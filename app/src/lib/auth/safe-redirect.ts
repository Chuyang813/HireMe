/**
 * Validates that a redirect target is a safe internal relative path.
 * Rejects absolute URLs, protocol-relative URLs (//), and anything
 * that could be used for open redirect attacks.
 */
export function isSafeRedirect(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  // Must start with exactly one slash (relative path)
  if (!url.startsWith("/")) return false;
  // Reject protocol-relative URLs like //evil.com
  if (url.startsWith("//")) return false;
  // Reject anything containing a protocol colon (e.g. javascript:, data:)
  if (/^\/[^/]/.test(url) && url.includes(":")) {
    // Allow colons only in path segments after the first (e.g. /path/to:thing)
    const withoutLeadingSlash = url.slice(1);
    const firstSegment = withoutLeadingSlash.split("/")[0];
    if (firstSegment.includes(":")) return false;
  }
  return true;
}

export function safeRedirectTarget(url: string | null | undefined, fallback = "/dashboard"): string {
  return isSafeRedirect(url ?? "") ? (url as string) : fallback;
}
