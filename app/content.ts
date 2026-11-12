// Site facts and the one sheet: an overview for recruiters, then four sections that each use a different
// spreadsheet object as their centrepiece (dashboard tiles, a card gallery, a Gantt chart, a heatmap with a
// live chart, and a form). Facts come from the latest résumé (public/resume.pdf).

import { ImageValue, cellId, colName, parseRef, shiftFormula, type Lookup } from "./formula";
import type { BrandName, IconName } from "./icons";

export const site = {
  name: "Pranav Thukral",
  url: "https://www.pranavthukral.com",
  email: "pranavthukral.pt@gmail.com",
  github: "https://github.com/PranavThukral",
  linkedin: "https://www.linkedin.com/in/pranavthukral",
  resume: "/resume.pdf",
  /** The GitHub profile photo, served locally because github.com's avatar redirect is sometimes slow or down. */
  avatar: "/avatar.png",
  description:
    "Waterloo Computer Science and Business Administration student building AI tools, evals and products. Projects: The Pitch Deck, BankingBench, Threadline.",
};

export type Style = {
  title?: boolean;
  sub?: boolean;
  band?: boolean;
  /** Short text shown at the right end of a section band. */
  badge?: string;
  head?: boolean;
  kpi?: boolean;
  bold?: boolean;
  muted?: boolean;
  tone?: boolean;
  align?: "left" | "center" | "right";
  /** Number format: grouped number, currency or percent. Unset means "General". */
  fmt?: "int" | "usd" | "pct";
  /** Fixed decimal places, set by the toolbar's decimal buttons. */
  decimals?: number;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  textColor?: string;
  fill?: string;
  href?: string;
  /** Overrides the section tone, so overview figures can point at their own section. */
  color?: string;
  /** Text unlocked by fixing one of the sheet's bugs. */
  reward?: boolean;
  /** Merged cell: how many columns and rows this cell covers, starting at itself. */
  merge?: { cols?: number; rows?: number };
  /** A Fluent UI icon shown before the text. */
  icon?: IconName;
  /** A brand's own mark (Simple Icons), shown before the text. */
  brand?: BrandName;
  /** Organisation logos (image files) shown before the text. */
  logo?: string | string[];
  /** Render a link as a button with its icon, mark or logo. */
  chip?: boolean;
  /** A large, full-width button (the overview's contact row); `primary` fills it with the accent colour. */
  large?: boolean;
  primary?: boolean;
  /** Render comma-separated technologies as tags, each with its logo where there is one. */
  tags?: boolean;
  /** Render as a status: a small square dot and the text. */
  pill?: boolean;
  /** A dashboard tile: the figure with its caption underneath. */
  tile?: boolean;
  caption?: string;
  /** Heatmap cell: a tick fills it with the section colour. */
  heat?: boolean;
  /** A TRUE/FALSE checkbox that toggles on click. */
  checkbox?: boolean;
  /** A comment, shown on hover from the corner triangle. */
  note?: string;
  /** Let text wrap onto a second line. */
  wrap?: boolean;
  /** A screenshot cell: errors show as a broken picture. */
  thumb?: boolean;
  /** Shown in grey while the cell is empty. */
  placeholder?: string;
  /** A Send chip that emails Pranav using the text in two other cells. */
  send?: { name: string; message: string };
};

export type Cell = { v: string; s?: Style };
export type Cells = Record<string, Cell>;

/** How a section lays out on phones. */
export type MobileLayout = "hero" | "gallery" | "timeline" | "list" | "pairs";

export type Section = { id: string; name: string; tone: string; start: number; end: number; mobile: MobileLayout };

// Slightly muted so the sections read as colour-coded without shouting.
export const TONES = {
  overview: "#d9663f",
  projects: "#4170d0",
  experience: "#7b5fcf",
  skills: "#2e8f6e",
  about: "#c9578a",
  amber: "#c9921f",
};

export const columnCount = 24;
export const columnWidths = Array.from({ length: columnCount }, () => 56);

const FOES_DATES = "Oct 2025 – Mar 2026";

