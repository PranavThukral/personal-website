"use client";

/* eslint-disable @next/next/no-img-element -- cells draw =IMAGE() results, which can be any URL a visitor types, so next/image (which needs known hosts and sizes) doesn't fit. */

import Image from "next/image";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  TONES,
  bugs,
  cells as initialCells,
  chart,
  columnCount,
  columnWidths,
  frames,
  gantt,
  monthIndex,
  monthLabel,
  gapRows,
  playCell,
  rowHeights,
  sections,
  site,
  startCell,
  TECH_BRANDS,
  totalRows,
  type Cell,
  type Cells,
  type Style,
} from "./content";
import { CardsView } from "./cards-view";
import { display } from "./display";
import { Brand, Icon, type IconName } from "./icons";
import { Mark } from "./marks";
import {
  EASTER_EGGS,
  FormulaError,
  ImageValue,
  cellId,
  colName,
  createEvaluator,
  closeBrackets,
  openCall,
  parseRef,
  shiftFormula,
  suggestFunctions,
  type FunctionDoc,
  type Scalar,
} from "./formula";

const NCOLS = columnCount;
const NROWS = totalRows + 5;
const DEF_W = 56;
const DEF_H = 32;
const HEAD_W = 46;
const HEAD_H = 26;

type Pos = { c: number; r: number };
type Sel = { a: Pos; b: Pos };
type Edit = { draft: string; from: "cell" | "bar"; cell: string };
type Drag =
  | { kind: "select" }
  | { kind: "move"; start: Pos; off: Pos }
  | { kind: "fill"; to: Pos }
  | { kind: "point"; base: string; start: Pos }
  | { kind: "tap"; at: Pos; x: number; y: number }
  | { kind: "cols" }
  | { kind: "rows" }
  | { kind: "bar"; index: number; grab: number; off: number };
type Clip = { cells: (Cell | undefined)[][]; origin: Pos; text: string; cut: boolean };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Colours offered by the text and fill palettes: the section tones plus a few neutrals.
const PALETTE = [
  { name: "Orange", value: "#d9663f" },
  { name: "Blue", value: "#4170d0" },
  { name: "Violet", value: "#7b5fcf" },
  { name: "Green", value: "#2e8f6e" },
  { name: "Pink", value: "#c9578a" },
  { name: "Red", value: "#d14343" },
  { name: "Amber", value: "#c9921f" },
  { name: "Grey", value: "#8a8f98" },
];
type ToggleKey = "bold" | "italic" | "underline" | "strike";
// What "Clear formatting" removes, as in Excel: everything the toolbar can set, including the sheet's own
// number formats. Structural styles (titles, bands, headers, links) stay.
const FORMAT_KEYS = ["bold", "italic", "underline", "strike", "textColor", "fill", "align", "fmt", "decimals"] as const;
type MenuAction = "cut" | "copy" | "paste" | "fillDown" | "fillRight" | "sortAsc" | "sortDesc" | "clear" | "clearFormat" | "find" | "link";
const MENU: ({ action: MenuAction; label: string; hint?: string } | "sep")[] = [
  { action: "cut", label: "Cut", hint: "Ctrl+X" },
  { action: "copy", label: "Copy", hint: "Ctrl+C" },
  { action: "paste", label: "Paste", hint: "Ctrl+V" },
  "sep",
  { action: "fillDown", label: "Fill down", hint: "Ctrl+D" },
  { action: "fillRight", label: "Fill right", hint: "Ctrl+R" },
  { action: "sortAsc", label: "Sort A to Z" },
  { action: "sortDesc", label: "Sort Z to A" },
  "sep",
  { action: "clear", label: "Clear contents", hint: "Del" },
  { action: "clearFormat", label: "Clear formatting" },
  "sep",
  { action: "find", label: "Find", hint: "Ctrl+F" },
  { action: "link", label: "Copy link to cell" },
];
const bounds = (s: Sel) => ({
  c0: Math.min(s.a.c, s.b.c),
  c1: Math.max(s.a.c, s.b.c),
  r0: Math.min(s.a.r, s.b.r),
  r1: Math.max(s.a.r, s.b.r),
});
const isNumeric = (v: Scalar): v is number => typeof v === "number";
const pointable = (draft: string) => draft.startsWith("=") && /[=(,+\-*/^&<>:]\s*$/.test(draft);
const rangeText = (a: Pos, b: Pos) =>
  a.c === b.c && a.r === b.r ? cellId(a.c, a.r) : `${cellId(Math.min(a.c, b.c), Math.min(a.r, b.r))}:${cellId(Math.max(a.c, b.c), Math.max(a.r, b.r))}`;
const sectionAt = (r: number) => sections.find((s) => r >= s.start && r <= s.end) ?? sections[sections.length - 1];
const startPos = parseRef(startCell)!;

// The merged cell (if any) that covers q, by its anchor.
function mergeAnchor(cells: Cells, q: Pos): Pos {
  for (const [id, cell] of Object.entries(cells)) {
    const mg = cell.s?.merge;
    const a = mg && parseRef(id);
    if (a && q.c >= a.c && q.c < a.c + (mg.cols ?? 1) && q.r >= a.r && q.r < a.r + (mg.rows ?? 1)) return a;
  }
  return q;
}

// A merge never hides content. If an edit, fill, paste or sort leaves text under a merged cell, runs a merge off
// the sheet or overlaps two merges, the later merge is undone so everything stays visible. Undo brings it back.
function keepContentVisible(cells: Cells): Cells {
  const anchors = Object.keys(cells)
    .filter((id) => cells[id].s?.merge)
    .map((id) => ({ id, at: parseRef(id)! }))
    .filter((a) => a.at)
    .sort((a, b) => a.at.r - b.at.r || a.at.c - b.at.c);
  const covered = new Set<string>();
  let out: Cells | null = null;
  for (const { id, at } of anchors) {
    const cols = cells[id].s!.merge!.cols ?? 1;
    const rows = cells[id].s!.merge!.rows ?? 1;
    const span: string[] = [];
    let ok = !covered.has(id) && at.c + cols <= NCOLS && at.r + rows <= NROWS;
    for (let dr = 0; dr < rows && ok; dr++)
      for (let dc = 0; dc < cols && ok; dc++) {
        if (!dr && !dc) continue;
        const q = cellId(at.c + dc, at.r + dr);
        if (covered.has(q) || cells[q]?.s?.merge || (cells[q]?.v ?? "") !== "") ok = false;
        else span.push(q);
      }
    if (ok) {
      for (const q of span) covered.add(q);
    } else {
      const style = { ...cells[id].s };
      delete style.merge;
      out ??= { ...cells };
      out[id] = { ...cells[id], s: style };
    }
  }
  return out ?? cells;
}

// A critically damped spring (the smoothDamp curve games use). Retargeting mid-flight keeps the current
// velocity, so jumping back and forth between sections glides instead of stuttering. It runs on our own
// frames, so it animates even where the browser's smooth scrolling is turned off.
const SMOOTH_TIME = 0.2;
const INTERRUPTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

function smoothDamp(current: number, target: number, velocity: number, dt: number): [number, number] {
  const omega = 2 / SMOOTH_TIME;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
}

class SmoothScroller {
  running = false;
  private readonly el: HTMLElement;
  private top = 0;
  private left = 0;
  private vTop = 0;
  private vLeft = 0;
  private targetTop = 0;
  private targetLeft = 0;
  private frame = 0;
  private last = 0;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  to(top: number, left: number) {
    const el = this.el;
    this.targetTop = clamp(top, 0, Math.max(0, el.scrollHeight - el.clientHeight));
    this.targetLeft = clamp(left, 0, Math.max(0, el.scrollWidth - el.clientWidth));
    if (this.running) return;
    this.running = true;
    this.top = el.scrollTop;
    this.left = el.scrollLeft;
    this.vTop = 0;
    this.vLeft = 0;
    this.last = performance.now();
    for (const type of INTERRUPTS) el.addEventListener(type, this.stop, { passive: true });
    this.frame = requestAnimationFrame(this.step);
  }

  stop = () => {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frame);
    for (const type of INTERRUPTS) this.el.removeEventListener(type, this.stop);
  };

  private step = (now: number) => {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    [this.top, this.vTop] = smoothDamp(this.top, this.targetTop, this.vTop, dt);
    [this.left, this.vLeft] = smoothDamp(this.left, this.targetLeft, this.vLeft, dt);
    const settled =
      Math.abs(this.targetTop - this.top) < 1 &&
      Math.abs(this.targetLeft - this.left) < 1 &&
      Math.abs(this.vTop) + Math.abs(this.vLeft) < 40;
    this.el.scrollTop = settled ? this.targetTop : this.top;
    this.el.scrollLeft = settled ? this.targetLeft : this.left;
    if (settled) this.stop();
    else this.frame = requestAnimationFrame(this.step);
  };
}

// Rough text width so long text can spill into empty neighbours, the way spreadsheets do.
function textWidth(text: string, cell: Cell | undefined) {
  const s = cell?.s;
  const per = s?.title ? 17 : s?.kpi ? 15 : s?.sub ? 7.6 : 7.4;
  return text.length * per + 20;
}

// The theme lives on <html data-theme>, set before paint by the layout's script.
const subscribeTheme = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
};
const readTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function setTheme(next: "light" | "dark") {
  const apply = () => {
    document.documentElement.dataset.theme = next;
  };
  try {
    localStorage.setItem("theme", next);
  } catch {
    // Private windows can block storage; the theme still applies for this visit.
  }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
  else apply();
}

const NARROW = "(max-width: 600px)";
// Subscribe to the fitted scale, so widths outside the scaling range don't rerender the sheet.
const subscribeResize = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
const SHEET_W = columnWidths.reduce((a, b) => a + b, 0);
const readColumnScale = () =>
  window.innerWidth <= 600 ? 0.72 : Math.floor(clamp((window.innerWidth - HEAD_W - 28) / SHEET_W, 0.66, 1) * 100) / 100;
