mod state;

use state::{WindowGeom, WindowStateStore};
use tauri::{Manager, PhysicalPosition, PhysicalSize, Url, WebviewUrl, WebviewWindowBuilder};

// 多环境配置：开发（tauri dev）加载本地地址，生产包加载线上域名。
// 生产构建不会误连本地开发地址。
const PROD_URL: &str = "https://notes.hello-mylife.online";
const DEV_URL: &str = "http://localhost:3000";

fn app_base_url() -> &'static str {
  if cfg!(debug_assertions) {
    DEV_URL
  } else {
    PROD_URL
  }
}

// 用系统默认浏览器打开外部链接（不新增 crate 依赖）。只允许 http/https scheme。
fn open_external_system(url: &str) -> Result<(), String> {
  if !(url.starts_with("http://") || url.starts_with("https://")) {
    return Err("仅允许打开 http/https 链接".into());
  }
  let result = if cfg!(target_os = "windows") {
    std::process::Command::new("cmd")
      .args(["/C", "start", "", url])
      .spawn()
  } else if cfg!(target_os = "macos") {
    std::process::Command::new("open").arg(url).spawn()
  } else {
    std::process::Command::new("xdg-open").arg(url).spawn()
  };
  result.map(|_| ()).map_err(|e| e.to_string())
}

// 仅允许加载可信域名；任意外部 http/https 链接转交系统默认浏览器打开（不困在 WebView 内），
// 其余 scheme 一律阻止。生产包主窗口与悬浮窗加载打包的 bootstrap 页（tauri:// 本地 origin），
// 由其探测连通性后再跳转线上域名，故本地 origin 也需放行。
fn handle_navigation(url: &Url) -> bool {
  let s = url.as_str();
  if s.starts_with(PROD_URL)
    || s.starts_with(DEV_URL)
    || s.starts_with("tauri://")
    || s.starts_with("http://tauri.localhost")
    || s.starts_with("https://tauri.localhost")
  {
    return true;
  }
  if s.starts_with("http://") || s.starts_with("https://") {
    // 外部链接：尝试用系统浏览器打开，WebView 内不加载
    let _ = open_external_system(s);
    return false;
  }
  false
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
  open_external_system(&url)
}

fn restore_window_geom(
  store: &WindowStateStore,
  window: &tauri::WebviewWindow,
  label: &str,
) {
  if let Some(geom) = store.get(label) {
    if geom.width > 0 && geom.height > 0 {
      if geom.x >= 0 && geom.y >= 0 {
        let _ = window.set_position(PhysicalPosition::new(geom.x, geom.y));
      }
      let _ = window.set_size(PhysicalSize::new(geom.width, geom.height));
    }
    let _ = window.set_always_on_top(geom.always_on_top.unwrap_or(false));
  }
}

