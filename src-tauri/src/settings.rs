// The app-wide settings file (`settings.json` in the app config folder): which Shopify store, which
// app client id, which API version. No secret is ever written here. Also owns the import of the
// old PyQt app's config file, which did hold the token and the client secret as plain text.
use crate::secrets::{CredentialManager, SHOPIFY_CLIENT_SECRET, SHOPIFY_TOKEN, SecretStore};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;

// #region The settings file
/// The Shopify Admin API version every call uses until the settings file names another.
pub const DEFAULT_API_VERSION: &str = "2026-04";
const SETTINGS_FILE: &str = "settings.json";
const STORE_SUFFIX: &str = ".myshopify.com";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// `name.myshopify.com`, lower case, or empty when not set up yet.
    pub shopify_store: String,
    pub shopify_client_id: String,
    pub api_version: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            shopify_store: String::new(),
            shopify_client_id: String::new(),
            api_version: DEFAULT_API_VERSION.to_string(),
        }
    }
}

/// True for `name.myshopify.com` in lower case, with nothing before or after it.
/// WARNING: the store name becomes the host of every Shopify request, the ones that carry the
/// token and the client secret included. Loosening this check lets a changed settings file send
/// them to another server.
pub fn is_shopify_store(store: &str) -> bool {
    let Some(name) = store.strip_suffix(STORE_SUFFIX) else {
        return false;
    };
    let plain = name
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
    plain && !name.is_empty() && !name.starts_with('-') && !name.ends_with('-')
}

/// True for a version such as `2026-04`. It becomes part of the request path.
fn is_api_version(version: &str) -> bool {
    const DASH_INDEX: usize = 4;
    const LENGTH: usize = 7;
    version.len() == LENGTH
        && version
            .bytes()
            .enumerate()
            .all(|(index, byte)| match index {
                DASH_INDEX => byte == b'-',
                _ => byte.is_ascii_digit(),
            })
}

/// The settings out of the file's text. A missing field takes its default.
pub fn parse_settings(text: &str) -> Result<Settings, String> {
    let settings: Settings = serde_json::from_str(text)
        .map_err(|error| format!("The settings file is not valid: {error}"))?;
    if !settings.shopify_store.is_empty() && !is_shopify_store(&settings.shopify_store) {
        return Err(
            "The settings file names a store that is not a name.myshopify.com address.".to_string(),
        );
    }
    if !is_api_version(&settings.api_version) {
        return Err(
            "The settings file names an API version that is not of the form 2026-04.".to_string(),
        );
    }
    Ok(settings)
}

/// The settings on disk, or the defaults when the file does not exist yet.
pub fn load(path: &Path) -> Result<Settings, String> {
    match std::fs::read_to_string(path) {
        Ok(text) => parse_settings(&text),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Settings::default()),
        Err(error) => Err(format!("Cannot read the settings file: {error}")),
    }
}

pub fn save(path: &Path, settings: &Settings) -> Result<(), String> {
    let text = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Cannot write the settings file: {error}"))?;
    write_file(path, &text).map_err(|error| format!("Cannot write the settings file: {error}"))
}

fn write_file(path: &Path, text: &str) -> std::io::Result<()> {
    if let Some(folder) = path.parent() {
        std::fs::create_dir_all(folder)?;
    }
    std::fs::write(path, text)
}

/// The settings with the store and client id the user typed, checked and tidied.
pub fn with_shopify_app(
    current: &Settings,
    store: &str,
    client_id: &str,
) -> Result<Settings, String> {
    let store = store.trim().to_ascii_lowercase();
    if !is_shopify_store(&store) {
        return Err("Enter the store as name.myshopify.com.".to_string());
    }
    let client_id = client_id.trim();
    if client_id.is_empty() {
        return Err("Enter the client ID.".to_string());
    }
    Ok(Settings {
        shopify_store: store,
        shopify_client_id: client_id.to_string(),
        api_version: current.api_version.clone(),
    })
}

pub fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let folder = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Cannot find the app's settings folder: {error}"))?;
    Ok(folder.join(SETTINGS_FILE))
}
// #endregion