const subscribeNarrow = (cb: () => void) => {
  const mq = matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function Spreadsheet() {
  const uid = useId();
  const [cells, setCells] = useState<Cells>(initialCells);
  const [sel, setSel] = useState<Sel>({ a: startPos, b: startPos });
  const [edit, setEdit] = useState<Edit | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [past, setPast] = useState<Cells[]>([]);
  const [future, setFuture] = useState<Cells[]>([]);
  const [nameBox, setNameBox] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewSection, setViewSection] = useState(sections[0].id);
  // Phones default to cards; the toggle can switch to the full grid. Desktop is always the grid.
  const [viewOverride, setViewOverride] = useState<"cards" | "grid" | null>(null);
  const [party, setParty] = useState(0);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [suggestHidden, setSuggestHidden] = useState(false);
  // Custom column widths use the same unscaled units as the defaults; row heights stay in pixels.
  const [colW, setColW] = useState<Record<number, number>>({});
  const [rowH, setRowH] = useState<Record<number, number>>({});
  const [resizing, setResizing] = useState<"col" | "row" | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [palette, setPalette] = useState<"text" | "fill" | null>(null);
  const [find, setFind] = useState<{ query: string; index: number } | null>(null);
  // Cell comments: one can be pinned open (the welcome note starts that way); hovering shows any other.
  const [openNote, setOpenNote] = useState<string | null>("A1");
  const [hoverNote, setHoverNote] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<Edit | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const clipRef = useRef<Clip | null>(null);
  const scrollerRef = useRef<SmoothScroller | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const cardsScrollerRef = useRef<SmoothScroller | null>(null);
  const cardSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const popRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const gliderRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<CanvasRenderingContext2D | null>(null);
  // The fill handle's pointer is captured by the grid, so its double-click is detected from two quick presses.
  const lastFillPressRef = useRef(0);
  const skipDoubleClickRef = useRef(false);

  useEffect(() => {
    editRef.current = edit;
  }, [edit]);

  const narrow = useSyncExternalStore(subscribeNarrow, () => matchMedia(NARROW).matches, () => false);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light");

  // With no saved choice, keep following the system setting while the page is open.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("theme");
      } catch {}
      if (saved !== "light" && saved !== "dark") document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
    };
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, []);
  const headW = narrow ? 30 : HEAD_W;
  const cardsView = narrow && viewOverride !== "grid";
  const { c0, c1, r0, r1 } = bounds(sel);
  // Phones get compact columns; between phone and full desktop the columns shrink so the whole sheet fits the
  // window without sideways scrolling (down to two-thirds width, below which it scrolls as a sheet would).
  const colScale = useSyncExternalStore(subscribeResize, readColumnScale, () => 1);
  const widths = useMemo(
    () => Array.from({ length: NCOLS }, (_, i) => Math.floor((colW[i] ?? columnWidths[i] ?? DEF_W) * colScale)),
    [colScale, colW],
  );
  const heights = useMemo(
    () => Array.from({ length: NROWS }, (_, i) => rowH[i] ?? (narrow && gapRows.includes(i) ? 26 : (rowHeights[i] ?? DEF_H))),
    [narrow, rowH],
  );
  const xs = useMemo(() => widths.reduce<number[]>((acc, w, i) => [...acc, acc[i] + w], [0]), [widths]);
  const ys = useMemo(() => heights.reduce<number[]>((acc, h, i) => [...acc, acc[i] + h], [0]), [heights]);

  const value = useMemo(() => createEvaluator((id) => cells[id]?.v ?? ""), [cells]);
  const fixed = useMemo(() => new Set(bugs.filter((b) => b.check(value)).map((b) => b.id)), [value]);

  // Merged cells: every covered cell points at the anchor cell that holds the content.
  const merges = useMemo(() => {
    const owner = new Map<string, string>();
    for (const [id, cell] of Object.entries(cells)) {
      const mg = cell.s?.merge;
      const at = mg && parseRef(id);
      if (!at) continue;
      for (let dr = 0; dr < (mg.rows ?? 1); dr++)
        for (let dc = 0; dc < (mg.cols ?? 1); dc++) if (dr || dc) owner.set(cellId(at.c + dc, at.r + dr), id);
    }
    return owner;
  }, [cells]);
  const anchorOf = (q: Pos) => {
    const owner = merges.get(cellId(q.c, q.r));
    return owner ? parseRef(owner)! : q;
  };
  const extentOf = (q: Pos) => {
    const mg = cells[cellId(q.c, q.r)]?.s?.merge;
    return { c1: q.c + (mg?.cols ?? 1) - 1, r1: q.r + (mg?.rows ?? 1) - 1 };
  };
  // The active cell is always a visible one: landing inside a merge (name box, a #B4 link) means its anchor.
  const cur = anchorOf(sel.a);
  const curId = cellId(cur.c, cur.r);
  const curSection = sectionAt(cur.r);

  // The Gantt's bars come straight from each row's Start and End cells.
  const bars = useMemo(
    () =>
      gantt.rows.map((g, index) => {
        const startText = display(value(g.start), cells[g.start]);
        const endText = display(value(g.end), cells[g.end]);
        const s0 = monthIndex(startText);
        const e0 = monthIndex(endText);
        // Dates entirely off the chart draw nothing rather than a clipped sliver at the edge.
        const ok = s0 !== null && e0 !== null && e0 >= s0 && e0 >= 0 && s0 <= gantt.months - 1;
        const isFormula = (id: string) => (cells[id]?.v ?? "").startsWith("=");
        return {
          ...g,
          index,
          s: ok ? clamp(s0, 0, gantt.months - 1) : -1,
          e: ok ? clamp(e0, 0, gantt.months - 1) : -1,
          ongoing: endText.trim().toLowerCase() === "now",
          // Only bars that sit fully on the chart and come from typed dates can be dragged, so a drop never
          // rewrites dates the chart had to clip or replaces a formula with a literal.
          draggable: ok && s0 >= 0 && e0 <= gantt.months - 1 && !isFormula(g.start) && !isFormula(g.end),
        };
      }),
    [value, cells],
  );
  const barAt = (q: Pos) => {
    const bar = bars.find((b) => b.row === q.r);
    if (!bar || !bar.draggable) return null;
    const m = q.c - gantt.firstCol;
    return m >= bar.s && m <= bar.e ? bar : null;
  };
  // How far a bar can move. A bar ending "now" keeps its end, so only its start slides (up to that end).
  const barShift = (bar: (typeof bars)[number], off: number) =>
    clamp(off, -bar.s, bar.ongoing ? bar.e - bar.s : gantt.months - 1 - bar.e);
  const frameCells = useMemo(() => {
    const ids = new Set<string>();
    for (const f of frames) for (let r = f.r0; r <= f.r1; r++) for (let c = f.c0; c <= f.c1; c++) ids.add(cellId(c, r));
    return ids;
  }, []);

  const commitCells = useCallback(
    (edited: Cells) => {
      const next = keepContentVisible(edited);
      // Say so when an edit had to unmerge cells, rather than changing the layout silently.
      if (next !== edited) setToast("Unmerged some cells so nothing is hidden. Ctrl+Z puts them back.");
      // Fixing one of the sheet's bugs unlocks its reward text in the same edit, so undo removes both.
      const get = createEvaluator((id) => next[id]?.v ?? "");
      const newly = bugs.filter((b) => !fixed.has(b.id) && b.check(get));
      let final = next;
      if (newly.length) {
        final = { ...next };
        for (const b of newly) if (!final[b.reward.cell]?.v) final[b.reward.cell] = { v: b.reward.text, s: { reward: true } };
        const total = bugs.filter((b) => b.check(get)).length;
        if (total === bugs.length) {
          setToast(`All ${bugs.length} bugs fixed. You'd make a good code reviewer. Say hi: ${site.email}`);
          setParty((n) => n + 1);
        } else {
          setToast(`Bug fixed, ${total} of ${bugs.length}. ${newly[0].done}`);
        }
      } else {
        // An edit that fixes nothing retires an earlier "Bug fixed" message, so it can't look like this edit's result.
        setToast((t) => (t && /^(Bug fixed|All \d+ bugs fixed)/.test(t) ? null : t));
      }
      setPast((p) => [...p.slice(-99), cells]);
      setFuture([]);
      setCells(final);
    },
    [cells, fixed],
  );

  const undo = useCallback(() => {
    if (!past.length) return;
    setFuture((f) => [cells, ...f]);
    setCells(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }, [cells, past]);

  const redo = useCallback(() => {
    if (!future.length) return;
    setPast((p) => [...p, cells]);
    setCells(future[0]);
    setFuture((f) => f.slice(1));
  }, [cells, future]);

  const flash = useCallback((text: string) => setToast(text), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useLayoutEffect(() => {
    const pop = popRef.current;
    const view = scrollRef.current;
    if (!pop || !view) return;
    if (edit?.from === "cell") {
      const box = { left: headW + xs[cur.c], top: HEAD_H + ys[cur.r], height: ys[cur.r + 1] - ys[cur.r] };
      pop.style.left = `${box.left}px`;
      pop.style.top = `${box.top + box.height + 4}px`;
      const viewRect = view.getBoundingClientRect();
      if (pop.getBoundingClientRect().bottom > viewRect.bottom - 8) {
        pop.style.top = `${box.top - pop.offsetHeight - 4}px`;
      }
      const over = pop.getBoundingClientRect().right - (viewRect.right - 8);
      if (over > 0) pop.style.left = `${Math.max(view.scrollLeft + headW, box.left - over)}px`;
    }
    const list = pop.querySelector("ul");
    const item = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (list && item) {
      if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
      else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
    }
  });

  // The current-section highlight slides between tabs.
  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    const glider = gliderRef.current;
    if (!tabs || !glider) return;
    const place = (reveal = false) => {
      const active = tabs.querySelector<HTMLElement>('.tab[aria-current="true"]');
      if (!active) return;
      if (reveal && (active.offsetLeft < tabs.scrollLeft || active.offsetLeft + active.offsetWidth > tabs.scrollLeft + tabs.clientWidth)) {
        tabs.scrollTo({ left: active.offsetLeft - 16, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
      glider.style.transform = `translateX(${active.offsetLeft}px)`;
      glider.style.width = `${active.offsetWidth}px`;
      glider.style.setProperty("--tone", sections.find((s) => s.id === viewSection)!.tone);
    };
    place(true);
    // Only animate after the first placement, so it doesn't slide in from the left on load.
    requestAnimationFrame(() => glider.classList.add("is-ready"));
    const ro = new ResizeObserver(() => place());
    ro.observe(tabs);
    return () => ro.disconnect();
  }, [viewSection, narrow]);

  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(0), 2400);
    return () => clearTimeout(t);
  }, [party]);

  useEffect(
    () => () => {
      scrollerRef.current?.stop();
      cardsScrollerRef.current?.stop();
    },
    [],
  );

  // Keep the active cell visible below the sticky headers.
  const reveal = useCallback(
    (p: Pos) => {
      const el = scrollRef.current;
      if (!el) return;
      scrollerRef.current?.stop();
      const viewW = el.clientWidth - headW;
      const viewH = el.clientHeight - HEAD_H;
      if (xs[p.c] < el.scrollLeft) el.scrollLeft = xs[p.c];
      else if (xs[p.c + 1] > el.scrollLeft + viewW) el.scrollLeft = xs[p.c + 1] - viewW;
      if (ys[p.r] < el.scrollTop) el.scrollTop = ys[p.r];
      else if (ys[p.r + 1] > el.scrollTop + viewH) el.scrollTop = ys[p.r + 1] - viewH;
    },
    [xs, ys, headW],
  );

  const focusGrid = () => gridRef.current?.focus({ preventScroll: true });

  // Links like /#E17 or /#A12:F16 open with that cell or range selected.
  useEffect(() => {
    let hash = "";
    try {
      hash = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const [from, to] = hash.split(":");
    const a = parseRef(from ?? "");
    const b = parseRef(to ?? from ?? "");
    if (!a || !b || a.c >= NCOLS || b.c >= NCOLS || a.r >= NROWS || b.r >= NROWS) return;
    // A link to a cell inside a merge opens the merged cell.
    const one = to === undefined ? mergeAnchor(initialCells, a) : null;
    const frame = requestAnimationFrame(() => {
      setSel(one ? { a: one, b: one } : { a, b });
      reveal(one ?? a);
      document.querySelector(`.cards .field[title="${cellId(a.c, a.r)}"]`)?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
    // Only on first load; later hash changes come from the visitor's own navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The context menu and colour palettes close on any outside press, scroll or resize.
  useEffect(() => {
    if (!menu && !palette) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (menu && !menuRef.current?.contains(target)) setMenu(null);
      if (palette && !target?.closest?.(".tool-wrap")) setPalette(null);
    };
    const close = () => {
      setMenu(null);
      setPalette(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", close);
    const view = scrollRef.current;
    view?.addEventListener("scroll", close, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", close);
      view?.removeEventListener("scroll", close);
    };
  }, [menu, palette]);

  // Keep the menu on screen and put keyboard focus on its first item.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || !menu) return;
    const rect = el.getBoundingClientRect();
    el.style.left = `${clamp(rect.left, 8, Math.max(8, innerWidth - rect.width - 8))}px`;
    el.style.top = `${clamp(rect.top, 8, Math.max(8, innerHeight - rect.height - 8))}px`;
    el.querySelector<HTMLButtonElement>(".menu-item")?.focus();
  }, [menu]);

  const glide = (top: number, left: number, target: "grid" | "cards" = "grid") => {
    const el = target === "grid" ? scrollRef.current : cardsRef.current;
    const scroller = target === "grid" ? scrollerRef : cardsScrollerRef;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollTo({ top, left });
      return;
    }
    scroller.current ??= new SmoothScroller(el);
    scroller.current.to(top, left);
  };

  // Tabs jump to a section with a smooth scroll; the active tab follows the scroll position.
  const jumpTo = (id: string) => {
    const section = sections.find((s) => s.id === id)!;
    if (edit) commitEdit();
    setToast(null);
    setViewSection(id);
    // Land on the first row of content, below the section band and its column headings.
    const p = { c: 0, r: section.id === sections[0].id ? section.start : section.start + 2 };
    setSel({ a: p, b: p });
    if (cardsView) {
      const el = cardSectionRefs.current[id];
      if (el) glide(el.offsetTop, 0, "cards");
      return;
    }
    focusGrid();
    glide(ys[section.start], 0);
  };

  // The bug counter takes you to the next unfixed bug.
  const jumpToBug = () => {
    const bug = bugs.find((b) => !fixed.has(b.id));
    if (!bug) return;
    if (edit) commitEdit();
    const p = parseRef(bug.cell)!;
    setSel({ a: p, b: p });
    setToast(null);
    const go = () => {
      const el = scrollRef.current;
      if (!el) return;
      focusGrid();
      const top = Math.max(0, ys[p.r] - el.clientHeight / 3);
      const viewW = el.clientWidth - headW;
      const left = xs[p.c + 1] > viewW ? xs[p.c + 1] - viewW + 24 : 0;
      glide(top, left);
    };
    // Bugs are fixed by dragging and filling, so the counter opens the grid on phones.
    if (cardsView) {
      setViewOverride("grid");
      requestAnimationFrame(() => requestAnimationFrame(go));
    } else go();
  };

  // Tapping a card selects it for context. The formula bar opens only for the playground;
  // editing other cells is an explicit choice through Grid view.
  const selectCell = (id: string) => {
    if (editRef.current) commitEdit();
    const p = parseRef(id)!;
    setSel({ a: p, b: p });
  };

  const playIn = (id: string) => {
    selectCell(id);
    requestAnimationFrame(() => barRef.current?.focus());
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      // A tab jump already set the current section; don't flicker through the ones it passes.
      if (scrollerRef.current?.running) return;
      const top = el.scrollTop + 8;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      const row = ys.findIndex((y, i) => i > 0 && y > top) - 1;
      const id = atBottom ? sections[sections.length - 1].id : sectionAt(Math.max(0, row)).id;
      setViewSection((prev) => (prev === id ? prev : id));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ys]);

  useEffect(() => {
    const box = cardsRef.current;
    if (!box) return;
    const onScroll = () => {
      if (cardsScrollerRef.current?.running) return;
      const top = box.scrollTop + 24;
      let id = sections[0].id;
      for (const s of sections) {
        const el = cardSectionRefs.current[s.id];
        if (el && el.offsetTop <= top) id = s.id;
      }
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) id = sections[sections.length - 1].id;
      setViewSection((prev) => (prev === id ? prev : id));
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => box.removeEventListener("scroll", onScroll);
  }, []);

  const changeDraft = (draft: string, from: Edit["from"], cell = edit?.cell ?? curId) => {
    setEdit({ draft, from, cell });
    setSuggestIndex(0);
    setSuggestHidden(false);
  };

  const beginEdit = (draft: string, from: Edit["from"] = "cell") => {
    reveal(cur);
    changeDraft(draft, from, curId);
  };

  // Typing = or a function name opens a dropdown of every function, easter eggs included.
  const suggestions = edit && !suggestHidden ? suggestFunctions(edit.draft) : null;
  const activeSuggest = suggestions ? Math.min(suggestIndex, suggestions.items.length - 1) : 0;
  const argHint = edit && !suggestions ? openCall(edit.draft) : null;

  const acceptSuggestion = (doc: FunctionDoc) => {
    if (!edit || !suggestions) return;
    const base = edit.draft.slice(0, edit.draft.length - suggestions.prefix.length);
    changeDraft(base + doc.name + (doc.args ? "(" : "()"), edit.from);
  };

  const commitEdit = useCallback(
    (move?: Pos) => {
      const e = editRef.current;
      if (!e) return;
      editRef.current = null;
      setEdit(null);
      const draft = closeBrackets(e.draft);
      const id = e.cell;
      const prev = cells[id];
      if (draft !== (prev?.v ?? "")) {
        const next = { ...cells };
        if (draft === "" && !prev?.s) delete next[id];
        else next[id] = { ...prev, v: draft };
        commitCells(next);
        const egg = /^=\s*([A-Za-z]+)\(\s*\)\s*$/.exec(draft)?.[1]?.toUpperCase();
        // An egg's own one-liner wins only when the edit didn't also fix a bug.
        if (egg && EASTER_EGGS[egg] && !bugs.some((b) => b.cell === id)) flash(EASTER_EGGS[egg]);
      }
      if (move) {
        // Step off a merged cell from its far edge, and land on the anchor of any merge stepped into.
        const at = parseRef(id)!;
        const mg = cells[id]?.s?.merge;
        const from = { c: move.c > 0 ? at.c + (mg?.cols ?? 1) - 1 : at.c, r: move.r > 0 ? at.r + (mg?.rows ?? 1) - 1 : at.r };
        const p = mergeAnchor(cells, { c: clamp(from.c + move.c, 0, NCOLS - 1), r: clamp(from.r + move.r, 0, NROWS - 1) });
        setSel({ a: p, b: p });
        reveal(p);
      }
      focusGrid();
    },
    [cells, commitCells, reveal, flash],
  );

  const cancelEdit = () => {
    editRef.current = null;
    setEdit(null);
    focusGrid();
  };

  useEffect(() => {
    if (edit?.from === "cell") {
      const input = editorRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }
  }, [edit?.from]);

  // ---------- pointer ----------

  const posFromEvent = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const view = scrollRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - headW;
    const y = e.clientY - rect.top - HEAD_H;
    let c = xs.findIndex((edge, i) => i > 0 && x < edge) - 1;
    let r = ys.findIndex((edge, i) => i > 0 && y < edge) - 1;
    if (c < 0) c = x < 0 ? -1 : NCOLS - 1;
    if (r < 0) r = y < 0 ? -1 : NROWS - 1;
    // Headers are sticky, so decide header hits against the visible viewport.
    if (e.clientX - view.left < headW) c = -1;
    if (e.clientY - view.top < HEAD_H) r = -1;
    return { c, r };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const hit = posFromEvent(e);
    const p = { c: clamp(hit.c, 0, NCOLS - 1), r: clamp(hit.r, 0, NROWS - 1) };

    if (edit && pointable(edit.draft)) {
      e.preventDefault();
      dragRef.current = { kind: "point", base: edit.draft, start: p };
      setEdit({ ...edit, draft: edit.draft + cellId(p.c, p.r) });
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (edit) commitEdit();

    if (hit.c < 0 && hit.r < 0) {
      setSel({ a: { c: 0, r: 0 }, b: { c: NCOLS - 1, r: NROWS - 1 } });
      focusGrid();
      return;
    }
    // Header clicks select whole columns or rows; dragging across headers selects several.
    if (hit.r < 0) {
      e.preventDefault();
      setSel({ a: e.shiftKey ? { c: sel.a.c, r: 0 } : { c: p.c, r: 0 }, b: { c: p.c, r: NROWS - 1 } });
      dragRef.current = { kind: "cols" };
      canvasRef.current?.setPointerCapture(e.pointerId);
      focusGrid();
      return;
    }
    if (hit.c < 0) {
      e.preventDefault();
      setSel({ a: e.shiftKey ? { c: 0, r: sel.a.r } : { c: 0, r: p.r }, b: { c: NCOLS - 1, r: p.r } });
      dragRef.current = { kind: "rows" };
      canvasRef.current?.setPointerCapture(e.pointerId);
      focusGrid();
      return;
    }
    const target = anchorOf(p);
    // Dragging a Gantt bar moves its dates; the bar's Start and End cells update when it drops. Bars ignore
    // touch panning (touch-action: none), so this works with a finger too.
    const bar = barAt(p);
    if (bar && !e.shiftKey) {
      e.preventDefault();
      focusGrid();
      setSel({ a: p, b: p });
      const d: Drag = { kind: "bar", index: bar.index, grab: p.c, off: 0 };
      dragRef.current = d;
      setDrag(d);
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (e.pointerType === "touch") {
      dragRef.current = { kind: "tap", at: target, x: e.clientX, y: e.clientY };
      return;
    }
    e.preventDefault();
    focusGrid();
    // Checkboxes toggle on click, as in Sheets.
    if (!e.shiftKey && cells[cellId(target.c, target.r)]?.s?.checkbox) toggleCheckbox(target);
    setSel(e.shiftKey ? { a: sel.a, b: p } : { a: target, b: target });
    dragRef.current = { kind: "select" };
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const toggleCheckbox = (q: Pos) => {
    const id = cellId(q.c, q.r);
    const cell = cells[id];
    if (!cell) return;
    commitCells({ ...cells, [id]: { ...cell, v: value(id) === true ? "FALSE" : "TRUE" } });
  };

  // Hovering a cell with a comment shows it, the way spreadsheets show notes.
  const trackHover = (e: React.PointerEvent) => {
    const hit = posFromEvent(e);
    let id: string | null = null;
    if (hit.r >= 0 && hit.c >= 0) {
      const q = anchorOf({ c: hit.c, r: hit.r });
      const ref = cellId(q.c, q.r);
      if (cells[ref]?.s?.note) id = ref;
    }
    if (id !== hoverNote) setHoverNote(id);
  };

  const onHandleDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const kind = e.currentTarget.dataset.drag === "fill" ? "fill" : "move";
    e.stopPropagation();
    e.preventDefault();
    if (edit) commitEdit();
    if (kind === "fill") {
      if (e.timeStamp - lastFillPressRef.current < 400) {
        lastFillPressRef.current = 0;
        skipDoubleClickRef.current = true;
        setTimeout(() => {
          skipDoubleClickRef.current = false;
        }, 500);
        autoFillDown();
        return;
      }
      lastFillPressRef.current = e.timeStamp;
    }
    const hit = posFromEvent(e);
    // Edges sit a few pixels outside the selection; measure the drag from inside it so drops land where aimed.
    const start = { c: clamp(hit.c, c0, c1), r: clamp(hit.r, r0, r1) };
    const next: Drag = kind === "move" ? { kind, start, off: { c: 0, r: 0 } } : { kind, to: { c: c1, r: r1 } };
    dragRef.current = next;
    setDrag(next);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) {
      if (e.pointerType === "mouse") trackHover(e);
      return;
    }
    const hit = posFromEvent(e);
    const p = { c: clamp(hit.c, 0, NCOLS - 1), r: clamp(hit.r, 0, NROWS - 1) };
    if (d.kind === "tap") {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) dragRef.current = null;
    } else if (d.kind === "bar") {
      const bar = bars[d.index];
      if (!bar?.draggable) return;
      const off = barShift(bar, p.c - d.grab);
      if (off !== d.off) {
        const next = { ...d, off };
        dragRef.current = next;
        setDrag(next);
      }
    } else if (d.kind === "cols") {
      if (p.c !== sel.b.c) setSel({ a: { c: sel.a.c, r: 0 }, b: { c: p.c, r: NROWS - 1 } });
    } else if (d.kind === "rows") {
      if (p.r !== sel.b.r) setSel({ a: { c: 0, r: sel.a.r }, b: { c: NCOLS - 1, r: p.r } });
    } else if (d.kind === "select") {
      if (p.c !== sel.b.c || p.r !== sel.b.r) setSel({ a: sel.a, b: p });
    } else if (d.kind === "point") {
      setEdit((ed) => (ed ? { ...ed, draft: d.base + rangeText(d.start, p) } : ed));
    } else if (d.kind === "move") {
      const off = {
        c: clamp(p.c - d.start.c, -c0, NCOLS - 1 - c1),
        r: clamp(p.r - d.start.r, -r0, NROWS - 1 - r1),
      };
      const next = { ...d, off };
      dragRef.current = next;
      setDrag(next);
    } else {
      const next = { ...d, to: p };
      dragRef.current = next;
      setDrag(next);
    }
  };

  const fillRange = (to: Pos) => {
    const vertical = Math.max(to.r - r1, r0 - to.r, 0) >= Math.max(to.c - c1, c0 - to.c, 0);
    if (vertical) return { c0, c1, r0: Math.min(r0, to.r), r1: Math.max(r1, to.r) };
    return { c0: Math.min(c0, to.c), c1: Math.max(c1, to.c), r0, r1 };
  };

  // Fill copies the selection's pattern and shifts formulas; evenly spaced numbers continue as a series.
  const fillTo = (to: Pos) => {
    const f = fillRange(to);
    if (f.c0 === c0 && f.c1 === c1 && f.r0 === r0 && f.r1 === r1) return;
    const next = { ...cells };
    const h = r1 - r0 + 1;
    const w = c1 - c0 + 1;
    const vertical = f.c0 === c0 && f.c1 === c1;
    const series = (ids: string[]) => {
      if (ids.length < 2) return null;
      const nums = ids.map((id) => (cells[id]?.v ?? "").trim()).map((v) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN));
      if (nums.some(Number.isNaN)) return null;
      const d = nums[1] - nums[0];
      return nums.every((n, i) => i === 0 || Math.abs(n - nums[i - 1] - d) < 1e-9) ? { first: nums[0], last: nums[nums.length - 1], d } : null;
    };
    for (let r = f.r0; r <= f.r1; r++)
      for (let c = f.c0; c <= f.c1; c++) {
        if (r >= r0 && r <= r1 && c >= c0 && c <= c1) continue;
        const id = cellId(c, r);
        const line = vertical
          ? Array.from({ length: h }, (_, i) => cellId(c, r0 + i))
          : Array.from({ length: w }, (_, j) => cellId(c0 + j, r));
        const run = series(line);
        if (run) {
          const k = vertical ? (r > r1 ? r - r1 : r - r0) : c > c1 ? c - c1 : c - c0;
          const n = k > 0 ? run.last + run.d * k : run.first + run.d * k;
          next[id] = { ...cells[line[0]], v: String(Math.round(n * 1e9) / 1e9) };
          continue;
        }
        const sr = r0 + ((((r - r0) % h) + h) % h);
        const sc = c0 + ((((c - c0) % w) + w) % w);
        const src = cells[cellId(sc, sr)];
        if (src) next[id] = { ...src, v: shiftFormula(src.v, c - sc, r - sr) };
        else delete next[id];
      }
    commitCells(next);
    setSel({ a: { c: f.c0, r: f.r0 }, b: { c: f.c1, r: f.r1 } });
  };

  // Double-clicking the fill handle fills down as far as the data in the neighbouring column goes.
  const autoFillDown = () => {
    const filledAt = (c: number, r: number) => c >= 0 && c < NCOLS && r < NROWS && !!display(value(cellId(c, r)), cells[cellId(c, r)]);
    const side = filledAt(c0 - 1, r1 + 1) ? c0 - 1 : filledAt(c1 + 1, r1 + 1) ? c1 + 1 : null;
    if (side === null) return;
    let end = r1;
    while (end + 1 < NROWS && filledAt(side, end + 1)) end++;
    if (end > r1) fillTo({ c: c1, r: end });
  };

  // Dragging a header edge resizes; the pointer stays captured on the edge until release.
  const startResize = (e: React.PointerEvent<HTMLElement>, axis: "col" | "row") => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const index = Number(e.currentTarget.dataset.index);
    const origin = axis === "col" ? e.clientX : e.clientY;
    const size = axis === "col" ? widths[index] : heights[index];
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setResizing(axis);
    const move = (ev: PointerEvent) => {
      const delta = (axis === "col" ? ev.clientX : ev.clientY) - origin;
      const next = axis === "col" ? clamp(Math.round(size + delta), 36, 640) / colScale : clamp(Math.round(size + delta), 22, 200);
      (axis === "col" ? setColW : setRowH)((m) => (m[index] === next ? m : { ...m, [index]: next }));
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      setResizing(null);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  // Double-clicking a column edge fits the column to its widest text; a row edge goes back to default.
  const autoFit = (e: React.MouseEvent<HTMLElement>, axis: "col" | "row") => {
    e.stopPropagation();
    const index = Number(e.currentTarget.dataset.index);
    if (axis === "row") {
      setRowH((m) => {
        const next = { ...m };
        delete next[index];
        return next;
      });
      return;
    }
    measureRef.current ??= document.createElement("canvas").getContext("2d");
    const ctx = measureRef.current;
    if (!ctx) return;
    let widest = 0;
    for (let r = 0; r < NROWS; r++) {
      const el = document.getElementById(`${uid}-${cellId(index, r)}`);
      const text = el?.querySelector(".cell-text")?.textContent;
      if (!el || !text || el.classList.contains("is-spill") || el.classList.contains("is-band") || cells[cellId(index, r)]?.s?.merge) continue;
      const st = getComputedStyle(el);
      ctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      widest = Math.max(widest, ctx.measureText(text).width + 22 + (el.querySelector("svg") ? 18 : 0));
    }
    setColW((m) => ({ ...m, [index]: clamp(Math.ceil(widest) || DEF_W, 40, 640) / colScale }));
  };

  const onPointerCancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d) return;
    if (d.kind === "point") {
      (editRef.current?.from === "bar" ? barRef.current : editorRef.current)?.focus();
    } else if (d.kind === "tap") {
      setSel({ a: d.at, b: d.at });
      if (cells[cellId(d.at.c, d.at.r)]?.s?.checkbox) toggleCheckbox(d.at);
      focusGrid();
    } else if (d.kind === "bar" && d.off && bars[d.index]?.draggable) {
      // Re-clamp against the bar as it is now, in case its dates changed mid-drag.
      const bar = bars[d.index];
      const off = barShift(bar, d.off);
      const from = monthLabel(bar.s + off);
      const to = bar.ongoing ? "now" : monthLabel(bar.e + off);
      const next = { ...cells, [bar.start]: { ...cells[bar.start], v: from } };
      if (!bar.ongoing) next[bar.end] = { ...cells[bar.end], v: to };
      flash(`Moved ${display(value(bar.name), cells[bar.name])} to ${from} – ${to}.`);
      commitCells(next);
    } else if (d.kind === "move" && (d.off.c || d.off.r)) {
      const next = { ...cells };
      const moved: Cells = {};
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const id = cellId(c, r);
          if (cells[id]) moved[cellId(c + d.off.c, r + d.off.r)] = cells[id];
          delete next[id];
        }
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) delete next[cellId(c + d.off.c, r + d.off.r)];
      Object.assign(next, moved);
      // Announce the move first so a bug fix made by this move gets the last word.
      flash(`Moved ${rangeText({ c: c0, r: r0 }, { c: c1, r: r1 })}`);
      commitCells(next);
      setSel({ a: { c: sel.a.c + d.off.c, r: sel.a.r + d.off.r }, b: { c: sel.b.c + d.off.c, r: sel.b.r + d.off.r } });
    } else if (d.kind === "fill") {
      fillTo(d.to);
    }
  };

  // ---------- keyboard ----------

  const clearRange = () => {
    const next = { ...cells };
    let changed = false;
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const id = cellId(c, r);
        if (next[id]) {
          changed = true;
          if (next[id].s) next[id] = { ...next[id], v: "" };
          else delete next[id];
        }
      }
    if (changed) commitCells(next);
  };

  // Formatting applies to every cell in the selection, creating empty styled cells where needed.
  const applyStyle = (patch: (s: Style | undefined, id: string) => Style | undefined) => {
    const next = { ...cells };
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const id = cellId(c, r);
        const cell = next[id];
        const style = patch(cell?.s, id);
        if (!cell && !style) continue;
        next[id] = { ...(cell ?? { v: "" }), s: style };
      }
    commitCells(next);
  };

  const toggleStyle = (key: ToggleKey) => {
    let all = true;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!cells[cellId(c, r)]?.s?.[key]) all = false;
    applyStyle((st) => ({ ...st, [key]: !all }));
  };

  const setFormat = (patch: Partial<Style>) => applyStyle((st) => ({ ...st, ...patch }));

  const changeDecimals = (delta: number) =>
    applyStyle((st, id) => {
      const v = value(id);
      const shown = typeof v === "number" ? display(v, { v: "", s: st }) : "";
      const current = st?.decimals ?? (shown.replace(/[^0-9.]/g, "").split(".")[1]?.length ?? 0);
      return { ...st, decimals: clamp(current + delta, 0, 6) };
    });

  const clearFormatting = () =>
    applyStyle((st) => {
      if (!st) return st;
      const rest = { ...st };
      for (const key of FORMAT_KEYS) delete rest[key];
      return rest;
    });

  // Ctrl+D / Ctrl+R: copy the first row (or column) of the selection into the rest, or the one before it.
  const fillDirection = (dir: "down" | "right") => {
    const next = { ...cells };
    const copy = (from: string, to: string, dc: number, dr: number) => {
      const src = cells[from];
      if (src) next[to] = { ...src, v: shiftFormula(src.v, dc, dr) };
      else delete next[to];
    };
    if (dir === "down") {
      const src = r1 > r0 ? r0 : r0 - 1;
      if (src < 0) return;
      for (let r = src + 1; r <= r1; r++) for (let c = c0; c <= c1; c++) copy(cellId(c, src), cellId(c, r), 0, r - src);
    } else {
      const src = c1 > c0 ? c0 : c0 - 1;
      if (src < 0) return;
      for (let c = src + 1; c <= c1; c++) for (let r = r0; r <= r1; r++) copy(cellId(src, r), cellId(c, r), c - src, 0);
    }
    commitCells(next);
  };

  // Sorts the selected rows by the active cell's column. Blanks go last and formulas are re-pointed.
  const sortRange = (dir: 1 | -1) => {
    if (r1 === r0) {
      flash("Select two or more rows to sort.");
      return;
    }
    // Like Sheets, rows can be sorted only when every merged cell is one row tall and fully inside the selection.
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const id = cellId(c, r);
        const mg = cells[id]?.s?.merge;
        const owner = merges.get(id);
        const splits = (mg && ((mg.rows ?? 1) > 1 || c + (mg.cols ?? 1) - 1 > c1)) || (owner && parseRef(owner)!.c < c0);
        if (splits) {
          flash("To sort, select whole merged cells, one row tall each.");
          return;
        }
      }
    const key = cur.c;
    const order = Array.from({ length: r1 - r0 + 1 }, (_, i) => r0 + i).sort((a, b) => {
      const x = value(cellId(key, a));
      const y = value(cellId(key, b));
      const ex = x === null || x === "";
      const ey = y === null || y === "";
      if (ex || ey) return ex === ey ? 0 : ex ? 1 : -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      if (typeof x === "number") return -dir;
      if (typeof y === "number") return dir;
      return String(x).localeCompare(String(y)) * dir;
    });
    flash(`Sorted ${rangeText({ c: c0, r: r0 }, { c: c1, r: r1 })} by column ${colName(key)}.`);
    const next = { ...cells };
    order.forEach((from, i) => {
      const to = r0 + i;
      for (let c = c0; c <= c1; c++) {
        const src = cells[cellId(c, from)];
        const id = cellId(c, to);
        if (src) next[id] = { ...src, v: shiftFormula(src.v, 0, to - from) };
        else delete next[id];
      }
    });
    commitCells(next);
  };

  const copyLink = () => {
    const url = `${location.origin}${location.pathname}#${rangeText(sel.a, sel.b)}`;
    if (!navigator.clipboard) {
      flash(url);
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => flash(`Link copied: ${url}`),
      () => flash(url),
    );
  };

  // Ctrl+Arrow: jump to the edge of the current block of data, or to the next filled cell.
  const filledCell = (q: Pos) => !!display(value(cellId(q.c, q.r)), cells[cellId(q.c, q.r)]);
  const edgeFrom = (from: Pos, d: Pos) => {
    const inside = (q: Pos) => q.c >= 0 && q.c < NCOLS && q.r >= 0 && q.r < NROWS;
    const step = (q: Pos) => ({ c: q.c + d.c, r: q.r + d.r });
    let q = from;
    if (!inside(step(q))) return q;
    if (filledCell(q) && filledCell(step(q))) {
      while (inside(step(q)) && filledCell(step(q))) q = step(q);
      return q;
    }
    q = step(q);
    while (inside(step(q)) && !filledCell(q)) q = step(q);
    return q;
  };

  const lastUsed = () => {
    let last = { c: 0, r: 0 };
    for (const id of Object.keys(cells)) {
      const q = parseRef(id);
      if (q && cells[id].v !== "") last = { c: Math.max(last.c, q.c), r: Math.max(last.r, q.r) };
    }
    return last;
  };

  const openFind = () => {
    setMenu(null);
    setFind((f) => f ?? { query: "", index: -1 });
    requestAnimationFrame(() => {
      findRef.current?.focus();
      findRef.current?.select();
    });
  };

  const closeFind = () => {
    setFind(null);
    focusGrid();
  };

  const openMenuAtCell = () => {
    reveal(cur);
    const el = document.getElementById(`${uid}-${coveredBy.get(curId) ?? curId}`);
    const rect = el?.getBoundingClientRect();
    if (rect) setMenu({ x: rect.left + 12, y: rect.bottom + 4 });
  };

  const moveTo = (p: Pos, extend: boolean) => {
    const raw = { c: clamp(p.c, 0, NCOLS - 1), r: clamp(p.r, 0, NROWS - 1) };
    const q = extend ? raw : anchorOf(raw);
    setSel(extend ? { a: sel.a, b: q } : { a: q, b: q });
    reveal(q);
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    if (edit || e.target !== gridRef.current) return;
    const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
    const key = e.key;
    const step: Record<string, Pos> = { ArrowUp: { c: 0, r: -1 }, ArrowDown: { c: 0, r: 1 }, ArrowLeft: { c: -1, r: 0 }, ArrowRight: { c: 1, r: 0 } };
    if (step[key]) {
      e.preventDefault();
      const from = e.shiftKey ? sel.b : sel.a;
      const d = step[key];
      // Stepping right or down leaves a merged cell from its far edge.
      const ext = e.shiftKey ? { c1: from.c, r1: from.r } : extentOf(from);
      const next = { c: d.c > 0 ? ext.c1 + 1 : from.c + d.c, r: d.r > 0 ? ext.r1 + 1 : from.r + d.r };
      moveTo(mod ? edgeFrom(from, d) : next, e.shiftKey);
    } else if (key === "Tab") {
      const next = e.shiftKey ? cur.c - 1 : extentOf(cur).c1 + 1;
      if (next < 0 || next >= NCOLS) return;
      e.preventDefault();
      moveTo({ c: next, r: cur.r }, false);
    } else if (key === "Enter" || key === "F2") {
      e.preventDefault();
      beginEdit(cells[curId]?.v ?? "");
    } else if (key === "Delete" || key === "Backspace") {
      e.preventDefault();
      clearRange();
    } else if (key === "Escape") {
      setSel({ a: cur, b: cur });
    } else if (mod && key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    } else if (mod && key.toLowerCase() === "b") {
      e.preventDefault();
      toggleStyle("bold");
    } else if (mod && key.toLowerCase() === "i") {
      e.preventDefault();
      toggleStyle("italic");
    } else if (mod && key.toLowerCase() === "u") {
      e.preventDefault();
      toggleStyle("underline");
    } else if (mod && key.toLowerCase() === "d") {
      e.preventDefault();
      fillDirection("down");
    } else if (mod && key.toLowerCase() === "r") {
      e.preventDefault();
      fillDirection("right");
    } else if (mod && key.toLowerCase() === "f") {
      e.preventDefault();
      openFind();
    } else if (mod && key === "Home") {
      e.preventDefault();
      moveTo({ c: 0, r: 0 }, e.shiftKey);
    } else if (mod && key === "End") {
      e.preventDefault();
      moveTo(lastUsed(), e.shiftKey);
    } else if (key === "Home") {
      e.preventDefault();
      moveTo({ c: 0, r: (e.shiftKey ? sel.b : sel.a).r }, e.shiftKey);
    } else if (key === "PageDown" || key === "PageUp") {
      e.preventDefault();
      const page = Math.max(1, Math.floor(((scrollRef.current?.clientHeight ?? 600) - HEAD_H) / DEF_H) - 1);
      const from = e.shiftKey ? sel.b : sel.a;
      moveTo({ c: from.c, r: from.r + (key === "PageDown" ? page : -page) }, e.shiftKey);
    } else if (key === " " && !e.shiftKey && !mod && cells[curId]?.s?.checkbox) {
      e.preventDefault();
      toggleCheckbox(cur);
    } else if (key === " " && e.shiftKey && !mod) {
      e.preventDefault();
      setSel({ a: { c: 0, r: r0 }, b: { c: NCOLS - 1, r: r1 } });
    } else if (key === " " && mod) {
      e.preventDefault();
      setSel({ a: { c: c0, r: 0 }, b: { c: c1, r: NROWS - 1 } });
    } else if (key === "ContextMenu" || (key === "F10" && e.shiftKey)) {
      e.preventDefault();
      openMenuAtCell();
    } else if (mod && key.toLowerCase() === "a") {
      e.preventDefault();
      setSel({ a: { c: 0, r: 0 }, b: { c: NCOLS - 1, r: NROWS - 1 } });
    } else if (!mod && key.length === 1 && !(e.altKey && !e.ctrlKey)) {
      e.preventDefault();
      beginEdit(key);
    }
  };

  const onEditorKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (suggestions) {
      const n = suggestions.items.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestIndex((activeSuggest + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        acceptSuggestion(suggestions.items[activeSuggest]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestHidden(true);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit({ c: 0, r: e.shiftKey ? -1 : 1 });
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitEdit({ c: e.shiftKey ? -1 : 1, r: 0 });
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  // ---------- clipboard ----------

  const copyRange = (cut: boolean) => {
    const rows: (Cell | undefined)[][] = [];
    const lines: string[] = [];
    for (let r = r0; r <= r1; r++) {
      const row: (Cell | undefined)[] = [];
      const texts: string[] = [];
      for (let c = c0; c <= c1; c++) {
        const id = cellId(c, r);
        row.push(cells[id]);
        texts.push(display(value(id), cells[id]));
      }
      rows.push(row);
      lines.push(texts.join("\t"));
    }
    const text = lines.join("\n");
    clipRef.current = { cells: rows, origin: { c: c0, r: r0 }, text, cut };
    return text;
  };

  const onCopy = (e: React.ClipboardEvent) => {
    if (edit) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", copyRange(false));
    flash(`Copied ${rangeText({ c: c0, r: r0 }, { c: c1, r: r1 })}`);
  };
  const onCut = (e: React.ClipboardEvent) => {
    if (edit) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", copyRange(true));
  };
  const onPaste = (e: React.ClipboardEvent) => {
    if (edit) return;
    e.preventDefault();
    applyPaste(e.clipboardData.getData("text/plain"));
  };

  const applyPaste = (text: string) => {
    const clip = clipRef.current;
    const at = { c: c0, r: r0 };
    const next = { ...cells };
    if (clip && clip.text === text) {
      const fits = (i: number, j: number) => at.c + j < NCOLS && at.r + i < NROWS;
      if (clip.cut)
        clip.cells.forEach((row, i) =>
          row.forEach((_, j) => {
            if (fits(i, j)) delete next[cellId(clip.origin.c + j, clip.origin.r + i)];
          }),
        );
      clip.cells.forEach((row, i) =>
        row.forEach((cell, j) => {
          const c = at.c + j;
          const r = at.r + i;
          if (c >= NCOLS || r >= NROWS) return;
          const id = cellId(c, r);
          if (!cell) delete next[id];
          else next[id] = clip.cut ? cell : { ...cell, v: shiftFormula(cell.v, c - (clip.origin.c + j), r - (clip.origin.r + i)) };
        }),
      );
      if (clip.cut) clipRef.current = null;
    } else {
      text
        .replace(/\r/g, "")
        .replace(/\n$/, "")
        .split("\n")
        .forEach((line, i) =>
          line.split("\t").forEach((v, j) => {
            const c = at.c + j;
            const r = at.r + i;
            const id = cellId(c, r);
            if (c >= NCOLS || r >= NROWS || (v === "" && !next[id])) return;
            next[id] = { ...next[id], v };
          }),
        );
    }
    commitCells(next);
  };

  const menuCopy = (cut: boolean) => {
    const text = copyRange(cut);
    navigator.clipboard?.writeText(text).catch(() => {});
    flash(`${cut ? "Cut" : "Copied"} ${rangeText({ c: c0, r: r0 }, { c: c1, r: r1 })}`);
  };

  const menuPaste = () => {
    const internal = clipRef.current?.text;
    if (!navigator.clipboard?.readText) {
      if (internal !== undefined) applyPaste(internal);
      else flash("Use Ctrl+V to paste from outside the sheet.");
      return;
    }
    navigator.clipboard.readText().then(applyPaste, () => {
      if (internal !== undefined) applyPaste(internal);
      else flash("Use Ctrl+V to paste from outside the sheet.");
    });
  };

  const runMenu = (action: MenuAction) => {
    if (action === "cut") menuCopy(true);
    else if (action === "copy") menuCopy(false);
    else if (action === "paste") menuPaste();
    else if (action === "fillDown") fillDirection("down");
    else if (action === "fillRight") fillDirection("right");
    else if (action === "sortAsc") sortRange(1);
    else if (action === "sortDesc") sortRange(-1);
    else if (action === "clear") clearRange();
    else if (action === "clearFormat") clearFormatting();
    else if (action === "find") openFind();
    else copyLink();
  };

  const closeMenu = () => {
    setMenu(null);
    focusGrid();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>(".menu-item") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      closeMenu();
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (edit) commitEdit();
    const hit = posFromEvent(e);
    const p = { c: clamp(hit.c, 0, NCOLS - 1), r: clamp(hit.r, 0, NROWS - 1) };
    if (hit.r < 0 && hit.c < 0) setSel({ a: { c: 0, r: 0 }, b: { c: NCOLS - 1, r: NROWS - 1 } });
    else if (hit.r < 0) setSel({ a: { c: p.c, r: 0 }, b: { c: p.c, r: NROWS - 1 } });
    else if (hit.c < 0 && hit.r >= 0) setSel({ a: { c: 0, r: p.r }, b: { c: NCOLS - 1, r: p.r } });
    else {
      // Right-clicking anywhere in a merged cell means the merged cell, as a left-click does.
      const q = anchorOf(p);
      if (!(q.c >= c0 && q.c <= c1 && q.r >= r0 && q.r <= r1)) setSel({ a: q, b: q });
    }
    setPalette(null);
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const reset = () => {
    editRef.current = null;
    setEdit(null);
    setColW({});
    setRowH({});
    commitCells(initialCells);
    setSel({ a: startPos, b: startPos });
    requestAnimationFrame(() => reveal(startPos));
    flash("Sheet reset. Undo brings your edits back.");
  };

  // ---------- derived ----------

  const stats = useMemo(() => {
    let sum = 0;
    let count = 0;
    let nums = 0;
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const v = value(cellId(c, r));
        if (v !== null && v !== "") count++;
        if (isNumeric(v)) {
          nums++;
          sum += v;
        }
      }
    return { sum, count, nums, avg: nums ? sum / nums : 0 };
  }, [value, r0, r1, c0, c1]);

  const rows = useMemo(() => {
    return Array.from({ length: NROWS }, (_, r) => {
      const out: { c: number; span: number; rowSpan: number; id: string; text: string; v: Scalar; cell?: Cell; error: boolean; numeric: boolean }[] = [];
      for (let c = 0; c < NCOLS; c++) {
        const id = cellId(c, r);
        if (merges.has(id)) continue;
        const cell = cells[id];
        const v = value(id);
        const text = display(v, cell);
        let span = 1;
        let rowSpan = 1;
        const mg = cell?.s?.merge;
        const align = cell?.s?.align ?? (isNumeric(v) ? "right" : "left");
        if (cell?.s?.band) {
          span = NCOLS - c;
        } else if (mg) {
          span = Math.min(mg.cols ?? 1, NCOLS - c);
          rowSpan = Math.min(mg.rows ?? 1, NROWS - r);
        } else if (text && align === "left" && !cell?.s?.href) {
          let width = widths[c];
          const need = textWidth(text, cell);
          while (width < need && c + span < NCOLS && !merges.has(cellId(c + span, r)) && !display(value(cellId(c + span, r)), cells[cellId(c + span, r)])) {
            width += widths[c + span];
            span++;
          }
        }
        out.push({ c, span, rowSpan, id, text, v, cell, error: v instanceof FormulaError, numeric: isNumeric(v) });
        c += span - 1;
      }
      return out;
    });
  }, [cells, value, widths, merges]);

  // Find matches what a cell shows or what it holds (so formulas are searchable too).
  const findQuery = find?.query.trim().toLowerCase() ?? "";
  const matches = useMemo(() => {
    if (!findQuery) return [] as string[];
    const out: string[] = [];
    for (let r = 0; r < NROWS; r++)
      for (let c = 0; c < NCOLS; c++) {
        const id = cellId(c, r);
        const cell = cells[id];
        if (cell && (display(value(id), cell).toLowerCase().includes(findQuery) || cell.v.toLowerCase().includes(findQuery))) out.push(id);
      }
    return out;
  }, [findQuery, cells, value]);
  const matchSet = new Set(matches);
  const currentMatch = find && find.index >= 0 && matches.length ? matches[find.index % matches.length] : null;

  const gotoMatch = (dir: 1 | -1) => {
    if (!find || !matches.length) return;
    const i = find.index < 0 ? (dir === 1 ? 0 : matches.length - 1) : (find.index + dir + matches.length) % matches.length;
    setFind({ ...find, index: i });
    const p = parseRef(matches[i])!;
    setSel({ a: p, b: p });
    reveal(p);
  };

  const openBugs = bugs.filter((b) => !fixed.has(b.id));
  const bugCells = new Set(openBugs.map((b) => b.cell));
  const curBug = openBugs.find((b) => b.cell === curId || b.related?.includes(curId));
  const coveredBy = new Map<string, string>(merges);
  rows.forEach((row, r) =>
    row.forEach(({ c, span, id }) => {
      for (let k = 1; k < span; k++) coveredBy.set(cellId(c + k, r), id);
    }),
  );
  const curCell = cells[curId];
  const curStyle = curCell?.s;
  const barValue = edit ? edit.draft : (curCell?.v ?? "");
  const curLink = curCell?.s?.href;
  const box = (b: { c0: number; c1: number; r0: number; r1: number }) => ({
    left: headW + xs[b.c0],
    top: HEAD_H + ys[b.r0],
    width: xs[b.c1 + 1] - xs[b.c0],
    height: ys[b.r1 + 1] - ys[b.r0],
  });
  // A selection that touches a merged cell grows to cover all of it.
  const extA = extentOf(sel.a);
  const extB = extentOf(sel.b);
  const selBox = box({ c0, c1: Math.max(c1, extA.c1, extB.c1), r0, r1: Math.max(r1, extA.r1, extB.r1) });
  const curExt = extentOf(cur);
  const curBox = box({ c0: cur.c, c1: curExt.c1, r0: cur.r, r1: curExt.r1 });

  const mailtoFrom = (send: { name: string; message: string }) => {
    const name = display(value(send.name), cells[send.name]).trim();
    const message = display(value(send.message), cells[send.message]).trim();
    // Mail apps drop very long mailto links, so keep the pre-filled parts short. Slice by whole characters so an
    // emoji is never cut in half, which would make encodeURIComponent throw.
    const clip = (s: string, n: number) => Array.from(s).slice(0, n).join("");
    const enc = (s: string) => {
      try {
        return encodeURIComponent(s);
      } catch {
        return encodeURIComponent(s.replace(/[\uD800-\uDFFF]/g, ""));
      }
    };
    const subject = enc(name ? `Hi from ${clip(name, 80)}` : "Hi from your website");
    return `mailto:${site.email}?subject=${subject}${message ? `&body=${enc(clip(message, 1500))}` : ""}`;
  };

  // What a cell draws: pictures, checkboxes, heatmap tiles, tags, pills and chips, or plain text.
  const renderContent = (id: string, cell: Cell | undefined, v: Scalar, text: string) => {
    const st = cell?.s;
    if (v instanceof ImageValue) return <img className="cell-image" src={v.src} alt="" draggable={false} loading="lazy" />;
    if (st?.checkbox) {
      // Name the box after the label beside it ("Guitar"), falling back to the cell reference.
      const at = parseRef(id);
      const next = at ? cellId(at.c + 1, at.r) : "";
      const label = (next && display(value(next), cells[next]).trim()) || `${id} checkbox`;
      return (
        <span className={`checkbox${v === true ? " is-on" : ""}`} role="checkbox" aria-checked={v === true} aria-label={label}>
          {v === true && <Icon name="checkBold" className="checkbox-icon" />}
        </span>
      );
    }
    if (st?.heat) return <span className={`heat${text ? " is-on" : ""}`}>{text && <Icon name="checkBold" className="heat-icon" />}</span>;
    if (st?.tags)
      return (
        <span className="tags">
          {text
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t, i) => (
              <span key={`${t}${i}`} className="tag">
                {TECH_BRANDS[t] && <Brand name={TECH_BRANDS[t]} className="tag-mark" />}
                {t}
              </span>
            ))}
        </span>
      );
    if (st?.pill)
      return (
        <span className="pill">
          <span className="pill-dot" />
          {text}
        </span>
      );
    const mark = (cls: string) => <Mark style={st} className={cls} />;
    if (st?.chip) {
      const href = st.send ? mailtoFrom(st.send) : (st.href ?? "#");
      return (
        <a
          className={`chip${st.large ? " is-large" : ""}${st.primary ? " is-primary" : ""}`}
          href={href}
          target={href.startsWith("/") || href.startsWith("mailto:") ? undefined : "_blank"}
          rel="noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {mark("chip-mark")}
          <span>{text}</span>
        </a>
      );
    }
    // A tile is one cell: its mark and figure, with the caption underneath.
    if (st?.tile)
      return (
        <span className="tile">
          <span className="tile-figure">
            {mark("tile-mark")}
            <span className="cell-text">{text}</span>
          </span>
          {st.caption && <span className="tile-caption">{st.caption}</span>}
        </span>
      );
    const lead = mark("cell-mark");
    if (st?.href)
      return (
        <a
          className="cell-anchor"
          href={st.href}
          target={st.href.startsWith("/") || st.href.startsWith("mailto:") ? undefined : "_blank"}
          rel="noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {lead}
          <span className="cell-text">{text}</span>
          <Icon name="open" className="cell-anchor-icon" />
        </a>
      );
    if (!text && st?.placeholder) return <span className="cell-placeholder">{st.placeholder}</span>;
    return (
      <>
        {lead}
        <span className="cell-text">{text}</span>
        {st?.badge && <span className="band-badge">{st.badge}</span>}
      </>
    );
  };

  // Comment popover: the hovered note, else the active cell's (so keyboard and touch can read notes), else the
  // pinned one.
  // The welcome note on A1 is pinned once and, once dismissed, stays dismissed. On phones the Cards view shows it
  // in the hero, so the grid doesn't cover the name with it.
  const activeNote = !edit && c0 === c1 && r0 === r1 && curId !== "A1" && cells[curId]?.s?.note ? curId : null;
  const pinned = narrow && openNote === "A1" ? null : openNote;
  const noteId = hoverNote ?? activeNote ?? pinned;
  const noteText = noteId ? cells[noteId]?.s?.note : undefined;
  const notePos = (() => {
    if (!noteId || !noteText) return null;
    const q = parseRef(noteId)!;
    const ext = extentOf(q);
    const b = box({ c0: q.c, c1: ext.c1, r0: q.r, r1: ext.r1 });
    const width = noteId === "A1" ? 420 : 280;
    const right = b.left + b.width + 6;
    return { left: right + width > headW + xs[NCOLS] ? Math.max(headW + 4, b.left - width - 6) : right, top: b.top + 4, width };
  })();

  // Keep the note inside the visible part of the sheet: narrow it to fit, then slide it left if it would run
  // past the right edge.
  useLayoutEffect(() => {
    const pop = noteRef.current;
    const view = scrollRef.current;
    if (!pop || !view || !notePos) return;
    pop.style.width = `${Math.min(notePos.width, view.clientWidth - headW - 16)}px`;
    pop.style.left = `${notePos.left}px`;
    const over = pop.getBoundingClientRect().right - (view.getBoundingClientRect().right - 8);
    if (over > 0) pop.style.left = `${Math.max(view.scrollLeft + headW + 4, notePos.left - over)}px`;
  });

  // Chart 1 reads the Uses column; a missing value leaves a gap.
  const chartValues = chart.values.map((ref) => {
    const v = value(ref);
    return typeof v === "number" ? v : null;
  });
  const chartMax = Math.max(1, ...chartValues.map((v) => v ?? 0));
  const chartBox = box({ c0: chart.col, c1: chart.col + chart.cols - 1, r0: chart.firstRow, r1: chart.firstRow + chart.values.length - 1 });
  const ganttRows = new Map(bars.map((b) => [b.row, b]));
  const nowBox = box({
    c0: gantt.firstCol + gantt.today,
    c1: gantt.firstCol + gantt.today,
    r0: gantt.rows[0].row,
    r1: gantt.rows[gantt.rows.length - 1].row,
  });
  const ghost =
    drag?.kind === "move"
      ? box({ c0: c0 + drag.off.c, c1: c1 + drag.off.c, r0: r0 + drag.off.r, r1: r1 + drag.off.r })
      : drag?.kind === "fill"
        ? box(fillRange(drag.to))
        : null;
  const multi = c0 !== c1 || r0 !== r1;

  const popup = suggestions ? (
    <div
      ref={popRef}
      className={`suggest suggest-${edit!.from}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <ul id={`${uid}-fx`} role="listbox" aria-label="Functions">
        {suggestions.items.map((doc, i) => (
          <li
            key={doc.name}
            id={`${uid}-fx-${i}`}
            role="option"
            aria-selected={i === activeSuggest}
            className={`suggest-item${doc.egg ? " is-egg" : ""}`}
            onMouseMove={() => setSuggestIndex(i)}
            onClick={() => acceptSuggestion(doc)}
          >
            <span className="suggest-name">
              {doc.name}
              <span className="suggest-args">({doc.args})</span>
            </span>
            <span className="suggest-desc">{doc.desc}</span>
            {doc.egg && <span className="suggest-egg">Easter egg</span>}
          </li>
        ))}
      </ul>
      <p className="suggest-foot">Tab or Enter to insert. Esc to close.</p>
    </div>
  ) : argHint ? (
    <div ref={popRef} className={`suggest arg-hint suggest-${edit!.from}`} aria-hidden="true" onPointerDown={(e) => e.stopPropagation()}>
      <span className="suggest-name">
        {argHint.name}
        <span className="suggest-args">({argHint.args})</span>
      </span>
      <span className="suggest-desc">{argHint.desc}</span>
    </div>
  ) : null;
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  // The bug counter lives in the status bar, or in the top bar on phones so the section tabs get the whole bottom row.
  const bugButton = (where: "bar" | "top") => (
    <button
      type="button"
      className={`bug-count bug-${where}${openBugs.length ? "" : " is-done"}`}
      onClick={jumpToBug}
      aria-label={openBugs.length ? `${fixed.size} of ${bugs.length} bugs fixed. Go to the next one.` : `All ${bugs.length} bugs fixed`}
    >
      <Icon name="bug" className="bug-icon" />
      {where === "top" ? `${fixed.size}/${bugs.length}` : openBugs.length ? `Bugs ${fixed.size}/${bugs.length}` : "All bugs fixed"}
    </button>
  );
  const tone = (color: string) => ({ "--tone": color }) as React.CSSProperties;

  return (
    <div className={`app${resizing ? ` is-resizing-${resizing}` : ""}`} style={tone(curSection.tone)}>
      <header className="toolbar">
        <a className="avatar" href={site.github} target="_blank" rel="noreferrer" aria-label={`${site.name} on GitHub`}>
          <Image src={site.avatar} alt="" width={30} height={30} priority />
        </a>
        <div className="doc">
          <h1 className="doc-name">{site.name}</h1>
          <p className="doc-meta">Waterloo CS/BBA</p>
        </div>
        <div className="tools" role="toolbar" aria-label="Sheet tools">
          <ToolButton label="Undo" shortcut="Ctrl+Z" disabled={!past.length} onClick={undo} icon="undo" />
          <ToolButton label="Redo" shortcut="Ctrl+Y" disabled={!future.length} onClick={redo} icon="redo" />
          <span className="tool-sep tg-number" aria-hidden="true" />
          <ToolButton
            className="tg-number"
            label="Format as currency"
            glyph="$"
            pressed={curStyle?.fmt === "usd"}
            onClick={() => setFormat({ fmt: curStyle?.fmt === "usd" ? undefined : "usd" })}
          />
          <ToolButton
            className="tg-number"
            label="Format as percent"
            glyph="%"
            pressed={curStyle?.fmt === "pct"}
            onClick={() => setFormat({ fmt: curStyle?.fmt === "pct" ? undefined : "pct" })}
          />
          <ToolButton
            className="tg-number"
            label="Format as number with commas"
            glyph="1,0"
            pressed={curStyle?.fmt === "int"}
            onClick={() => setFormat({ fmt: curStyle?.fmt === "int" ? undefined : "int" })}
          />
          <ToolButton className="tg-number" label="Fewer decimal places" glyph=".0" onClick={() => changeDecimals(-1)} />
          <ToolButton className="tg-number" label="More decimal places" glyph=".00" onClick={() => changeDecimals(1)} />
          <span className="tool-sep tg-text" aria-hidden="true" />
          <ToolButton className="tg-text" label="Bold" shortcut="Ctrl+B" pressed={!!curStyle?.bold} onClick={() => toggleStyle("bold")} icon="bold" />
          <ToolButton className="tg-text" label="Italic" shortcut="Ctrl+I" pressed={!!curStyle?.italic} onClick={() => toggleStyle("italic")} icon="italic" />
          <ToolButton
            className="tg-text"
            label="Underline"
            shortcut="Ctrl+U"
            pressed={!!curStyle?.underline}
            onClick={() => toggleStyle("underline")}
            icon="underline"
          />
          <ToolButton className="tg-text" label="Strikethrough" pressed={!!curStyle?.strike} onClick={() => toggleStyle("strike")} icon="strike" />
          <span className="tool-sep tg-color" aria-hidden="true" />
          <span className="tool-wrap tg-color">
            <button
              type="button"
              className="tool tool-color"
              aria-label="Text colour"
              aria-expanded={palette === "text"}
              title="Text colour"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPalette((p) => (p === "text" ? null : "text"))}
            >
              <Icon name="textColor" className="tool-icon" />
              <span className="swatch-bar" style={{ background: curStyle?.textColor ?? "currentColor" }} />
            </button>
            {palette === "text" && (
              <Palette
                label="Text colour"
                onClose={() => setPalette(null)}
                onPick={(color) => {
                  setFormat({ textColor: color });
                  setPalette(null);
                  focusGrid();
                }}
              />
            )}
          </span>
          <span className="tool-wrap tg-color">
            <button
              type="button"
              className="tool tool-color"
              aria-label="Fill colour"
              aria-expanded={palette === "fill"}
              title="Fill colour"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPalette((p) => (p === "fill" ? null : "fill"))}
            >
              <Icon name="fillColor" className="tool-icon" />
              <span className="swatch-bar" style={{ background: curStyle?.fill ?? "var(--frame-line)" }} />
            </button>
            {palette === "fill" && (
              <Palette
                label="Fill colour"
                onClose={() => setPalette(null)}
                onPick={(color) => {
                  setFormat({ fill: color });
                  setPalette(null);
                  focusGrid();
                }}
              />
            )}
          </span>
          <span className="tool-sep tg-align" aria-hidden="true" />
          {(["left", "center", "right"] as const).map((a) => (
            <ToolButton
              key={a}
              className="tg-align"
              label={`Align ${a}`}
              pressed={curStyle?.align === a}
              onClick={() => setFormat({ align: curStyle?.align === a ? undefined : a })}
              icon={a === "left" ? "alignLeft" : a === "center" ? "alignCenter" : "alignRight"}
            />
          ))}
          <span className="tool-sep tg-misc" aria-hidden="true" />
          <ToolButton className="tg-misc" label="Find" shortcut="Ctrl+F" pressed={!!find} onClick={openFind} icon="search" />
          <ToolButton className="tg-misc" label="Reset sheet" onClick={reset} icon="reset" />
        </div>
        <div className="view-toggle" role="group" aria-label="Layout">
          <button type="button" aria-pressed={cardsView} onClick={() => setViewOverride("cards")}>
            Cards
          </button>
          <button type="button" aria-pressed={!cardsView} onClick={() => setViewOverride("grid")}>
            Grid
          </button>
        </div>
        <nav className="links" aria-label="Contact">
          <a className="link-btn" href={`mailto:${site.email}`}>
            Email
          </a>
          <a className="link-btn" href={site.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="link-btn" href={site.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          {bugButton("top")}
          <button
            type="button"
            className="theme-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} className="tool-icon" />
          </button>
          <a className="resume-btn" href={site.resume} target="_blank" rel="noreferrer">
            Résumé
          </a>
        </nav>
      </header>

      <div className="formula-bar" hidden={cardsView && curId !== playCell}>
        <input
          className="name-box"
          aria-label="Cell reference. Type one, like E9, and press Enter to go there."
          value={nameBox ?? rangeText(sel.a, sel.b)}
          onFocus={(e) => {
            setNameBox(rangeText(sel.a, sel.b));
            e.currentTarget.select();
          }}
          onChange={(e) => setNameBox(e.target.value)}
          onBlur={() => setNameBox(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setNameBox(null);
              focusGrid();
            }
            if (e.key !== "Enter") return;
            const [from, to] = (nameBox ?? "").split(":");
            const a = parseRef(from ?? "");
            const b = parseRef(to ?? from ?? "");
            if (a && b && a.c < NCOLS && a.r < NROWS && b.c < NCOLS && b.r < NROWS) {
              scrollerRef.current?.stop();
              // A single cell inside a merge means the merged cell itself, as in Sheets.
              const one = to === undefined ? anchorOf(a) : null;
              setSel(one ? { a: one, b: one } : { a, b });
              reveal(one ?? a);
            }
            setNameBox(null);
            focusGrid();
          }}
        />
        <span className="fx" aria-hidden="true">
          fx
        </span>
        <input
          ref={barRef}
          className="formula-input"
          aria-label={`Contents of ${curId}`}
          spellCheck={false}
          value={barValue}
          onFocus={() => {
            if (!editRef.current) changeDraft(curCell?.v ?? "", "bar", curId);
          }}
          onChange={(e) => changeDraft(e.target.value, "bar")}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={edit?.from === "bar" && !!suggestions}
          aria-controls={edit?.from === "bar" && suggestions ? `${uid}-fx` : undefined}
          aria-activedescendant={edit?.from === "bar" && suggestions ? `${uid}-fx-${activeSuggest}` : undefined}
          onKeyDown={onEditorKey}
          onBlur={() => {
            if (editRef.current?.from === "bar" && dragRef.current?.kind !== "point") commitEdit();
          }}
        />
        {edit?.from === "bar" && popup}
        {curLink && !edit && (
          <a
            className="open-link"
            href={curLink}
            target={curLink.startsWith("/") || curLink.startsWith("mailto:") ? undefined : "_blank"}
            rel="noreferrer"
          >
            Open link
          </a>
        )}
      </div>

      <div className="main" data-view={viewOverride ?? "auto"}>
      <div className="scroll" ref={scrollRef}>
        <div
          ref={gridRef}
          className="grid"
          role="grid"
          tabIndex={0}
          aria-label={`${site.name}'s sheet`}
          aria-rowcount={NROWS}
          aria-colcount={NCOLS}
          aria-activedescendant={`${uid}-${coveredBy.get(curId) ?? curId}`}
          aria-multiselectable="true"
          onKeyDown={onGridKey}
          onCopy={onCopy}
          onCut={onCut}
          onPaste={onPaste}
          onDoubleClick={(e) => {
            // A double-click on the fill handle already auto-filled; don't also start editing.
            if (skipDoubleClickRef.current) {
              skipDoubleClickRef.current = false;
              return;
            }
            // Clicks already toggle checkboxes, so a double-click on one shouldn't also open the editor.
            if (edit || cells[curId]?.s?.checkbox) return;
            const hit = posFromEvent(e);
            if (hit.r >= 0 && hit.c >= 0) beginEdit(cells[curId]?.v ?? "");
          }}
        >
          <div
            ref={canvasRef}
            className="canvas"
            style={{
              ["--head-w" as string]: `${headW}px`,
              width: headW + xs[NCOLS],
              height: HEAD_H + ys[NROWS],
              gridTemplateColumns: `${headW}px ${widths.map((w) => `${w}px`).join(" ")}`,
              gridTemplateRows: `${HEAD_H}px ${heights.map((h) => `${h}px`).join(" ")}`,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={() => setHoverNote(null)}
            onContextMenu={onContextMenu}
          >
            <div className="corner" style={{ gridRow: 1, gridColumn: 1 }} aria-hidden="true" />
            {widths.map((_, c) => (
              <div
                key={`h${c}`}
                className={`col-head${c >= c0 && c <= c1 ? " on" : ""}`}
                style={{ gridRow: 1, gridColumn: c + 2 }}
                aria-hidden="true"
              >
                {colName(c)}
                <span
                  className="col-resizer"
                  data-index={c}
                  onPointerDown={(e) => startResize(e, "col")}
                  onDoubleClick={(e) => autoFit(e, "col")}
                />
              </div>
            ))}
            {rows.map((row, r) => {
              const section = sectionAt(r);
              return (
                <div role="row" aria-rowindex={r + 1} className="row" key={r} style={tone(section.tone)}>
                  <div
                    className={`row-head${r >= r0 && r <= r1 ? " on" : ""}${r === section.start ? " row-start" : ""}`}
                    style={{ gridRow: r + 2, gridColumn: 1, ...tone(section.tone) }}
                    aria-hidden="true"
                  >
                    {r + 1}
                    <span
                      className="row-resizer"
                      data-index={r}
                      onPointerDown={(e) => startResize(e, "row")}
                      onDoubleClick={(e) => autoFit(e, "row")}
                    />
                  </div>
                  {row.map(({ c, span, rowSpan, id, text, v, cell, error, numeric }) => {
                    const s = cell?.s;
                    const align = s?.align ?? (numeric ? "right" : "left");
                    // Gantt rows paint their month cells as bars, shifted live while a bar is dragged.
                    const g = ganttRows.get(r);
                    const shift = g && drag?.kind === "bar" && drag.index === g.index ? drag.off : 0;
                    const month = c - gantt.firstCol;
                    // A bar ending "now" keeps its end while its start is dragged.
                    const endShift = g?.ongoing ? 0 : shift;
                    const inBar = !!g && g.s >= 0 && month >= g.s + shift && month <= g.e + endShift;
                    const isTodayHead = r === gantt.todayRow && month === gantt.today;
                    const cls = [
                      "cell",
                      s?.title && "is-title",
                      s?.sub && "is-sub",
                      s?.band && "is-band",
                      s?.head && "is-head",
                      s?.kpi && "is-kpi",
                      s?.bold && "is-bold",
                      s?.italic && "is-italic",
                      s?.underline && "is-underline",
                      s?.strike && "is-strike",
                      matchSet.has(id) && "is-match",
                      currentMatch === id && "is-match-current",
                      s?.muted && "is-muted",
                      s?.tone && "is-tone",
                      s?.href && "is-link",
                      s?.reward && "is-reward",
                      s?.note && "has-note",
                      s?.chip && "is-chip",
                      s?.large && "is-large-chip",
                      s?.tags && "is-tags",
                      s?.pill && "is-pill",
                      s?.heat && "is-heat",
                      s?.checkbox && "is-checkbox",
                      s?.wrap && "is-wrap",
                      s?.tile && "is-tile",
                      s?.thumb && "is-thumb",
                      v instanceof ImageValue && "is-image",
                      frameCells.has(id) && "in-frame",
                      g && month >= 0 && month < gantt.months && "gantt-cell",
                      inBar && "gantt-bar",
                      inBar && month === g!.s + shift && "bar-start",
                      inBar && month === g!.e + endShift && (g!.ongoing ? "bar-ongoing" : "bar-end"),
                      drag?.kind === "bar" && inBar && shift !== 0 && "is-dragging",
                      inBar && bugCells.has(g!.start) && "bar-bug",
                      isTodayHead && "is-today",
                      bugCells.has(id) && "has-bug",
                      error && "is-error",
                      span > 1 && !s?.merge && !s?.band && "is-spill",
                      `align-${align}`,
                    ]
                      .filter(Boolean)
                      .join(" ");
                    const selected = r >= r0 && r <= r1 && c + span - 1 >= c0 && c <= c1;
                    return (
                      <div
                        key={id}
                        id={`${uid}-${id}`}
                        role="gridcell"
                        aria-colindex={c + 1}
                        aria-selected={selected}
                        aria-label={text ? undefined : `${id}, empty`}
                        aria-describedby={noteId === id && noteText ? `${uid}-note` : undefined}
                        className={cls}
                        style={{
                          gridRow: `${r + 2} / span ${rowSpan}`,
                          gridColumn: `${c + 2} / span ${span}`,
                          ...tone(inBar ? g!.tone : (s?.color ?? section.tone)),
                          color: s?.textColor,
                          backgroundColor: s?.fill ? `color-mix(in srgb, ${s.fill} 24%, var(--sheet))` : undefined,
                        }}
                      >
                        {renderContent(id, cell, v, text)}
                        {s?.note && (
                          <button
                            type="button"
                            className="note-mark"
                            aria-label={openNote === id ? "Hide note" : "Show note"}
                            tabIndex={-1}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => setOpenNote((n) => (n === id ? null : id))}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {frames.map((f) => (
              <div
                key={`${f.c0}-${f.r0}`}
                className={`frame frame-${f.kind}`}
                // Sit on the grid lines (each cell draws its line on its right and bottom edge), so neighbouring
                // tiles and cards share one line instead of doubling it.
                style={(({ left, top, width, height }) => ({ left: left - 1, top: top - 1, width: width + 1, height: height + 1, ...tone(f.tone) }))(box(f))}
                aria-hidden="true"
              />
            ))}
            <div className="gantt-now" style={{ left: nowBox.left + nowBox.width / 2, top: nowBox.top, height: nowBox.height }} aria-hidden="true">
              <span>now</span>
            </div>
            <div className="chart-obj" style={{ ...chartBox, ...tone(TONES.skills) }} aria-label="Chart 1: uses per skill" role="img">
              {chartValues.map((n, i) => {
                const r = chart.firstRow + i;
                return (
                  <div key={chart.values[i]} className={`chart-row${n === null ? " is-missing" : ""}`} style={{ top: ys[r] - ys[chart.firstRow], height: heights[r] }}>
                    <span className="chart-track">
                      <span className="chart-bar" style={{ width: `${n === null ? 0 : (n / chartMax) * 100}%` }} />
                    </span>
                    <span className="chart-val">{n === null ? "?" : n}</span>
                  </div>
                );
              })}
            </div>
            {notePos && noteText && (
              <div
                ref={noteRef}
                id={`${uid}-note`}
                className={`note-pop${openNote === noteId && !hoverNote ? " is-pinned" : ""}`}
                style={notePos}
                role="note"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <p>{noteText}</p>
                {openNote === noteId && (
                  <button type="button" className="note-close" aria-label="Close note" onClick={() => setOpenNote(null)}>
                    <Icon name="check" className="note-close-icon" />
                    Got it
                  </button>
                )}
              </div>
            )}
            {multi && <div className="sel-range" style={selBox} aria-hidden="true" />}
            <div className="sel-cur" style={curBox} aria-hidden="true" />
            {!edit && (
              <div className="sel-frame" style={selBox} aria-hidden="true">
                <span className="edge edge-t" data-drag="move" onPointerDown={onHandleDown} />
                <span className="edge edge-r" data-drag="move" onPointerDown={onHandleDown} />
                <span className="edge edge-b" data-drag="move" onPointerDown={onHandleDown} />
                <span className="edge edge-l" data-drag="move" onPointerDown={onHandleDown} />
                <span className="fill-handle" data-drag="fill" onPointerDown={onHandleDown} />
              </div>
            )}
            {ghost && <div className={`ghost ghost-${drag?.kind}`} style={ghost} aria-hidden="true" />}
            {edit?.from === "cell" && (
              <input
                ref={editorRef}
                className="cell-editor"
                aria-label={`Edit ${curId}`}
                spellCheck={false}
                style={{ left: curBox.left, top: curBox.top, minWidth: curBox.width, height: curBox.height }}
                value={edit.draft}
                onChange={(e) => changeDraft(e.target.value, "cell")}
                onPointerDown={(e) => e.stopPropagation()}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={!!suggestions}
                aria-controls={suggestions ? `${uid}-fx` : undefined}
                aria-activedescendant={suggestions ? `${uid}-fx-${activeSuggest}` : undefined}
                onKeyDown={onEditorKey}
                onBlur={() => {
                  if (editRef.current?.from === "cell" && dragRef.current?.kind !== "point") commitEdit();
                }}
              />
            )}
            {edit?.from === "cell" && popup}
          </div>
        </div>
      </div>

      {find && (
        <div className="find" role="search" onPointerDown={(e) => e.stopPropagation()}>
          <input
            ref={findRef}
            className="find-input"
            placeholder="Find in sheet"
            aria-label="Find in sheet"
            value={find.query}
            onChange={(e) => setFind({ query: e.target.value, index: -1 })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                gotoMatch(e.shiftKey ? -1 : 1);
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeFind();
              }
            }}
          />
          <span className="find-count" aria-live="polite">
            {!findQuery ? "" : !matches.length ? "No results" : find.index >= 0 ? `${(find.index % matches.length) + 1} of ${matches.length}` : `${matches.length} found`}
          </span>
          <button type="button" aria-label="Previous match" title="Previous (Shift+Enter)" onClick={() => gotoMatch(-1)}>
            <Icon name="chevronUp" className="tool-icon" />
          </button>
          <button type="button" aria-label="Next match" title="Next (Enter)" onClick={() => gotoMatch(1)}>
            <Icon name="chevronDown" className="tool-icon" />
          </button>
          <button type="button" aria-label="Close find" title="Close (Esc)" onClick={closeFind}>
            <Icon name="dismiss" className="tool-icon" />
          </button>
        </div>
      )}

      <CardsView
        sections={sections}
        cells={cells}
        value={value}
        curId={curId}
        bugCells={bugCells}
        bars={bars}
        playCell={playCell}
        mailto={mailtoFrom}
        onSelect={selectCell}
        onPlay={playIn}
        onToggle={(id) => toggleCheckbox(parseRef(id)!)}
        onSet={(id, v) => commitCells({ ...cells, [id]: { ...cells[id], v } })}
        scrollRef={cardsRef}
        sectionRef={(id, el) => {
          cardSectionRefs.current[id] = el;
        }}
      />
      </div>

      <footer className="statusbar">
        <nav className="tabs" aria-label="Sections" ref={tabsRef}>
          <span className="tab-glider" ref={gliderRef} aria-hidden="true" />
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className="tab"
              aria-current={s.id === viewSection ? "true" : undefined}
              style={tone(s.tone)}
              onClick={() => jumpTo(s.id)}
            >
              <span className="tab-dot" aria-hidden="true" />
              {s.name}
            </button>
          ))}
        </nav>
        {bugButton("bar")}
        <p className={`hint${toast ? " is-toast" : curBug ? " is-bug" : ""}`} aria-live="polite">
          {toast ??
            (curBug && `${curBug.hint}${cardsView && curBug.needsGrid ? " Switch to Grid to fix this one." : ""}`) ??
            "Double-click to edit, right-click for more. Four small bugs are hiding in the sections. Try =AMBITION()."}
        </p>
        <p className="stats">
          {stats.nums > 0 && multi
            ? narrow
              ? `Sum ${fmt(stats.sum)}`
              : `Sum ${fmt(stats.sum)}   Avg ${fmt(stats.avg)}   Count ${stats.count}`
            : multi
              ? `Count ${stats.count}`
              : ""}
        </p>
      </footer>
      {party > 0 && <Confetti key={party} />}
      {menu && (
        <div ref={menuRef} className="menu" role="menu" aria-label="Cell actions" style={{ left: menu.x, top: menu.y }} onKeyDown={onMenuKey}>
          {MENU.map((item, i) =>
            item === "sep" ? (
              <div key={`sep${i}`} className="menu-sep" role="separator" />
            ) : (
              <button
                key={item.action}
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  closeMenu();
                  runMenu(item.action);
                }}
              >
                <span>{item.label}</span>
                {item.hint && <kbd>{item.hint}</kbd>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// A short burst of section-coloured cells when every bug is fixed.
function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          style={
            {
              "--tone": sections[i % sections.length].tone,
              "--x": `${(i * 37) % 100}%`,
              "--delay": `${(i % 9) * 60}ms`,
              "--drift": `${((i * 53) % 120) - 60}px`,
              "--spin": `${((i * 71) % 540) - 270}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function ToolButton({
  label,
  shortcut,
  disabled,
  pressed,
  glyph,
  icon,
  className,
  onClick,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  pressed?: boolean;
  glyph?: string;
  icon?: IconName;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={["tool", glyph && "tool-glyph", className].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={pressed}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {glyph ? <span aria-hidden="true">{glyph}</span> : icon && <Icon name={icon} className="tool-icon" />}
    </button>
  );
}

function Palette({ label, onPick, onClose }: { label: string; onPick: (color: string | undefined) => void; onClose: () => void }) {
  return (
    <div
      className="palette-pop"
      role="group"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        onClose();
        e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(".tool")?.focus();
      }}
    >
      <button type="button" className="swatch is-default" autoFocus onClick={() => onPick(undefined)}>
        Default
      </button>
      <div className="swatches">
        {PALETTE.map((p) => (
          <button key={p.value} type="button" className="swatch" style={{ background: p.value }} aria-label={p.name} title={p.name} onClick={() => onPick(p.value)} />
        ))}
      </div>
    </div>
  );
}
