// A small spreadsheet formula engine: refs, ranges, arithmetic, comparison, & and common functions.

export class FormulaError {
  readonly code: string;
  constructor(code: string) {
    this.code = code;
  }
  toString() {
    return this.code;
  }
}

/** What =IMAGE(url) returns: the grid draws it as a picture filling the cell. */
export class ImageValue {
  readonly src: string;
  constructor(src: string) {
    this.src = src;
  }
  toString() {
    return "";
  }
}

export type Scalar = number | string | boolean | null | FormulaError | ImageValue;
type Value = Scalar | Scalar[];

export function colName(index: number) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function colIndex(name: string) {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export const cellId = (c: number, r: number) => `${colName(c)}${r + 1}`;

const MAX_ROW = 1_000_000;

export function parseRef(ref: string): { c: number; r: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref.trim());
  if (!m || +m[2] < 1 || +m[2] > MAX_ROW) return null;
  return { c: colIndex(m[1]), r: +m[2] - 1 };
}

// ---------- tokenizer ----------

type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ref"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    if (/^\s/.test(rest)) {
      i++;
      continue;
    }
    if (rest.startsWith("#REF!")) throw new FormulaError("#REF!");
    let m: RegExpExecArray | null;
    if ((m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(rest))) {
      const n = parseFloat(m[0]);
      if (!Number.isFinite(n)) throw new FormulaError("#NUM!");
      tokens.push({ t: "num", v: n });
      i += m[0].length;
    } else if (rest[0] === '"') {
      let j = 1;
      let s = "";
      while (j < rest.length) {
        if (rest[j] === '"') {
          if (rest[j + 1] === '"') {
            s += '"';
            j += 2;
            continue;
          }
          break;
        }
        s += rest[j++];
      }
      if (j >= rest.length) throw new FormulaError("#ERROR!");
      tokens.push({ t: "str", v: s });
      i += j + 1;
    } else if ((m = /^\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z_(])/.exec(rest))) {
      const p = parseRef(m[0]);
      if (!p) throw new FormulaError("#REF!");
      tokens.push({ t: "ref", v: cellId(p.c, p.r) });
      i += m[0].length;
    } else if ((m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest))) {
      tokens.push({ t: "id", v: m[0].toUpperCase() });
      i += m[0].length;
    } else if ((m = /^(<=|>=|<>|[-+*/^&=<>(),:%])/.exec(rest))) {
      tokens.push({ t: "op", v: m[0] });
      i += m[0].length;
    } else {
      throw new FormulaError("#ERROR!");
    }
  }
  return tokens;
}

// ---------- parser ----------

type Node =
  | { k: "lit"; v: Scalar }
  | { k: "ref"; id: string }
  | { k: "range"; a: string; b: string }
  | { k: "neg"; x: Node }
  | { k: "pct"; x: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; name: string; args: Node[] };

