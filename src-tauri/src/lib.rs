mod files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // WHY: the page relaunches the app after an update installs (@tauri-apps/plugin-process).
        .plugin(tauri_plugin_process::init())
        // WHY: native open and save dialogs; the files themselves go through the files module.
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            files::read_file_bytes,
            files::write_file_bytes
        ])
        .setup(|app| {
            // WHY: self-update is a desktop feature; the plugin does not exist on mobile.
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

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
        .expect("error while building tauri application");
}
