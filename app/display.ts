import type { Cell } from "./content";
import { FormulaError, ImageValue, type Scalar } from "./formula";

/** How a cell's value reads on screen, shared by the grid and the phone cards. */
export function display(value: Scalar, cell: Cell | undefined): string {
  if (value instanceof FormulaError) return value.code;
  if (value instanceof ImageValue) return "";
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    const fmt = cell?.s?.fmt;
    const decimals = cell?.s?.decimals;
    const n = fmt === "pct" ? value * 100 : value;
    const options: Intl.NumberFormatOptions = { useGrouping: fmt === "int" || fmt === "usd" };
    if (decimals !== undefined) {
      options.minimumFractionDigits = decimals;
      options.maximumFractionDigits = decimals;
    } else {
      options.maximumFractionDigits = fmt === "usd" ? 0 : 2;
    }
    const text = Math.abs(n).toLocaleString("en-US", options);
    const sign = n < 0 && Number(text.replace(/,/g, "")) !== 0 ? "-" : "";
    return fmt === "usd" ? `${sign}$${text}` : fmt === "pct" ? `${sign}${text}%` : `${sign}${text}`;
  }
  return value;
}
