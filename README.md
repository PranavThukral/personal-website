# pranavthukral.com

My personal site, built as a working spreadsheet. Every section is a range of live cells: you can click around, edit them, write formulas, drag a Gantt bar or fix the four small bugs hidden in the sheet.

Try `=AMBITION()` in any empty cell.

## What's in it

- **A formula engine written from scratch** ([app/formula.ts](app/formula.ts)): tokenizer, parser and evaluator with cell and range references, cycle detection (`#CYCLE!`), spreadsheet errors (`#NAME?`, `#DIV/0!`, `#VALUE!`), reference shifting for fill and paste, and an `IMAGE()` function.
- **A spreadsheet UI** ([app/spreadsheet.tsx](app/spreadsheet.tsx)): selection, editing, autocomplete, fill handle, drag to move, copy and paste, undo and redo, merged cells, sort, find, resizable rows and columns, a context menu and number formatting.
- **One sheet, five sections**: dashboard tiles, a project gallery, a draggable Gantt chart, a skills heatmap with a live chart, and a contact form, all driven by cells in [app/content.ts](app/content.ts).
- **A phone layout** ([app/cards-view.tsx](app/cards-view.tsx)) built from the same cells, plus light and dark themes.

No UI framework or component library: Next.js, React, TypeScript and plain CSS. Icons are [Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) (MIT) and [Simple Icons](https://simpleicons.org) (CC0).

## Run it

```bash
npm install
npm run dev   # http://localhost:3000
```

`npm run lint` and `npm run build` check and build it.