// #region Old config import
const OLD_CONFIG_FOLDER: &str = ".nerdworkbench";
const OLD_CONFIG_FILE: &str = "config.json";
const OLD_STORE_KEY: &str = "shopify_store";
const OLD_CLIENT_ID_KEY: &str = "shopify_client_id";
const OLD_API_VERSION_KEY: &str = "api_version";
const OLD_TOKEN_KEY: &str = "shopify_token";
const OLD_CLIENT_SECRET_KEY: &str = "shopify_client_secret";

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ImportOutcome {
    /// No old config file, or one that holds no secret while this app has its own settings file.
    NotNeeded,
    Imported,
}

/// What the import at start did, kept for the whole run so the Settings window can say it.
pub struct OldConfigImport(pub Result<ImportOutcome, String>);

/// Takes over the old app's config: the token and the client secret go to the secret store, then
/// the old file is rewritten without them, then (the first time only) this app's settings file is
/// written.
/// WARNING: the order is the safety. The old file loses its two secrets only after both are stored,
/// and the settings file is written last, so a failure at any step leaves nothing lost and the
/// next start tries again.
/// WHY: the secrets are moved out whenever the old file holds them, not only the first time. The
/// old app, a sync tool or a restored backup can put the plain-text file back.
pub fn import_old_config(
    old_config: &Path,
    settings_file: &Path,
    secrets: &dyn SecretStore,
) -> Result<ImportOutcome, String> {
    let Some(mut old) = read_old_config(old_config)? else {
        return Ok(ImportOutcome::NotNeeded);
    };
    let current = if settings_file.exists() {
        Some(load(settings_file)?)
    } else {
        None
    };
    let holds_secrets = old.contains_key(OLD_TOKEN_KEY) || old.contains_key(OLD_CLIENT_SECRET_KEY);
    if current.is_some() && !holds_secrets {
        return Ok(ImportOutcome::NotNeeded);
    }

    move_secrets_out(&old, current.as_ref(), secrets).map_err(|error| {
        format!(
            "Cannot move the old Shopify secrets to the Credential Manager, so the old \
             config file was left as it is: {error}"
        )
    })?;
    old.remove(OLD_TOKEN_KEY);
    old.remove(OLD_CLIENT_SECRET_KEY);
    rewrite_old_config(old_config, &old)?;
    if current.is_none() {
        save(settings_file, &settings_from_old(&old))?;
    }
    Ok(ImportOutcome::Imported)
}

type OldConfig = serde_json::Map<String, serde_json::Value>;

/// The old config file's content, or `None` when there is no such file.
fn read_old_config(old_config: &Path) -> Result<Option<OldConfig>, String> {
    let text = match std::fs::read_to_string(old_config) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "Cannot read the old Workbench config file: {error}"
            ));
        }
    };
    // WHY: the parser's own message can quote a piece of the file, and this file holds secrets.
    serde_json::from_str(&text).map(Some).map_err(|_| {
        "The old Workbench config file is not valid JSON; nothing was imported.".to_string()
    })
}

/// Stores the old file's two secrets. `current` is this app's settings when it is already set up.
fn move_secrets_out(
    old: &OldConfig,
    current: Option<&Settings>,
    secrets: &dyn SecretStore,
) -> Result<(), String> {
    for (old_key, entry) in [
        (OLD_CLIENT_SECRET_KEY, SHOPIFY_CLIENT_SECRET),
        (OLD_TOKEN_KEY, SHOPIFY_TOKEN),
    ] {
        let secret = old_text(old, old_key);
        if secret.is_empty() {
            continue;
        }
        if !takes_old_secret(entry, old, current, secrets)? {
            log::warn!(
                "the old config's {entry} was dropped, not stored: this app holds its own, or \
                 the old one is for another store"
            );
            continue;
        }
        secrets.set(entry, &secret)?;
    }
    Ok(())
}

/// True when a secret of the old file belongs in the secret store. On the first import, always.
/// WHY: once this app is set up, what it stored itself is newer than the old file, so only an
/// empty entry is filled. And a token is only good at the store that issued it, so the old token
/// is kept only when the old file names the store that is in Settings.
fn takes_old_secret(
    entry: &str,
    old: &OldConfig,
    current: Option<&Settings>,
    secrets: &dyn SecretStore,
) -> Result<bool, String> {
    let Some(current) = current else {
        return Ok(true);
    };
    if secrets.get(entry)?.is_some() {
        return Ok(false);
    }
    let old_store = old_text(old, OLD_STORE_KEY).to_ascii_lowercase();
    Ok(entry != SHOPIFY_TOKEN || old_store == current.shopify_store)
}

