// Two commands move file bytes between the page and the disk: the page picks a path with the
// dialog plugin, then reads or writes it here. Raw IPC bodies carry the bytes (a JSON array of
// numbers would be ten times bigger and slow for a project full of images).
use tauri::ipc::{InvokeBody, Request, Response};

/// The request header that carries the target path of `write_file_bytes`, percent-encoded.
const PATH_HEADER: &str = "x-file-path";

/// Decodes a percent-encoded UTF-8 string, as `encodeURIComponent` writes it.
fn percent_decode(value: &str) -> Result<String, String> {
    let bad_escape = || "The file path header has a broken % escape.".to_string();
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let digits = bytes.get(index + 1..index + 3).ok_or_else(bad_escape)?;
            let digits = std::str::from_utf8(digits).map_err(|_| bad_escape())?;
            // WHY: from_str_radix also takes a leading "+", which is not a hex digit.
            if !digits.bytes().all(|byte| byte.is_ascii_hexdigit()) {
                return Err(bad_escape());
            }
            decoded.push(u8::from_str_radix(digits, 16).map_err(|_| bad_escape())?);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).map_err(|_| "The file path header is not valid UTF-8.".to_string())
}

/// The target path out of the request header value.
fn decode_path_header(value: &str) -> Result<String, String> {
    let path = percent_decode(value)?;
    if path.is_empty() {
        return Err("No file path was given.".to_string());
    }
    Ok(path)
}

/// Reads the whole file and returns its bytes as the raw response body.
#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Response, String> {
    std::fs::read(&path)
        .map(Response::new)
        .map_err(|error| format!("Cannot read {path}: {error}"))
}

/// Writes the raw request body to the path in the `x-file-path` header, replacing the file.
#[tauri::command]
pub fn write_file_bytes(request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("The file bytes must be sent as a raw body.".to_string());
    };
    let header = request
        .headers()
        .get(PATH_HEADER)
        .ok_or_else(|| "No file path was given.".to_string())?
        .to_str()
        .map_err(|_| "The file path header is not plain text.".to_string())?;
    let path = decode_path_header(header)?;
    std::fs::write(&path, bytes).map_err(|error| format!("Cannot write {path}: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_spaces_and_non_ascii() {
        assert_eq!(
            decode_path_header("D%3A%5CMy%20Files%5Cdisc%20%C8%99%C8%9B.nerd").unwrap(),
            "D:\\My Files\\disc \u{219}\u{21b}.nerd"
        );
    }

    #[test]
    fn decodes_hash_and_percent() {
        assert_eq!(decode_path_header("a%23b%2520c").unwrap(), "a#b%20c");
    }

    #[test]
    fn keeps_plain_characters_as_they_are() {
        assert_eq!(
            decode_path_header("C:/disc-1_a.png").unwrap(),
            "C:/disc-1_a.png"
        );
    }

    #[test]
    fn rejects_a_cut_escape() {
        assert!(decode_path_header("a%2").is_err());
        assert!(decode_path_header("a%zz").is_err());
        assert!(decode_path_header("a%+1").is_err());
    }

    #[test]
    fn rejects_bytes_that_are_not_utf8() {
        assert!(decode_path_header("%FF%FE").is_err());
    }

    #[test]
    fn rejects_an_empty_path() {
        assert!(decode_path_header("").is_err());
    }
}