type SectionSpec = {
  id: string;
  name: string;
  tone: string;
  rows: number;
  mobile: MobileLayout;
  /** Local row heights by zero-based local row. */
  tall?: Record<number, number>;
  /** Cells in local coordinates; `at` gives another section's cell relative to this one. */
  cells: (at: (section: string, ref: string) => string) => Cells;
};

const m = (cols: number, rows = 1) => ({ cols, rows });
const band = (v: string, badge?: string): Cell => ({ v, s: { band: true, badge } });
const head = (v: string, cols: number, align?: Style["align"]): Cell => ({ v, s: { head: true, align, merge: m(cols) } });
/** What a chip or label shows before its text: a Fluent icon, a brand mark or an organisation's logo. */
type Mark = Pick<Style, "icon" | "brand" | "logo">;
const chip = (v: string, href: string, mark: Mark, cols: number): Cell => ({ v, s: { href, chip: true, ...mark, merge: m(cols) } });

/** Technologies named in project tags, mapped to their marks. Ones without a mark (LLM, Grok) show as text. */
export const TECH_BRANDS: Record<string, BrandName> = {
  "Next.js": "nextjs",
  TypeScript: "typescript",
  "Sheets API": "googlesheets",
  Python: "python",
  FastAPI: "fastapi",
  PostgreSQL: "postgresql",
  React: "react",
  Fastify: "fastify",
  Turso: "turso",
};

const LOGO = {
  rbc: "/logos/rbc.svg",
  waterloo: "/logos/waterloo_logo.png",
  pitchDeck: "/logos/pitch_deck_logo.png",
  foes: "/logos/foes_image.jpg",
};

// ---------- Overview: dashboard tiles ----------

const HELLO = "Hi, I'm Pranav. This whole page is a working spreadsheet, so click around, edit cells and try a formula.";

/** A tile is one cell, two rows tall: the figure, with its caption underneath. */
const tile = (v: string, color: string, mark: Mark, cols: number, caption: string, fmt?: Style["fmt"]): Cell => ({
  v,
  s: { kpi: true, tile: true, caption, color, ...mark, fmt, align: "left", merge: m(cols, 2) },
});

// ---------- Projects: a gallery of cards ----------

const projectCards = [
  {
    col: 0,
    title: "The Pitch Deck",
    thumb: '=IMAGE("/shots/pitch-deck.jpg")',
    desc: "Matches students to opportunities worth applying to, ranked by a scoring algorithm.",
    tags: "Next.js, TypeScript, Sheets API, LLM",
    metricLabel: "Monthly visits",
    metric: { v: "2000", s: { fmt: "int" as const } },
    link: { text: "thepitchdeck.ca", href: "https://www.thepitchdeck.ca", mark: { logo: LOGO.pitchDeck } as Mark },
  },
  {
    col: 8,
    title: "BankingBench",
    thumb: '=IMAGE("/shots/bankingbench.jpg")',
    desc: "10 synthetic banking tasks that test whether graders can be fooled by plausible wrong code.",
    tags: "Python, FastAPI, PostgreSQL",
    metricLabel: "Grader false positives, of 30",
    metric: { v: "20 → 0", s: {} },
    link: { text: "bankingbench.vercel.app", href: "https://bankingbench.vercel.app", mark: { brand: "vercel" } as Mark },
  },
  {
    col: 16,
    title: "Threadline",
    // Bug: IMAGE is misspelled, so the thumbnail shows #NAME? until it's fixed.
    thumb: '=IMGAE("/shots/threadline.jpg")',
    desc: "Reads an email thread, suggests next steps and drafts replies. Every claim is source-checked.",
    tags: "React, Fastify, Turso, Grok",
    metricLabel: "Sends reviewed by a person",
    metric: { v: "100%", s: {} },
    link: { text: "threadline-five-rust.vercel.app", href: "https://threadline-five-rust.vercel.app", mark: { brand: "vercel" } as Mark },
  },
];

