// The Shopify OAuth connect: open the approval page in the browser, catch Shopify's redirect on
// localhost, check it, swap the code for an access token and store the token in the Credential
// Manager. The token, the client secret and the code never leave this file except to Shopify.
use super::{describe_transport_error, http_client};
use crate::secrets::{CredentialManager, SHOPIFY_CLIENT_SECRET, SHOPIFY_TOKEN, SecretStore};
use crate::settings;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use socket2::{Domain, Protocol, Socket, Type};
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, ErrorKind, Read, Write};
use std::net::{Ipv4Addr, Ipv6Addr, Shutdown, SocketAddr, TcpListener, TcpStream};
use std::path::Path;
use std::time::{Duration, Instant};
use subtle::ConstantTimeEq;
use tauri_plugin_opener::OpenerExt;

// #region The authorize URL
const REDIRECT_PORT: u16 = 8765;
/// WARNING: Shopify compares this with the redirect URL registered in the app, byte for byte.
/// Another host spelling (127.0.0.1), a trailing slash or another port makes it refuse.
const REDIRECT_URL: &str = "http://localhost:8765/callback";
const CALLBACK_PATH: &str = "/callback";
const SCOPES: &str = "read_price_rules,write_price_rules,read_discounts,write_discounts,\
    read_products,read_orders";
const STATE_BYTES: usize = 32;

/// A fresh value that ties Shopify's answer to this one connection attempt.
fn new_state() -> Result<String, String> {
    let mut bytes = [0u8; STATE_BYTES];
    getrandom::fill(&mut bytes)
        .map_err(|_| "Windows gave no secure random numbers.".to_string())?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

/// The page where the store owner approves the app. `store` is already a checked store name.
fn authorize_url(store: &str, client_id: &str, state: &str) -> String {
    let query = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("client_id", client_id)
        .append_pair("scope", SCOPES)
        .append_pair("redirect_uri", REDIRECT_URL)
        .append_pair("state", state)
        .finish();
    format!("https://{store}/admin/oauth/authorize?{query}")
}
// #endregion

// #region Checking the callback
/// What a genuine answer to this connection attempt must match.
pub struct CallbackCheck {
    pub state: String,
    pub store: String,
    pub client_secret: String,
}

#[derive(Debug, PartialEq)]
pub enum CallbackError {
    /// Shopify (or the user) said no; holds Shopify's short reason.
    Refused(String),
    StateMismatch,
    BadSignature,
    WrongStore,
    NoCode,
}

impl CallbackError {
    fn message(&self) -> String {
        match self {
            Self::Refused(reason) => format!("Shopify refused the authorisation: {reason}"),
            Self::StateMismatch => "The answer did not belong to this connection attempt. \
                Nothing was connected; try again."
                .to_string(),
            Self::BadSignature => "The answer was not signed by Shopify with this app's client \
                secret. Check the client secret and try again."
                .to_string(),
            Self::WrongStore => {
                "The answer came for another store than the one in Settings.".to_string()
            }
            Self::NoCode => "Shopify sent no authorisation code.".to_string(),
        }
    }
}

/// The authorisation code out of the callback's query string, after every check has passed.
pub fn parse_callback(query: &str, expected: &CallbackCheck) -> Result<String, CallbackError> {
    let parameters = callback_parameters(query);
    let parameter = |name: &str| parameters.get(name).map(String::as_str);
    // WHY: the state is checked first, in constant time. Any program on this PC can send requests
    // to the listener for as long as it waits, so a wrong guess must tell nothing by how long it
    // took, and nothing else in the request is believed before the state matches.
    let is_this_attempt = parameter("state")
        .is_some_and(|state| bool::from(state.as_bytes().ct_eq(expected.state.as_bytes())));
    if !is_this_attempt {
        return Err(CallbackError::StateMismatch);
    }
    // WHY: a refusal carries no signature, so the state is all that vouches for it. It can only
    // end the attempt, never connect anything.
    if let Some(reason) = parameter("error") {
        return Err(CallbackError::Refused(plain_reason(reason)));
    }
    // WHY: the state already proves the answer belongs to this attempt. The signature is checked
    // as well because Shopify requires it of every app, it proves Shopify itself wrote `shop` and
    // `code`, and it catches a mistyped client secret here, with a clear sentence.
    if !is_signed_by_shopify(&parameters, &expected.client_secret) {
        return Err(CallbackError::BadSignature);
    }
    // WHY: the code is always exchanged at the store in Settings, never at this value. The check
    // refuses an approval that was given on another store.
    if parameter("shop") != Some(expected.store.as_str()) {
        return Err(CallbackError::WrongStore);
    }
    match parameter("code") {
        Some(code) if !code.is_empty() => Ok(code.to_string()),
        _ => Err(CallbackError::NoCode),
    }
}

/// What the listener makes of a request to the callback path: `None` when it does not carry this
/// attempt's state, so it is not Shopify's answer and the wait goes on.
/// WARNING: without this, any local program (or a page in the browser) could end a connect that
/// is waiting, just by requesting the callback path once.
fn own_callback(query: &str, expected: &CallbackCheck) -> Option<Result<String, CallbackError>> {
    match parse_callback(query, expected) {
        Err(CallbackError::StateMismatch) => None,
        outcome => Some(outcome),
    }
}

const SIGNATURE_PARAMETER: &str = "hmac";
/// The older signature Shopify may still send beside `hmac`; it is not part of the signed text.
const OLD_SIGNATURE_PARAMETER: &str = "signature";
const MAX_REASON_CHARACTERS: usize = 80;

/// The query's parameters, decoded and sorted by name. A name that comes twice holds both
/// values, joined with a comma, as Shopify's own library reads it.
fn callback_parameters(query: &str) -> BTreeMap<String, String> {
    let mut parameters = BTreeMap::<String, String>::new();
    for (name, value) in url::form_urlencoded::parse(query.as_bytes()) {
        parameters
            .entry(name.into_owned())
            .and_modify(|held| *held = format!("{held},{value}"))
            .or_insert_with(|| value.to_string());
    }
    parameters
}

/// The text Shopify signs: every parameter except the two signatures, sorted by name and written
/// as a query string again.
/// WARNING: this copies Shopify's official library (`@shopify/shopify-api`, `generateLocalHmac`)
/// byte for byte: decoded values, sorted names, form encoding, a space as `%20`. Any other
/// spelling gives another signature and every connect fails.
fn signed_message(parameters: &BTreeMap<String, String>) -> String {
    let signed = parameters.iter().filter(|(name, _)| {
        !matches!(name.as_str(), SIGNATURE_PARAMETER | OLD_SIGNATURE_PARAMETER)
    });
    url::form_urlencoded::Serializer::new(String::new())
        .extend_pairs(signed)
        .finish()
        .replace('+', "%20")
}

/// True when `hmac` is the HMAC-SHA256 of the signed text under the client secret.
fn is_signed_by_shopify(parameters: &BTreeMap<String, String>, client_secret: &str) -> bool {
    let signature = parameters
        .get(SIGNATURE_PARAMETER)
        .and_then(|signature| decode_hex(signature));
    let (Some(signature), Ok(mut mac)) = (
        signature,
        Hmac::<Sha256>::new_from_slice(client_secret.as_bytes()),
    ) else {
        return false;
    };
    mac.update(signed_message(parameters).as_bytes());
    // WHY: verify_slice compares in constant time, so a wrong signature tells nothing by timing.
    mac.verify_slice(&signature).is_ok()
}

fn decode_hex(text: &str) -> Option<Vec<u8>> {
    // WHY: from_str_radix also takes a leading "+", which is not a hex digit.
    if !text.len().is_multiple_of(2) || !text.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&text[index..index + 2], 16).ok())
        .collect()
}

