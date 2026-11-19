// The installed font families, for the Voucher tool's font picker. The page cannot list system
// fonts itself, so Rust reads them with `fontdb` and sends the names.

/// Sorted without regard to case and without duplicates. An empty name is dropped.
fn sorted_unique_families(names: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut families: Vec<String> = names
        .into_iter()
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .collect();
    // WHY: sorted by lower-cased name first, so "arial" and "Arial" sit together and the dedupe
    // below can drop the second; the original text breaks a tie so the result is the same on
    // every run.
    families.sort_by(|first, second| {
        first
            .to_lowercase()
            .cmp(&second.to_lowercase())
            .then_with(|| first.cmp(second))
    });
    families.dedup_by(|later, earlier| later.to_lowercase() == earlier.to_lowercase());
    families
}

fn read_system_families() -> Vec<String> {
    let mut database = fontdb::Database::new();
    database.load_system_fonts();
    // WHY: the first family of a face is its English name when the font has one, so a font with
    // names in several languages is listed once, under the name the canvas knows it by.
    sorted_unique_families(
        database
            .faces()
            .filter_map(|face| face.families.first().map(|(name, _)| name.clone())),
    )
}

/// Every installed font family, sorted and without duplicates.
#[tauri::command]
pub async fn list_font_families() -> Result<Vec<String>, String> {
    // WHY: reading every font file takes a moment; it must not hold up the window.
    tauri::async_runtime::spawn_blocking(read_system_families)
        .await
        .map_err(|_| "The font list could not be read.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(list: &[&str]) -> Vec<String> {
        list.iter().map(|name| name.to_string()).collect()
    }

    #[test]
    fn sorts_without_regard_to_case() {
        let sorted = sorted_unique_families(names(&["verdana", "Arial", "Impact", "arial black"]));
        assert_eq!(
            sorted,
            names(&["Arial", "arial black", "Impact", "verdana"])
        );
    }

    #[test]
    fn drops_duplicates_including_ones_that_differ_only_in_case() {
        let sorted = sorted_unique_families(names(&["Impact", "Arial", "Impact", "arial"]));
        assert_eq!(sorted, names(&["Arial", "Impact"]));
    }

    #[test]
    fn drops_empty_names_and_trims_the_rest() {
        let sorted = sorted_unique_families(names(&["", "  ", " Georgia "]));
        assert_eq!(sorted, names(&["Georgia"]));
    }

    #[test]
    fn gives_the_same_order_whatever_order_the_names_arrive_in() {
        let forward = sorted_unique_families(names(&["arial", "Arial"]));
        let backward = sorted_unique_families(names(&["Arial", "arial"]));
        assert_eq!(forward, backward);
    }
}