// ---------- Experience: a Gantt chart ----------

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The Gantt runs Aug 2025 to Dec 2026, one column per month starting at column D. */
export const ganttStart = { year: 2025, month: 8 };
export const ganttMonths = 17;
export const ganttFirstCol = 3;
/** "Now" is November 2026. */
export const ganttToday = 15;

export function monthIndex(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (t === "now") return ganttMonths - 1;
  const match = /^([a-z]{3})\w*\s+(\d{4})$/.exec(t);
  if (!match) return null;
  const month = MONTH_NAMES.findIndex((n) => n.toLowerCase() === match[1]) + 1;
  if (!month) return null;
  return (+match[2] - ganttStart.year) * 12 + month - ganttStart.month;
}

export function monthLabel(index: number): string {
  const total = ganttStart.month - 1 + index;
  return `${MONTH_NAMES[((total % 12) + 12) % 12]} ${ganttStart.year + Math.floor(total / 12)}`;
}

const timeline = [
  { name: "The Pitch Deck", logo: LOGO.pitchDeck, start: "Aug 2025", end: "now", tone: TONES.projects },
  {
    name: "Programs",
    icon: "team" as IconName,
    start: "Sep 2025",
    end: "Jun 2026",
    tone: TONES.amber,
    note: "TD Talent Lab, JEC Canada and the ICON Talent Partners Fellowship.",
  },
  // Bug: FOES ran Oct 2025 – Mar 2026, but its bar starts three months late.
  { name: "FOES", logo: LOGO.foes, start: "Jan 2026", end: "Jun 2026", tone: TONES.experience },
  { name: "RBC", logo: LOGO.rbc, start: "Jul 2026", end: "Aug 2026", tone: TONES.skills },
  { name: "Waterloo", logo: LOGO.waterloo, start: "Sep 2026", end: "now", tone: TONES.about },
];

const roles = [
  { role: "Software Engineer Intern, RBC", logo: LOGO.rbc, what: "LLM-assisted incident tooling for an SRE team", result: "68% faster incident lookup", when: "Jul – Aug 2026" },
  { role: "Business Analyst Intern, FOES", logo: LOGO.foes, what: "Private equity research and GTM automation (Apollo, Clay)", result: "75 firms, 41-page report", when: FOES_DATES },
  { role: "Founder, The Pitch Deck", logo: LOGO.pitchDeck, what: "Built and grew a student opportunity platform", result: "2,000+ monthly visits", when: "Aug 2025 – now" },
];

// ---------- Skills: a heatmap and a live chart ----------

const skillRows: { name: string; kind: string; brand?: BrandName; icon?: IconName; used: boolean[] }[] = [
  // used: The Pitch Deck, BankingBench, Threadline, RBC, FOES
  { name: "Python", kind: "Language", brand: "python", used: [false, true, false, true, false] },
  { name: "TypeScript", kind: "Language", brand: "typescript", used: [true, false, true, true, false] },
  { name: "React", kind: "Frontend", brand: "react", used: [true, false, true, false, false] },
  { name: "Next.js", kind: "Frontend", brand: "nextjs", used: [true, false, false, false, false] },
  { name: "FastAPI", kind: "Backend", brand: "fastapi", used: [false, true, false, true, false] },
  { name: "Fastify", kind: "Backend", brand: "fastify", used: [false, false, true, false, false] },
  { name: "MongoDB", kind: "Data", brand: "mongodb", used: [false, false, false, true, false] },
  { name: "PostgreSQL", kind: "Data", brand: "postgresql", used: [false, true, false, false, false] },
  { name: "SQLite (Turso)", kind: "Data", brand: "sqlite", used: [false, false, true, false, false] },
  { name: "LLM integration", kind: "AI", icon: "brain", used: [true, false, true, true, false] },
  { name: "Evals and testing", kind: "AI", icon: "beaker", used: [false, true, false, false, false] },
  { name: "Market research", kind: "Business", icon: "trending", used: [false, false, false, false, true] },
  { name: "GTM automation", kind: "Business", icon: "flow", used: [false, false, false, false, true] },
];
const skillColumns = ["Pitch Deck", "BankingBench", "Threadline", "RBC", "FOES"];
const tickCols = ["H", "J", "L", "N", "P"];