function parse(tokens: Token[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (...ops: string[]) => peek()?.t === "op" && ops.includes(peek()!.v as string);
  const expect = (op: string) => {
    if (!isOp(op)) throw new FormulaError("#ERROR!");
    p++;
  };

  const binary = (next: () => Node, ops: string[], right = false): (() => Node) => {
    const fn = (): Node => {
      let a = next();
      while (isOp(...ops)) {
        const op = (tokens[p++] as { v: string }).v;
        const b = right ? fn() : next();
        a = { k: "bin", op, a, b };
        if (right) break;
      }
      return a;
    };
    return fn;
  };

  const primary = (): Node => {
    const tok = tokens[p++];
    if (!tok) throw new FormulaError("#ERROR!");
    if (tok.t === "num") return { k: "lit", v: tok.v };
    if (tok.t === "str") return { k: "lit", v: tok.v };
    if (tok.t === "ref") {
      if (isOp(":")) {
        p++;
        const end = tokens[p++];
        if (end?.t !== "ref") throw new FormulaError("#REF!");
        return { k: "range", a: tok.v, b: end.v };
      }
      return { k: "ref", id: tok.v };
    }
    if (tok.t === "id") {
      if (tok.v === "TRUE" || tok.v === "FALSE") return { k: "lit", v: tok.v === "TRUE" };
      if (!isOp("(")) throw new FormulaError("#NAME?");
      p++;
      const args: Node[] = [];
      if (!isOp(")")) {
        args.push(comparison());
        while (isOp(",")) {
          p++;
          args.push(comparison());
        }
      }
      expect(")");
      return { k: "call", name: tok.v, args };
    }
    if (tok.v === "(") {
      const inner = comparison();
      expect(")");
      return inner;
    }
    throw new FormulaError("#ERROR!");
  };

  const postfix = (): Node => {
    let x = primary();
    while (isOp("%")) {
      p++;
      x = { k: "pct", x };
    }
    return x;
  };
  const unary = (): Node => {
    if (isOp("-")) {
      p++;
      return { k: "neg", x: unary() };
    }
    if (isOp("+")) {
      p++;
      return unary();
    }
    return postfix();
  };
  const power = binary(unary, ["^"]);
  const product = binary(power, ["*", "/"]);
  const sum = binary(product, ["+", "-"]);
  const concat = binary(sum, ["&"]);
  const comparison = binary(concat, ["=", "<>", "<", ">", "<=", ">="]);

  const root = comparison();
  if (p !== tokens.length) throw new FormulaError("#ERROR!");
  return root;
}

// ---------- evaluation ----------

export type Lookup = (id: string) => Scalar;

const isErr = (v: unknown): v is FormulaError => v instanceof FormulaError;

function toNum(v: Scalar): number | FormulaError {
  if (isErr(v)) return v;
  if (v instanceof ImageValue) return new FormulaError("#VALUE!");
  if (v === null || v === "") return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : new FormulaError("#VALUE!");
}

const toText = (v: Scalar) =>
  v === null || v instanceof ImageValue ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v);

const MAX_RANGE = 5000;

function rangeIds(a: string, b: string): string[] {
  const s = parseRef(a);
  const e = parseRef(b);
  if (!s || !e) throw new FormulaError("#REF!");
  if ((Math.abs(s.r - e.r) + 1) * (Math.abs(s.c - e.c) + 1) > MAX_RANGE) throw new FormulaError("#REF!");
  const ids: string[] = [];
  for (let r = Math.min(s.r, e.r); r <= Math.max(s.r, e.r); r++)
    for (let c = Math.min(s.c, e.c); c <= Math.max(s.c, e.c); c++) ids.push(cellId(c, r));
  return ids;
}

function flatten(values: Value[]): Scalar[] {
  return values.flatMap((v) => (Array.isArray(v) ? v : [v]));
}

// Numbers from args: values inside ranges skip text, direct text args must be numeric.
function numbers(args: Value[]): number[] | FormulaError {
  const out: number[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const v of arg) {
        if (isErr(v)) return v;
        if (typeof v === "number") out.push(v);
      }
    } else {
      const n = toNum(arg);
      if (isErr(n)) return n;
      out.push(n);
    }
  }
  return out;
}

