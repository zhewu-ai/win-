// M16 统一便签/待办编辑器 feature 开关。
// 关闭即回旧双模式编辑器（text→LinkEditor、checklist→ChecklistEditor），
// documentJson 被忽略，content/checklistItems 投影始终完整，不丢可见数据。
// 覆盖方式：localStorage["m16.unified-editor"] = "0" 回滚；或 URL ?m16=legacy 临时回滚。
const UNIFIED_KEY = "m16.unified-editor";

export function isUnifiedEditorEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.location.search.includes("m16=legacy")) return false;
    const v = window.localStorage.getItem(UNIFIED_KEY);
    return v !== "0"; // 默认开启；"0" = 回滚
  } catch {
    return true;
  }
}

export function setUnifiedEditorEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(UNIFIED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}