/// Shopify's refusal reason, cut down to plain characters.
/// WHY: it comes from a request nobody has checked and it ends up on the screen.
fn plain_reason(reason: &str) -> String {
    reason
        .chars()
        .filter(|&character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.' | '/' | ' ')
        })
        .take(MAX_REASON_CHARACTERS)
        .collect()
}
// #endregion

// #region The localhost listener
/// How long the listener waits: for the callback in all, and for one connection's request.
struct Patience {
    whole: Duration,
    per_connection: Duration,
}

const CALLBACK_PATIENCE: Patience = Patience {
    whole: Duration::from_secs(120),
    per_connection: Duration::from_secs(5),
};
const POLL_INTERVAL: Duration = Duration::from_millis(50);
const MAX_REQUEST_BYTES: u64 = 16 * 1024;
const LISTEN_BACKLOG: i32 = 16;

const APPROVED_PAGE: &str = "<!doctype html><meta charset=\"utf-8\"><title>Nerd's Workbench</title>\
<body style=\"font-family:sans-serif;text-align:center;padding:60px\">\
<h2 style=\"color:#4a265a\">Approved</h2>\
<p>Go back to Nerd's Workbench: it is finishing the connection. You can close this tab.</p>";
const FAILED_PAGE: &str = "<!doctype html><meta charset=\"utf-8\"><title>Nerd's Workbench</title>\
<body style=\"font-family:sans-serif;text-align:center;padding:60px\">\
<h2 style=\"color:#4a265a\">Not connected</h2>\
<p>Go back to Nerd's Workbench: it says what went wrong. You can close this tab.</p>";

#[derive(Debug, PartialEq)]
enum RequestTarget {
    /// A GET of the callback path; holds the raw query string.
    Callback(String),
    Other,
}

/// What the first line of an HTTP request asks for.
fn request_target(request_line: &str) -> RequestTarget {
    let mut parts = request_line.split_whitespace();
    let (Some("GET"), Some(target)) = (parts.next(), parts.next()) else {
        return RequestTarget::Other;
    };
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    if path != CALLBACK_PATH {
        return RequestTarget::Other;
    }
    RequestTarget::Callback(query.to_string())
}