const FUNCTIONS: Record<string, (args: Value[]) => Scalar> = {
  SUM: (a) => withNums(a, (n) => n.reduce((x, y) => x + y, 0)),
  AVERAGE: (a) => withNums(a, (n) => (n.length ? n.reduce((x, y) => x + y, 0) / n.length : new FormulaError("#DIV/0!"))),
  MIN: (a) => withNums(a, (n) => (n.length ? Math.min(...n) : 0)),
  MAX: (a) => withNums(a, (n) => (n.length ? Math.max(...n) : 0)),
  PRODUCT: (a) => withNums(a, (n) => n.reduce((x, y) => x * y, 1)),
  COUNT: (a) => flatten(a).filter((v) => typeof v === "number").length,
  COUNTA: (a) => flatten(a).filter((v) => v !== null && v !== "").length,
  ROUND: ([x, d]) => {
    const n = toNum(scalar(x));
    const digits = d === undefined ? 0 : toNum(scalar(d));
    if (isErr(n)) return n;
    if (isErr(digits)) return digits;
    const f = 10 ** digits;
    return (Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * f)) / f;
  },
  ABS: ([x]) => {
    const n = toNum(scalar(x));
    return isErr(n) ? n : Math.abs(n);
  },
  IF: ([c, a, b]) => {
    const cond = scalar(c);
    if (isErr(cond)) return cond;
    const truthy = typeof cond === "string" ? cond !== "" : Boolean(cond);
    return truthy ? scalar(a ?? true) : scalar(b ?? false);
  },
  AND: (a) => flatten(a).every((v) => Boolean(v)),
  OR: (a) => flatten(a).some((v) => Boolean(v)),
  NOT: ([x]) => !scalar(x),
  CONCAT: (a) => flatten(a).map(toText).join(""),
  LEN: ([x]) => toText(scalar(x)).length,
  UPPER: ([x]) => toText(scalar(x)).toUpperCase(),
  LOWER: ([x]) => toText(scalar(x)).toLowerCase(),
  // Easter eggs.
  IMAGE: ([src]) => {
    const url = scalar(src);
    if (isErr(url)) return url;
    return typeof url === "string" && url.trim() ? new ImageValue(url.trim()) : new FormulaError("#VALUE!");
  },
  HIRE: () => "pranavthukral.pt@gmail.com",
  AMBITION: () => new FormulaError("#UNDEFINED!"),
  LIMITS: () => new FormulaError("#NULL!"),
  SLEEP: () => new FormulaError("#N/A"),
  WORKLIFEBALANCE: () => new FormulaError("#DIV/0!"),
  SALARY: () => new FormulaError("#NEGOTIABLE!"),
  COFFEE: () => "∞",
  MEANINGOFLIFE: () => 42,
  BUGS: () => 0,
  IMPOSTERSYNDROME: () => false,
  CURIOSITY: () => new FormulaError("#OVERFLOW!"),
  PRANAV: () => "Builds AI tools, evals and products. Ships them.",
};

/** One-liners shown when someone enters an easter-egg formula. */
export const EASTER_EGGS: Record<string, string> = {
  HIRE: "Good call. That's my inbox.",
  AMBITION: "No upper bound found.",
  LIMITS: "None detected.",
  SLEEP: "Not found. Try again after finals.",
  WORKLIFEBALANCE: "Still dividing by zero. Working on it.",
  SALARY: "Let's talk.",
  COFFEE: "Refilling…",
  MEANINGOFLIFE: "Douglas Adams was right.",
  BUGS: "In production, anyway.",
  IMPOSTERSYNDROME: "FALSE. The tests pass.",
  CURIOSITY: "Exceeded cell limits.",
  PRANAV: "That's me.",
};

function withNums(args: Value[], fn: (n: number[]) => Scalar): Scalar {
  const n = numbers(args);
  return isErr(n) ? n : fn(n);
}

function scalar(v: Value | undefined): Scalar {
  if (v === undefined) return null;
  if (Array.isArray(v)) return v.length === 1 ? v[0] : new FormulaError("#VALUE!");
  return v;
}

function evaluate(node: Node, get: Lookup): Value {
  switch (node.k) {
    case "lit":
      return node.v;
    case "ref":
      return get(node.id);
    case "range":
      try {
        return rangeIds(node.a, node.b).map(get);
      } catch (e) {
        return isErr(e) ? e : new FormulaError("#REF!");
      }
    case "neg": {
      const n = toNum(scalar(evaluate(node.x, get)));
      return isErr(n) ? n : -n;
    }
    case "pct": {
      const n = toNum(scalar(evaluate(node.x, get)));
      return isErr(n) ? n : n / 100;
    }
    case "call": {
      const fn = FUNCTIONS[node.name];
      if (!fn) return new FormulaError("#NAME?");
      if (node.name === "IF") {
        // Only evaluate the branch that is taken.
        const cond = scalar(evaluate(node.args[0] ?? { k: "lit", v: false }, get));
        if (isErr(cond)) return cond;
        const truthy = typeof cond === "string" ? cond !== "" : Boolean(cond);
        const branch = truthy ? node.args[1] : node.args[2];
        return branch ? scalar(evaluate(branch, get)) : truthy;
      }
      const aggregate = ["SUM", "AVERAGE", "MIN", "MAX", "PRODUCT", "COUNT", "COUNTA"].includes(node.name);
      const args = node.args.map((a) => (aggregate && a.k === "ref" ? [get(a.id)] : evaluate(a, get)));
      const err = flatten(args).find(isErr);
      if (err && (!["COUNT", "COUNTA"].includes(node.name) || err.code === "#CYCLE!")) return err;
      return fn(args);
    }
    case "bin": {
      const a = scalar(evaluate(node.a, get));
      const b = scalar(evaluate(node.b, get));
      if (isErr(a)) return a;
      if (isErr(b)) return b;
      if (node.op === "&") return toText(a) + toText(b);
      if (["=", "<>", "<", ">", "<=", ">="].includes(node.op)) {
        const bothNum = typeof a !== "string" && typeof b !== "string";
        const x = bothNum ? (toNum(a) as number) : toText(a).toLowerCase();
        const y = bothNum ? (toNum(b) as number) : toText(b).toLowerCase();
        switch (node.op) {
          case "=":
            return x === y;
          case "<>":
            return x !== y;
          case "<":
            return x < y;
          case ">":
            return x > y;
          case "<=":
            return x <= y;
          default:
            return x >= y;
        }
      }
      const x = toNum(a);
      const y = toNum(b);
      if (isErr(x)) return x;
      if (isErr(y)) return y;
      if (node.op === "/" && y === 0) return new FormulaError("#DIV/0!");
      const result = node.op === "+" ? x + y : node.op === "-" ? x - y : node.op === "*" ? x * y : node.op === "/" ? x / y : x ** y;
      return Number.isFinite(result) ? result : new FormulaError("#NUM!");
    }
  }
}