// ---------- the sections ----------

const specs: SectionSpec[] = [
  {
    id: "overview",
    name: "Overview",
    tone: TONES.overview,
    rows: 7,
    mobile: "hero",
    tall: { 0: 72, 1: 30, 3: 58, 4: 30, 5: 18, 6: 64 },
    // Strongest evidence first: the internship and the scholarship, then the product's traffic.
    cells: (at) => ({
      // Narrow enough that the welcome note fits beside the name on laptop screens too.
      A1: { v: "Pranav Thukral", s: { title: true, merge: m(8), note: HELLO } },
      A2: { v: "CS + Business at Waterloo. Always looking to contribute to fast-moving, diverse teams that combine both my interests :)", s: { sub: true, merge: m(24) } },
      A4: tile("Prev. SWE @ RBC", TONES.experience, { logo: LOGO.rbc }, 7, "Software Engineer Intern, summer 2026"),
      // Pulled live from the About section, so the sheet opens on a working formula.
      H4: tile(`=${at("about", "R3")}`, TONES.about, { logo: LOGO.waterloo }, 6, "Math Scholarship, 1 of 15", "usd"),
      N4: tile("2,000+", TONES.projects, { logo: LOGO.pitchDeck }, 6, "Monthly visits, The Pitch Deck"),
      T4: tile(`=COUNTA(${at("projects", "A3")},${at("projects", "I3")},${at("projects", "Q3")})`, TONES.projects, { icon: "globe" }, 5, "Projects live", "int"),
      // Big contact buttons, one under each tile.
      A7: { v: "Résumé", s: { href: site.resume, chip: true, large: true, primary: true, icon: "pdf", merge: m(7) } },
      H7: { v: "Email", s: { href: `mailto:${site.email}`, chip: true, large: true, icon: "mail", merge: m(6) } },
      N7: { v: "GitHub", s: { href: site.github, chip: true, large: true, brand: "github", merge: m(6) } },
      T7: { v: "LinkedIn", s: { href: site.linkedin, chip: true, large: true, brand: "linkedin", merge: m(5) } },
    }),
  },
  {
    id: "projects",
    name: "Projects",
    tone: TONES.projects,
    rows: 8,
    mobile: "gallery",
    tall: { 0: 48, 1: 176, 2: 44, 3: 52, 4: 40, 5: 44, 6: 46, 7: 32 },
    cells: () => {
      const cells: Cells = { A1: band("Projects", "3 live sites") };
      for (const p of projectCards) {
        const col = (offset: number) => colName(p.col + offset);
        cells[`${col(0)}2`] = { v: p.thumb, s: { thumb: true, merge: m(8) } };
        cells[`${col(0)}3`] = { v: p.title, s: { bold: true, merge: m(5) } };
        cells[`${col(5)}3`] = { v: "Live", s: { pill: true, merge: m(3), align: "right" } };
        cells[`${col(0)}4`] = { v: p.desc, s: { wrap: true, merge: m(8) } };
        cells[`${col(0)}5`] = { v: p.tags, s: { tags: true, merge: m(8) } };
        cells[`${col(0)}6`] = { v: p.metricLabel, s: { muted: true, merge: m(5) } };
        cells[`${col(5)}6`] = { v: p.metric.v, s: { ...p.metric.s, bold: true, tone: true, align: "right", merge: m(3) } };
        cells[`${col(0)}7`] = chip(p.link.text, p.link.href, p.link.mark, 8);
      }
      return cells;
    },
  },
  {
    id: "experience",
    name: "Experience",
    tone: TONES.experience,
    rows: 14,
    mobile: "timeline",
    tall: { 0: 48, 1: 26, 2: 26, 3: 38, 4: 38, 5: 38, 6: 38, 7: 38, 8: 16, 9: 30, 13: 32 },
    cells: () => {
      const cells: Cells = {
        A1: band("Experience", "Aug 2025 – now"),
        A2: head("Timeline", 3),
        D2: head("2025", 5, "center"),
        I2: head("2026", 12, "center"),
        U2: head("Start", 2),
        W2: head("End", 2),
        A3: head("Role", 3),
        U3: head("", 2),
        W3: head("", 2),
      };
      for (let i = 0; i < ganttMonths; i++) cells[`${colName(ganttFirstCol + i)}3`] = head(monthLabel(i)[0], 1, "center");
      timeline.forEach((t, i) => {
        const r = 4 + i;
        cells[`A${r}`] = { v: t.name, s: { bold: true, logo: t.logo, icon: t.icon, note: t.note, merge: m(3) } };
        cells[`U${r}`] = { v: t.start, s: { muted: true, merge: m(2) } };
        cells[`W${r}`] = { v: t.end, s: { muted: true, merge: m(2) } };
      });
      cells.A10 = head("Role", 5);
      cells.F10 = head("What", 10);
      cells.P10 = head("Result", 5);
      cells.U10 = head("When", 4);
      roles.forEach((role, i) => {
        const r = 11 + i;
        cells[`A${r}`] = { v: role.role, s: { bold: true, logo: role.logo, merge: m(5) } };
        cells[`F${r}`] = { v: role.what, s: { merge: m(10) } };
        cells[`P${r}`] = { v: role.result, s: { bold: true, tone: true, merge: m(5) } };
        cells[`U${r}`] = { v: role.when, s: { muted: true, merge: m(4) } };
      });
      return cells;
    },
  },
  {
    id: "skills",
    name: "Skills",
    tone: TONES.skills,
    rows: skillRows.length + 4,
    mobile: "list",
    tall: { 0: 48, 1: 30 },
    cells: () => {
      const cells: Cells = {
        A1: band("Skills", `${skillRows.length} skills, 5 places`),
        A2: head("Skill", 4),
        E2: head("Type", 3),
        R2: head("Uses", 2, "right"),
        T2: head("Chart 1: uses per skill", 5),
      };
      skillColumns.forEach((name, j) => (cells[`${tickCols[j]}2`] = head(name, 2, "center")));
      skillRows.forEach((skill, i) => {
        const r = 3 + i;
        cells[`A${r}`] = { v: skill.name, s: { bold: true, brand: skill.brand, icon: skill.icon, merge: m(4) } };
        cells[`E${r}`] = { v: skill.kind, s: { muted: true, merge: m(3) } };
        skill.used.forEach((on, j) => (cells[`${tickCols[j]}${r}`] = { v: on ? "✓" : "", s: { heat: true, merge: m(2) } }));
        // Bug: the last row's Uses count is missing, so its bar is missing from the chart.
        // (The empty cell keeps the column's merge and alignment, so a typed or filled fix lines up.)
        const uses: Style = { fmt: "int", bold: true, tone: true, align: "right", merge: m(2) };
        cells[`R${r}`] = { v: i < skillRows.length - 1 ? `=COUNTA(H${r}:Q${r})` : "", s: uses };
      });
      const last = skillRows.length + 2;
      cells[`P${last + 1}`] = { v: "Total", s: { muted: true, align: "right", merge: m(2) } };
      cells[`R${last + 1}`] = { v: `=SUM(R3:R${last})`, s: { fmt: "int", bold: true, align: "right", merge: m(2) } };
      return cells;
    },
  },
  {
    id: "about",
    name: "About",
    tone: TONES.about,
    rows: 11,
    mobile: "pairs",
    tall: { 0: 48, 1: 36, 2: 36, 3: 36, 4: 36, 5: 36, 6: 38, 7: 32, 8: 44, 9: 44 },
    cells: () => ({
      A1: band("About"),
      A2: { v: "School", s: { muted: true, icon: "grad", merge: m(4) } },
      E2: { v: "Computer Science + Business Administration, Waterloo", s: { logo: LOGO.waterloo, merge: m(13) } },
      A3: { v: "Scholarship", s: { muted: true, icon: "ribbon", merge: m(4) } },
      E3: {
        v: "Waterloo National Mathematics Scholarship",
        s: { logo: LOGO.waterloo, merge: m(13), note: "Selected as 1 of 15 incoming mathematics students, based on academic and extracurricular achievement." },
      },
      R3: { v: "20000", s: { fmt: "usd", bold: true, tone: true, align: "right", merge: m(3) } },
      A4: { v: "Award", s: { muted: true, icon: "trophy", merge: m(4) } },
      E4: {
        v: "Ingenious+ National Innovation Grant, The Pitch Deck",
        s: { merge: m(13), note: "Funding, mentorship and recognition for equity and inclusion, awarded to The Pitch Deck." },
      },
      R4: { v: "1000", s: { fmt: "usd", bold: true, tone: true, align: "right", merge: m(3) } },
      E5: { v: "Total awarded", s: { muted: true, align: "right", merge: m(13) } },
      // Bug: the total includes itself, a circular reference.
      R5: { v: "=SUM(R3:R5)", s: { fmt: "usd", bold: true, align: "right", merge: m(3) } },
      A6: { v: "Programs", s: { muted: true, icon: "team", merge: m(4) } },
      E6: { v: "TD Talent Lab, JEC Canada, ICON Talent Partners Fellowship", s: { merge: m(13) } },
      A7: { v: "Off the clock", s: { muted: true, icon: "heart", merge: m(4) } },
      E7: { v: "TRUE", s: { checkbox: true } },
      F7: { v: "Guitar", s: { merge: m(2) } },
      H7: { v: "TRUE", s: { checkbox: true } },
      I7: { v: "Badminton", s: { merge: m(3) } },
      L7: { v: "TRUE", s: { checkbox: true } },
      M7: { v: "Reading", s: { merge: m(2) } },
      O7: { v: "TRUE", s: { checkbox: true } },
      P7: { v: "Exploring Toronto", s: { merge: m(4) } },
      A9: { v: "Find me", s: { muted: true, icon: "person", merge: m(4) } },
      E9: chip("Email", `mailto:${site.email}`, { icon: "mail" }, 3),
      H9: chip("LinkedIn", site.linkedin, { brand: "linkedin" }, 3),
      K9: chip("GitHub", site.github, { brand: "github" }, 3),
      N9: chip("Résumé", site.resume, { icon: "pdf" }, 3),
      A10: { v: "Say hi", s: { muted: true, icon: "send", merge: m(4) } },
      E10: { v: "", s: { placeholder: "Your name", merge: m(4) } },
      I10: { v: "", s: { placeholder: "A short message", merge: m(8) } },
      // Filled in below once the global positions of E10 and I10 are known.
      Q10: { v: "Send", s: { chip: true, icon: "send", merge: m(3) } },
    }),
  },
];

