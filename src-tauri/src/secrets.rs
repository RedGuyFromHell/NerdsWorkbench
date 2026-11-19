// The two Shopify secrets (the access token and the app's client secret) live in the Windows
// Credential Manager, never in a file and never in the page. Everything that needs one reads it
// here, in Rust. The `SecretStore` trait is the seam the tests use to stand in for Windows.

/// The Credential Manager service every entry of this app sits under.
const SERVICE: &str = "nerds-workbench";
pub const SHOPIFY_TOKEN: &str = "shopify-token";
pub const SHOPIFY_CLIENT_SECRET: &str = "shopify-client-secret";

/// Where secrets are kept. An error text never holds a secret.
pub trait SecretStore {
    /// The secret, or `None` when the entry does not exist.
    fn get(&self, name: &str) -> Result<Option<String>, String>;
    fn set(&self, name: &str, secret: &str) -> Result<(), String>;
    /// Removes the entry. An entry that is already gone is not an error.
    fn delete(&self, name: &str) -> Result<(), String>;
}

/// The Windows Credential Manager, through the keyring crate.
pub struct CredentialManager;

impl CredentialManager {
    fn entry(name: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new(SERVICE, name).map_err(|error| describe(&error))
    }
}

impl SecretStore for CredentialManager {
    fn get(&self, name: &str) -> Result<Option<String>, String> {
        match Self::entry(name)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(describe(&error)),
        }
    }

    fn set(&self, name: &str, secret: &str) -> Result<(), String> {
        Self::entry(name)?
            .set_password(secret)
            .map_err(|error| describe(&error))
    }

    fn delete(&self, name: &str) -> Result<(), String> {
        match Self::entry(name)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(describe(&error)),
        }
    }
}

/// WHY: only the operating system's own message is passed on. Other keyring errors can carry the
/// stored bytes (a secret that is not valid text), so they get one fixed sentence.
fn describe(error: &keyring::Error) -> String {
    match error {
        keyring::Error::PlatformFailure(cause) | keyring::Error::NoStorageAccess(cause) => {
            format!("Windows Credential Manager failed: {cause}")
        }
        _ => "Windows Credential Manager could not read or write the entry.".to_string(),
    }
}

/// Stores the app's client secret. The page sends it once and can never read it back.
#[tauri::command]
pub async fn save_client_secret(secret: String) -> Result<(), String> {
    let secret = secret.trim();
    if secret.is_empty() {
        return Err("The client secret is empty.".to_string());
    }
    CredentialManager.set(SHOPIFY_CLIENT_SECRET, secret)
}

/// Removes the token and the client secret from the Credential Manager.
#[tauri::command]
pub async fn disconnect() -> Result<(), String> {
    remove_shopify_secrets(&CredentialManager)
}

/// Deletes both entries; the second is tried even when the first fails, so one stuck entry does
/// not keep the other on the machine.
fn remove_shopify_secrets(secrets: &dyn SecretStore) -> Result<(), String> {
    let token = secrets.delete(SHOPIFY_TOKEN);
    let client_secret = secrets.delete(SHOPIFY_CLIENT_SECRET);
    token.and(client_secret)
}

#[cfg(test)]
pub mod testing {
    use super::SecretStore;
    use std::collections::HashMap;
    use std::sync::Mutex;

    /// A secret store in memory. `fail_on` names an entry whose every write and delete fails.
    #[derive(Default)]
    pub struct MemoryStore {
        pub entries: Mutex<HashMap<String, String>>,
        pub fail_on: Option<&'static str>,
    }

    impl MemoryStore {
        pub fn with(entries: &[(&str, &str)]) -> Self {
            let store = Self::default();
            for (name, secret) in entries {
                store.set(name, secret).unwrap();
            }
            store
        }

        pub fn secret(&self, name: &str) -> Option<String> {
            self.entries.lock().unwrap().get(name).cloned()
        }

        fn refuse(&self, name: &str) -> Result<(), String> {
            if self.fail_on == Some(name) {
                return Err("the store refused".to_string());
            }
            Ok(())
        }
    }

    impl SecretStore for MemoryStore {
        fn get(&self, name: &str) -> Result<Option<String>, String> {
            Ok(self.secret(name))
        }

        fn set(&self, name: &str, secret: &str) -> Result<(), String> {
            self.refuse(name)?;
            self.entries
                .lock()
                .unwrap()
                .insert(name.to_string(), secret.to_string());
            Ok(())
        }

        fn delete(&self, name: &str) -> Result<(), String> {
            self.refuse(name)?;
            self.entries.lock().unwrap().remove(name);
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::testing::MemoryStore;
    use super::*;

    #[test]
    fn disconnect_removes_both_entries() {
        let secrets = MemoryStore::with(&[(SHOPIFY_TOKEN, "t"), (SHOPIFY_CLIENT_SECRET, "s")]);
        remove_shopify_secrets(&secrets).unwrap();
        assert_eq!(secrets.secret(SHOPIFY_TOKEN), None);
        assert_eq!(secrets.secret(SHOPIFY_CLIENT_SECRET), None);
    }

    #[test]
    fn disconnect_still_removes_the_secret_when_the_token_is_stuck() {
        let mut secrets = MemoryStore::with(&[(SHOPIFY_TOKEN, "t"), (SHOPIFY_CLIENT_SECRET, "s")]);
        secrets.fail_on = Some(SHOPIFY_TOKEN);
        assert!(remove_shopify_secrets(&secrets).is_err());
        assert_eq!(secrets.secret(SHOPIFY_CLIENT_SECRET), None);
    }
}
