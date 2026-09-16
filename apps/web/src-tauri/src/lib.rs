#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default();

  #[cfg(desktop)]
  let builder = builder.plugin(tauri_plugin_single_instance::init(
    |_app, _argv, _cwd| {},
  ));

  builder
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      let salt_path = app
        .path()
        .app_local_data_dir()
        .expect("failed to resolve the Stronghold salt path")
        .join("stronghold-salt.bin");
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
