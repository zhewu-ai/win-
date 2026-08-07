/**
 * 桌面应用下载入口配置。
 * 网页端账号菜单先进站内 /download 说明页，再由此页提供安装包与版本列表。
 * 后续更新 Release 时，如需改推荐安装包，同步更新 DESKTOP_WINDOWS_INSTALLER_URL。
 */
export const DESKTOP_APP_DOWNLOAD_PAGE_URL = "/download";

export const DESKTOP_WINDOWS_INSTALLER_URL =
  "https://github.com/zhewu-ai/win-/releases/download/v0.1.0/StickyNotes_0.1.0_x64-setup.exe";

export const DESKTOP_APP_DOWNLOAD_URL =
  "https://github.com/zhewu-ai/win-/releases";
