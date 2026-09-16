use tauri::Manager;

const STRONGHOLD_KEYRING_ACCOUNT: &str = "account-access-vault";
const STRONGHOLD_KEYRING_SERVICE: &str = "cantiara";
const STRONGHOLD_PASSWORD_LENGTH: usize = 43;

fn is_valid_stronghold_password(candidate: &str) -> bool {
  candidate.len() == STRONGHOLD_PASSWORD_LENGTH
    && candidate
      .bytes()
      .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

#[tauri::command]
fn get_or_create_stronghold_password(candidate: String) -> Result<String, String> {
  if !is_valid_stronghold_password(&candidate) {
    return Err("Invalid Stronghold password candidate".to_owned());
  }

  #[cfg(target_os = "macos")]
  {
    let entry = keyring::Entry::new(
      STRONGHOLD_KEYRING_SERVICE,
      STRONGHOLD_KEYRING_ACCOUNT,
    )
    .map_err(|error| format!("Failed to open the OS credential store: {error}"))?;

    return match entry.get_password() {
      Ok(password) if is_valid_stronghold_password(&password) => Ok(password),
      Ok(_) => Err("The stored Stronghold password is invalid".to_owned()),
      Err(keyring::Error::NoEntry) => {
        entry
          .set_password(&candidate)
          .map_err(|error| format!("Failed to save the Stronghold password: {error}"))?;
        entry
          .get_password()
          .map_err(|error| format!("Failed to read the Stronghold password: {error}"))
      }
      Err(error) => Err(format!("Failed to read the Stronghold password: {error}")),
    };
  }

  #[cfg(not(target_os = "macos"))]
  {
    let _ = candidate;
    Err("No supported OS credential store is available".to_owned())
  }
}

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
    .invoke_handler(tauri::generate_handler![get_or_create_stronghold_password])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