/// Listens on the redirect port, on both loopback addresses.
/// WHY: a browser may resolve `localhost` to 127.0.0.1 or to ::1, so both must answer. Neither
/// is reachable from another machine.
fn bind_callback_listeners(port: u16) -> Result<Vec<TcpListener>, String> {
    let in_use = || {
        format!(
            "Port {port} on this PC is in use by another program, or by a connection attempt \
             that is still waiting. Close it (or wait two minutes) and connect again."
        )
    };
    let describe = |error: std::io::Error| match error.kind() {
        ErrorKind::AddrInUse | ErrorKind::PermissionDenied => in_use(),
        _ => format!("Cannot listen on port {port} for Shopify's answer: {error}"),
    };
    let ipv4 = bind_exclusive((Ipv4Addr::LOCALHOST, port).into()).map_err(describe)?;
    let mut listeners = vec![ipv4];
    match bind_exclusive((Ipv6Addr::LOCALHOST, port).into()) {
        Ok(ipv6) => listeners.push(ipv6),
        Err(error)
            if matches!(
                error.kind(),
                ErrorKind::AddrInUse | ErrorKind::PermissionDenied
            ) =>
        {
            return Err(in_use());
        }
        // A PC with IPv6 switched off resolves localhost to 127.0.0.1 only, so IPv4 is enough.
        Err(error) => log::warn!("no IPv6 listener for the Shopify callback: {error}"),
    }
    for listener in &listeners {
        listener.set_nonblocking(true).map_err(describe)?;
    }
    Ok(listeners)
}

/// A listener that no other socket can share its address with.
/// WARNING: on Windows a plain bind lets another program bind the same port with SO_REUSEADDR
/// and receive the connections instead, Shopify's redirect with the code included. The exclusive
/// option must be set before the bind.
fn bind_exclusive(address: SocketAddr) -> std::io::Result<TcpListener> {
    let socket = Socket::new(
        Domain::for_address(address),
        Type::STREAM,
        Some(Protocol::TCP),
    )?;
    #[cfg(windows)]
    take_port_exclusively(&socket)?;
    socket.bind(&address.into())?;
    socket.listen(LISTEN_BACKLOG)?;
    Ok(socket.into())
}

/// Sets SO_EXCLUSIVEADDRUSE, which socket2 has no setter for.
#[cfg(windows)]
fn take_port_exclusively(socket: &Socket) -> std::io::Result<()> {
    use std::os::windows::io::AsRawSocket;
    use windows_sys::Win32::Networking::WinSock::{
        SO_EXCLUSIVEADDRUSE, SOCKET_ERROR, SOL_SOCKET, setsockopt,
    };
    let enabled: i32 = 1;
    // SAFETY: the socket stays open for the whole call, and the option value is a live i32
    // whose size is passed with it.
    let outcome = unsafe {
        setsockopt(
            socket.as_raw_socket() as usize,
            SOL_SOCKET,
            SO_EXCLUSIVEADDRUSE,
            (&raw const enabled).cast(),
            size_of::<i32>() as i32,
        )
    };
    if outcome == SOCKET_ERROR {
        return Err(std::io::Error::last_os_error());
    }
    Ok(())
}

/// Waits for this attempt's callback and returns what `judge` made of its query string, or `None`
/// when the time ran out. A request to another path, or one `judge` does not take for the answer
/// (`None`), gets a 404 and the wait goes on.
/// WARNING: the listeners are taken by value so they close when this returns: one answer, good
/// or bad, ends the listening. A second answer can only come from a second Connect.
fn wait_for_callback<T, E>(
    listeners: Vec<TcpListener>,
    patience: &Patience,
    judge: impl Fn(&str) -> Option<Result<T, E>>,
) -> Option<Result<T, E>> {
    let deadline = Instant::now() + patience.whole;
    while Instant::now() < deadline {
        for listener in &listeners {
            // swallow: a connection that failed to arrive or to speak HTTP is dropped; the
            // browser's real request is still to come and the deadline still holds.
            let Ok((stream, _)) = listener.accept() else {
                continue;
            };
            let give_up_at = deadline.min(Instant::now() + patience.per_connection);
            if let Some(outcome) = answer(&stream, give_up_at, &judge) {
                return Some(outcome);
            }
        }
        std::thread::sleep(POLL_INTERVAL);
    }
    None
}

fn answer<T, E>(
    stream: &TcpStream,
    give_up_at: Instant,
    judge: &impl Fn(&str) -> Option<Result<T, E>>,
) -> Option<Result<T, E>> {
    let request_line = read_request_line(stream, give_up_at)?;
    let outcome = match request_target(&request_line) {
        RequestTarget::Callback(query) => judge(&query),
        RequestTarget::Other => None,
    };
    let Some(outcome) = outcome else {
        respond(stream, "404 Not Found", "");
        return None;
    };
    let page = if outcome.is_ok() {
        APPROVED_PAGE
    } else {
        FAILED_PAGE
    };
    respond(stream, "200 OK", page);
    Some(outcome)
}

