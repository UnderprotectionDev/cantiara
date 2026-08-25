use std::fs;
use std::io::Write;

use tauri::Manager;

#[tauri::command]
fn desktop_vault_password(app: tauri::AppHandle) -> Result<String, String> {
  let dir = app
    .path()
    .app_local_data_dir()
    .map_err(|error| error.to_string())?;
  fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
  let path = dir.join("vault.pass");
  if path.exists() {
    return fs::read_to_string(&path).map_err(|error| error.to_string());
  }
  let mut bytes = [0u8; 32];
  getrandom::getrandom(&mut bytes).map_err(|error| error.to_string())?;
  let secret: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
  let mut file = fs::File::create(&path).map_err(|error| error.to_string())?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
  }
  file
    .write_all(secret.as_bytes())
    .map_err(|error| error.to_string())?;
  Ok(secret)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));
  }

  builder
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    .invoke_handler(tauri::generate_handler![desktop_vault_password])
    .setup(|app| {
      let salt_path = app
        .path()
        .app_local_data_dir()
        .expect("could not resolve app local data path")
        .join("salt.txt");
      app.handle().plugin(
        tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
      )?;
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
