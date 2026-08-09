"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  Note,
  WorkProject,
  WorkProjectColor,
  WorkProjectInput,
  WorkScheduleItem,
  WorkScheduleItemInput,
} from "@/types";
import { useWorkCalendar } from "@/hooks/useWorkCalendar";
import { addDays, fromDateStr, monthOptions, startOfWeek, toDateStr, todayStr } from "@/lib/calendar-date";
import WorkWeekView from "./work/WorkWeekView";
import WorkMonthView from "./work/WorkMonthView";
import WorkTodayView from "./work/WorkTodayView";
import WorkProjectDialog from "./work/WorkProjectDialog";
import WorkScheduleItemDialog from "./work/WorkScheduleItemDialog";
import QuickWeekDialog from "./work/QuickWeekDialog";
import WorkProjectSidePanel from "./work/WorkProjectSidePanel";
import { wpClass } from "./work/color";

type CalendarView = "week" | "month" | "today";

export interface CalendarInitialAction {
  date?: string;
  newEvent?: boolean;
  eventId?: string;
}

interface Props {
  /** 嵌入态（首页右面板）：单栏时提供返回回调关闭面板；双栏不传则头部无返回区 */
  onBack?: () => void;
  /** true → 根节点填充父容器（flex-1 h-full），用于首页嵌入；false → 独立页 h-screen */
  embedded?: boolean;
  /** 父级触发的「添加今日事件/排期」；n 递增可重复触发，null 忽略 */
  openNewEvent?: { date: string; n: number } | null;
  /** 独立页从 URL 深链读到的初始动作，挂载时生效一次 */
  initialAction?: CalendarInitialAction | null;
  /** 便签链接层数据源（首页嵌入时由父级传入；独立页为空时自行拉取未归档便签）。 */
  notes?: Note[];
  /** 今日视图「今天编辑的便签」点击回调；独立页缺省时跳回首页。 */
  onOpenNote?: (noteId: string) => void;
}

function rangeFor(view: CalendarView, monthDate: Date, weekStart: Date, dayDate: Date): { from: string; to: string } {
  if (view === "today") {
    const s = toDateStr(dayDate);
    return { from: s, to: s };
  }
  if (view === "week") {
    return { from: toDateStr(weekStart), to: toDateStr(addDays(weekStart, 6)) };
  }
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  return { from: toDateStr(new Date(y, m, 1)), to: toDateStr(new Date(y, m + 1, 0)) };
}

const COLOR_CYCLE: WorkProjectColor[] = ["blue", "red", "green", "purple", "gray"];