/// Reads from one connection until `give_up_at`, however slowly its bytes come.
/// WHY: a read timeout alone starts again with every byte, so a sender that drips one byte at a
/// time would hold the listener (which serves one connection at a time) for as long as it likes.
struct BudgetedReader<'a> {
    stream: &'a TcpStream,
    give_up_at: Instant,
}

impl Read for BudgetedReader<'_> {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        let time_left = self.give_up_at.saturating_duration_since(Instant::now());
        if time_left.is_zero() {
            return Err(ErrorKind::TimedOut.into());
        }
        self.stream.set_read_timeout(Some(time_left))?;
        self.stream.read(buffer)
    }
}

fn read_request_line(stream: &TcpStream, give_up_at: Instant) -> Option<String> {
    // WHY: a socket accepted from a non-blocking listener is non-blocking too on Windows.
    stream.set_nonblocking(false).ok()?;
    let budgeted = BudgetedReader { stream, give_up_at };
    let mut reader = BufReader::new(budgeted.take(MAX_REQUEST_BYTES));
    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;
    // WHY: the headers are read to their end before we answer. Closing a socket that still holds
    // unread bytes makes Windows reset the connection, and the browser shows an error page.
    let mut header = String::new();
    while matches!(reader.read_line(&mut header), Ok(length) if length > 0)
        && !header.trim_end().is_empty()
    {
        header.clear();
    }
    Some(request_line)
}

fn respond(mut stream: &TcpStream, status: &str, page: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{page}",
        page.len()
    );
    // swallow: the browser tab may be gone already; the outcome is reported in the app anyway.
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.shutdown(Shutdown::Both);
}
// #endregion

// #region The token exchange
/// The access token out of Shopify's answer to the code exchange.
/// WHY: the body is never quoted in an error: on success it is the token itself.
fn read_token_response(status: u16, body: &str) -> Result<String, String> {
    if !(200..300).contains(&status) {
        return Err(format!(
            "Shopify refused the token exchange (HTTP {status})."
        ));
    }
    serde_json::from_str::<TokenAnswer>(body)
        .ok()
        .and_then(|answer| answer.access_token)
        .filter(|token| !token.is_empty())
        .ok_or_else(|| "Shopify's answer held no access token.".to_string())
}

#[derive(serde::Deserialize)]
struct TokenAnswer {
    access_token: Option<String>,
}

async fn exchange_code(
    store: &str,
    client_id: &str,
    client_secret: &str,
    code: &str,
) -> Result<String, String> {
    let response = http_client()?
        .post(format!("https://{store}/admin/oauth/access_token"))
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
        }))
        .send()
        .await
        .map_err(|error| describe_transport_error(&error))?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|error| describe_transport_error(&error))?;
    read_token_response(status, &body)
}
// #endregion

/// Connects the app to the store in the settings: the whole OAuth round trip. On success the
/// token is in the Credential Manager and nothing is returned.
#[tauri::command]
pub async fn shopify_connect(app: tauri::AppHandle) -> Result<(), String> {
    let settings_file = settings::settings_path(&app)?;
    let settings = settings::load(&settings_file)?;
    let store = settings.shopify_store;
    let client_id = settings.shopify_client_id;
    if !settings::is_shopify_store(&store) || client_id.is_empty() {
        return Err("Enter the store and the client ID first.".to_string());
    }
    let client_secret = CredentialManager
        .get(SHOPIFY_CLIENT_SECRET)?
        .ok_or_else(|| "Enter the client secret first.".to_string())?;

    let check = CallbackCheck {
        state: new_state()?,
        store: store.clone(),
        client_secret: client_secret.clone(),
    };
    // WHY: the port is taken before the browser opens, so Shopify's redirect cannot arrive first.
    let listeners = bind_callback_listeners(REDIRECT_PORT)?;
    app.opener()
        .open_url(
            authorize_url(&store, &client_id, &check.state),
            None::<&str>,
        )
        .map_err(|_| "Cannot open the browser for the Shopify approval page.".to_string())?;

    // WHY: the wait blocks its thread for up to two minutes, so it runs on the blocking pool and
    // the app stays responsive.
    let callback = tauri::async_runtime::spawn_blocking(move || {
        wait_for_callback(listeners, &CALLBACK_PATIENCE, |query| {
            own_callback(query, &check)
        })
    })
    .await
    .map_err(|_| "The connection attempt stopped unexpectedly.".to_string())?;
    let code = callback
        .ok_or_else(|| {
            "Timed out: the approval in the browser did not finish in two minutes.".to_string()
        })?
        .map_err(|error| error.message())?;

    let token = exchange_code(&store, &client_id, &client_secret, &code).await?;
    store_token_for(&store, &token, &settings_file, &CredentialManager)
}