// ---------- stacking ----------

// Empty rows between sections give each one room to breathe.
const SECTION_GAP = 2;
const GAP_HEIGHT = 44;
const offsets: Record<string, number> = {};
export const gapRows: number[] = [];
let row = 0;
for (const spec of specs) {
  if (row > 0) {
    // One empty row between the overview and Projects; two between the later sections.
    const gap = spec.id === "projects" ? 1 : SECTION_GAP;
    for (let g = 0; g < gap; g++) gapRows.push(row + g);
    row += gap;
  }
  offsets[spec.id] = row;
  row += spec.rows;
}

/** A section's local cell reference, as a global one. */
const at = (section: string, ref: string) => {
  const p = parseRef(ref)!;
  return cellId(p.c, p.r + offsets[section]);
};

export const cells: Cells = {};
export const rowHeights: Record<number, number> = {};
export const sections: Section[] = specs.map((spec) => {
  const off = offsets[spec.id];
  // Refs from `local` are written relative to this section, so the single shift below lands them correctly.
  const local = (section: string, ref: string) => {
    const p = parseRef(ref)!;
    return cellId(p.c, p.r + offsets[section] - off);
  };
  for (const [ref, cell] of Object.entries(spec.cells(local))) {
    const p = parseRef(ref)!;
    cells[cellId(p.c, p.r + off)] = { ...cell, v: shiftFormula(cell.v, 0, off) };
  }
  for (const [r, h] of Object.entries(spec.tall ?? {})) rowHeights[+r + off] = h;
  return { id: spec.id, name: spec.name, tone: spec.tone, start: off, end: off + spec.rows - 1, mobile: spec.mobile };
});
for (const r of gapRows) rowHeights[r] = GAP_HEIGHT;
// The gap rows after a section still belong to it, so the colours and tabs don't flicker in between.
sections.forEach((section, i) => {
  if (sections[i + 1]) section.end = sections[i + 1].start - 1;
});

