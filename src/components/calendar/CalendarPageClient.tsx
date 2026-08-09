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
import WorkRightPanel from "./work/WorkRightPanel";
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
  /** 独立页从 URL 深链读到的初始动作，挂载时生效一次 */
  initialAction?: CalendarInitialAction | null;
  /** 便签链接层数据源（首页嵌入时由父级传入；独立页为空时自行拉取未归档便签）。 */
  notes?: Note[];
  /** 今日视图「今天编辑的便签」点击回调；独立页缺省时跳回首页。 */
  onOpenNote?: (noteId: string) => void;
  /** 筛选状态上提：父级（首页）同步左侧预览卡片。 */
  hiddenProjectIds?: Set<string>;
  showNoteLayer?: boolean;
  onFilterChange?: (hidden: Set<string>, noteLayer: boolean) => void;
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

const SUB_COPY = "添加连续阶段和单日节点，保存后写入数据库并在月/周/今日视图同步显示。";

export default function CalendarPageClient({
  onBack,
  embedded = false,
  initialAction = null,
  notes,
  onOpenNote,
  hiddenProjectIds: hiddenProjectIdsProp,
  showNoteLayer: showNoteLayerProp,
  onFilterChange,
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
  } = useWorkCalendar();

  const [view, setView] = useState<CalendarView>("week");
  const [today, setToday] = useState<Date>(() => new Date());
  const [monthDate, setMonthDate] = useState<Date>(() => new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [dayDate, setDayDate] = useState<Date>(() => new Date());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(() => hiddenProjectIdsProp ?? new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [showNoteLayer, setShowNoteLayer] = useState(true);
  const [newItemNonce, setNewItemNonce] = useState(0);
  const [newPresetType, setNewPresetType] = useState<"range" | "node">("range");
  const [rightOpen, setRightOpen] = useState(false);
  const [projectDialog, setProjectDialog] = useState<{ open: boolean; project: WorkProject | null }>({
    open: false,
    project: null,
  });
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

  // 初始拉取：项目（含归档，供「显示归档」）+ 全部排期（客户端自行按视图裁剪）
  useEffect(() => {
    void fetchProjects(true);
  }, [fetchProjects]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  // 受控筛选状态（首页嵌入时由父级提供并回传变更）
  useEffect(() => {
    if (hiddenProjectIdsProp) setHiddenProjectIds(hiddenProjectIdsProp);
  }, [hiddenProjectIdsProp]);

  useEffect(() => {
    if (showNoteLayerProp !== undefined) setShowNoteLayer(showNoteLayerProp);
  }, [showNoteLayerProp]);

  useEffect(() => {
    onFilterChange?.(hiddenProjectIds, showNoteLayer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenProjectIds, showNoteLayer]);

  const initialApplied = useRef(false);
  // 深链初始动作（独立页 /calendar?date=...&new=1 / ?event=<id>），仅首次生效
  useEffect(() => {
    if (initialApplied.current || !initialAction) return;
    initialApplied.current = true;
    const { date, newEvent, eventId } = initialAction;
    if (newEvent && date) {
      startNewItem(date, null, "range");
    } else if (eventId) {
      setPendingItemId(eventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

  // 深链 ?event=<id>：命中当前范围排期时选中编辑
  useEffect(() => {
    if (!pendingItemId) return;
    const found = items.find((it) => it.id === pendingItemId);
    if (found) {
      handleItemClick(found);
      setPendingItemId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, pendingItemId]);

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
      if (!window.confirm(`删除项目「${p.name}」？其排期条目将不再显示。`)) return;
      try {
        await deleteProject(p.id);
        if (selectedProjectId === p.id) setSelectedProjectId(null);
        setUiError(null);
      } catch {
        setUiError("删除失败，请重试");
      }
    },
    [deleteProject, selectedProjectId]
  );

  // ---- 排期条目 ----
  const startNewItem = useCallback((dateStr: string, projectId: string | null, type: "range" | "node" = "range") => {
    setDayDate(fromDateStr(dateStr));
    setSelectedItemId(null);
    if (projectId) setSelectedProjectId(projectId);
    setNewPresetType(type);
    setNewItemNonce((n) => n + 1);
    setRightOpen(true);
    setUiError(null);
  }, []);

  const handleCancelForm = useCallback(() => {
    setSelectedItemId(null);
    setNewItemNonce((n) => n + 1);
    setRightOpen(false);
  }, []);

  const handleItemClick = useCallback((item: WorkScheduleItem) => {
    setSelectedItemId(item.id);
    setSelectedProjectId(item.projectId);
    setRightOpen(true);
    setUiError(null);
  }, []);

  const handleCreateItem = useCallback(
    async (input: WorkScheduleItemInput) => {
      await createItem(input);
      // 新建成功后重置表单，方便连续录入
      setNewItemNonce((n) => n + 1);
    },
    [createItem]
  );

  const handleUpdateItem = useCallback(
    async (id: string, input: WorkScheduleItemInput) => {
      await updateItem(id, input);
    },
    [updateItem]
  );

  const handleDeleteItem = useCallback(
    async (id: string) => {
      try {
        await deleteItem(id);
        setSelectedItemId((prev) => (prev === id ? null : prev));
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

  // ---- 筛选 ----
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
    setSelectedItemId(null);
    setRightOpen(true);
  }, []);

  // ---- 派生 ----
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const colorOf = useCallback((projectId: string): WorkProjectColor => projectById.get(projectId)?.colorKey ?? "gray", [projectById]);
  const projectNameOf = useCallback((projectId: string) => projectById.get(projectId)?.name ?? "未知项目", [projectById]);

  const todayDateStr = useMemo(() => toDateStr(today), [today]);

  // 项目生命周期：archived / ended（全部排期已结束，待归档）/ active
  const lifecycleOf = useMemo(() => {
    const m = new Map<string, "active" | "ended" | "archived">();
    for (const p of projects) {
      if (p.status === "archived") {
        m.set(p.id, "archived");
        continue;
      }
      const its = items.filter((i) => i.projectId === p.id);
      m.set(p.id, its.length > 0 && its.every((i) => i.endDate < todayDateStr) ? "ended" : "active");
    }
    return m;
  }, [projects, items, todayDateStr]);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === "active" && lifecycleOf.get(p.id) !== "ended"),
    [projects, lifecycleOf]
  );
  const endedProjects = useMemo(
    () => projects.filter((p) => p.status === "active" && lifecycleOf.get(p.id) === "ended"),
    [projects, lifecycleOf]
  );
  const archivedProjects = useMemo(() => projects.filter((p) => p.status === "archived"), [projects]);

  // 可见排期：active 项目（含已结束，历史仍可见）+ 显式开启的归档项目，减隐藏
  const viewableProjectIds = useMemo(
    () => new Set(projects.filter((p) => p.status === "active" || (p.status === "archived" && showArchived)).map((p) => p.id)),
    [projects, showArchived]
  );
  const visibleProjectIds = useMemo(
    () => new Set([...viewableProjectIds].filter((id) => !hiddenProjectIds.has(id))),
    [viewableProjectIds, hiddenProjectIds]
  );
  const visibleItems = useMemo(() => items.filter((it) => visibleProjectIds.has(it.projectId)), [items, visibleProjectIds]);

  const selectedProject = selectedProjectId ? projectById.get(selectedProjectId) ?? null : null;
  const selectedItem = useMemo(() => (selectedItemId ? items.find((it) => it.id === selectedItemId) ?? null : null), [items, selectedItemId]);

  // 右栏项目下拉：active 项目 + 当前选中条目所属项目
  const rightSelectProjects = useMemo(() => {
    const curId = selectedProject?.id ?? selectedItem?.projectId ?? null;
    return projects.filter((p) => p.status === "active" || p.id === curId);
  }, [projects, selectedProject, selectedItem]);

  const periodLabel = useMemo(() => {
    if (view === "month") return `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;
    if (view === "week") {
      const end = addDays(weekStart, 6);
      return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
    }
    return `今日 · ${dayDate.getFullYear()}年${dayDate.getMonth() + 1}月${dayDate.getDate()}日`;
  }, [view, monthDate, weekStart, dayDate]);

  const monthSelectOptions = useMemo(() => monthOptions(monthDate), [monthDate]);
  const emptyNoProjects = projects.length === 0;

  // 筛选芯片
  const renderChip = (p: WorkProject, opts: { secondary?: boolean }) => {
    const hidden = hiddenProjectIds.has(p.id);
    const selected = selectedProjectId === p.id;
    const life = lifecycleOf.get(p.id);
    return (
      <div
        key={p.id}
        className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 transition-colors ${
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
          <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${hidden ? "border-border-strong" : "border-transparent"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${hidden ? "bg-border-strong" : `wp-dot ${wpClass(p.colorKey)}`}`} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => selectProject(p.id)}
          className={`max-w-[140px] truncate text-xs transition-colors ${selected ? "font-semibold text-ink" : "text-ink-secondary hover:text-ink"}`}
        >
          {p.name || "未命名项目"}
        </button>
        {opts.secondary && life === "ended" && (
          <span className="flex-shrink-0 text-[10px] font-bold text-danger">已结束</span>
        )}
        {opts.secondary && life === "archived" && (
          <span className="flex-shrink-0 text-[10px] font-bold text-ink-muted">已归档</span>
        )}
        {opts.secondary && life === "ended" && (
          <button
            type="button"
            onClick={() => void handleArchiveProject(p)}
            className="flex-shrink-0 rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary hover:text-ink transition-colors"
          >
            归档
          </button>
        )}
        {opts.secondary && life === "archived" && (
          <button
            type="button"
            onClick={() => void handleRestoreProject(p)}
            className="flex-shrink-0 rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] font-semibold text-primary transition-colors"
          >
            恢复
          </button>
        )}
      </div>
    );
  };

  const renderRightPanel = (
    <WorkRightPanel
      projects={rightSelectProjects}
      selectedProject={selectedProject}
      selectedItem={selectedItem}
      todayStr={todayDateStr}
      newItemNonce={newItemNonce}
      presetType={newPresetType}
      onCreateItem={handleCreateItem}
      onUpdateItem={handleUpdateItem}
      onDeleteItem={handleDeleteItem}
      onNewProject={openNewProject}
      onCancel={handleCancelForm}
    />
  );

  return (
    <div
      className={`${
        embedded ? "flex-1 flex flex-col h-full min-h-0 bg-page-bg" : "h-screen flex flex-col bg-page-bg"
      }`}
    >
      {/* 顶行：返回 + 标题/说明 + 导航 + 视图切换 */}
      <header className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-light px-3 py-2">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors whitespace-nowrap"
            title="返回列表"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>
        ) : !embedded ? (
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors whitespace-nowrap"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回便签
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight text-ink">工作日历</h1>
          <p className="hidden text-xs leading-relaxed text-ink-muted sm:block">{SUB_COPY}</p>
        </div>

        {/* 导航 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="hidden text-sm font-semibold text-ink sm:block">{periodLabel}</span>
          <button
            onClick={() => navigate(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-btn text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
            aria-label="上一页"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="rounded-btn px-2 py-1 text-sm text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
          >
            今天
          </button>
          <button
            onClick={() => navigate(1)}
            className="flex h-7 w-7 items-center justify-center rounded-btn text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
            aria-label="下一页"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {view === "month" && (
            <select
              value={`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                setMonthDate(new Date(y, m - 1, 1));
              }}
              className="ml-1 rounded-input border border-border-light bg-panel-bg px-1.5 py-1 text-sm text-ink outline-none"
              aria-label="选择月份"
            >
              {monthSelectOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 视图切换（segmented） */}
        <div className="flex flex-shrink-0 items-center rounded-lg border border-border-light bg-panel-bg p-0.5">
          {(
            [
              ["today", "今日"],
              ["month", "月"],
              ["week", "周"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-sm rounded-md transition-colors ${
                view === v ? "bg-primary font-semibold text-white" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* 筛选行：项目 chip + 便签链接 + 手动添加入口 + 归档开关 */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 border-b border-border-light px-3 py-2">
        {emptyNoProjects ? (
          <span className="text-xs text-ink-muted">暂无项目，点击「新增项目」开始。</span>
        ) : (
          activeProjects.map((p) => renderChip(p, { secondary: false }))
        )}
        <button
          type="button"
          onClick={() => setShowNoteLayer((v) => !v)}
          className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 transition-colors ${
            showNoteLayer ? "border-[var(--note)]/40 bg-[var(--note)]/10" : "border-border-light opacity-50"
          }`}
          title={showNoteLayer ? "点击隐藏便签链接" : "点击显示便签链接"}
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-transparent">
            <span className={`h-2.5 w-2.5 rounded-full ${showNoteLayer ? "bg-[var(--note)]" : "bg-border-strong"}`} />
          </span>
          <span className={`text-xs ${showNoteLayer ? "text-[var(--note)]" : "text-ink-secondary"}`}>便签链接</span>
        </button>

        <div className="flex-1 min-w-0" />

        <button
          onClick={() => startNewItem(todayStr(), null, "range")}
          className="flex items-center gap-1 rounded-btn bg-primary px-2.5 py-1 text-sm font-medium text-white transition-colors hover:bg-primary/90 whitespace-nowrap"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
          添加连续阶段
        </button>
        <button
          onClick={() => startNewItem(todayStr(), null, "node")}
          className="flex items-center gap-1 rounded-btn px-2 py-1 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink whitespace-nowrap"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          添加单日节点
        </button>
        <button
          onClick={openNewProject}
          className="flex items-center gap-1 rounded-btn px-2 py-1 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink whitespace-nowrap"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          新增项目
        </button>
        <Toggle label="显示归档" checked={showArchived} onChange={() => setShowArchived((v) => !v)} />
      </div>

      {/* 已结束待归档 / 已归档 chip 行 */}
      {(endedProjects.length > 0 || (showArchived && archivedProjects.length > 0)) && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 border-b border-border-light bg-surface-strong/30 px-3 py-1.5">
          <span className="text-[10px] font-semibold text-ink-muted flex-shrink-0">
            {endedProjects.length > 0 ? "已结束待归档" : "已归档"}
          </span>
          {endedProjects.map((p) => renderChip(p, { secondary: true }))}
          {showArchived && archivedProjects.map((p) => renderChip(p, { secondary: true }))}
        </div>
      )}

      {/* 主体：视图 + 桌面右栏 */}
      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 flex-1 overflow-y-auto px-2 py-3 scrollbar-thin sm:px-4">
          {(error || uiError) && (
            <div className="mb-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error || uiError}</div>
          )}
          {loading && <div className="mb-2 text-xs text-ink-muted">加载中...</div>}

          {emptyNoProjects ? (
            <div className="py-16 text-center">
              <p className="text-sm text-ink-muted">暂无工作项目，点击右上角「新增项目」开始。</p>
              <button
                onClick={openNewProject}
                className="mt-4 rounded-btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                新增项目
              </button>
            </div>
          ) : view === "week" ? (
            <WorkWeekView
              weekStart={weekStart}
              items={visibleItems}
              today={today}
              colorOf={colorOf}
              showNoteLayer={showNoteLayer}
              onItemClick={handleItemClick}
              onSelectDay={handleSelectDay}
            />
          ) : view === "month" ? (
            <WorkMonthView
              monthDate={monthDate}
              items={visibleItems}
              today={today}
              colorOf={colorOf}
              showNoteLayer={showNoteLayer}
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
              projectNameOf={projectNameOf}
              showNoteLayer={showNoteLayer}
              onItemClick={handleItemClick}
              onToggleDone={handleToggleDone}
              onOpenNote={handleOpenNote}
            />
          )}
        </main>

        {/* 桌面右栏：手动添加/编辑表单 */}
        <div className="hidden w-[286px] flex-shrink-0 sm:flex">{renderRightPanel}</div>
      </div>

      {/* 窄窗口：右栏抽屉 */}
      {rightOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30 sm:hidden" onClick={() => setRightOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-40 flex w-[85%] max-w-[340px] flex-col sm:hidden">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border-light bg-sidebar-bg px-3 py-1.5">
              <span className="text-xs font-semibold text-ink-muted">手动添加 / 编辑</span>
              <button
                onClick={() => setRightOpen(false)}
                className="rounded-btn p-1 text-ink-muted transition-colors hover:text-ink"
                aria-label="关闭"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1">{renderRightPanel}</div>
          </div>
        </>
      )}

      {/* 新增项目弹窗 */}
      <WorkProjectDialog
        open={projectDialog.open}
        project={projectDialog.project}
        defaultColor={nextProjectColor(projects)}
        onClose={() => setProjectDialog({ open: false, project: null })}
        onSave={handleSaveProject}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex flex-shrink-0 items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
    >
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors ${
          checked ? "border-primary bg-primary text-white" : "border-border-strong"
        }`}
      >
        {checked && (
          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}
