// Files the user double-clicks in Explorer reach the app as command-line arguments: the first
// launch gets them in its own argv, a second launch (which the single-instance plugin stops)
// hands its argv to the running app. Either way the paths wait in a queue until the page takes
// them, so a path that arrives before the page listens is not lost.
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

/// The event the page listens for. It carries no paths: the page then takes the queue.
pub const OPEN_FILE_EVENT: &str = "open-file";

/// Paths waiting for the page, in the order they arrived.
#[derive(Default)]
pub struct PendingOpenFiles(Mutex<Vec<String>>);

/// The file paths in a launch's arguments: the first argument is the executable, and anything
/// that starts with `-` is a flag, not a file.
pub fn paths_from_args(args: &[String]) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|arg| !arg.is_empty() && !arg.starts_with('-'))
        .cloned()
        .collect()
}

/// Queues the paths and tells the page to take them. The queue (not the event) holds the paths,
/// so nothing is lost when the page is not listening yet, and nothing is opened twice.
pub fn deliver(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    let pending = app.state::<PendingOpenFiles>();
    if let Ok(mut queue) = pending.0.lock() {
        queue.extend(paths);
    }
    if let Err(error) = app.emit(OPEN_FILE_EVENT, ()) {
        log::warn!("Could not tell the page about an opened file: {error}");
    }
}

/// Hands the page every path queued so far and empties the queue.
#[tauri::command]
pub fn take_pending_open_files(pending: State<'_, PendingOpenFiles>) -> Vec<String> {
    pending
        .0
        .lock()
        .map(|mut queue| std::mem::take(&mut *queue))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::paths_from_args;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|arg| arg.to_string()).collect()
    }

    #[test]
    fn skips_the_executable() {
        assert_eq!(
            paths_from_args(&args(&["C:\\Apps\\workbench.exe", "C:\\Files\\a.nerd"])),
            vec!["C:\\Files\\a.nerd"]
        );
    }

    #[test]
    fn gives_nothing_for_a_launch_without_files() {
        assert!(paths_from_args(&args(&["C:\\Apps\\workbench.exe"])).is_empty());
        assert!(paths_from_args(&[]).is_empty());
    }

    #[test]
    fn skips_flags() {
        assert_eq!(
            paths_from_args(&args(&["workbench.exe", "--flag", "-x", "b.nerd"])),
            vec!["b.nerd"]
        );
    }

    #[test]
    fn keeps_every_path_in_order() {
        assert_eq!(
            paths_from_args(&args(&["workbench.exe", "one.nerd", "two.disc.json"])),
            vec!["one.nerd", "two.disc.json"]
        );
    }

    #[test]
    fn keeps_a_path_with_spaces_and_diacritics_whole() {
        assert_eq!(
            paths_from_args(&args(&[
                "workbench.exe",
                "C:\\Proiecte mele\\disc ș ț.nerd"
            ])),
            vec!["C:\\Proiecte mele\\disc ș ț.nerd"]
        );
    }

    #[test]
    fn skips_an_empty_argument() {
        assert_eq!(
            paths_from_args(&args(&["workbench.exe", "", "c.nerd"])),
            vec!["c.nerd"]
        );
    }
}
