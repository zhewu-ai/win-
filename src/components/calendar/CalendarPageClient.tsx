"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  CalendarImportDraft,
  CalendarImportStage,
  CalendarImportUsage,
  CalendarImportYearNotice,
  Note,
  WorkProject,
  WorkProjectColor,
  WorkProjectInput,
  WorkScheduleItem,
  WorkScheduleItemInput,
} from "@/types";
import { useWorkCalendar } from "@/hooks/useWorkCalendar";
import { addDays, fromDateStr, isSameDay, monthOptions, startOfWeek, toDateStr, todayStr } from "@/lib/calendar-date";
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

// M13 导入阶段定义（2.1）：上传文件 → 读取内容 → AI 识别 → 整理草稿 → 等待确认
const IMPORT_STAGES: { id: CalendarImportStage["id"]; label: string }[] = [
  { id: "upload", label: "上传文件" },
  { id: "read", label: "读取内容" },
  { id: "ai", label: "AI 识别" },
  { id: "draft", label: "整理草稿" },
  { id: "wait", label: "等待确认" },
];
const STAGE_ORDER: CalendarImportStage["id"][] = IMPORT_STAGES.map((s) => s.id);
const AI_ERROR_CODES = new Set([
  "AI_NOT_CONFIGURED",
  "AI_NETWORK_ERROR",
  "AI_HTTP_ERROR",
  "AI_TIMEOUT",
  "AI_EMPTY",
  "AI_INVALID_JSON",
  "INVALID_DRAFT",
]);

function buildStages(st: Partial<Record<CalendarImportStage["id"], CalendarImportStage["status"]>>): CalendarImportStage[] {
  return IMPORT_STAGES.map((s) => ({ id: s.id, label: s.label, status: st[s.id] ?? "waiting" }));
}