/** Turns a cell's raw input into a value: formulas are evaluated, numeric text becomes a number. */
export function computeRaw(raw: string, get: Lookup): Scalar {
  if (raw.startsWith("=")) {
    if (raw.length === 1) return new FormulaError("#ERROR!");
    try {
      const result = scalar(evaluate(parse(tokenize(raw.slice(1))), get));
      if (typeof result === "number" && !Number.isFinite(result)) return new FormulaError("#NUM!");
      return result;
    } catch (e) {
      return isErr(e) ? e : new FormulaError("#ERROR!");
    }
  }
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (/^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$|^-?\.\d+$/.test(trimmed) && !/^-?0\d/.test(trimmed)) {
    const n = Number(trimmed.replace(/,/g, ""));
    if (!Number.isFinite(n)) return new FormulaError("#NUM!");
    return Object.is(n, -0) ? 0 : n;
  }
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  return raw;
}

/** Builds a memoized lookup over a sheet's raw inputs, reporting circular references as #CYCLE!. */
export function createEvaluator(raws: (id: string) => string): Lookup {
  const memo = new Map<string, Scalar>();
  const visiting = new Set<string>();
  const get: Lookup = (id) => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return new FormulaError("#CYCLE!");
    visiting.add(id);
    const value = computeRaw(raws(id), get);
    visiting.delete(id);
    memo.set(id, value);
    return value;
  };
  return get;
}

/** Shifts the relative references in a formula, as fill and paste do. */
export function shiftFormula(raw: string, dc: number, dr: number): string {
  if (!raw.startsWith("=")) return raw;
  return raw.replace(/("(?:[^"]|"")*")|(?<![A-Za-z0-9_.$])(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z_(\d.])/g, (m, str, d1, col, d2, row) => {
    if (str) return str;
    const c = d1 ? colIndex(col) : colIndex(col) + dc;
    const r = d2 ? +row - 1 : +row - 1 + dr;
    if (c < 0 || r < 0) return "#REF!";
    return `${d1}${colName(c)}${d2}${r + 1}`;
  });
}

export type FunctionDoc = { name: string; args: string; desc: string; egg?: boolean };

