mod files;
mod open_files;

#[cfg(desktop)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // WHY: first plugin, as its docs demand: a second launch (a double-clicked .nerd file while the
    // app is open) is stopped before anything else starts. Its arguments go to the running app,
    // which comes to the front.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
        open_files::deliver(app, open_files::paths_from_args(&args));
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }));

    builder
        // WHY: the page relaunches the app after an update installs (@tauri-apps/plugin-process).
        .plugin(tauri_plugin_process::init())
        // WHY: native open and save dialogs; the files themselves go through the files module.
        .plugin(tauri_plugin_dialog::init())
        .manage(open_files::PendingOpenFiles::default())
        .invoke_handler(tauri::generate_handler![
            files::read_file_bytes,
            files::write_file_bytes,
            open_files::take_pending_open_files
        ])
        .setup(|app| {
            // WHY: a double-clicked file starts the app with its path in our own arguments; the page
            // takes it from the queue once it has mounted.
            let args: Vec<String> = std::env::args().collect();
            open_files::deliver(app.handle(), open_files::paths_from_args(&args));

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