// The Send chip emails Pranav with whatever was typed into the name and message cells.
cells[at("about", "Q10")].s!.send = { name: at("about", "E10"), message: at("about", "I10") };

export const totalRows = row;
/** Cell selected on load: A1, as in any spreadsheet, so nothing on the dashboard looks highlighted by mistake. */
export const startCell = "A1";
/** An empty overview cell the phone layout offers as a formula playground. */
export const playCell = at("overview", "A8");

// ---------- objects drawn over the grid ----------

export type Frame = { c0: number; r0: number; c1: number; r1: number; tone: string; kind: "tile" | "card" };

/** Outlines that turn groups of cells into tiles and cards. */
export const frames: Frame[] = [
  ...[
    [0, 6, TONES.experience],
    [7, 12, TONES.about],
    [13, 18, TONES.projects],
    [19, 23, TONES.projects],
  ].map(([c0, c1, tone]) => ({ c0: c0 as number, c1: c1 as number, r0: offsets.overview + 3, r1: offsets.overview + 4, tone: tone as string, kind: "tile" as const })),
  ...projectCards.map((p) => ({ c0: p.col, c1: p.col + 7, r0: offsets.projects + 1, r1: offsets.projects + 6, tone: TONES.projects, kind: "card" as const })),
];

/** The Gantt: one row per role, bars drawn from each row's Start and End cells. */
export const gantt = {
  firstCol: ganttFirstCol,
  months: ganttMonths,
  today: ganttToday,
  todayRow: offsets.experience + 2,
  rows: timeline.map((t, i) => ({
    row: offsets.experience + 3 + i,
    name: at("experience", `A${4 + i}`),
    start: at("experience", `U${4 + i}`),
    end: at("experience", `W${4 + i}`),
    tone: t.tone,
  })),
};