/** 新建项目自动配色：优先未使用色，其次最少使用色。 */
function nextProjectColor(projects: WorkProject[]): WorkProjectColor {
  const used = projects.map((p) => p.colorKey);
  const unused = COLOR_CYCLE.find((c) => !used.includes(c));
  if (unused) return unused;
  const counts = COLOR_CYCLE.map((c) => ({ c, n: used.filter((u) => u === c).length }));
  counts.sort((a, b) => a.n - b.n);
  return counts[0].c;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors flex-shrink-0"
    >
      <span
        className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors ${
          checked ? "bg-primary border-primary text-white" : "border-border-strong"
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

export default function CalendarPageClient({
  onBack,
  embedded = false,
  openNewEvent = null,
  initialAction = null,
  notes,
  onOpenNote,
}: Props) {
  const {
    projects,
    items,
    loading,
    error,
    fetchProjects,
    fetchItems,
    createProject,
    updateProject,
    deleteProject,
    createItem,
    updateItem,
    deleteItem,
    quickWeekPreview,
  } = useWorkCalendar();

  const [view, setView] = useState<CalendarView>("week");
  const [today, setToday] = useState<Date>(() => new Date());
  const [monthDate, setMonthDate] = useState<Date>(() => new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [dayDate, setDayDate] = useState<Date>(() => new Date());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(() => new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [showNoteLayer, setShowNoteLayer] = useState(true);
  const [projectDialog, setProjectDialog] = useState<{ open: boolean; project: WorkProject | null }>({
    open: false,
    project: null,
  });
  const [itemDialog, setItemDialog] = useState<{
    open: boolean;
    item: WorkScheduleItem | null;
    date: string;
    projectId: string | null;
  }>({ open: false, item: null, date: todayStr(), projectId: null });
  const [quickWeekOpen, setQuickWeekOpen] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [fetchedNotes, setFetchedNotes] = useState<Note[] | null>(null);

  // 独立页无 notes prop 时自行拉取未归档便签（今日视图「今天编辑的便签」链接层）
  useEffect(() => {
    if (notes) {
      setFetchedNotes(null);
      return;
    }
    let cancelled = false;
    fetch("/api/notes?archived=false")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.notes)) setFetchedNotes(d.notes as Note[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [notes]);

  const notesForLayer = notes ?? fetchedNotes ?? [];

  // 初始拉取：项目（含归档，供「显示归档」）+ 当前范围排期
  useEffect(() => {
    void fetchProjects(true);
  }, [fetchProjects]);

  const range = useMemo(() => rangeFor(view, monthDate, weekStart, dayDate), [view, monthDate, weekStart, dayDate]);

  useEffect(() => {
    void fetchItems(range.from, range.to);
  }, [fetchItems, range.from, range.to]);

  const initialApplied = useRef(false);
  // 深链初始动作（独立页 /calendar?date=...&new=1 / ?event=<id>），仅首次生效
  useEffect(() => {
    if (initialApplied.current || !initialAction) return;
    initialApplied.current = true;
    const { date, newEvent, eventId } = initialAction;
    if (newEvent && date) {
      setItemDialog({ open: true, item: null, date, projectId: null });
    } else if (eventId) {
      setPendingItemId(eventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

  // 深链 ?event=<id>：命中当前范围排期时打开编辑
  useEffect(() => {
    if (!pendingItemId) return;
    const found = items.find((it) => it.id === pendingItemId);
    if (found) {
      setItemDialog({ open: true, item: found, date: found.startDate, projectId: found.projectId });
      setPendingItemId(null);
    }
  }, [items, pendingItemId]);

  // 嵌入态父级「添加今日事件」：n 递增时打开新建排期弹窗（可重复触发）
  useEffect(() => {
    if (!openNewEvent) return;
    setDayDate(fromDateStr(openNewEvent.date));
    setItemDialog({ open: true, item: null, date: openNewEvent.date, projectId: null });
  }, [openNewEvent]);

  const goToToday = useCallback(() => {
    const t = new Date();
    setToday(t);
    setMonthDate(t);
    setWeekStart(startOfWeek(t));
    setDayDate(t);
  }, []);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (view === "month") setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
      else if (view === "week") setWeekStart((d) => addDays(d, dir * 7));
      else setDayDate((d) => addDays(d, dir));
    },
    [view]
  );

  const handleSelectDay = useCallback((dateStr: string) => {
    setDayDate(fromDateStr(dateStr));
    setView("today");
  }, []);

  // ---- 项目 ----
  const openNewProject = useCallback(() => {
    setUiError(null);
    setProjectDialog({ open: true, project: null });
  }, []);

  const handleSaveProject = useCallback(
    async (input: WorkProjectInput) => {
      if (projectDialog.project) await updateProject(projectDialog.project.id, input);
      else await createProject(input);
    },
    [projectDialog.project, updateProject, createProject]
  );

  const handleArchiveProject = useCallback(
    async (p: WorkProject) => {
      try {
        await updateProject(p.id, { status: "archived" });
        if (!showArchived && selectedProjectId === p.id) setSelectedProjectId(null);
      } catch {
        setUiError("归档失败，请重试");
      }
    },
    [updateProject, showArchived, selectedProjectId]
  );

  const handleRestoreProject = useCallback(
    async (p: WorkProject) => {
      try {
        await updateProject(p.id, { status: "active" });
      } catch {
        setUiError("恢复失败，请重试");
      }
    },
    [updateProject]
  );

  const handleDeleteProject = useCallback(
    async (p: WorkProject) => {
      try {
        await deleteProject(p.id);
        if (selectedProjectId === p.id) setSelectedProjectId(null);
      } catch {
        setUiError("删除失败，请重试");
      }
    },
    [deleteProject, selectedProjectId]
  );

  // ---- 排期条目 ----
  const openNewItem = useCallback((dateStr: string, projectId: string | null = null) => {
    setUiError(null);
    setItemDialog({ open: true, item: null, date: dateStr, projectId });
  }, []);

  const handleItemClick = useCallback((item: WorkScheduleItem) => {
    setUiError(null);
    setItemDialog({ open: true, item, date: item.startDate, projectId: item.projectId });
  }, []);

  const handleSaveItem = useCallback(
    async (input: WorkScheduleItemInput) => {
      if (itemDialog.item) await updateItem(itemDialog.item.id, input);
      else await createItem(input);
    },
    [itemDialog.item, updateItem, createItem]
  );

  const handleDeleteItem = useCallback(
    async (id: string) => {
      try {
        await deleteItem(id);
      } catch {
        setUiError("删除失败，请重试");
      }
    },
    [deleteItem]
  );

  const handleToggleDone = useCallback(
    (item: WorkScheduleItem) => {
      void updateItem(item.id, { status: item.status === "done" ? "todo" : "done" }).catch(() => {});
    },
    [updateItem]
  );

  // ---- 快速录入一周 ----
  const handleQuickWeekCreate = useCallback(
    async (projectId: string, rows: { title: string; type: "range" | "node"; startDate: string; endDate: string }[]) => {
      for (const r of rows) {
        await createItem({
          projectId,
          title: r.title,
          type: r.type,
          startDate: r.startDate,
          endDate: r.endDate,
        });
      }
    },
    [createItem]
  );

  const handleOpenNote = useCallback(
    (noteId: string) => {
      if (onOpenNote) {
        onOpenNote(noteId);
        return;
      }
      window.location.assign("/");
    },
    [onOpenNote]
  );

  // ---- 派生 ----
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const colorOf = useCallback((projectId: string): WorkProjectColor => projectById.get(projectId)?.colorKey ?? "gray", [projectById]);

  const activeProjects = useMemo(() => projects.filter((p) => p.status === "active"), [projects]);
  const visibleProjects = useMemo(
    () => projects.filter((p) => p.status === "active" || showArchived),
    [projects, showArchived]
  );
  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects.filter((p) => !hiddenProjectIds.has(p.id)).map((p) => p.id)),
    [visibleProjects, hiddenProjectIds]
  );
  const visibleItems = useMemo(() => items.filter((it) => visibleProjectIds.has(it.projectId)), [items, visibleProjectIds]);

  const selectedProject = selectedProjectId ? projectById.get(selectedProjectId) ?? null : null;
  const selectedProjectItems = useMemo(
    () => (selectedProject ? items.filter((it) => it.projectId === selectedProject.id) : []),
    [items, selectedProject]
  );

  const defaultItemProjectId = useMemo(() => {
    if (itemDialog.item) return itemDialog.item.projectId;
    if (itemDialog.projectId && projects.some((p) => p.id === itemDialog.projectId)) return itemDialog.projectId;
    if (selectedProjectId && projects.some((p) => p.id === selectedProjectId)) return selectedProjectId;
    return activeProjects[0]?.id ?? null;
  }, [itemDialog.item, itemDialog.projectId, selectedProjectId, projects, activeProjects]);

  const titleLabel =
    view === "month"
      ? `${monthDate.getFullYear()} 年 ${monthDate.getMonth() + 1} 月`
      : view === "week"
        ? `${weekStart.getFullYear()} 年 ${weekStart.getMonth() + 1} 月`
        : `${dayDate.getFullYear()} 年 ${dayDate.getMonth() + 1} 月`;
  const monthSelectOptions = useMemo(() => monthOptions(monthDate), [monthDate]);
  const todayDateStr = toDateStr(today);

  const toggleHidden = useCallback((id: string) => {
    setHiddenProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectProject = useCallback((id: string) => {
    setSelectedProjectId((prev) => (prev === id ? null : id));
  }, []);

  const emptyNoProjects = projects.length === 0;

  return (
    <div
      className={`${
        embedded ? "flex-1 flex flex-col h-full min-h-0 bg-page-bg" : "h-screen flex flex-col bg-page-bg"
      }`}
    >
      {/* 顶栏 */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border-light bg-sidebar-bg flex-shrink-0 flex-wrap">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors whitespace-nowrap"
            title="返回列表"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>
        ) : !embedded ? (
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回便签
          </Link>
        ) : null}
        <h1 className="text-base font-bold text-ink whitespace-nowrap">工作日历</h1>

        <div className="mx-1 h-4 w-px bg-border-light" />

        {/* 视图切换：默认周视图 */}
        <div className="flex rounded-btn border border-border-light overflow-hidden">
          {(
            [
              ["week", "周"],
              ["month", "月"],
              ["today", "今日"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-sm transition-colors ${
                view === v ? "bg-primary text-white font-semibold" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 导航 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            aria-label="上一页"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-7 h-7 flex items-center justify-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            aria-label="下一页"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-2 py-1 text-sm text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
          >
            今天
          </button>
        </div>

        <div className="flex-1 min-w-0" />
        <span className="text-sm font-medium text-ink hidden sm:block">{titleLabel}</span>
        {view === "month" && (
          <select
            value={`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              setMonthDate(new Date(y, m - 1, 1));
            }}
            className="px-2 py-1 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none"
            aria-label="选择月份"
          >
            {monthSelectOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}

        {/* 操作 */}
        <button
          onClick={() => openNewItem(todayStr())}
          className="flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/10 rounded-btn transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
          新增排期
        </button>
        <button
          onClick={openNewProject}
          className="flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover rounded-btn transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          新增项目
        </button>
        <button
          onClick={() => setQuickWeekOpen(true)}
          disabled={activeProjects.length === 0}
          title={activeProjects.length === 0 ? "请先新增项目" : "快速录入一周"}
          className="flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          快速录入
        </button>
      </header>

      {/* 项目筛选 + 开关 */}
      {projects.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border-light flex-wrap flex-shrink-0">
          <span className="text-xs font-medium text-ink-muted flex-shrink-0">项目</span>
          {visibleProjects.map((p) => {
            const hidden = hiddenProjectIds.has(p.id);
            const selected = selectedProjectId === p.id;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 transition-colors ${
                  selected ? "border-primary/40 bg-primary/10" : "border-border-light"
                } ${hidden ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleHidden(p.id)}
                  title={hidden ? "点击显示该项目" : "点击隐藏该项目"}
                  aria-label={`${hidden ? "显示" : "隐藏"}${p.name}`}
                  className="flex items-center justify-center"
                >
                  <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${hidden ? "border-border-strong" : "border-transparent"}`}>
                    <span className={`w-2 h-2 rounded-full ${hidden ? "bg-border-strong" : `wp-dot ${wpClass(p.colorKey)}`}`} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectProject(p.id)}
                  className={`max-w-[140px] truncate text-xs transition-colors ${
                    selected ? "text-ink font-semibold" : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  {p.name || "未命名项目"}
                </button>
              </div>
            );
          })}
          <div className="flex-1 min-w-0" />
          <Toggle label="显示归档" checked={showArchived} onChange={() => setShowArchived((v) => !v)} />
          {view === "today" && (
            <Toggle label="便签链接" checked={showNoteLayer} onChange={() => setShowNoteLayer((v) => !v)} />
          )}
        </div>
      )}

      {/* 主体 */}
      <main className="flex-1 min-h-0 flex">
        <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 py-3 scrollbar-thin">
          {(error || uiError) && (
            <div className="mb-3 px-3 py-2 rounded-card bg-danger/10 text-sm text-danger">{error || uiError}</div>
          )}
          {loading && <div className="mb-2 text-xs text-ink-muted">加载中...</div>}

          {emptyNoProjects ? (
            <div className="py-16 text-center">
              <p className="text-sm text-ink-muted">暂无工作项目，点击右上角「新增项目」开始。</p>
              <button
                onClick={openNewProject}
                className="mt-4 px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
              >
                新增项目
              </button>
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-ink-muted">当前没有可见项目。</p>
              <button
                onClick={() => setShowArchived(true)}
                className="mt-3 text-xs font-medium text-primary hover:bg-primary/10 rounded-btn px-2 py-1 transition-colors"
              >
                显示归档项目
              </button>
            </div>
          ) : view === "week" ? (
            <WorkWeekView
              weekStart={weekStart}
              items={visibleItems}
              today={today}
              colorOf={colorOf}
              onItemClick={handleItemClick}
              onSelectDay={handleSelectDay}
            />
          ) : view === "month" ? (
            <WorkMonthView
              monthDate={monthDate}
              items={visibleItems}
              today={today}
              colorOf={colorOf}
              onItemClick={handleItemClick}
              onSelectDay={handleSelectDay}
            />
          ) : (
            <WorkTodayView
              date={dayDate}
              items={visibleItems}
              notes={showNoteLayer ? notesForLayer : []}
              today={today}
              colorOf={colorOf}
              onItemClick={handleItemClick}
              onToggleDone={handleToggleDone}
              onNewItem={(d) => openNewItem(d)}
              onOpenNote={handleOpenNote}
            />
          )}
        </div>

        {/* 项目详情：桌面固定右栏 / 窄窗口浮层 */}
        {selectedProject && (
          <div className="hidden sm:flex w-[300px] flex-shrink-0">
            <WorkProjectSidePanel
              project={selectedProject}
              items={selectedProjectItems}
              todayStr={todayDateStr}
              onClose={() => setSelectedProjectId(null)}
              onEdit={() => setProjectDialog({ open: true, project: selectedProject })}
              onArchive={() => void handleArchiveProject(selectedProject)}
              onRestore={() => void handleRestoreProject(selectedProject)}
              onDelete={() => void handleDeleteProject(selectedProject)}
              onNewItem={(d) => openNewItem(d, selectedProject.id)}
              onItemClick={handleItemClick}
            />
          </div>
        )}
        {selectedProject && (
          <>
            <div className="sm:hidden fixed inset-0 z-20 bg-black/30" onClick={() => setSelectedProjectId(null)} />
            <div className="sm:hidden fixed inset-y-0 right-0 z-30 w-[85%] max-w-[340px]">
              <WorkProjectSidePanel
                project={selectedProject}
                items={selectedProjectItems}
                todayStr={todayDateStr}
                onClose={() => setSelectedProjectId(null)}
                onEdit={() => setProjectDialog({ open: true, project: selectedProject })}
                onArchive={() => void handleArchiveProject(selectedProject)}
                onRestore={() => void handleRestoreProject(selectedProject)}
                onDelete={() => void handleDeleteProject(selectedProject)}
                onNewItem={(d) => openNewItem(d, selectedProject.id)}
                onItemClick={handleItemClick}
              />
            </div>
          </>
        )}
      </main>

      {/* 弹窗 */}
      <WorkProjectDialog
        open={projectDialog.open}
        project={projectDialog.project}
        defaultColor={nextProjectColor(projects)}
        onClose={() => setProjectDialog({ open: false, project: null })}
        onSave={handleSaveProject}
      />
      <WorkScheduleItemDialog
        open={itemDialog.open}
        item={itemDialog.item}
        defaultDate={itemDialog.date}
        projects={projects}
        defaultProjectId={defaultItemProjectId}
        onClose={() => setItemDialog({ open: false, item: null, date: todayStr(), projectId: null })}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
      <QuickWeekDialog
        open={quickWeekOpen}
        projects={activeProjects}
        defaultWeekStart={toDateStr(weekStart)}
        onClose={() => setQuickWeekOpen(false)}
        onPreview={quickWeekPreview}
        onCreateItems={handleQuickWeekCreate}
      />
    </div>
  );
}
