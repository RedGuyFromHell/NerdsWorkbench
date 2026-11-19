// The one door from the page to the Shopify Admin API: the page sends a GraphQL query and its
// variables, Rust adds the token from the Credential Manager and returns the data.
use super::{describe_transport_error, http_client};
use crate::secrets::{CredentialManager, SHOPIFY_TOKEN, SecretStore};
use crate::settings;
use serde_json::Value;

const TOKEN_HEADER: &str = "X-Shopify-Access-Token";
const NOT_CONNECTED: &str = "Not connected to Shopify. Open Settings and connect.";
const REDACTED: &str = "[hidden]";

fn graphql_url(store: &str, api_version: &str) -> String {
    format!("https://{store}/admin/api/{api_version}/graphql.json")
}

/// The `data` of a GraphQL answer, or an error made of the HTTP status and Shopify's own messages.
pub fn read_graphql_response(status: u16, body: &str) -> Result<Value, String> {
    let answer: Option<Value> = serde_json::from_str(body).ok();
    let messages = answer.as_ref().map(error_messages).unwrap_or_default();
    if !(200..300).contains(&status) {
        // WHY: a body that is not Shopify's JSON (a gateway's error page) is not passed on.
        return Err(match messages.as_str() {
            "" => format!("Shopify answered HTTP {status}"),
            _ => format!("Shopify answered HTTP {status}: {messages}"),
        });
    }
    if !messages.is_empty() {
        return Err(format!("Shopify GraphQL error: {messages}"));
    }
    match answer.and_then(|mut answer| answer.get_mut("data").map(Value::take)) {
        Some(data) if !data.is_null() => Ok(data),
        _ => Err("Shopify's answer held no data.".to_string()),
    }
}

/// Shopify's messages, joined. `errors` is a list of objects for GraphQL errors and one plain
/// string for a refused request (a bad token).
fn error_messages(answer: &Value) -> String {
    match answer.get("errors") {
        Some(Value::String(message)) => message.clone(),
        Some(Value::Array(errors)) => errors
            .iter()
            .filter_map(|error| error.get("message")?.as_str())
            .collect::<Vec<_>>()
            .join("; "),
        _ => String::new(),
    }
}

/// The text with every copy of the secret taken out.
/// WHY: Shopify's messages are not known to repeat the token, but an error sentence goes to the
/// page and the screen, so the one value that must never get there is removed by force.
fn redact(text: &str, secret: &str) -> String {
    text.replace(secret, REDACTED)
}

/// Runs one GraphQL query or mutation against the connected store and returns its `data`.
#[tauri::command]
pub async fn shopify_graphql(
    app: tauri::AppHandle,
    query: String,
    variables: Option<Value>,
) -> Result<Value, String> {
    let settings = settings::load(&settings::settings_path(&app)?)?;
    if !settings::is_shopify_store(&settings.shopify_store) {
        return Err(NOT_CONNECTED.to_string());
    }
    let token = CredentialManager
        .get(SHOPIFY_TOKEN)?
        .ok_or_else(|| NOT_CONNECTED.to_string())?;
    let mut token_header = reqwest::header::HeaderValue::from_str(&token).map_err(|_| {
        "The stored Shopify token is not usable. Disconnect and connect again.".to_string()
    })?;
    token_header.set_sensitive(true);

    let response = http_client()?
        .post(graphql_url(&settings.shopify_store, &settings.api_version))
        .header(TOKEN_HEADER, token_header)
        .json(&serde_json::json!({ "query": query, "variables": variables }))
        .send()
        .await
        .map_err(|error| describe_transport_error(&error))?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|error| describe_transport_error(&error))?;
    read_graphql_response(status, &body).map_err(|message| redact(&message, &token))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_url_names_the_store_and_the_version() {
        assert_eq!(
            graphql_url("example-shop.myshopify.com", "2026-04"),
            "https://example-shop.myshopify.com/admin/api/2026-04/graphql.json"
        );
    }

    #[test]
    fn a_good_answer_gives_its_data() {
        let body = r#"{"data":{"shop":{"name":"Example"}},"extensions":{"cost":{}}}"#;
        assert_eq!(
            read_graphql_response(200, body),
            Ok(json!({"shop": {"name": "Example"}}))
        );
    }

    #[test]
    fn graphql_errors_give_their_messages_joined() {
        let body = r#"{"errors":[{"message":"Field 'nope' doesn't exist","locations":[]},{"message":"Second"}]}"#;
        assert_eq!(
            read_graphql_response(200, body),
            Err("Shopify GraphQL error: Field 'nope' doesn't exist; Second".to_string())
        );
    }

    #[test]
    fn an_http_error_gives_the_status_and_shopifys_message() {
        let body = r#"{"errors":"[API] Invalid API key or access token"}"#;
        assert_eq!(
            read_graphql_response(401, body),
            Err("Shopify answered HTTP 401: [API] Invalid API key or access token".to_string())
        );
    }

    #[test]
    fn an_http_error_page_gives_the_status_only() {
        assert_eq!(
            read_graphql_response(502, "<html>Bad gateway, request id 123</html>"),
            Err("Shopify answered HTTP 502".to_string())
        );
    }

    #[test]
    fn an_answer_with_no_data_is_an_error() {
        assert!(read_graphql_response(200, r#"{"data":null}"#).is_err());
        assert!(read_graphql_response(200, "not json").is_err());
    }

    #[test]
    fn a_message_never_carries_the_token() {
        assert_eq!(
            redact("bad token token-value-1 in header", "token-value-1"),
            "bad token [hidden] in header"
        );
    }
}
