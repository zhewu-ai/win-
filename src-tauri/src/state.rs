use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct WindowGeom {
  #[serde(default = "default_neg")]
  pub x: i32,
  #[serde(default = "default_neg")]
  pub y: i32,
  pub width: u32,
  pub height: u32,
  // None = 用户未显式改过置顶（首次打开走窗口默认值）；
  // Some(v) = 窗口最后一次关闭时保存的置顶状态
  #[serde(default)]
  pub always_on_top: Option<bool>,
}

fn default_neg() -> i32 {
  -1
}

pub struct WindowStateStore {
  data: Mutex<HashMap<String, WindowGeom>>,
  path: PathBuf,
}

impl WindowStateStore {
  pub fn load(app: &tauri::AppHandle) -> Self {
    let path = app
      .path()
      .app_data_dir()
      .map(|p| p.join("window_state.json"))
      .unwrap_or_else(|_| PathBuf::from("window_state.json"));
    let data = std::fs::read_to_string(&path)
      .ok()
      .and_then(|s| serde_json::from_str(&s).ok())
      .unwrap_or_default();
    Self {
      data: Mutex::new(data),
      path,
    }
  }

  pub fn get(&self, label: &str) -> Option<WindowGeom> {
    self.data.lock().ok()?.get(label).cloned()
  }

  pub fn update(&self, label: &str, f: impl FnOnce(&mut WindowGeom)) {
    if let Ok(mut map) = self.data.lock() {
      let entry = map.entry(label.to_string()).or_default();
      f(entry);
    }
  }

  pub fn save(&self) {
    if let Ok(map) = self.data.lock() {
      if let Some(dir) = self.path.parent() {
        let _ = std::fs::create_dir_all(dir);
      }
      let json = serde_json::to_string_pretty(&*map).unwrap_or_default();
      let _ = std::fs::write(&self.path, json);
    }
  }
}
