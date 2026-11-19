// Text files of the tools (settings, saved months) live in the app data folder. Three commands read,
// write and list them; the page only ever names a relative path, and every path is checked here
// before it touches the disk.
use std::fs::File;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// A half-written file lives under this ending until the rename; the list never shows it.
const TEMP_ENDING: &str = ".tmp";
/// A stored JSON file whose top-level `status` is this word is a locked record.
const LOCKED_STATUS: &str = "closed";
/// Windows opens these names as devices, with any extension, not as files.
const DEVICE_NAMES: [&str; 6] = ["con", "prn", "aux", "nul", "com", "lpt"];

// #region Path safety
/// True for CON, NUL, COM0 to COM9, LPT0 to LPT9 and the like, with or without an extension.
fn is_device_name(segment: &str) -> bool {
    let stem = segment
        .split('.')
        .next()
        .unwrap_or(segment)
        .to_ascii_lowercase();
    DEVICE_NAMES.iter().any(|device| {
        stem == *device
            || (stem.len() == device.len() + 1
                && stem.starts_with(device)
                && stem.ends_with(|digit: char| digit.is_ascii_digit()))
    })
}

fn check_segment(segment: &str) -> Result<(), String> {
    let plain = !segment.is_empty()
        && segment
            .chars()
            .all(|letter| letter.is_ascii_alphanumeric() || matches!(letter, '-' | '_' | '.'));
    // WHY: a leading or trailing dot is `..`, a hidden name, or a name Windows silently shortens.
    if !plain || segment.starts_with('.') || segment.ends_with('.') || is_device_name(segment) {
        return Err(format!(
            "The app data path part \"{segment}\" is not allowed."
        ));
    }
    Ok(())
}

/// The path under the app data folder that `relative` names. Only `/`-separated parts of letters,
/// digits, `-`, `_` and `.` pass: no `..`, no absolute path, no drive letter, no empty part.
fn resolve_inside(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative.is_empty() {
        return Err("No app data path was given.".to_string());
    }
    let mut resolved = root.to_path_buf();
    for segment in relative.split('/') {
        check_segment(segment)?;
        resolved.push(segment);
    }
    Ok(resolved)
}
// #endregion

// #region Reading, writing, listing
fn read_text_in(root: &Path, relative: &str) -> Result<Option<String>, String> {
    let path = resolve_inside(root, relative)?;
    match std::fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Cannot read {relative}: {error}")),
    }
}

/// True when the file is JSON with the top-level `"status": "closed"`. Anything else, an unreadable
/// or broken file included, can be replaced.
// WHY: the lock guards a closed month against a bug in the page, not against a compromised page:
// `files::write_file_bytes` writes any path the page names.
fn is_locked(path: &Path) -> bool {
    let Ok(text) = std::fs::read_to_string(path) else {
        return false; // swallow: no file yet, or one that cannot be read, is not a closed month
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
        return false; // swallow: a broken file holds no record to keep, a new write repairs it
    };
    value.get("status").and_then(|status| status.as_str()) == Some(LOCKED_STATUS)
}

/// Writes the text to a new file and waits until the disk holds it.
fn write_synced(path: &Path, text: &str) -> std::io::Result<()> {
    let mut file = File::create(path)?;
    file.write_all(text.as_bytes())?;
    file.sync_all()
}

fn write_text_in(root: &Path, relative: &str, text: &str) -> Result<(), String> {
    let path = resolve_inside(root, relative)?;
    if is_locked(&path) {
        return Err(format!("{relative} is closed and is never overwritten."));
    }
    let cannot_write = |error: std::io::Error| format!("Cannot write {relative}: {error}");
    if let Some(folder) = path.parent() {
        std::fs::create_dir_all(folder).map_err(cannot_write)?;
    }
    // WHY: the text goes to a temp file first, then one rename swaps it in, so a crash leaves
    // the old file whole instead of half of the new one. The sync comes before the rename: without
    // it a power cut can leave the new name on a file whose bytes never reached the disk.
    let mut temp_name = path.as_os_str().to_owned();
    temp_name.push(TEMP_ENDING);
    let temp_path = PathBuf::from(temp_name);
    let swapped = write_synced(&temp_path, text).and_then(|()| std::fs::rename(&temp_path, &path));
    if let Err(error) = swapped {
        let _ = std::fs::remove_file(&temp_path); // swallow: the write error below is the real news
        return Err(cannot_write(error));
    }
    Ok(())
}