/** 失败时标记失败阶段为 error，其前阶段 done、其后阶段 waiting。 */
function failStages(
  code: string | undefined,
  message: string
): CalendarImportStage[] {
  const failedId = !code ? "ai" : code === "EXCEL_READ_FAILED" ? "read" : AI_ERROR_CODES.has(code) ? "ai" : "upload";
  const fi = STAGE_ORDER.indexOf(failedId);
  return IMPORT_STAGES.map((s) => {
    const i = STAGE_ORDER.indexOf(s.id);
    if (i === fi) return { id: s.id, label: s.label, status: "error", error: message };
    if (i < fi) return { id: s.id, label: s.label, status: "done" };
    return { id: s.id, label: s.label, status: "waiting" };
  });
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 新建项目自动配色：优先未使用色，其次最少使用色。 */
function nextProjectColor(projects: WorkProject[]): WorkProjectColor {
  const used = projects.map((p) => p.colorKey);
  const unused = COLOR_CYCLE.find((c) => !used.includes(c));
  if (unused) return unused;
  const counts = COLOR_CYCLE.map((c) => ({ c, n: used.filter((u) => u === c).length }));
  counts.sort((a, b) => a.n - b.n);
  return counts[0].c;
}

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
  const [rightMode, setRightMode] = useState<"item" | "project">("item");
  const [rightOpen, setRightOpen] = useState(false);
  const [projectDialog, setProjectDialog] = useState<{ open: boolean; project: WorkProject | null }>({
    open: false,
    project: null,
  });
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [fetchedNotes, setFetchedNotes] = useState<Note[] | null>(null);

  // M13 AI 排期导入状态：uploading/preview/confirming/idle
  const [importState, setImportState] = useState<{
    step: "idle" | "uploading" | "preview" | "confirming";
    draft: CalendarImportDraft | null;
    usage: CalendarImportUsage | null;
    kind: "image" | "excel" | null;
    error: string | null;
    doneMessage: string | null;
  }>({ step: "idle", draft: null, usage: null, kind: null, error: null, doneMessage: null });
  // 2.1 阶段进度与 AI 等待秒数；2.2 年份异常提示
  const [importStages, setImportStages] = useState<CalendarImportStage[] | null>(null);
  const [importElapsed, setImportElapsed] = useState(0);
  const [yearNotice, setYearNotice] = useState<CalendarImportYearNotice | null>(null);
  const lastFileRef = useRef<{ file: File } | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // M12 体验细修 2.9：工作区宽度 <520px 进入窄宽专注模式（工具区默认收起，可展开）。
  // 挂载时同步测量一次（窄窗直接加载 / 双栏窄面板都正确），ResizeObserver 负责后续窗口变化。
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = () => setFocusMode(el.getBoundingClientRect().width < 520);
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 2.5 月视图连续月份滚动：锚点月前后 ±3 个月纵向堆叠，切换锚点月时滚动到对应月
  const monthContainerRef = useRef<HTMLDivElement>(null);
  const monthRange = useMemo(() => {
    const out: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      out.push(new Date(monthDate.getFullYear(), monthDate.getMonth() + i, 1));
    }
    return out;
  }, [monthDate]);
  useEffect(() => {
    if (view !== "month") return;
    const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
    const el = monthContainerRef.current?.querySelector(`[data-month="${key}"]`);
    el?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [monthDate, view]);

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
      startNewItem(date, null);
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

  const handleEditProject = useCallback((p: WorkProject) => {
    setUiError(null);
    setProjectDialog({ open: true, project: p });
  }, []);

  const handleArchiveProject = useCallback(
    async (p: WorkProject) => {
      try {
        await updateProject(p.id, { status: "archived" });
        if (!showArchived && selectedProjectId === p.id) {
          setSelectedProjectId(null);
          setRightMode("item");
          setRightOpen(false);
        }
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
        if (selectedProjectId === p.id) {
          setSelectedProjectId(null);
          setRightMode("item");
          setRightOpen(false);
        }
        setUiError(null);
      } catch {
        setUiError("删除失败，请重试");
      }
    },
    [deleteProject, selectedProjectId]
  );

  // ---- 排期条目 ----
  const startNewItem = useCallback((dateStr: string, projectId: string | null) => {
    setDayDate(fromDateStr(dateStr));
    setSelectedItemId(null);
    if (projectId) setSelectedProjectId(projectId);
    setRightMode("item");
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
    setRightMode("item");
    setRightOpen(true);
    setUiError(null);
  }, []);

  const handleAddItemToProject = useCallback(
    (p: WorkProject) => {
      startNewItem(todayStr(), p.id);
    },
    [startNewItem]
  );

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

  // ---- M13 AI 排期导入（3.1 单入口：后端按文件类型自动路由，前端不再传 kind） ----
  const handleParseFile = useCallback(async (file: File) => {
    lastFileRef.current = { file };
    setImportState((s) => ({ ...s, step: "uploading", error: null, doneMessage: null }));
    setYearNotice(null);
    setImportElapsed(0);
    // 2.1 阶段进度：上传文件 → 读取内容 → AI 识别
    setImportStages(buildStages({ upload: "active" }));
    await delay(150);
    setImportStages(buildStages({ upload: "done", read: "active" }));
    await delay(250);
    setImportStages(buildStages({ upload: "done", read: "done", ai: "active" }));
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => setImportElapsed((e) => e + 1), 1000);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/calendar-imports/parse", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (!res.ok) {
        const message = data?.message || "识别失败，请重试";
        setImportStages(failStages(data?.error, message));
        setImportState((s) => ({ ...s, step: "idle", error: message }));
        return;
      }
      // 成功：整理草稿 → 等待确认 → 进入预览
      setImportStages(buildStages({ upload: "done", read: "done", ai: "done", draft: "active" }));
      await delay(180);
      setImportStages(buildStages({ upload: "done", read: "done", ai: "done", draft: "done", wait: "active" }));
      await delay(280);
      setImportStages(null);
      setImportElapsed(0);
      setImportState((s) => ({
        ...s,
        step: "preview",
        draft: data.draft ?? null,
        usage: data.usage ?? null,
        kind: data.kind === "excel" || data.kind === "image" ? data.kind : null,
        error: null,
      }));
      setYearNotice(data.yearNotice ?? null);
    } catch {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      const message = "网络错误，请重试";
      setImportStages(failStages(undefined, message));
      setImportState((s) => ({ ...s, step: "idle", error: message }));
    }
  }, []);

  const handleRetryImport = useCallback(() => {
    const last = lastFileRef.current;
    if (last) void handleParseFile(last.file);
  }, [handleParseFile]);

  const handleUpdateDraft = useCallback((draft: CalendarImportDraft) => {
    setImportState((s) => ({ ...s, draft }));
  }, []);

  const handleCancelImport = useCallback(() => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setImportStages(null);
    setImportElapsed(0);
    setYearNotice(null);
    setImportState({ step: "idle", draft: null, usage: null, kind: null, error: null, doneMessage: null });
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!importState.draft) return;
    setImportState((s) => ({ ...s, step: "confirming", error: null }));
    try {
      const res = await fetch("/api/calendar-imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: importState.draft }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setImportState((s) => ({
          ...s,
          step: "preview",
          error: data?.message || data?.error || "导入失败，请重试",
        }));
        return;
      }
      const msg = `已导入 ${data?.created?.items ?? 0} 条排期、${data?.created?.projects ?? 0} 个项目`;
      setImportState({ step: "idle", draft: null, usage: null, kind: null, error: null, doneMessage: msg });
      setYearNotice(null);
      void fetchProjects(true);
      void fetchItems();
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      doneTimerRef.current = setTimeout(() => {
        setImportState((s) => ({ ...s, doneMessage: null }));
      }, 5000);
    } catch {
      setImportState((s) => ({ ...s, step: "preview", error: "网络错误，导入失败" }));
    }
  }, [importState.draft, fetchProjects, fetchItems]);

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
    setRightMode("project");
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

  const detailProject = rightMode === "project" ? selectedProject : null;
  const detailLifecycle = detailProject ? lifecycleOf.get(detailProject.id) ?? "active" : "active";
  const detailItemCount = detailProject ? items.filter((i) => i.projectId === detailProject.id).length : 0;

  // 右栏项目下拉：active 项目 + 当前选中条目所属项目
  const rightSelectProjects = useMemo(() => {
    const curId = selectedProject?.id ?? selectedItem?.projectId ?? null;
    return projects.filter((p) => p.status === "active" || p.id === curId);
  }, [projects, selectedProject, selectedItem]);

  // 2.4/2.7 顶部日期导航标签：日视图显示具体日期，月/周显示区间
  const compactPeriodLabel = useMemo(() => {
    if (view === "month") return `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;
    if (view === "week") {
      const end = addDays(weekStart, 6);
      return weekStart.getMonth() === end.getMonth()
        ? `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 - ${end.getDate()}日`
        : `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
    }
    return `${dayDate.getMonth() + 1}月${dayDate.getDate()}日`;
  }, [view, monthDate, weekStart, dayDate]);

  const isOnTodayPeriod = useMemo(() => {
    const now = new Date();
    if (view === "month") {
      return now.getFullYear() === monthDate.getFullYear() && now.getMonth() === monthDate.getMonth();
    }
    if (view === "week") return isSameDay(now, weekStart);
    return isSameDay(now, dayDate);
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
      </div>
    );
  };

  const renderRightPanel = (
    <WorkRightPanel
      projects={rightSelectProjects}
      selectedProject={selectedProject}
      detailProject={detailProject}
      detailItemCount={detailItemCount}
      detailLifecycle={detailLifecycle}
      selectedItem={selectedItem}
      todayStr={todayDateStr}
      newItemNonce={newItemNonce}
      onCreateItem={handleCreateItem}
      onUpdateItem={handleUpdateItem}
      onDeleteItem={handleDeleteItem}
      onEditProject={handleEditProject}
      onArchiveProject={handleArchiveProject}
      onRestoreProject={handleRestoreProject}
      onDeleteProject={handleDeleteProject}
      onAddItemToProject={handleAddItemToProject}
      onNewProject={openNewProject}
      onCancel={handleCancelForm}
      importDraft={importState.draft}
      importUsage={importState.usage}
      importKind={importState.kind}
      importStages={importStages}
      importElapsed={importElapsed}
      importYearNotice={yearNotice}
      importBusy={importState.step === "uploading" || importState.step === "confirming"}
      importError={importState.error}
      importDoneMessage={importState.doneMessage}
      onParseFile={handleParseFile}
      onUpdateDraft={handleUpdateDraft}
      onConfirmImport={handleConfirmImport}
      onCancelImport={handleCancelImport}
      onRetryImport={handleRetryImport}
      onDismissYearNotice={() => setYearNotice(null)}
    />
  );

  return (
    <div
      ref={rootRef}
      className={`${
        embedded ? "flex-1 flex flex-col h-full min-h-0 bg-page-bg" : "h-screen flex flex-col bg-page-bg"
      }`}
    >
      {/* 顶行：返回 + 标题 + 日期导航 + 视图切换（2.4/2.7/2.9 压缩分层） */}
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-border-light px-3 py-2">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            title="返回列表"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : !embedded ? (
          <Link
            href="/"
            className="flex flex-shrink-0 items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors whitespace-nowrap"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回便签
          </Link>
        ) : null}

        {!focusMode && <h1 className="truncate text-[18px] font-bold leading-tight text-ink">工作日历</h1>}

        <div className="min-w-0 flex-1" />

        {/* 日期导航：‹ 8月10日 ›（2.4 压缩；2.7 日视图显示具体日期） */}
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button
            onClick={() => navigate(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-btn text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
            aria-label="上一页"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="whitespace-nowrap text-sm font-semibold text-ink">{compactPeriodLabel}</span>
          <button
            onClick={() => navigate(1)}
            className="flex h-7 w-7 items-center justify-center rounded-btn text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
            aria-label="下一页"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {view === "month" && !focusMode && (
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

        {/* 视图切换：日 / 周 / 月（2.7 命名） */}
        <div className="flex flex-shrink-0 items-center rounded-lg border border-border-light bg-panel-bg p-0.5">
          {(
            [
              ["today", "日"],
              ["week", "周"],
              ["month", "月"],
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

        {/* 窄宽专注模式：展开/收起工具区（2.9） */}
        {focusMode && (
          <button
            onClick={() => setToolbarExpanded((v) => !v)}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-btn text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
            aria-label={toolbarExpanded ? "收起工具区" : "展开工具区"}
            title={toolbarExpanded ? "收起工具区" : "展开工具区"}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
        )}
      </header>

      {/* 工具区：今天 + 项目筛选 + 便签链接 + 添加/归档（窄宽专注模式默认收起） */}
      {(!focusMode || toolbarExpanded) && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 border-b border-border-light px-3 py-2">
          <button
            onClick={goToToday}
            className={`flex-shrink-0 rounded-btn px-2 py-1 text-xs font-semibold transition-colors ${
              isOnTodayPeriod ? "text-primary" : "text-ink-muted hover:text-ink hover:bg-surface-hover"
            }`}
            title="回到今天"
          >
            今天
          </button>
          {emptyNoProjects ? (
            <span className="text-xs text-ink-muted">暂无项目</span>
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
            onClick={() => startNewItem(todayStr(), null)}
            className="flex items-center gap-1 rounded-btn bg-primary px-2.5 py-1 text-sm font-medium text-white transition-colors hover:bg-primary/90 whitespace-nowrap"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
            添加排期
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
      )}

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
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-[clamp(10px,3vw,36px)] py-3">
          {(error || uiError) && (
            <div className="mb-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error || uiError}</div>
          )}
          {loading && <div className="mb-2 text-xs text-ink-muted">加载中...</div>}

          {emptyNoProjects ? (
            <div className="py-16 text-center">
              <p className="text-sm text-ink-muted">暂无项目</p>
              <button
                onClick={openNewProject}
                className="mt-4 rounded-btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                新增项目
              </button>
            </div>
          ) : view === "week" ? (
            <div className="mx-auto h-full min-h-0 w-full max-w-[1000px] overflow-x-auto">
              <div className="h-full min-w-[560px]">
                <WorkWeekView
                  weekStart={weekStart}
                  items={visibleItems}
                  today={today}
                  colorOf={colorOf}
                  showNoteLayer={showNoteLayer}
                  onItemClick={handleItemClick}
                  onSelectDay={handleSelectDay}
                />
              </div>
            </div>
          ) : view === "month" ? (
            /* 2.5 连续月份滚动：锚点月 ±3 个月纵向堆叠，上下滚动跨月；切换锚点月自动滚动定位 */
            <div ref={monthContainerRef} className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
              {monthRange.map((m) => (
                <div key={`${m.getFullYear()}-${m.getMonth()}`} data-month={`${m.getFullYear()}-${m.getMonth()}`}>
                  <div className="mb-1.5 text-sm font-bold text-ink">
                    {m.getFullYear()}年{m.getMonth() + 1}月
                  </div>
                  <div className="overflow-x-auto">
                    <div className="min-w-[560px]">
                      <WorkMonthView
                        monthDate={m}
                        items={visibleItems}
                        notes={showNoteLayer ? notesForLayer : []}
                        today={today}
                        colorOf={colorOf}
                        showNoteLayer={showNoteLayer}
                        onItemClick={handleItemClick}
                        onSelectDay={handleSelectDay}
                        onOpenNote={handleOpenNote}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[1000px]">
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
            </div>
          )}
        </main>

        {/* 桌面右栏：默认收起（2.3），点「添加排期」/项目 /排期条目时展开；取消/删除后收起 */}
        {rightOpen && (
          <div className="hidden w-[286px] flex-shrink-0 sm:flex">{renderRightPanel}</div>
        )}
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