/// A text value of the old config, trimmed; empty when missing or not text.
fn old_text(old: &OldConfig, key: &str) -> String {
    let text = old.get(key).and_then(serde_json::Value::as_str);
    text.unwrap_or_default().trim().to_string()
}

/// This app's settings from the old config. A value that does not pass the checks falls back to
/// its default, so an odd old file cannot block the secrets from moving out.
fn settings_from_old(old: &OldConfig) -> Settings {
    let defaults = Settings::default();
    let store = old_text(old, OLD_STORE_KEY).to_ascii_lowercase();
    let api_version = old_text(old, OLD_API_VERSION_KEY);
    Settings {
        shopify_store: if is_shopify_store(&store) {
            store
        } else {
            defaults.shopify_store
        },
        shopify_client_id: old_text(old, OLD_CLIENT_ID_KEY),
        api_version: if is_api_version(&api_version) {
            api_version
        } else {
            defaults.api_version
        },
    }
}

fn rewrite_old_config(old_config: &Path, old: &OldConfig) -> Result<(), String> {
    let failed = |error: std::io::Error| {
        format!(
            "The Shopify secrets are in the Credential Manager now, but the old config file \
             could not be rewritten without them: {error}"
        )
    };
    let text = serde_json::to_string_pretty(old).map_err(|error| failed(error.into()))?;
    // WHY: written beside the file and renamed over it, so a crash mid-write cannot leave half a
    // file. The draft never holds the two secrets.
    let draft = old_config.with_extension("json.tmp");
    std::fs::write(&draft, text).map_err(failed)?;
    std::fs::rename(&draft, old_config).map_err(failed)
}

/// Runs the import against the real folders. Called once, when the app starts.
pub fn import_at_start(app: &tauri::AppHandle) -> OldConfigImport {
    let outcome = settings_path(app).and_then(|settings_file| {
        let home = app
            .path()
            .home_dir()
            .map_err(|error| format!("Cannot find the home folder: {error}"))?;
        let old_config = home.join(OLD_CONFIG_FOLDER).join(OLD_CONFIG_FILE);
        import_old_config(&old_config, &settings_file, &CredentialManager)
    });
    OldConfigImport(outcome)
}
// #endregion

// #region Commands
/// What the page may know about the Shopify connection. It says whether the secrets exist, never
/// what they are.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopifyStatus {
    store: String,
    client_id: String,
    api_version: String,
    has_client_secret: bool,
    connected: bool,
    imported_old_config: bool,
    import_error: Option<String>,
}

#[tauri::command]
pub async fn shopify_status(
    app: tauri::AppHandle,
    import: tauri::State<'_, OldConfigImport>,
) -> Result<ShopifyStatus, String> {
    let settings = load(&settings_path(&app)?)?;
    Ok(ShopifyStatus {
        store: settings.shopify_store,
        client_id: settings.shopify_client_id,
        api_version: settings.api_version,
        has_client_secret: CredentialManager.get(SHOPIFY_CLIENT_SECRET)?.is_some(),
        connected: CredentialManager.get(SHOPIFY_TOKEN)?.is_some(),
        imported_old_config: import.0 == Ok(ImportOutcome::Imported),
        import_error: import.0.clone().err(),
    })
}

/// Saves the store and the client id.
#[tauri::command]
pub async fn save_shopify_settings(
    app: tauri::AppHandle,
    store: String,
    client_id: String,
) -> Result<(), String> {
    let path = settings_path(&app)?;
    let current = load(&path)?;
    let changed = with_shopify_app(&current, &store, &client_id)?;
    // WHY: a token belongs to the store that issued it. It is removed before the new store is
    // saved, so a token is never sent to a store it was not made for.
    if changed.shopify_store != current.shopify_store {
        CredentialManager.delete(SHOPIFY_TOKEN)?;
    }
    save(&path, &changed)
}
// #endregion

#[cfg(test)]
mod tests {
    use super::*;
    use crate::secrets::testing::MemoryStore;

