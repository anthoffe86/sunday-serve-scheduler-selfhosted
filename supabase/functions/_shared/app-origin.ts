/**
 * Where links we email are allowed to point.
 *
 * Extracted from password-reset.ts so every flow that emails a link -- password
 * reset, account setup, volunteer invitation -- resolves its origin the same
 * way. password-reset.ts re-exports these for its existing callers.
 */

/** Reduce a URL to a bare origin, or null if it is not a usable http(s) URL. */
export function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Decide which site an emailed link points at.
 *
 * The caller may suggest an origin (useful for Netlify deploy previews and for
 * local dev on a shifting port) but it is only honoured when explicitly
 * allow-listed via ALLOWED_APP_ORIGINS. Trusting the request body here would let
 * a link be emailed that points at a site the caller controls -- for a reset
 * that harvests the recovery token, and for an invitation it phishes the
 * invitee's chosen password.
 *
 * Returns null when APP_BASE_URL is unset or unusable, which callers should
 * treat as a configuration error rather than a user error.
 */
export function resolveAppOrigin(requestedBaseUrl: unknown): string | null {
  const configured = normalizeOrigin(Deno.env.get("APP_BASE_URL"));
  const allowed = new Set(
    (Deno.env.get("ALLOWED_APP_ORIGINS") ?? "")
      .split(",")
      .map((entry) => normalizeOrigin(entry))
      .filter((entry): entry is string => entry !== null)
  );
  if (configured) allowed.add(configured);

  if (typeof requestedBaseUrl === "string") {
    const requested = normalizeOrigin(requestedBaseUrl);
    if (requested && allowed.has(requested)) return requested;
  }

  return configured;
}
