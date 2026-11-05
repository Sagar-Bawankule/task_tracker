import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import type { Cell, ParsedSheet } from "@/lib/import-format";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel request limit is 4.5 MB
const MAX_ROWS = 5000;
const pad = (n: number) => String(n).padStart(2, "0");

function cellToText(value: ExcelJS.CellValue): Cell {
  if (value == null) return { v: "" };
  if (value instanceof Date) {
    // Excel dates have no timezone; ExcelJS gives them as UTC midnight
    return { v: `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}` };
  }
  if (typeof value === "object") {
    if ("hyperlink" in value) {
      // text can be a plain string or rich text at runtime, even though the types say string
      const raw = value.text as unknown;
      const text =
        typeof raw === "string"
          ? raw
          : raw && typeof raw === "object" && "richText" in raw
            ? (raw as { richText: { text: string }[] }).richText.map((r) => r.text).join("")
            : "";
      return { v: text || value.hyperlink, l: value.hyperlink };
    }
    if ("richText" in value) return { v: value.richText.map((r) => r.text).join("") };
    if ("result" in value) return cellToText(value.result as ExcelJS.CellValue);
    if ("error" in value) return { v: "" };
    return { v: "" };
  }
  return { v: String(value) };
}

/** Minimal RFC-4180 CSV parser (handles quotes, commas and newlines inside quotes) */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Use the first row with at least 2 filled cells as the header row; drop empty rows */
function toSheet(name: string, grid: Cell[][]): ParsedSheet | null {
  const filled = (r: Cell[]) => r.filter((c) => c && c.v.trim()).length;
  const h = grid.findIndex((r) => filled(r) >= 2);
  if (h < 0) return null;
  const headers = grid[h].map((c) => (c?.v ?? "").trim());
  const rows = grid
    .slice(h + 1)
    .filter((r) => filled(r) > 0)
    .slice(0, MAX_ROWS)
    .map((r) => headers.map((_, i) => r[i] ?? { v: "" }));
  return { name, headers, rows };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return Response.json({ error: "Upload failed. Try again." }, { status: 400 });
  }
  if (!file) return Response.json({ error: "No file received." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 4 MB. Split it into smaller files." }, { status: 413 });

  const name = file.name.toLowerCase();
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const sheets: ParsedSheet[] = [];
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const text = buf.toString("utf8").replace(/^﻿/, "");
      const s = toSheet(file.name, parseCsv(text).map((r) => r.map((v) => ({ v }))));
      if (s) sheets.push(s);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      for (const ws of wb.worksheets) {
        if (ws.state && ws.state !== "visible") continue;
        const grid: Cell[][] = [];
        ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
          if (rowNumber > MAX_ROWS + 20) return;
          const cells: Cell[] = [];
          for (let c = 1; c <= Math.min(ws.columnCount, 60); c++) cells.push(cellToText(row.getCell(c).value));
          grid[rowNumber - 1] = cells;
        });
        const s = toSheet(ws.name, Array.from(grid, (r) => r ?? []));
        if (s) sheets.push(s);
      }
    } else if (name.endsWith(".xls")) {
      return Response.json({ error: "Old .xls files aren’t supported. In Excel use File → Save As → Excel Workbook (.xlsx)." }, { status: 400 });
    } else {
      return Response.json({ error: "Please upload an Excel (.xlsx) or CSV file." }, { status: 400 });
    }
    if (!sheets.length) return Response.json({ error: "No data found in this file." }, { status: 400 });
    // the sheet with the most rows first (e.g. "All Tasks" before "Summary")
    sheets.sort((a, b) => b.rows.length - a.rows.length);
    return Response.json({ sheets });
  } catch (e) {
    console.error("Import parse failed:", e);
    return Response.json({ error: "Couldn’t read this file. Make sure it is a valid .xlsx or .csv file." }, { status: 400 });
  }
}
