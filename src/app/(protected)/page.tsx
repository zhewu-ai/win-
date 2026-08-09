"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import NoteEditor from "@/components/NoteEditor";
import OfflineBar from "@/components/OfflineBar";
import CalendarPageClient from "@/components/calendar/CalendarPageClient";
import { useNotes } from "@/hooks/useNotes";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { deleteNoteOfflineAware } from "@/lib/offline/persist";
import { getDraft } from "@/lib/offline/draft";
import type { Note } from "@/types";

const SIDEBAR_COLLAPSED_KEY = "sticky-notes.sidebarCollapsed";

export default function HomePage() {
  const { notes, loading, refreshing, searchQuery, setSearchQuery, fetchNotes, createNote, applyNote } =
    useNotes(false);
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";

  // 布局模式：≥720 双栏（侧栏固定 350px，仅手动折叠）/ <720 单栏（工具栏再按编辑区实际宽度细分）
  const mode = useLayoutMode();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  // M12 工作日历：右面板嵌入日历
  const [calendarOpen, setCalendarOpen] = useState(false);
  // M12 返修：从日历便签进入编辑器后保持日历挂载（保留视图上下文），供「返回工作日历」恢复
  const [cameFromCalendar, setCameFromCalendar] = useState(false);
  // M12 返修：工作日历筛选状态上提（隐藏项目 + 便签链接层），与左侧预览卡同步
  const [calendarHidden, setCalendarHidden] = useState<Set<string>>(new Set());
  const [calendarNoteLayer, setCalendarNoteLayer] = useState(true);
  const handleCalendarFilterChange = useCallback((hidden: Set<string>, noteLayer: boolean) => {
    setCalendarHidden(hidden);
    setCalendarNoteLayer(noteLayer);
  }, []);
  // M11.1.1 内部链接跳转返回栈：栈顶是「当前便签的来源便签」
  const [noteNavStack, setNoteNavStack] = useState<string[]>([]);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // NoteEditor 暴露的刷新前置保护：flush 未保存内容 + 重试失败载荷，返回是否可安全刷新
  const editorRefreshRef = useRef<(() => Promise<boolean>) | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });
  // M12 R3 2.2：恢复侧边栏收起/展开动画。
  // 仅双栏启用 width/opacity 过渡（单栏保持即时收起）；模式切换首帧禁用过渡，
  // 规避 R1 §9.6 记录的「双栏 350px ↔ 单栏 100% 同帧过渡被冻结在起始值」老 bug。
  const [sidebarTransitionOff, setSidebarTransitionOff] = useState(true);
  useLayoutEffect(() => {
    setSidebarTransitionOff(true);
    const id = requestAnimationFrame(() => setSidebarTransitionOff(false));
    return () => cancelAnimationFrame(id);
  }, [mode]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage may be unavailable; collapse still applies for this session
      }
      return next;
    });
  };

  // M12 工作日历：打开/关闭右面板嵌入日历（不跳独立页）。
  // 2.2 选中态互斥：打开日历时清除便签/待办选中态，避免两个对象同时高亮。
  const openCalendar = useCallback(() => {
    setCalendarOpen(true);
    setSelectedNoteId(null);
    setShowEditor(false);
    setNoteNavStack([]);
  }, []);

  const closeCalendar = useCallback(() => {
    setCalendarOpen(false);
    setCameFromCalendar(false);
  }, []);

  // M12 返修：从日历进入的便签点击「返回工作日历」→ 恢复日历面板（视图上下文由保持挂载保留）。
  // 2.2：返回日历时同样清除便签选中态。
  const returnToCalendar = useCallback(() => {
    setCameFromCalendar(false);
    setCalendarOpen(true);
    setSelectedNoteId(null);
    setShowEditor(false);
    setNoteNavStack([]);
  }, []);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

  // M11.1.1 返回条文案：栈顶来源便签的标题；来源已删则提示失效
  const stackTopId = noteNavStack[noteNavStack.length - 1];
  const backNote = stackTopId ? notes.find((n) => n.id === stackTopId) : undefined;
  const backLabel = stackTopId
    ? backNote
      ? backNote.title || "未命名便签"
      : "来源便签已失效"
    : "";

  const handleCreate = async () => {
    setCalendarOpen(false);
    setCameFromCalendar(false);
    try {
      const note = await createNote();
      setSelectedNoteId(note.id);
      setShowEditor(true);
    } catch {
      alert("新建便签失败");
    }
  };

  const handleSelect = (id: string) => {
    // 手动点左侧列表视为新路径起点，清空内部链接返回栈；同时关闭日历面板
    setCalendarOpen(false);
    setCameFromCalendar(false);
    setNoteNavStack([]);
    setSelectedNoteId(id);
    setShowEditor(true);
  };

  const handleBack = () => {
    // 从日历进入的便签：返回箭头回到工作日历，而非关闭编辑器
    if (cameFromCalendar) {
      setCameFromCalendar(false);
      setCalendarOpen(true);
      return;
    }
    setShowEditor(false);
    setSelectedNoteId(null);
  };

  const handleUpdate = (updated: Note) => {
    applyNote(updated);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNoteOfflineAware(id);
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
        setShowEditor(false);
        setNoteNavStack([]);
      }
      fetchNotes(searchQuery || undefined);
    } catch {
      alert("删除便签失败");
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      const res = await fetch("/api/notes/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || data.error || "删除便签失败");
        return;
      }
      // 当前正在编辑的便签被批量删除后清空编辑区
      if (selectedNoteId && data.deletedIds.includes(selectedNoteId)) {
        setSelectedNoteId(null);
        setShowEditor(false);
        setNoteNavStack([]);
      }
      fetchNotes(searchQuery || undefined);
    } catch {
      alert("删除便签失败");
    }
  };

  const handleArchive = async (id: string) => {
    setNoteNavStack([]);
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
      setShowEditor(false);
    }
    fetchNotes(searchQuery || undefined);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    fetchNotes(q || undefined);
  };

  const showRefreshToast = useCallback((msg: string) => {
    setRefreshToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setRefreshToast(null), 2000);
  }, []);

  // M11.1 内部链接打开：列表已有目标 → 直接选中；否则按 id 拉取单条，
  // 404/403/失败返回 false（链接变灰已失效）；归档目标不跳转、仅提示。
  // M11.1.1 成功跳转前把当前便签压入返回栈，供「返回上一条」逐级回退。
  const openNoteById = useCallback(
    async (noteId: string): Promise<boolean> => {
      const pushIfNeeded = () =>
        setNoteNavStack((prev) =>
          selectedNoteId &&
          selectedNoteId !== noteId &&
          prev[prev.length - 1] !== selectedNoteId
            ? [...prev, selectedNoteId]
            : prev
        );
      const existing = notes.find((n) => n.id === noteId);
      if (existing) {
        pushIfNeeded();
        setSelectedNoteId(noteId);
        setShowEditor(true);
        return true;
      }
      try {
        const res = await fetch(`/api/notes/${noteId}`);
        if (res.status === 404 || res.status === 403 || !res.ok) return false;
        const note = (await res.json()) as Note;
        if (note.isArchived) {
          showRefreshToast("该便签已归档，可前往归档页查看");
          return true;
        }
        applyNote(note);
        pushIfNeeded();
        setSelectedNoteId(noteId);
        setShowEditor(true);
        return true;
      } catch {
        return false;
      }
    },
    [notes, applyNote, showRefreshToast, selectedNoteId]
  );

  // M12：今日视图「今天编辑的便签」点击 → 打开便签但保持日历挂载，可「返回工作日历」
  const handleCalendarOpenNote = useCallback(
    async (noteId: string) => {
      const ok = await openNoteById(noteId);
      if (ok) {
        setCalendarOpen(false);
        setCameFromCalendar(true);
      }
    },
    [openNoteById]
  );

  // M11.1.1 返回上一条：弹出栈顶来源便签并切回；来源已删除则仅提示不跳转。
  const goBackLinkedNote = useCallback(() => {
    const targetId = noteNavStack[noteNavStack.length - 1];
    if (!targetId) return;
    setNoteNavStack((prev) => prev.slice(0, -1));
    if (notes.some((n) => n.id === targetId)) {
      setSelectedNoteId(targetId);
      setShowEditor(true);
    } else {
      showRefreshToast("来源便签已失效");
    }
  }, [noteNavStack, notes, showRefreshToast]);

  // 手动刷新：先保护本机未保存内容（flush + 重试失败载荷），再静默拉服务器最新列表。
  // 不覆盖本机本地 pending 队列（mirrorNote 已有保护，此处不引入覆盖）。
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    if (editorRefreshRef.current) {
      const ok = await editorRefreshRef.current();
      if (!ok) {
        showRefreshToast("本机有未保存内容且保存失败，请先重试保存");
        return;
      }
    }
    const fetched = await fetchNotes(searchQuery || undefined, { silent: true });
    if (fetched === null) {
      showRefreshToast("刷新失败，请稍后重试");
      return;
    }
    if (fetched === undefined) return; // 已有请求在途，忽略本次
    // 其他设备删除当前编辑的便签 → 退出编辑态，避免继续编辑幽灵数据
    if (!searchQuery && selectedNoteId && !fetched.some((n) => n.id === selectedNoteId)) {
      setSelectedNoteId(null);
      setShowEditor(false);
    }
    showRefreshToast("已刷新");
  }, [refreshing, fetchNotes, searchQuery, selectedNoteId, showRefreshToast]);

  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ deletedId?: string }>).detail;
      if (detail?.deletedId && detail.deletedId === selectedNoteId) {
        setSelectedNoteId(null);
        setShowEditor(false);
        setNoteNavStack([]);
      }
      fetchNotes(searchQuery || undefined);
    };
    window.addEventListener("sticky-notes:changed", onChanged);
    return () => window.removeEventListener("sticky-notes:changed", onChanged);
  }, [fetchNotes, searchQuery, selectedNoteId]);

  // M12 普通用户直接访问 /calendar 被重定向回来时，提示无权限
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("notice") === "calendar_forbidden") {
      showRefreshToast("无权限访问日历");
      const url = new URL(window.location.href);
      url.searchParams.delete("notice");
      window.history.replaceState({}, "", url.toString());
    }
  }, [showRefreshToast]);

  // 防丢：重开后存在未同步草稿时自动打开对应便签，交给编辑器恢复
  useEffect(() => {
    if (loading) return;
    const d = getDraft();
    if (!d || selectedNoteId) return;
    const target = notes.find((n) => n.id === d.noteId);
    if (target) {
      setSelectedNoteId(d.noteId);
      setShowEditor(true);
    }
  }, [loading, notes, selectedNoteId]);

  // 右面板任一内容激活（编辑器 / 日历 / 日历进入未退出）→ 单栏模式收起侧栏
  const panelActive = showEditor || calendarOpen || cameFromCalendar;
  // 日历面板可见：日历打开，或「从日历进入的便签已关闭」自动回到日历
  const showCalendarPanel = isAdmin && (calendarOpen || (cameFromCalendar && !showEditor));
  // M12 R3 2.2：侧边栏展开态（渲染 border 与宽度类）
  const sidebarExpanded = mode === "single" ? !panelActive : !sidebarCollapsed;

  return (
    <div className="h-screen flex flex-col bg-page-bg">
      <OfflineBar />
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏：
            单栏 → 编辑打开或日历打开时收起，否则全宽显示；双栏 → 固定 350px，随手动折叠隐藏。
            M12 R3 2.2：外层容器只负责宽度槽位（overflow-hidden 裁剪），内层固定 350px 防内容挤压；
            双栏启用 width/opacity 过渡实现平滑收起/展开，模式切换首帧禁用过渡规避冻结 bug（R1 §9.6）。 */}
        <div
          className={`flex flex-shrink-0 flex-col bg-sidebar-bg overflow-hidden ${
            sidebarExpanded ? "border-r border-border-light" : ""
          } ${
            mode === "single"
              ? !panelActive
                ? "w-full"
                : "w-0 opacity-0 pointer-events-none"
              : sidebarCollapsed
                ? "w-0 opacity-0 pointer-events-none"
                : "w-[350px]"
          }`}
          style={
            mode !== "single" && !sidebarTransitionOff
              ? { transition: "width 200ms ease-in-out, opacity 150ms ease-in-out" }
              : undefined
          }
        >
          <div className={`${mode === "single" ? "w-full" : "w-[350px]"} flex h-full flex-col`}>
            <Sidebar
              notes={notes}
              selectedId={selectedNoteId}
              onSelect={handleSelect}
              onBulkDelete={handleBulkDelete}
              loading={loading}
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onCreateNote={handleCreate}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              onCollapse={mode === "single" ? undefined : toggleSidebar}
              isAdmin={isAdmin}
              onOpenCalendar={openCalendar}
              calendarActive={calendarOpen}
              calendarHiddenProjectIds={calendarHidden}
              calendarShowNoteLayer={calendarNoteLayer}
            />
          </div>
        </div>

        {/* 折叠后的展开条 - 仅双栏 */}
        {mode !== "single" && sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="w-7 flex-shrink-0 items-center justify-center bg-sidebar-bg border-r border-border-light text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors flex"
            title="展开侧边栏"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* 编辑器/日历：单栏时面板激活才显示；双栏始终显示。
            日历层保持挂载（进入便签后仅隐藏不卸载），「返回工作日历」时恢复视图上下文。 */}
        <div
          className={`${
            mode === "single" && !panelActive ? "hidden" : "flex"
          } relative flex-1 flex-col`}
        >
          {/* 日历层：从日历进入便签后保持挂载以保留视图上下文，仅切换可见性 */}
          {isAdmin && (calendarOpen || cameFromCalendar) && (
            <div className={`${showCalendarPanel ? "flex" : "hidden"} absolute inset-0 flex-col`}>
              <CalendarPageClient
                embedded
                onBack={mode === "single" ? closeCalendar : undefined}
                notes={notes}
                onOpenNote={handleCalendarOpenNote}
                hiddenProjectIds={calendarHidden}
                showNoteLayer={calendarNoteLayer}
                onFilterChange={handleCalendarFilterChange}
              />
            </div>
          )}
          {/* 便签层：编辑中的便签（无选中时显示空占位） */}
          {!showCalendarPanel && (
            <NoteEditor
              note={selectedNote}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onNewNote={handleCreate}
              showBackButton={mode === "single"}
              onBack={handleBack}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              refreshReadyRef={editorRefreshRef}
              onOpenNote={openNoteById}
              linkableNotes={notes}
              onGoBack={goBackLinkedNote}
              backLabel={backLabel}
              onCalendarReturn={cameFromCalendar ? returnToCalendar : undefined}
              calendarReturnLabel={cameFromCalendar ? "返回工作日历" : undefined}
            />
          )}
        </div>
      </div>

      {/* 刷新结果轻提示：不阻塞、自动消失 */}
      {refreshToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-card bg-ink text-page-bg text-sm shadow-xl">
          {refreshToast}
        </div>
      )}
    </div>
  );
}
