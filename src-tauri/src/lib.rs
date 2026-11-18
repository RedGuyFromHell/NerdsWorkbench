mod app_data;
mod files;
mod open_files;
mod secrets;
mod settings;
mod shopify;

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
        // WHY: the Shopify connect opens the approval page in the default browser. Only Rust calls
        // it, so the capability file gives the page no opener permission.
        .plugin(tauri_plugin_opener::init())
        .manage(open_files::PendingOpenFiles::default())
        .invoke_handler(tauri::generate_handler![
            files::read_file_bytes,
            files::write_file_bytes,
            open_files::take_pending_open_files,
            app_data::read_app_text,
            app_data::write_app_text,
            app_data::list_app_files,
            secrets::save_client_secret,
            secrets::disconnect,
            settings::shopify_status,
            settings::save_shopify_settings,
            shopify::oauth::shopify_connect,
            shopify::graphql::shopify_graphql
        ])
        .setup(|app| {
            // WHY: a double-clicked file starts the app with its path in our own arguments; the page
            // takes it from the queue once it has mounted.
            let args: Vec<String> = std::env::args().collect();
            open_files::deliver(app.handle(), open_files::paths_from_args(&args));

            // WHY: the old PyQt app kept the Shopify token and client secret as plain text in its
            // config file. They move to the Credential Manager once, before any window can ask.
            app.manage(settings::import_at_start(app.handle()));

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
