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

// 仅允许加载可信域名，阻止任意外部 URL 在壳内打开
fn allowed_url(url: &Url) -> bool {
  let s = url.as_str();
  s.starts_with(PROD_URL) || s.starts_with(DEV_URL)
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
    let _ = window.set_always_on_top(geom.always_on_top);
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

  let url = format!("{}/notes/{}/floating", app_base_url(), id);
  let parsed = Url::parse(&url).map_err(|e| e.to_string())?;

  let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed))
    .title("便签")
    .inner_size(360.0, 520.0)
    .min_inner_size(320.0, 360.0)
    .always_on_top(true)
    .on_navigation(allowed_url);

  // 恢复上次的窗口大小、位置与置顶状态
  let store = app.state::<WindowStateStore>();
  if let Some(geom) = store.get(&label) {
    if geom.width > 0 && geom.height > 0 {
      builder = builder.inner_size(geom.width as f64, geom.height as f64);
      if geom.x >= 0 && geom.y >= 0 {
        builder = builder.position(geom.x as f64, geom.y as f64);
      }
      builder = builder.always_on_top(geom.always_on_top);
    }
  }

  let w = builder.build().map_err(|e| e.to_string())?;
  let _ = w.set_focus();
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

      // 主窗口：生产包加载线上域名；默认不置顶（可由用户手动开启）
      let main_url = Url::parse(app_base_url()).map_err(|e| e.to_string())?;
      let main = WebviewWindowBuilder::new(
        app.handle(),
        "main",
        WebviewUrl::External(main_url),
      )
      .title("全平台便签")
      .inner_size(1100.0, 760.0)
      .min_inner_size(900.0, 600.0)
      .center()
      .on_navigation(allowed_url)
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
            store.update(&label, |g: &mut WindowGeom| g.always_on_top = aot);
          }
          store.save();
        }
        _ => {}
      }
    })
    .invoke_handler(tauri::generate_handler![
      open_floating_note,
      toggle_always_on_top,
      get_always_on_top
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