/** Chart 1: a bar per skill, reading the Uses column, drawn over columns T to X beside the heatmap. */
export const chart = {
  col: 19,
  cols: 5,
  firstRow: offsets.skills + 2,
  values: skillRows.map((_, i) => at("skills", `R${3 + i}`)),
};

// ---------- the phone layout, built from the same cells ----------

export const phone = {
  hero: {
    name: at("overview", "A1"),
    sub: at("overview", "A2"),
    note: HELLO,
    tiles: ["A", "H", "N", "T"].map((c) => at("overview", `${c}4`)),
    links: ["A7", "H7", "N7", "T7"].map((ref) => at("overview", ref)),
  },
  projects: projectCards.map((p) => {
    const ref = (offset: number, r: number) => at("projects", `${colName(p.col + offset)}${r}`);
    return { thumb: ref(0, 2), title: ref(0, 3), pill: ref(5, 3), desc: ref(0, 4), tags: ref(0, 5), metricLabel: ref(0, 6), metric: ref(5, 6), link: ref(0, 7) };
  }),
  projectsReward: at("projects", "A8"),
  timeline: {
    rows: gantt.rows,
    details: roles.map((_, i) => ({
      role: at("experience", `A${11 + i}`),
      what: at("experience", `F${11 + i}`),
      result: at("experience", `P${11 + i}`),
      when: at("experience", `U${11 + i}`),
    })),
    reward: at("experience", "A14"),
  },
  skills: {
    rows: skillRows.map((_, i) => ({
      name: at("skills", `A${3 + i}`),
      kind: at("skills", `E${3 + i}`),
      ticks: tickCols.map((c, j) => ({ id: at("skills", `${c}${3 + i}`), label: skillColumns[j] })),
      uses: at("skills", `R${3 + i}`),
    })),
    total: at("skills", `R${skillRows.length + 3}`),
    reward: at("skills", `A${skillRows.length + 4}`),
  },
  about: {
    pairs: [2, 3, 4, 6].map((r) => ({ key: at("about", `A${r}`), value: at("about", `E${r}`), amount: at("about", `R${r}`) })),
    total: { label: at("about", "E5"), value: at("about", "R5") },
    hobbies: [
      ["E7", "F7"],
      ["H7", "I7"],
      ["L7", "M7"],
      ["O7", "P7"],
    ].map(([box, label]) => ({ box: at("about", box), label: at("about", label) })),
    links: ["E9", "H9", "K9", "N9"].map((ref) => at("about", ref)),
    form: { name: at("about", "E10"), message: at("about", "I10"), send: at("about", "Q10") },
    reward: at("about", "A8"),
  },
};

