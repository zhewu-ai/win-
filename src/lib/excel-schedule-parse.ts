import * as XLSX from "xlsx";
import type {
  CalendarImportDraft,
  CalendarImportDraftItem,
  CalendarImportDraftProject,
} from "@/types";

// M13 程序硬解析兜底：AI 超时/失败/空草稿时，用确定性规则从周历横排 Excel 生成可编辑草稿。
// 只输出草稿，绝不直接入库（写入走 /confirm）。耗时目标 <2s。

export interface ExcelProgramResult {
  draft: CalendarImportDraft;
  durationMs: number;
}

const GENERIC_SHEET = /^(sheet\d*|工作簿\d*)$/i;
const LABEL_TEXT = new Set(["project/date", "project", "日期", "项目", "/", "-", "—"]);
const MONTH_LABEL = /^(一|二|三|四|五|六|七|八|九|十|十一|十二)月$/;
const DATE_ROW_MIN = 5; // 至少 5 个连续日期单元格才算日期行

function toDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isDate(v: unknown): v is Date {
  return v instanceof Date && !Number.isNaN(v.getTime());
}

/** 单元格文本归一：多行 → “ / ”，并折叠多余的连续斜杠。 */
function cleanText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return "";
  let s = String(v).replace(/\s*\r?\n+\s*/g, " / ").replace(/\s*\/\s*\/\s*/g, " / ").trim();
  return s;
}

/** 标题清理：去掉 “Production Schedule/Timeline/时间表” 尾缀与 “丨/|” 分段前缀。 */
function stripProjectSuffix(name: string): string {
  let s = name
    .replace(
      /\s*(Production Schedule|Production|Timeline|Schedule|制作时间表|时间表|排期表)\s*$/i,
      ""
    )
    .split(/\s*[丨|\|]\s*/)[0]
    .trim();
  s = s.replace(/[-_—\s]+$/, "").replace(/\s+/g, " ").trim();
  return s;
}

/** 从左上区域取第一行有含义文本作为标题（跳过标签/月份）。 */
function collectTitle(ws: XLSX.WorkSheet): string {
  const seen = new Set<string>();
  for (let r = 1; r <= 8; r++) {
    for (let c = 0; c < 6; c++) {
      const cell = ws[`${XLSX.utils.encode_col(c)}${r}`];
      if (!cell) continue;
      const t = cleanText(cell.v);
      if (!t) continue;
      if (MONTH_LABEL.test(t)) continue;
      if (
        /^(日期|尺寸|规格|导演|客户|代理|监制|交付|项目|制作时间|timeline|production schedule|schedule|anoval)$/i.test(
          t
        )
      )
        continue;
      if (seen.has(t)) continue;
      seen.add(t);
      return t;
    }
  }
  return "";
}

/** 项目名推断优先级：标题 → sheet 名 → 文件名主干。 */
function inferProjectName(sheetName: string, title: string, filename: string): string {
  const lines = title
    .split(/\r?\n/)
    .filter((l) => !/^(Production Schedule|Timeline|Schedule|制作时间表|时间表)$/i.test(l.trim()));
  let t = stripProjectSuffix(lines.join(" ").trim());
  if (t && t.length > 1) return t.slice(0, 60);
  if (sheetName && !GENERIC_SHEET.test(sheetName)) return sheetName.slice(0, 60);
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-\s]*(20\d{2}|19\d{2})[\d_]*$/, "")
    .trim();
  return base.slice(0, 60) || "未命名项目";
}

interface Acc {
  projects: CalendarImportDraftProject[];
  items: CalendarImportDraftItem[];
  warnings: string[];
}

function ensureProject(acc: Acc, name: string): string {
  const existing = acc.projects.find((p) => p.name === name);
  if (existing) return existing.tempId;
  const tempId = `p${acc.projects.length + 1}`;
  acc.projects.push({ tempId, name });
  return tempId;
}

function parseSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
  filename: string,
  acc: Acc
): void {
  // 1) 行 → 单元格
  const rowCells = new Map<number, Map<number, unknown>>();
  let maxRow = 0;
  for (const addr of Object.keys(ws)) {
    if (addr[0] === "!") continue;
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    const col = XLSX.utils.decode_col(m[1]);
    const row = Number(m[2]);
    if (row > 400) continue;
    if (!rowCells.has(row)) rowCells.set(row, new Map());
    rowCells.get(row)!.set(col, ws[addr].v);
    if (row > maxRow) maxRow = row;
  }

  // 2) 水平合并（值在左上角）：SheetJS merge 坐标为 0 基行 → 统一转成 1 基行 key
  const hMerge = new Map<string, number>();
  for (const m of ws["!merges"] ?? []) {
    if (m.e.c > m.s.c && m.s.r === m.e.r) {
      const key = `${m.s.r + 1}:${m.s.c}`;
      const prev = hMerge.get(key) ?? -1;
      hMerge.set(key, Math.max(prev, m.e.c));
    }
  }

  // 3) 找日期行：≥5 个连续日期单元格
  const dateRows: { row: number; dates: Map<number, Date>; min: number; max: number }[] = [];
  for (const [row, cells] of [...rowCells.entries()].sort((a, b) => a[0] - b[0])) {
    const dates = [...cells.entries()]
      .filter(([, v]) => isDate(v))
      .sort((a, b) => a[0] - b[0]);
    if (dates.length < DATE_ROW_MIN) continue;
    let runStart = dates[0][0];
    let runEnd = dates[0][0];
    const runs: [number, number][] = [];
    for (let i = 1; i <= dates.length; i++) {
      if (i === dates.length || dates[i][0] !== runEnd + 1) {
        runs.push([runStart, runEnd]);
        if (i < dates.length) {
          runStart = dates[i][0];
          runEnd = dates[i][0];
        }
      } else {
        runEnd = dates[i][0];
      }
    }
    const best = runs
      .filter(([s, e]) => e - s + 1 >= DATE_ROW_MIN)
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    if (!best) continue;
    const datesMap = new Map<number, Date>(
      dates.filter(([c]) => c >= best[0] && c <= best[1]) as [number, Date][]
    );
    dateRows.push({ row, dates: datesMap, min: best[0], max: best[1] });
  }
  if (dateRows.length === 0) {
    acc.warnings.push(`${sheetName}：未找到日期行，已跳过`);
    return;
  }

  const titleText = collectTitle(ws);
  const fallbackProject = inferProjectName(sheetName, titleText, filename);
  const firstDateCol = dateRows[0].min;
  const projectCol = firstDateCol - 1; // 左侧项目列（无则 -1）

  // 4) 扫描日期行之间的任务行
  const seen = new Set<string>();
  let tempCounter = 0;
  const rowEntries = [...rowCells.entries()].sort((a, b) => a[0] - b[0]);
  for (const [row, cells] of rowEntries) {
    if (row <= dateRows[0].row) continue;
    // 最近的日期行（<= 当前行）
    let dr = dateRows[0];
    for (const d of dateRows) {
      if (d.row <= row) dr = d;
      else break;
    }
    if (row === dr.row) continue;

    const tasks: { col: number; date: Date; text: string }[] = [];
    for (const [col, date] of dr.dates) {
      const v = cells.get(col);
      if (v === undefined) continue;
      const text = cleanText(v);
      if (!text) continue;
      if (LABEL_TEXT.has(text.toLowerCase()) || MONTH_LABEL.test(text)) continue;
      if (text.startsWith("*") || text.startsWith("备注")) continue;
      tasks.push({ col, date, text });
    }
    if (tasks.length === 0) continue;

    // 逐行项目名（左侧项目列），否则用兜底项目名
    let projectName = "";
    if (projectCol >= 0) {
      const pc = cells.get(projectCol);
      if (pc !== undefined) {
        const t = cleanText(pc);
        if (t && !LABEL_TEXT.has(t.toLowerCase()) && !MONTH_LABEL.test(t)) projectName = t;
      }
    }
    const projName = projectName || fallbackProject;
    const projectTempId = ensureProject(acc, projName);

    // 同文本连续列 / 水平合并 → 跨天 span
    const used = new Set<number>();
    const spans: { col: number; endCol: number; text: string }[] = [];
    for (const t of tasks) {
      if (used.has(t.col)) continue;
      let endCol = t.col;
      const me = hMerge.get(`${row}:${t.col}`);
      if (me !== undefined && me > t.col) {
        endCol = me;
        // 合并范围内若有自己的值（如 Laputa R11 C..G 合并但 E 另有值），
        // 合并 span 只到该值前一列，覆盖格自身单独成条，避免吞掉信息
        const covered = tasks
          .filter((x) => x.col > t.col && x.col <= me)
          .sort((a, b) => a.col - b.col);
        if (covered.length > 0) endCol = Math.min(endCol, covered[0].col - 1);
      }
      if (endCol === t.col) {
        let c = t.col;
        while (tasks.some((x) => x.col === c + 1 && x.text === t.text)) c++;
        if (c > t.col) endCol = c;
      }
      if (endCol > dr.max) endCol = dr.max;
      for (let cc = t.col; cc <= endCol; cc++) used.add(cc);
      spans.push({ col: t.col, endCol, text: t.text });
    }

    for (const sp of spans) {
      const startDate = toDateStr(dr.dates.get(sp.col)!);
      const endDate = toDateStr(dr.dates.get(sp.endCol)!);
      const key = `${projName} ${sp.text} ${startDate} ${endDate}`;
      if (seen.has(key)) continue;
      seen.add(key);
      acc.items.push({
        tempId: `t${++tempCounter}`,
        projectTempId,
        title: sp.text,
        startDate,
        endDate,
        confidence: 0.5, // 程序解析置信度低 → 前端标「请确认」
        sourceRef: `${sheetName}!${XLSX.utils.encode_col(sp.col)}${row}`,
      });
    }
  }
}

export function parseExcelSchedule(buffer: Buffer, filename: string): ExcelProgramResult {
  const t0 = Date.now();
  const acc: Acc = { projects: [], items: [], warnings: [] };
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    acc.warnings.push("PROGRAM_FALLBACK_USED: Excel 程序解析失败，无法生成草稿。");
    return {
      draft: { projects: [], items: [], warnings: acc.warnings },
      durationMs: Date.now() - t0,
    };
  }
  for (const sheetName of wb.SheetNames) {
    try {
      parseSheet(wb.Sheets[sheetName], sheetName, filename, acc);
    } catch {
      acc.warnings.push(`${sheetName}：程序解析失败，已跳过`);
    }
  }
  acc.warnings.unshift("PROGRAM_FALLBACK_USED: AI 识别未及时返回，已使用 Excel 程序解析生成草稿，请确认。");
  return {
    draft: { projects: acc.projects, items: acc.items, warnings: acc.warnings },
    durationMs: Date.now() - t0,
  };
}
