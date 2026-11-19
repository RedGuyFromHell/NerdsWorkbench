// The app-wide Shopify connection: the OAuth connect (oauth.rs) and the GraphQL call (graphql.rs).
// Both talk to the store through the HTTPS client built here. The token and the client secret
// stay on this side: the page gets data and plain error sentences, never a secret.
pub mod graphql;
pub mod oauth;

use std::time::Duration;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// The HTTPS client for every Shopify request.
pub fn http_client() -> Result<reqwest::Client, String> {
    // WHY: reqwest is built without a TLS crypto provider (the updater's choice, which we share),
    // and rustls refuses to work until the process picks one. The updater picks ring the same way.
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        // swallow: an error here only means another thread installed the provider first.
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    reqwest::Client::builder()
        .https_only(true)
        // WARNING: a followed redirect would send the request again, token or client secret
        // included, to whatever host the answer names. Shopify's API never redirects.
        .redirect(reqwest::redirect::Policy::none())
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|_| "Cannot start the HTTPS client.".to_string())
}

/// A fixed sentence for a request that got no answer.
/// WHY: reqwest's own error text holds the request URL, so it is not passed on.
pub fn describe_transport_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return "Shopify did not answer in time.".to_string();
    }
    if error.is_connect() {
        return "Cannot reach Shopify. Check the internet connection and the store name."
            .to_string();
    }
    "The request to Shopify failed before an answer came.".to_string()
}