/// Stores the token, unless the store in Settings is no longer the one the connect started with.
/// WHY: a token belongs to the store that issued it, and saving another store in Settings deletes
/// the token. A connect that was still waiting then would put the old store's token back, to be
/// sent to the new store.
fn store_token_for(
    connected_store: &str,
    token: &str,
    settings_file: &Path,
    secrets: &dyn SecretStore,
) -> Result<(), String> {
    if settings::load(settings_file)?.shopify_store != connected_store {
        return Err(
            "The store in Settings changed while the connection was waiting. Nothing was \
             connected; connect again."
                .to_string(),
        );
    }
    secrets.set(SHOPIFY_TOKEN, token)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::secrets::testing::MemoryStore;

    // The signatures below are HMAC-SHA256 of the query without `hmac`, keyed with CLIENT_SECRET,
    // worked out with another tool (Node's crypto), not with this file's code.
    const CLIENT_SECRET: &str = "test-client-secret";
    const GOOD_SIGNATURE: &str = "aa0b7da1073ff84b59351057a9860bc12a2c9bada5daf5a1f73567542e547e09";
    const NO_CODE_SIGNATURE: &str =
        "371b8c16529e3e9422ef637f1e0d78da507c3091a8b0afb3eec7a6ac6c69691c";
    const OTHER_SHOP_SIGNATURE: &str =
        "78635aa377e0442e9ca11079896a471eb23507ddc658b5fb4f8e5fe5fff2a105";

    fn expected() -> CallbackCheck {
        CallbackCheck {
            state: "expected-state".to_string(),
            store: "example-shop.myshopify.com".to_string(),
            client_secret: CLIENT_SECRET.to_string(),
        }
    }

    fn good_query() -> String {
        format!(
            "code=abc123&hmac={GOOD_SIGNATURE}&host=YWRtaW4&shop=example-shop.myshopify.com\
             &state=expected-state&timestamp=1700000000"
        )
    }

    #[test]
    fn the_authorize_url_carries_the_client_scopes_redirect_and_state() {
        assert_eq!(
            authorize_url("example-shop.myshopify.com", "abc123", "s1"),
            "https://example-shop.myshopify.com/admin/oauth/authorize?client_id=abc123\
             &scope=read_price_rules%2Cwrite_price_rules%2Cread_discounts%2Cwrite_discounts%2Cread_products%2Cread_orders\
             &redirect_uri=http%3A%2F%2Flocalhost%3A8765%2Fcallback&state=s1"
        );
    }

    #[test]
    fn the_redirect_url_is_the_registered_one() {
        assert_eq!(REDIRECT_URL, "http://localhost:8765/callback");
        assert_eq!(REDIRECT_PORT, 8765);
        assert_eq!(CALLBACK_PATH, "/callback");
    }

    #[test]
    fn a_state_is_64_hex_characters_and_never_repeats() {
        let first = new_state().unwrap();
        let second = new_state().unwrap();
        assert_eq!(first.len(), 64);
        assert!(first.bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert_ne!(first, second);
    }

    #[test]
    fn a_good_callback_gives_its_code() {
        assert_eq!(
            parse_callback(&good_query(), &expected()),
            Ok("abc123".to_string())
        );
    }

    #[test]
    fn the_parameter_order_does_not_matter() {
        let query = format!(
            "timestamp=1700000000&state=expected-state&hmac={GOOD_SIGNATURE}\
             &shop=example-shop.myshopify.com&host=YWRtaW4&code=abc123"
        );
        assert_eq!(
            parse_callback(&query, &expected()),
            Ok("abc123".to_string())
        );
    }

    #[test]
    fn an_error_parameter_is_a_refusal_with_its_reason_as_plain_text() {
        assert_eq!(
            parse_callback("error=access_denied&state=expected-state", &expected()),
            Err(CallbackError::Refused("access_denied".to_string()))
        );
        assert_eq!(
            parse_callback(
                "error=%3Cb%3Eno%3C%2Fb%3E+way&state=expected-state",
                &expected()
            ),
            Err(CallbackError::Refused("bno/b way".to_string()))
        );
    }

    #[test]
    fn a_refusal_without_this_attempts_state_is_not_believed() {
        for stray in ["error=access_denied", "error=access_denied&state=a-guess"] {
            assert_eq!(
                parse_callback(stray, &expected()),
                Err(CallbackError::StateMismatch),
                "{stray}"
            );
        }
    }

    #[test]
    fn only_a_request_with_this_attempts_state_is_the_answer() {
        for stray in [
            "",
            "code=abc123",
            "code=abc123&state=a-guess",
            "error=access_denied",
        ] {
            assert_eq!(own_callback(stray, &expected()), None, "{stray}");
        }
        assert_eq!(
            own_callback(&good_query(), &expected()),
            Some(Ok("abc123".to_string()))
        );
        assert_eq!(
            own_callback("error=access_denied&state=expected-state", &expected()),
            Some(Err(CallbackError::Refused("access_denied".to_string())))
        );
        let changed_code = good_query().replace("code=abc123", "code=stolen");
        assert_eq!(
            own_callback(&changed_code, &expected()),
            Some(Err(CallbackError::BadSignature))
        );
    }

    // Each signature below was worked out in Node the way Shopify's library does it: the query
    // read with URLSearchParams, `hmac` and `signature` dropped, the names sorted, written again
    // with URLSearchParams, every "+" turned into "%20", then HMAC-SHA256 with CLIENT_SECRET.
    #[test]
    fn the_signature_is_over_the_decoded_sorted_and_re_encoded_query() {
        const PADDED_HOST_SIGNATURE: &str =
            "ccd103fb21b61d86864e8ac59cac15a576fa235dbc6e868a63cb1430ad6d276d";
        const SPACE_SIGNATURE: &str =
            "d822620139c633c205bc59eca31535192740d1959eb8742c3ee255e49b769433";
        let rest = "shop=example-shop.myshopify.com&state=expected-state&timestamp=1700000000";
        // The signed text holds "%3D%3D" and "two%20words", however the query spelled them.
        for (query, signature) in [
            (
                "host=YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvZXhhbXBsZQ==",
                PADDED_HOST_SIGNATURE,
            ),
            (
                "host=YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvZXhhbXBsZQ%3D%3D",
                PADDED_HOST_SIGNATURE,
            ),
            ("host=YWRtaW4&note=two+words", SPACE_SIGNATURE),
            ("host=YWRtaW4&note=two%20words", SPACE_SIGNATURE),
            ("host=YWRtaW4&signature=an-old-one", GOOD_SIGNATURE),
        ] {
            let query = format!("code=abc123&hmac={signature}&{query}&{rest}");
            assert_eq!(
                parse_callback(&query, &expected()),
                Ok("abc123".to_string()),
                "{query}"
            );
        }
    }

    #[test]
    fn the_signed_text_is_spelled_as_shopifys_library_spells_it() {
        let parameters = callback_parameters(
            "timestamp=1700000000&hmac=00&note=two+words&signature=old&host=YWRtaW4%3D&code=a%26b",
        );
        assert_eq!(
            signed_message(&parameters),
            "code=a%26b&host=YWRtaW4%3D&note=two%20words&timestamp=1700000000"
        );
    }

    #[test]
    fn a_wrong_or_missing_state_is_refused() {
        let wrong = good_query().replace("state=expected-state", "state=expected-statf");
        assert_eq!(
            parse_callback(&wrong, &expected()),
            Err(CallbackError::StateMismatch)
        );
        let missing = good_query().replace("&state=expected-state", "");
        assert_eq!(
            parse_callback(&missing, &expected()),
            Err(CallbackError::StateMismatch)
        );
        let longer = good_query().replace("state=expected-state", "state=expected-state2");
        assert_eq!(
            parse_callback(&longer, &expected()),
            Err(CallbackError::StateMismatch)
        );
    }

    #[test]
    fn a_changed_or_unsigned_callback_is_refused() {
        let changed_code = good_query().replace("code=abc123", "code=stolen");
        assert_eq!(
            parse_callback(&changed_code, &expected()),
            Err(CallbackError::BadSignature)
        );
        let unsigned = good_query().replace(&format!("&hmac={GOOD_SIGNATURE}"), "");
        assert_eq!(
            parse_callback(&unsigned, &expected()),
            Err(CallbackError::BadSignature)
        );
        let not_hex = good_query().replace(GOOD_SIGNATURE, "zz");
        assert_eq!(
            parse_callback(&not_hex, &expected()),
            Err(CallbackError::BadSignature)
        );
        let other_secret = CallbackCheck {
            client_secret: "another-secret".to_string(),
            ..expected()
        };
        assert_eq!(
            parse_callback(&good_query(), &other_secret),
            Err(CallbackError::BadSignature)
        );
    }

    #[test]
    fn a_callback_for_another_store_is_refused() {
        let query = format!(
            "code=abc123&hmac={OTHER_SHOP_SIGNATURE}&host=YWRtaW4&shop=other-shop.myshopify.com\
             &state=expected-state&timestamp=1700000000"
        );
        assert_eq!(
            parse_callback(&query, &expected()),
            Err(CallbackError::WrongStore)
        );
    }

    #[test]
    fn a_callback_with_no_code_is_refused() {
        let query = format!(
            "hmac={NO_CODE_SIGNATURE}&host=YWRtaW4&shop=example-shop.myshopify.com\
             &state=expected-state&timestamp=1700000000"
        );
        assert_eq!(
            parse_callback(&query, &expected()),
            Err(CallbackError::NoCode)
        );
    }

    #[test]
    fn only_a_get_of_the_callback_path_is_the_callback() {
        assert_eq!(
            request_target("GET /callback?code=1&state=2 HTTP/1.1\r\n"),
            RequestTarget::Callback("code=1&state=2".to_string())
        );
        assert_eq!(
            request_target("GET /callback HTTP/1.1\r\n"),
            RequestTarget::Callback(String::new())
        );
        for other in [
            "GET /favicon.ico HTTP/1.1\r\n",
            "GET / HTTP/1.1\r\n",
            "GET /callback/more?code=1 HTTP/1.1\r\n",
            "GET /callbackx?code=1 HTTP/1.1\r\n",
            "GET /other?next=/callback?code=1 HTTP/1.1\r\n",
            "POST /callback?code=1 HTTP/1.1\r\n",
            "GET\r\n",
            "",
        ] {
            assert_eq!(request_target(other), RequestTarget::Other, "{other:?}");
        }
    }

    #[test]
    fn the_token_comes_out_of_a_good_answer_and_the_body_is_never_quoted() {
        assert_eq!(
            read_token_response(
                200,
                r#"{"access_token":"token-value-1","scope":"read_products"}"#
            ),
            Ok("token-value-1".to_string())
        );
        let refused = read_token_response(400, r#"{"error":"invalid_request","echo":"abc123"}"#);
        assert_eq!(
            refused,
            Err("Shopify refused the token exchange (HTTP 400).".to_string())
        );
        let empty = read_token_response(200, r#"{"access_token":"","note":"token-value-1"}"#);
        assert_eq!(
            empty,
            Err("Shopify's answer held no access token.".to_string())
        );
        let not_json = read_token_response(200, "token-value-1");
        assert_eq!(
            not_json,
            Err("Shopify's answer held no access token.".to_string())
        );
    }

    // The listener tests run on a real loopback socket, with a port the system picks.
    fn loopback_listener() -> (TcpListener, u16) {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        listener.set_nonblocking(true).unwrap();
        let port = listener.local_addr().unwrap().port();
        (listener, port)
    }

    fn get(port: u16, target: &str) -> String {
        let mut stream = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
        write!(
            stream,
            "GET {target} HTTP/1.1\r\nHost: localhost:{port}\r\n\r\n"
        )
        .unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        response
    }

    fn patience_of(whole_ms: u64, per_connection_ms: u64) -> Patience {
        Patience {
            whole: Duration::from_millis(whole_ms),
            per_connection: Duration::from_millis(per_connection_ms),
        }
    }

    fn is_ok_code(query: &str) -> Option<Result<String, ()>> {
        Some(if query == "code=ok" {
            Ok(query.to_string())
        } else {
            Err(())
        })
    }

    /// A client that sends its request one byte at a time and never finishes it.
    fn drip_for(port: u16, lasting: Duration) -> std::thread::JoinHandle<()> {
        const DRIP_INTERVAL: Duration = Duration::from_millis(50);
        let mut stream = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
        std::thread::spawn(move || {
            let until = Instant::now() + lasting;
            // The loop also ends when the listener hangs up, which is what it should do.
            while Instant::now() < until && stream.write_all(b"G").is_ok() {
                std::thread::sleep(DRIP_INTERVAL);
            }
        })
    }

    fn is_closed(port: u16) -> bool {
        let address = (Ipv4Addr::LOCALHOST, port).into();
        TcpStream::connect_timeout(&address, Duration::from_millis(300)).is_err()
    }

    #[test]
    fn the_listener_answers_404_elsewhere_and_closes_after_one_good_callback() {
        let (listener, port) = loopback_listener();
        let waiting = std::thread::spawn(move || {
            wait_for_callback(vec![listener], &patience_of(20_000, 5_000), is_ok_code)
        });

        assert!(get(port, "/favicon.ico").starts_with("HTTP/1.1 404 Not Found"));
        let page = get(port, "/callback?code=ok");
        assert!(page.starts_with("HTTP/1.1 200 OK"));
        assert!(page.contains("Approved"));
        assert_eq!(waiting.join().unwrap(), Some(Ok("code=ok".to_string())));
        assert!(is_closed(port));
    }

    #[test]
    fn the_listener_closes_after_one_failed_callback_too() {
        let (listener, port) = loopback_listener();
        let waiting = std::thread::spawn(move || {
            wait_for_callback(vec![listener], &patience_of(20_000, 5_000), |_query| {
                Some(Err::<String, &str>("no"))
            })
        });

        let page = get(port, "/callback?code=forged");
        assert!(page.contains("Not connected"));
        assert!(!page.contains("forged"));
        assert_eq!(waiting.join().unwrap(), Some(Err("no")));
        assert!(is_closed(port));
    }

    #[test]
    fn the_listener_gives_up_when_the_time_runs_out() {
        let (listener, port) = loopback_listener();
        let outcome = wait_for_callback(vec![listener], &patience_of(120, 5_000), |_query| {
            Some(Ok::<(), ()>(()))
        });
        assert_eq!(outcome, None);
        assert!(is_closed(port));
    }

    #[test]
    fn a_stray_callback_gets_404_and_the_wait_goes_on() {
        let (listener, port) = loopback_listener();
        let waiting = std::thread::spawn(move || {
            wait_for_callback(vec![listener], &patience_of(20_000, 5_000), |query| {
                own_callback(query, &expected())
            })
        });

        for stray in [
            "/callback",
            "/callback?code=forged&state=a-guess",
            "/callback?error=access_denied",
        ] {
            assert!(
                get(port, stray).starts_with("HTTP/1.1 404 Not Found"),
                "{stray}"
            );
        }
        let page = get(port, &format!("/callback?{}", good_query()));
        assert!(page.contains("Approved"));
        assert_eq!(waiting.join().unwrap(), Some(Ok("abc123".to_string())));
        assert!(is_closed(port));
    }

    #[test]
    fn a_slow_sender_cannot_hold_the_listener_past_the_deadline() {
        let (listener, port) = loopback_listener();
        let slow_sender = drip_for(port, Duration::from_secs(4));
        let started = Instant::now();

        let outcome = wait_for_callback(vec![listener], &patience_of(300, 5_000), is_ok_code);

        assert_eq!(outcome, None);
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "waited {:?} past a 300 ms deadline",
            started.elapsed()
        );
        slow_sender.join().unwrap();
    }

    #[test]
    fn a_slow_sender_is_dropped_when_its_read_budget_is_spent() {
        let (listener, port) = loopback_listener();
        let slow_sender = drip_for(port, Duration::from_secs(4));
        let waiting = std::thread::spawn(move || {
            wait_for_callback(vec![listener], &patience_of(20_000, 300), is_ok_code)
        });
        let started = Instant::now();

        let page = get(port, "/callback?code=ok");

        assert!(page.contains("Approved"));
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "the real callback waited {:?} behind a slow sender",
            started.elapsed()
        );
        assert_eq!(waiting.join().unwrap(), Some(Ok("code=ok".to_string())));
        slow_sender.join().unwrap();
    }

    /// What Windows itself says about the listener's SO_EXCLUSIVEADDRUSE option.
    #[cfg(windows)]
    fn is_exclusive(listener: &TcpListener) -> bool {
        use std::os::windows::io::AsRawSocket;
        use windows_sys::Win32::Networking::WinSock::{
            SO_EXCLUSIVEADDRUSE, SOL_SOCKET, getsockopt,
        };
        let mut enabled: i32 = 0;
        let mut length = size_of::<i32>() as i32;
        // SAFETY: the listener is open for the whole call, and both pointers are live locals of
        // the size passed.
        let outcome = unsafe {
            getsockopt(
                listener.as_raw_socket() as usize,
                SOL_SOCKET,
                SO_EXCLUSIVEADDRUSE,
                (&raw mut enabled).cast(),
                &raw mut length,
            )
        };
        outcome == 0 && enabled != 0
    }

    // The option is read back from Windows: a second bind that this Windows refuses anyway
    // would prove nothing about the option.
    #[cfg(windows)]
    #[test]
    fn the_listener_takes_its_port_exclusively() {
        let listener = bind_exclusive((Ipv4Addr::LOCALHOST, 0).into()).unwrap();
        assert!(is_exclusive(&listener));

        let address = listener.local_addr().unwrap();
        let intruder = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP)).unwrap();
        intruder.set_reuse_address(true).unwrap();
        assert!(intruder.bind(&address.into()).is_err());
    }

    fn settings_file_naming(store: &str) -> (tempfile::TempDir, std::path::PathBuf) {
        let folder = tempfile::tempdir().unwrap();
        let settings_file = folder.path().join("settings.json");
        let settings = settings::Settings {
            shopify_store: store.to_string(),
            ..settings::Settings::default()
        };
        settings::save(&settings_file, &settings).unwrap();
        (folder, settings_file)
    }

    #[test]
    fn the_token_is_stored_for_the_store_the_connect_started_with() {
        let (_folder, settings_file) = settings_file_naming("example-shop.myshopify.com");
        let secrets = MemoryStore::default();
        let stored = store_token_for(
            "example-shop.myshopify.com",
            "token-value-1",
            &settings_file,
            &secrets,
        );
        assert_eq!(stored, Ok(()));
        assert_eq!(
            secrets.secret(SHOPIFY_TOKEN).as_deref(),
            Some("token-value-1")
        );
    }

    #[test]
    fn a_token_is_not_stored_when_the_store_changed_during_the_wait() {
        let (_folder, settings_file) = settings_file_naming("other-shop.myshopify.com");
        let secrets = MemoryStore::default();
        let stored = store_token_for(
            "example-shop.myshopify.com",
            "token-value-1",
            &settings_file,
            &secrets,
        );
        let error = stored.unwrap_err();
        assert!(error.contains("The store in Settings changed"), "{error}");
        assert!(!error.contains("token-value-1"));
        assert_eq!(secrets.secret(SHOPIFY_TOKEN), None);
    }

    #[test]
    fn a_taken_port_says_so() {
        let (_holder, port) = loopback_listener();
        let error = bind_callback_listeners(port).unwrap_err();
        assert!(
            error.contains(&format!("Port {port} on this PC is in use")),
            "{error}"
        );
    }
}