    const OLD_CONFIG: &str = r#"{
  "shopify_store": "example-shop.myshopify.com",
  "shopify_token": "old-token-value",
  "shopify_client_id": "old-client-id",
  "shopify_client_secret": "old-secret-value",
  "api_version": "2025-10",
  "window_width": 900
}"#;

    const OLD_CONFIG_WITHOUT_SECRETS: &str = r#"{
  "shopify_store": "example-shop.myshopify.com",
  "shopify_client_id": "old-client-id",
  "api_version": "2025-10"
}"#;

    struct Folders {
        _root: tempfile::TempDir,
        old_config: PathBuf,
        settings_file: PathBuf,
    }

    fn folders_with_old_config(text: Option<&str>) -> Folders {
        let root = tempfile::tempdir().unwrap();
        let old_config = root
            .path()
            .join("home")
            .join(".nerdworkbench")
            .join("config.json");
        let settings_file = root.path().join("config").join("settings.json");
        if let Some(text) = text {
            std::fs::create_dir_all(old_config.parent().unwrap()).unwrap();
            std::fs::write(&old_config, text).unwrap();
        }
        Folders {
            _root: root,
            old_config,
            settings_file,
        }
    }

    #[test]
    fn a_missing_settings_file_gives_the_defaults() {
        let folders = folders_with_old_config(None);
        let settings = load(&folders.settings_file).unwrap();
        assert_eq!(settings.shopify_store, "");
        assert_eq!(settings.shopify_client_id, "");
        assert_eq!(settings.api_version, "2026-04");
    }

    #[test]
    fn a_partial_file_keeps_its_fields_and_defaults_the_rest() {
        let settings = parse_settings(r#"{"shopifyStore":"example-shop.myshopify.com"}"#).unwrap();
        assert_eq!(settings.shopify_store, "example-shop.myshopify.com");
        assert_eq!(settings.shopify_client_id, "");
        assert_eq!(settings.api_version, "2026-04");
    }

    #[test]
    fn a_settings_file_with_a_foreign_store_or_a_path_in_the_version_is_refused() {
        assert!(parse_settings(r#"{"shopifyStore":"evil.example.com"}"#).is_err());
        assert!(parse_settings(r#"{"apiVersion":"2026-04/../../oauth"}"#).is_err());
        assert!(parse_settings("not json").is_err());
    }

    #[test]
    fn only_a_bare_myshopify_name_is_a_store() {
        assert!(is_shopify_store("example-shop.myshopify.com"));
        assert!(is_shopify_store("shop2.myshopify.com"));
        for bad in [
            "",
            ".myshopify.com",
            "myshopify.com",
            "example-shop.myshopify.com.evil.com",
            "evil.com/example-shop.myshopify.com",
            "evil.com#.myshopify.com",
            "user@example-shop.myshopify.com",
            "a.b.myshopify.com",
            "-shop.myshopify.com",
            "shop-.myshopify.com",
            "Example-Shop.myshopify.com",
            "example-shop.myshopify.com:8443",
            "example shop.myshopify.com",
            "https://example-shop.myshopify.com",
        ] {
            assert!(!is_shopify_store(bad), "{bad} must not pass");
        }
    }

    #[test]
    fn the_typed_store_and_client_id_are_tidied_and_checked() {
        let current = Settings {
            api_version: "2025-10".to_string(),
            ..Settings::default()
        };
        let changed =
            with_shopify_app(&current, "  Example-Shop.MyShopify.com ", " abc123 ").unwrap();
        assert_eq!(changed.shopify_store, "example-shop.myshopify.com");
        assert_eq!(changed.shopify_client_id, "abc123");
        assert_eq!(changed.api_version, "2025-10");

        assert!(with_shopify_app(&current, "example-shop.com", "abc123").is_err());
        assert!(with_shopify_app(&current, "", "abc123").is_err());
        assert!(with_shopify_app(&current, "example-shop.myshopify.com", "  ").is_err());
    }

    #[test]
    fn the_import_moves_the_secrets_out_and_keeps_the_rest() {
        let folders = folders_with_old_config(Some(OLD_CONFIG));
        let secrets = MemoryStore::default();

        let outcome = import_old_config(&folders.old_config, &folders.settings_file, &secrets);

        assert_eq!(outcome, Ok(ImportOutcome::Imported));
        assert_eq!(
            secrets.secret(SHOPIFY_TOKEN).as_deref(),
            Some("old-token-value")
        );
        assert_eq!(
            secrets.secret(SHOPIFY_CLIENT_SECRET).as_deref(),
            Some("old-secret-value")
        );
        assert_eq!(
            load(&folders.settings_file).unwrap(),
            Settings {
                shopify_store: "example-shop.myshopify.com".to_string(),
                shopify_client_id: "old-client-id".to_string(),
                api_version: "2025-10".to_string(),
            }
        );
        let rewritten = std::fs::read_to_string(&folders.old_config).unwrap();
        assert!(!rewritten.contains("old-token-value"));
        assert!(!rewritten.contains("old-secret-value"));
        let old: serde_json::Value = serde_json::from_str(&rewritten).unwrap();
        assert_eq!(
            old,
            serde_json::json!({
                "shopify_store": "example-shop.myshopify.com",
                "shopify_client_id": "old-client-id",
                "api_version": "2025-10",
                "window_width": 900
            })
        );
        let settings_text = std::fs::read_to_string(&folders.settings_file).unwrap();
        assert!(!settings_text.contains("old-token-value"));
        assert!(!settings_text.contains("old-secret-value"));
    }

    #[test]
    fn the_old_file_is_not_rewritten_when_a_secret_cannot_be_stored() {
        for stuck in [SHOPIFY_TOKEN, SHOPIFY_CLIENT_SECRET] {
            let folders = folders_with_old_config(Some(OLD_CONFIG));
            let secrets = MemoryStore {
                fail_on: Some(stuck),
                ..MemoryStore::default()
            };

            let outcome = import_old_config(&folders.old_config, &folders.settings_file, &secrets);

            let error = outcome.unwrap_err();
            assert!(!error.contains("old-token-value") && !error.contains("old-secret-value"));
            assert_eq!(
                std::fs::read_to_string(&folders.old_config).unwrap(),
                OLD_CONFIG
            );
            assert!(
                !folders.settings_file.exists(),
                "the next start must try again"
            );
        }
    }

    #[test]
    fn the_import_runs_once_and_only_with_an_old_file() {
        let no_old_file = folders_with_old_config(None);
        let secrets = MemoryStore::default();
        assert_eq!(
            import_old_config(
                &no_old_file.old_config,
                &no_old_file.settings_file,
                &secrets
            ),
            Ok(ImportOutcome::NotNeeded)
        );
        assert!(!no_old_file.settings_file.exists());

        let already_set_up = folders_with_old_config(Some(OLD_CONFIG_WITHOUT_SECRETS));
        save(&already_set_up.settings_file, &Settings::default()).unwrap();
        assert_eq!(
            import_old_config(
                &already_set_up.old_config,
                &already_set_up.settings_file,
                &secrets
            ),
            Ok(ImportOutcome::NotNeeded)
        );
        assert_eq!(
            std::fs::read_to_string(&already_set_up.old_config).unwrap(),
            OLD_CONFIG_WITHOUT_SECRETS
        );
        assert_eq!(
            load(&already_set_up.settings_file).unwrap(),
            Settings::default()
        );
    }

    fn set_up_for(store: &str) -> Folders {
        let folders = folders_with_old_config(Some(OLD_CONFIG));
        let settings = Settings {
            shopify_store: store.to_string(),
            shopify_client_id: "new-client-id".to_string(),
            ..Settings::default()
        };
        save(&folders.settings_file, &settings).unwrap();
        folders
    }

    fn assert_old_file_holds_no_secret(folders: &Folders) {
        let rewritten = std::fs::read_to_string(&folders.old_config).unwrap();
        assert!(!rewritten.contains("shopify_token"), "{rewritten}");
        assert!(!rewritten.contains("shopify_client_secret"), "{rewritten}");
        assert!(rewritten.contains("old-client-id"), "{rewritten}");
    }

    #[test]
    fn secrets_left_in_the_old_file_move_out_when_this_app_is_already_set_up() {
        let folders = set_up_for("example-shop.myshopify.com");
        let settings_before = std::fs::read_to_string(&folders.settings_file).unwrap();
        let secrets = MemoryStore::default();

        let outcome = import_old_config(&folders.old_config, &folders.settings_file, &secrets);

        assert_eq!(outcome, Ok(ImportOutcome::Imported));
        assert_eq!(
            secrets.secret(SHOPIFY_TOKEN).as_deref(),
            Some("old-token-value")
        );
        assert_eq!(
            secrets.secret(SHOPIFY_CLIENT_SECRET).as_deref(),
            Some("old-secret-value")
        );
        assert_old_file_holds_no_secret(&folders);
        assert_eq!(
            std::fs::read_to_string(&folders.settings_file).unwrap(),
            settings_before
        );
    }

    #[test]
    fn an_entry_this_app_already_holds_is_not_replaced_by_the_old_file() {
        let folders = set_up_for("example-shop.myshopify.com");
        let secrets = MemoryStore::with(&[
            (SHOPIFY_TOKEN, "new-token-value"),
            (SHOPIFY_CLIENT_SECRET, "new-secret-value"),
        ]);

        let outcome = import_old_config(&folders.old_config, &folders.settings_file, &secrets);

        assert_eq!(outcome, Ok(ImportOutcome::Imported));
        assert_eq!(
            secrets.secret(SHOPIFY_TOKEN).as_deref(),
            Some("new-token-value")
        );
        assert_eq!(
            secrets.secret(SHOPIFY_CLIENT_SECRET).as_deref(),
            Some("new-secret-value")
        );
        assert_old_file_holds_no_secret(&folders);
    }

    #[test]
    fn an_old_token_for_another_store_than_the_one_in_settings_is_not_kept() {
        let folders = set_up_for("other-shop.myshopify.com");
        let secrets = MemoryStore::default();

        let outcome = import_old_config(&folders.old_config, &folders.settings_file, &secrets);

        assert_eq!(outcome, Ok(ImportOutcome::Imported));
        assert_eq!(secrets.secret(SHOPIFY_TOKEN), None);
        assert_eq!(
            secrets.secret(SHOPIFY_CLIENT_SECRET).as_deref(),
            Some("old-secret-value")
        );
        assert_old_file_holds_no_secret(&folders);
    }

    #[test]
    fn the_old_file_keeps_its_secrets_when_a_set_up_app_cannot_store_them() {
        let folders = set_up_for("example-shop.myshopify.com");
        let secrets = MemoryStore {
            fail_on: Some(SHOPIFY_TOKEN),
            ..MemoryStore::default()
        };

        let outcome = import_old_config(&folders.old_config, &folders.settings_file, &secrets);

        let error = outcome.unwrap_err();
        assert!(error.contains("was left as it is"), "{error}");
        assert!(!error.contains("old-token-value") && !error.contains("old-secret-value"));
        assert_eq!(
            std::fs::read_to_string(&folders.old_config).unwrap(),
            OLD_CONFIG
        );
    }

    #[test]
    fn an_empty_old_token_is_not_stored_and_odd_values_fall_back() {
        let folders = folders_with_old_config(Some(
            r#"{"shopify_store": "Not A Store", "shopify_token": "  ", "api_version": 7}"#,
        ));
        let secrets = MemoryStore::default();

        let outcome = import_old_config(&folders.old_config, &folders.settings_file, &secrets);

        assert_eq!(outcome, Ok(ImportOutcome::Imported));
        assert_eq!(secrets.secret(SHOPIFY_TOKEN), None);
        assert_eq!(secrets.secret(SHOPIFY_CLIENT_SECRET), None);
        assert_eq!(load(&folders.settings_file).unwrap(), Settings::default());
        let rewritten = std::fs::read_to_string(&folders.old_config).unwrap();
        assert!(!rewritten.contains("shopify_token"));
    }

    #[test]
    fn an_old_file_that_is_not_json_is_left_alone() {
        let folders = folders_with_old_config(Some("{ broken"));
        let secrets = MemoryStore::default();
        let outcome = import_old_config(&folders.old_config, &folders.settings_file, &secrets);
        assert!(outcome.is_err());
        assert_eq!(
            std::fs::read_to_string(&folders.old_config).unwrap(),
            "{ broken"
        );
        assert!(!folders.settings_file.exists());
    }
}