// ---------- optional bugs ----------
// Four small, optional fixes, one per section. Each teaches one spreadsheet move and unlocks a fact.

export type Bug = {
  id: string;
  /** Cell that shows the error marker. */
  cell: string;
  /** Other cells whose selection also shows the hint. */
  related?: string[];
  hint: string;
  /** Fixed by dragging or filling, which only the grid view offers. */
  needsGrid?: boolean;
  done: string;
  reward: { cell: string; text: string };
  check: (get: Lookup) => boolean;
};

const num = (v: unknown): v is number => typeof v === "number";
const lastSkill = skillRows.length + 2;
const foes = gantt.rows[2];

export const bugs: Bug[] = [
  {
    id: "typo",
    cell: at("projects", "Q2"),
    related: [at("projects", "Q3")],
    hint: `${at("projects", "Q2")} should show Threadline's screenshot, but IMAGE is misspelled as IMGAE. Double-click it and fix the typo.`,
    done: "Screenshot restored.",
    reward: { cell: at("projects", "A8"), text: "Unlocked: The Pitch Deck's database is a Google Sheet. Spreadsheets all the way down." },
    check: (get) => get(at("projects", "Q2")) instanceof ImageValue,
  },
  {
    id: "gantt",
    cell: foes.start,
    related: [foes.name, foes.end],
    needsGrid: true,
    hint: `FOES ran ${FOES_DATES}, but its bar starts three months late. Drag the violet FOES bar left into place.`,
    done: "Timeline straightened out.",
    reward: { cell: at("experience", "A14"), text: "Unlocked: I speak English, Hindi, Punjabi and some French." },
    check: (get) => get(foes.start) === "Oct 2025" && get(foes.end) === "Mar 2026",
  },
  {
    id: "fill",
    cell: at("skills", `R${lastSkill}`),
    needsGrid: true,
    hint: `GTM automation's Uses count is missing, so its bar is missing from the chart. Select ${at("skills", `R${lastSkill - 1}`)} and drag its corner handle down one row.`,
    done: "Count restored. Watch the chart.",
    reward: { cell: at("skills", `A${lastSkill + 2}`), text: "Unlocked: this page runs on a spreadsheet engine written from scratch in TypeScript." },
    check: (get) => {
      const v = get(at("skills", `R${lastSkill}`));
      // Count filled cells across H:Q the way COUNTA and the heatmap do, so any mark counts.
      const ticks = "HIJKLMNOPQ".split("").filter((c) => {
        const x = get(at("skills", `${c}${lastSkill}`));
        return x !== null && x !== "";
      }).length;
      return num(v) && v === ticks;
    },
  },
  {
    id: "cycle",
    cell: at("about", "R5"),
    hint: `This total adds itself up. Double-click it and change the range to ${at("about", "R3")}:${at("about", "R4")}.`,
    done: "Circular reference broken.",
    reward: { cell: at("about", "A8"), text: "Unlocked: first-term courses so far are CS 145, MATH 135 and MATH 137." },
    check: (get) => {
      const total = get(at("about", "R5"));
      const a = get(at("about", "R3"));
      const b = get(at("about", "R4"));
      return num(total) && num(a) && num(b) && total === a + b;
    },
  },
];
