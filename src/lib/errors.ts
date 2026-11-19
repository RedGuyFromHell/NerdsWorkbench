// The one way an unknown failure becomes a sentence for the user.
const UNKNOWN_FAILURE = "Something went wrong.";

/** A Rust command rejects with a plain sentence; anything else gets a fixed one. */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : UNKNOWN_FAILURE;
}