#[tauri::command]
fn open_floating_note(app: tauri::AppHandle, id: String) -> Result<(), String> {
  let label = format!("floating_{}", id);

  // 同一条便签已打开悬浮窗则聚焦并置顶，避免重复窗口
  if let Some(existing) = app.get_webview_window(&label) {
    let _ = existing.set_always_on_top(true);
    let _ = existing.set_focus();
    return Ok(());
  }

  // 生产包加载打包的 bootstrap 页，由其按 hash 跳转线上浮窗路径；
  // 开发模式直连本地 dev 地址以保留热更新。
  let webview_url = if cfg!(debug_assertions) {
    let url = format!("{}/notes/{}/floating", app_base_url(), id);
    let parsed = Url::parse(&url).map_err(|e| e.to_string())?;
    WebviewUrl::External(parsed)
  } else {
    WebviewUrl::App(format!("index.html#/notes/{}/floating", id).into())
  };

  // 悬浮窗默认置顶；仅当用户手动取消置顶后才保存 false，下次按保存值恢复
  let saved = app.state::<WindowStateStore>().get(&label);
  let effective_aot = saved
    .as_ref()
    .and_then(|g| g.always_on_top)
    .unwrap_or(true);

  let mut builder = WebviewWindowBuilder::new(&app, &label, webview_url)
    .title("PinNote")
    .inner_size(360.0, 520.0)
    .min_inner_size(260.0, 340.0)
    .always_on_top(effective_aot)
    .on_navigation(handle_navigation);

  // 恢复上次的窗口大小、位置与置顶状态
  if let Some(geom) = saved {
    if geom.width > 0 && geom.height > 0 {
      builder = builder.inner_size(geom.width as f64, geom.height as f64);
      if geom.x >= 0 && geom.y >= 0 {
        builder = builder.position(geom.x as f64, geom.y as f64);
      }
      builder = builder.always_on_top(effective_aot);
    }
  }

  let w = builder.build().map_err(|e| e.to_string())?;
  // Windows：builder 的 always_on_top 可能在 WebView2 初始化后丢失，
  // 这里显式设置一次，并延迟重试确保置顶真正生效
  let _ = w.set_always_on_top(effective_aot);
  let _ = w.set_focus();

  let app2 = app.clone();
  let label2 = label.clone();
  std::thread::spawn(move || {
    for delay_ms in [400u64, 1200u64] {
      std::thread::sleep(std::time::Duration::from_millis(delay_ms));
      if let Some(win) = app2.get_webview_window(&label2) {
        let _ = win.set_always_on_top(effective_aot);
      }
    }
  });
  Ok(())
}

#[tauri::command]
fn toggle_always_on_top(window: tauri::WebviewWindow) -> Result<bool, String> {
  let cur = window.is_always_on_top().map_err(|e| e.to_string())?;
  window.set_always_on_top(!cur).map_err(|e| e.to_string())?;
  Ok(!cur)
}

#[tauri::command]
fn get_always_on_top(window: tauri::WebviewWindow) -> Result<bool, String> {
  window.is_always_on_top().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let store = WindowStateStore::load(app.handle());
      app.manage(store);

      // 主窗口：生产包加载打包的 bootstrap 页（探测连通性 → 跳转线上域名 / 离线 fallback）；
      // 开发模式直连本地地址以保留热更新。默认不置顶（可由用户手动开启）。
      let main_url = if cfg!(debug_assertions) {
        WebviewUrl::External(Url::parse(DEV_URL).map_err(|e| e.to_string())?)
      } else {
        WebviewUrl::App("index.html".into())
      };
      let main = WebviewWindowBuilder::new(app.handle(), "main", main_url)
      .title("PinNote")
      .inner_size(1100.0, 760.0)
      .min_inner_size(320.0, 480.0)
      .center()
      .on_navigation(handle_navigation)
      .build()?;

      let state = app.state::<WindowStateStore>();
      restore_window_geom(state.inner(), &main, "main");
      Ok(())
    })
    .on_window_event(|window, event| {
      let app = window.app_handle();
      let label = window.label().to_string();
      match event {
        tauri::WindowEvent::Moved(pos) => {
          let store = app.state::<WindowStateStore>();
          store.update(&label, |g: &mut WindowGeom| {
            g.x = pos.x;
            g.y = pos.y;
          });
        }
        tauri::WindowEvent::Resized(size) => {
          let store = app.state::<WindowStateStore>();
          store.update(&label, |g: &mut WindowGeom| {
            g.width = size.width;
            g.height = size.height;
          });
        }
        tauri::WindowEvent::CloseRequested { .. } => {
          let store = app.state::<WindowStateStore>();
          if let Ok(aot) = window.is_always_on_top() {
            store.update(&label, |g: &mut WindowGeom| g.always_on_top = Some(aot));
          }
          store.save();
        }
        _ => {}
      }
    })
    .invoke_handler(tauri::generate_handler![
      open_floating_note,
      toggle_always_on_top,
      get_always_on_top,
      open_external
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