/** What the formula autocomplete offers, in the order it lists them. */
export const FUNCTION_DOCS: FunctionDoc[] = [
  { name: "SUM", args: "value1, [value2, …]", desc: "Adds numbers and ranges." },
  { name: "AVERAGE", args: "value1, [value2, …]", desc: "The mean of the numbers." },
  { name: "MIN", args: "value1, [value2, …]", desc: "The smallest number." },
  { name: "MAX", args: "value1, [value2, …]", desc: "The largest number." },
  { name: "PRODUCT", args: "value1, [value2, …]", desc: "Multiplies the numbers together." },
  { name: "COUNT", args: "value1, [value2, …]", desc: "Counts cells that hold numbers." },
  { name: "COUNTA", args: "value1, [value2, …]", desc: "Counts cells that aren't empty." },
  { name: "ROUND", args: "value, [digits]", desc: "Rounds to a number of decimal places." },
  { name: "ABS", args: "value", desc: "The absolute value." },
  { name: "IF", args: "condition, if_true, [if_false]", desc: "Picks a value based on a test." },
  { name: "AND", args: "test1, [test2, …]", desc: "TRUE if every test is TRUE." },
  { name: "OR", args: "test1, [test2, …]", desc: "TRUE if any test is TRUE." },
  { name: "NOT", args: "test", desc: "Flips TRUE and FALSE." },
  { name: "CONCAT", args: "text1, [text2, …]", desc: "Joins text together." },
  { name: "LEN", args: "text", desc: "The number of characters." },
  { name: "UPPER", args: "text", desc: "Converts text to uppercase." },
  { name: "LOWER", args: "text", desc: "Converts text to lowercase." },
  { name: "IMAGE", args: "url", desc: "Shows a picture in the cell." },
  { name: "AMBITION", args: "", desc: "Measures how far I plan to go.", egg: true },
  { name: "BUGS", args: "", desc: "Known bugs in production.", egg: true },
  { name: "COFFEE", args: "", desc: "Current coffee reserves.", egg: true },
  { name: "CURIOSITY", args: "", desc: "How much I still want to learn.", egg: true },
  { name: "HIRE", args: "", desc: "The fastest way to reach me.", egg: true },
  { name: "IMPOSTERSYNDROME", args: "", desc: "Runs a quick check.", egg: true },
  { name: "LIMITS", args: "", desc: "Lists my limits.", egg: true },
  { name: "MEANINGOFLIFE", args: "", desc: "Answers the big question.", egg: true },
  { name: "PRANAV", args: "", desc: "Me, in one line.", egg: true },
  { name: "SALARY", args: "", desc: "Expected compensation.", egg: true },
  { name: "SLEEP", args: "", desc: "Hours of sleep during finals.", egg: true },
  { name: "WORKLIFEBALANCE", args: "", desc: "Computes the ratio.", egg: true },
];

/** The dropdown's order: the easter eggs come first, so typing "=" shows the fun ones before SUM and friends. */
const EGGS_FIRST = [...FUNCTION_DOCS.filter((f) => f.egg), ...FUNCTION_DOCS.filter((f) => !f.egg)];

/** The function a formula is being typed after, if any: the dropdown's prefix and matches. */
export function suggestFunctions(draft: string): { prefix: string; items: FunctionDoc[] } | null {
  if (!draft.startsWith("=")) return null;
  if ((draft.match(/"/g)?.length ?? 0) % 2) return null;
  if (draft === "=") return { prefix: "", items: EGGS_FIRST };
  const m = /(?:^=|[=(,+\-*/^&<>:\s])([A-Za-z]+)$/.exec(draft);
  if (!m) return null;
  const prefix = m[1].toUpperCase();
  const items = EGGS_FIRST.filter((f) => f.name.startsWith(prefix));
  return items.length ? { prefix: m[1], items } : null;
}

/** Closes any brackets left open, the way spreadsheets do when you press Enter on =SUM(A1:A3. */
export function closeBrackets(draft: string): string {
  if (!draft.startsWith("=")) return draft;
  let depth = 0;
  let inString = false;
  for (const ch of draft.slice(1)) {
    if (ch === '"') inString = !inString;
    else if (!inString && ch === "(") depth++;
    else if (!inString && ch === ")") depth = Math.max(0, depth - 1);
  }
  return inString ? draft : draft + ")".repeat(depth);
}

/** The innermost function call still open at the end of a draft, for the argument hint. */
export function openCall(draft: string): FunctionDoc | null {
  const stack: (string | null)[] = [];
  let inString = false;
  for (let i = 1; i < draft.length; i++) {
    const ch = draft[i];
    if (ch === '"') inString = !inString;
    else if (inString) continue;
    else if (ch === "(") stack.push(/([A-Za-z]+)$/.exec(draft.slice(0, i))?.[1].toUpperCase() ?? null);
    else if (ch === ")") stack.pop();
  }
  const name = stack[stack.length - 1];
  return (name && FUNCTION_DOCS.find((f) => f.name === name)) || null;
}
