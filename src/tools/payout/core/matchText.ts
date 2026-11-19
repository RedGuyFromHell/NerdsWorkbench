// How the payout rules compare text typed by a person (a tag, a product title, an option value)
// with text from the shop: spaces and case never make two of them differ.

/** The form two texts are compared in: trimmed, inner spaces collapsed, lower case. */
export function toMatchKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
