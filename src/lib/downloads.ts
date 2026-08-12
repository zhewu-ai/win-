/**
 * 桌面应用下载入口配置。
 * 网页端账号菜单先进站内 /download 说明页，再由此页提供安装包与版本列表。
 *
 * ⚠️ 发版规则：每次桌面壳版本 bump 后，必须把下面两个直连 URL 同步更新到对应
 * 版本资产名（Windows：StickyNotes_<ver>_x64-setup.exe；Mac：StickyNotes_<ver>_universal.dmg），
 * 否则下载页会指向过期或不存在的安装包。
 */
export const DESKTOP_APP_DOWNLOAD_PAGE_URL = "/download";

export const DESKTOP_WINDOWS_INSTALLER_URL =
  "https://github.com/zhewu-ai/win-/releases/download/app-v0.1.2/StickyNotes_0.1.2_x64-setup.exe";

export const DESKTOP_MAC_DOWNLOAD_URL =
  "https://github.com/zhewu-ai/win-/releases/download/app-v0.1.2/StickyNotes_0.1.2_universal.dmg";

export const DESKTOP_RELEASES_URL =
  "https://github.com/zhewu-ai/win-/releases";

/** 网页版 / 官网地址。桌面壳账户菜单「打开网页版」入口与其它外部链接统一从这里取，不散落。 */
export const WEB_APP_URL = "https://notes.hello-mylife.online";