fn list_files_in(root: &Path, folder: &str) -> Result<Vec<String>, String> {
    let path = resolve_inside(root, folder)?;
    let entries = match std::fs::read_dir(&path) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Cannot list {folder}: {error}")),
    };
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("Cannot list {folder}: {error}"))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let is_file = entry.file_type().is_ok_and(|kind| kind.is_file());
        if is_file && !name.ends_with(TEMP_ENDING) {
            names.push(name);
        }
    }
    names.sort();
    Ok(names)
}
// #endregion

// #region Commands
fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Cannot find the app data folder: {error}"))
}

/// The text of a file under the app data folder, or `None` when there is no such file yet.
#[tauri::command]
pub fn read_app_text(app: AppHandle, path: String) -> Result<Option<String>, String> {
    read_text_in(&app_data_root(&app)?, &path)
}

/// Writes the text to a file under the app data folder (made with its folders if new), replacing it
/// whole. A file marked `"status": "closed"` is refused.
#[tauri::command]
pub fn write_app_text(app: AppHandle, path: String, text: String) -> Result<(), String> {
    write_text_in(&app_data_root(&app)?, &path, &text)
}

/// The sorted names of the files in a folder under the app data folder; empty when it does not exist.
#[tauri::command]
pub fn list_app_files(app: AppHandle, folder: String) -> Result<Vec<String>, String> {
    list_files_in(&app_data_root(&app)?, &folder)
}
// #endregion

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static NEXT_FOLDER: AtomicUsize = AtomicUsize::new(0);

    /// A new empty folder under the system temp folder, removed when dropped.
    struct TempRoot(PathBuf);

    impl TempRoot {
        fn new() -> Self {
            let folder = std::env::temp_dir().join(format!(
                "nwb-app-data-test-{}-{}",
                std::process::id(),
                NEXT_FOLDER.fetch_add(1, Ordering::SeqCst)
            ));
            std::fs::create_dir_all(&folder).unwrap();
            Self(folder)
        }
    }

    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn file_names(folder: &Path) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(folder)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    // #region Path safety
    #[test]
    fn resolves_a_nested_relative_path_under_the_root() {
        let root = Path::new("app-data-root");
        assert_eq!(
            resolve_inside(root, "payout/months/2026-01.json").unwrap(),
            root.join("payout").join("months").join("2026-01.json")
        );
    }

    #[test]
    fn refuses_a_path_that_climbs_out() {
        let root = Path::new("app-data-root");
        assert!(resolve_inside(root, "../x").is_err());
        assert!(resolve_inside(root, "payout/../../x").is_err());
        assert!(resolve_inside(root, "payout/..").is_err());
        assert!(resolve_inside(root, "payout/./x").is_err());
        assert!(resolve_inside(root, "..").is_err());
    }

    #[test]
    fn refuses_an_absolute_path_a_drive_letter_and_backslashes() {
        let root = Path::new("app-data-root");
        assert!(resolve_inside(root, "C:\\x").is_err());
        assert!(resolve_inside(root, "C:/x").is_err());
        assert!(resolve_inside(root, "C:x").is_err());
        assert!(resolve_inside(root, "/x").is_err());
        assert!(resolve_inside(root, "\\x").is_err());
        assert!(resolve_inside(root, "\\\\server\\share\\x").is_err());
        assert!(resolve_inside(root, "payout\\settings.json").is_err());
    }

    #[test]
    fn refuses_an_empty_path_and_an_empty_segment() {
        let root = Path::new("app-data-root");
        assert!(resolve_inside(root, "").is_err());
        assert!(resolve_inside(root, "a//b").is_err());
        assert!(resolve_inside(root, "a/").is_err());
    }

    #[test]
    fn refuses_characters_outside_letters_digits_dash_underscore_dot() {
        let root = Path::new("app-data-root");
        assert!(resolve_inside(root, "a b").is_err());
        assert!(resolve_inside(root, "a:b").is_err());
        assert!(resolve_inside(root, "a*b").is_err());
        assert!(resolve_inside(root, "\u{219}.json").is_err());
        assert!(resolve_inside(root, "a\0b").is_err());
    }

    #[test]
    fn refuses_a_segment_that_starts_or_ends_with_a_dot() {
        let root = Path::new("app-data-root");
        assert!(resolve_inside(root, ".hidden").is_err());
        assert!(resolve_inside(root, "payout/file.").is_err());
    }

    #[test]
    fn refuses_windows_device_names() {
        let root = Path::new("app-data-root");
        assert!(resolve_inside(root, "payout/con").is_err());
        assert!(resolve_inside(root, "payout/NUL.json").is_err());
        assert!(resolve_inside(root, "payout/com1.txt").is_err());
        assert!(resolve_inside(root, "lpt9").is_err());
        assert!(resolve_inside(root, "payout/COM0").is_err());
        assert!(resolve_inside(root, "payout/lpt0.json").is_err());
        assert!(resolve_inside(root, "payout/console.json").is_ok());
    }
    // #endregion

    // #region Read, write, list
    #[test]
    fn writes_then_reads_the_same_text() {
        let root = TempRoot::new();
        write_text_in(
            &root.0,
            "payout/months/2026-01.json",
            "{\"a\": \"\u{219}\"}",
        )
        .unwrap();
        assert_eq!(
            read_text_in(&root.0, "payout/months/2026-01.json").unwrap(),
            Some("{\"a\": \"\u{219}\"}".to_string())
        );
    }

    #[test]
    fn a_missing_file_reads_as_none() {
        let root = TempRoot::new();
        assert_eq!(read_text_in(&root.0, "payout/settings.json").unwrap(), None);
    }

    #[test]
    fn a_refused_path_is_an_error_when_reading_writing_and_listing() {
        let root = TempRoot::new();
        assert!(read_text_in(&root.0, "../x").is_err());
        assert!(write_text_in(&root.0, "../x", "text").is_err());
        assert!(list_files_in(&root.0, "../x").is_err());
    }

    #[test]
    fn a_write_replaces_the_old_text_and_leaves_no_temp_file() {
        let root = TempRoot::new();
        write_text_in(&root.0, "payout/settings.json", "old").unwrap();
        write_text_in(&root.0, "payout/settings.json", "new").unwrap();
        assert_eq!(
            read_text_in(&root.0, "payout/settings.json").unwrap(),
            Some("new".to_string())
        );
        assert_eq!(file_names(&root.0.join("payout")), vec!["settings.json"]);
    }

    #[test]
    fn a_failed_write_leaves_no_temp_file() {
        let root = TempRoot::new();
        // A folder where the file should go: the rename cannot replace it.
        let months = root.0.join("payout").join("months");
        std::fs::create_dir_all(months.join("2026-02.json")).unwrap();
        assert!(write_text_in(&root.0, "payout/months/2026-02.json", "new").is_err());
        assert_eq!(file_names(&months), vec!["2026-02.json"]);
    }

    #[test]
    fn lists_file_names_sorted_and_skips_folders_and_temp_files() {
        let root = TempRoot::new();
        write_text_in(&root.0, "payout/months/2026-02.json", "b").unwrap();
        write_text_in(&root.0, "payout/months/2026-01.json", "a").unwrap();
        let months = root.0.join("payout").join("months");
        std::fs::create_dir_all(months.join("sub")).unwrap();
        std::fs::write(months.join("2026-03.json.tmp"), "half").unwrap();
        assert_eq!(
            list_files_in(&root.0, "payout/months").unwrap(),
            vec!["2026-01.json", "2026-02.json"]
        );
    }

    #[test]
    fn a_missing_folder_lists_as_empty() {
        let root = TempRoot::new();
        assert_eq!(
            list_files_in(&root.0, "payout/months").unwrap(),
            Vec::<String>::new()
        );
    }
    // #endregion

    // #region Closed months
    #[test]
    fn a_closed_month_is_never_overwritten() {
        let root = TempRoot::new();
        let open = "{\"status\": \"open\"}";
        let closed = "{\"status\": \"closed\", \"total\": 1}";
        write_text_in(&root.0, "payout/months/2026-01.json", open).unwrap();
        write_text_in(&root.0, "payout/months/2026-01.json", closed).unwrap();
        assert!(write_text_in(&root.0, "payout/months/2026-01.json", open).is_err());
        assert!(write_text_in(&root.0, "payout/months/2026-01.json", closed).is_err());
        assert_eq!(
            read_text_in(&root.0, "payout/months/2026-01.json").unwrap(),
            Some(closed.to_string())
        );
        assert_eq!(
            file_names(&root.0.join("payout").join("months")),
            vec!["2026-01.json"]
        );
    }

    #[test]
    fn an_open_or_unmarked_file_may_be_replaced() {
        let root = TempRoot::new();
        write_text_in(
            &root.0,
            "payout/months/2026-01.json",
            "{\"status\": \"open\"}",
        )
        .unwrap();
        write_text_in(
            &root.0,
            "payout/months/2026-01.json",
            "{\"status\": \"open\", \"n\": 2}",
        )
        .unwrap();
        write_text_in(&root.0, "payout/people.json", "{\"version\": 1}").unwrap();
        write_text_in(&root.0, "payout/people.json", "not json at all").unwrap();
        write_text_in(&root.0, "payout/people.json", "{}").unwrap();
    }
    // #endregion
}
