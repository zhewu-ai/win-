import * as XLSX from "xlsx";

// M13 AI 排期导入：把 Excel 转成 AI 可读的结构化文本。
// 程序只负责提取「文件名 / sheet 名 / 非空单元格坐标+文本 / 日期值 / 合并单元格范围」，
// 不判断排期含义——语义由 AI 判断。

const MAX_CELL_LINES = 800;
const MAX_SHEETS = 8;

/** 数字序列 → YYYY-MM-DD（UTC，避免时区错位）。 */
function toDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cellDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return toDateStr(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value).trim();
}

export interface ExcelTextResult {
  text: string;
  sheetCount: number;
  cellCount: number;
}

/** 读取 Excel Buffer，构造成 AI 可读文本。 */
export function excelToText(buffer: Buffer, filename: string): ExcelTextResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets = wb.SheetNames.slice(0, MAX_SHEETS);
  const blocks: string[] = [];
  blocks.push(`文件：${filename}`);

  let cellCount = 0;

  for (const sheetName of sheets) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    blocks.push(`Sheet：${sheetName.trim() || "(未命名)"}`);

    const merges = (sheet["!merges"] ?? []) as XLSX.Range[];
    const mergeLines: string[] = [];
    for (const m of merges) {
      const topLeft = XLSX.utils.encode_cell(m.s);
      const bottomRight = XLSX.utils.encode_cell(m.e);
      const raw = sheet[topLeft]?.v;
      const val = cellDisplay(raw);
      mergeLines.push(`- ${topLeft}:${bottomRight} = ${val}`);
    }
    if (mergeLines.length > 0) {
      blocks.push("合并单元格：");
      blocks.push(...mergeLines);
    }

    const cellLines: string[] = [];
    for (const addr of Object.keys(sheet)) {
      if (addr[0] === "!") continue; // 跳过 !ref/!merges 等元数据键
      const v = sheet[addr]?.v;
      const text = cellDisplay(v);
      if (!text) continue;
      cellLines.push(`- ${addr} = ${text}`);
      cellCount++;
      if (cellLines.length >= MAX_CELL_LINES) break;
    }
    if (cellLines.length > 0) {
      blocks.push("表格内容：");
      blocks.push(...cellLines);
    }
  }

  return { text: blocks.join("\n"), sheetCount: sheets.length, cellCount };
}
