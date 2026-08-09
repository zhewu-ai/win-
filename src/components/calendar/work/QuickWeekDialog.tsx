"use client";

import { useEffect, useState } from "react";
import type { QuickWeekPreviewRow, WorkProject } from "@/types";

interface Props {
  open: boolean;
  projects: WorkProject[];
  /** 默认周首日（本周一，YYYY-MM-DD）。 */
  defaultWeekStart: string;
  onClose: () => void;
  onPreview: (input: {
    projectId: string;
    weekStart: string;
    days: Record<string, string>;
    nodes: { date: string; title: string }[];
  }) => Promise<QuickWeekPreviewRow[]>;
  onCreateItems: (
    projectId: string,
    rows: { title: string; type: "range" | "node"; startDate: string; endDate: string }[]
  ) => Promise<void>;
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const inputCls =
  "w-full px-2.5 py-1.5 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all";

type EditableRow = { title: string; type: "range" | "node"; startDate: string; endDate: string };

export default function QuickWeekDialog({ open, projects, defaultWeekStart, onClose, onPreview, onCreateItems }: Props) {
  const [projectId, setProjectId] = useState("");
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  const [days, setDays] = useState<Record<string, string>>({
    mon: "",
    tue: "",
    wed: "",
    thu: "",
    fri: "",
    sat: "",
    sun: "",
  });
  const [nodes, setNodes] = useState<{ date: string; title: string }[]>([]);
  const [phase, setPhase] = useState<"input" | "preview">("input");
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProjectId(projects[0]?.id ?? "");
    setWeekStart(defaultWeekStart);
    setDays({ mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" });
    setNodes([]);
    setRows([]);
    setPhase("input");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultWeekStart]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const noProjects = projects.length === 0;

  const handleGenerate = async () => {
    if (noProjects) {
      setError("请先新增项目再快速录入一周");
      return;
    }
    if (!projectId) {
      setError("请选择所属项目");
      return;
    }
    if (!weekStart) {
      setError("请选择周首日（周一）");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const preview = await onPreview({ projectId, weekStart, days, nodes });
      setRows(preview.map((r) => ({ title: r.title, type: r.type, startDate: r.startDate, endDate: r.endDate })));
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成预览失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    const clean = rows.filter((r) => r.title.trim());
    if (clean.length === 0) {
      setError("没有可创建的排期");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await onCreateItems(projectId, clean);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
      setCreating(false);
    }
  };

  const setNode = (i: number, patch: Partial<{ date: string; title: string }>) => {
    setNodes((prev) => prev.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="快速录入一周"
      >
        <h3 className="text-base font-bold text-ink">快速录入一周</h3>

        {noProjects ? (
          <p className="mt-4 px-3 py-4 rounded-card bg-danger/10 text-sm text-danger">
            还没有工作项目，请先创建项目再快速录入一周。
          </p>
        ) : phase === "input" ? (
          <>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">所属项目</label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">周首日（周一）</label>
                  <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="rounded-card border border-border-light overflow-hidden">
                {DAY_KEYS.map((key, i) => (
                  <div key={key} className="flex items-center gap-2 px-3 py-1.5 border-b border-border-light/60 last:border-b-0">
                    <span className="w-8 flex-shrink-0 text-xs font-medium text-ink-muted">{DAY_LABELS[i]}</span>
                    <input
                      type="text"
                      value={days[key] ?? ""}
                      onChange={(e) => setDays((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="当天做什么（留空跳过）"
                      maxLength={120}
                      className="flex-1 min-w-0 text-sm text-ink bg-transparent outline-none placeholder:text-ink-muted/60"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                提示：连续多天相同内容会自动合并为一条连续阶段；含「call/提交/反馈/交付」等词默认单日节点。
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-ink-muted">交付/收付等节点</label>
                  <button
                    type="button"
                    onClick={() => setNodes((prev) => [...prev, { date: weekStart, title: "" }])}
                    className="text-xs font-medium text-primary hover:bg-primary/10 rounded-btn px-1.5 py-0.5 transition-colors"
                  >
                    + 添加节点
                  </button>
                </div>
                {nodes.length === 0 && <p className="text-xs text-ink-muted/70">暂无节点，可在此补充提交/交付/收付时间。</p>}
                <div className="space-y-1.5">
                  {nodes.map((n, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="date"
                        value={n.date}
                        onChange={(e) => setNode(i, { date: e.target.value })}
                        className={`${inputCls} !w-36 flex-shrink-0`}
                      />
                      <input
                        type="text"
                        value={n.title}
                        onChange={(e) => setNode(i, { title: e.target.value })}
                        placeholder="节点标题，如 输出检查"
                        maxLength={120}
                        className={`${inputCls} flex-1 min-w-0`}
                      />
                      <button
                        type="button"
                        onClick={() => setNodes((prev) => prev.filter((_, idx) => idx !== i))}
                        className="flex-shrink-0 p-1 text-ink-muted hover:text-danger rounded transition-colors"
                        aria-label="删除节点"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {generating ? "生成中..." : "生成预览"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-xs text-ink-muted">确认前可修改类型与日期；确认后写入正式排期。</p>
            <div className="mt-2 rounded-card border border-border-light overflow-hidden">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr] gap-2 items-center px-3 py-2 border-b border-border-light/60 last:border-b-0">
                  <input
                    type="text"
                    value={r.title}
                    onChange={(e) => setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))}
                    className="min-w-0 text-sm text-ink bg-transparent outline-none"
                  />
                  <select
                    value={r.type}
                    onChange={(e) => {
                      const t = e.target.value as "range" | "node";
                      setRows((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, type: t, endDate: t === "node" ? x.startDate : x.endDate } : x))
                      );
                    }}
                    className="px-1.5 py-1 text-xs text-ink bg-panel-bg border border-border-light rounded-input outline-none"
                  >
                    <option value="range">连续阶段</option>
                    <option value="node">单日节点</option>
                  </select>
                  <input
                    type="date"
                    value={r.startDate}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, idx) =>
                          idx === i
                            ? { ...x, startDate: e.target.value, endDate: x.type === "node" ? e.target.value : x.endDate }
                            : x
                        )
                      )
                    }
                    className={`${inputCls} !py-1 !px-1.5 !text-xs`}
                  />
                  <input
                    type="date"
                    value={r.type === "node" ? r.startDate : r.endDate}
                    onChange={(e) => setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, endDate: e.target.value } : x)))}
                    disabled={r.type === "node"}
                    className={`${inputCls} !py-1 !px-1.5 !text-xs ${r.type === "node" ? "opacity-50" : ""}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-ink-muted">共 {rows.length} 条排期</div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-between items-center gap-2">
              <button
                onClick={() => setPhase("input")}
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
              >
                返回修改
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {creating ? "创建中..." : `确认创建 ${rows.length} 条`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
