/** Strict Content Security Policy for the production build: the page can only talk to itself. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

/**
 * Inserts the CSP and referrer meta tags right after the document's real <meta charset> tag.
 * HTML comments are ignored, so a commented-out charset tag can never receive the policy.
 * Throws (failing the build) when no real charset tag exists.
 */
export function injectCsp(html: string): string {
  // Blank out comments (keeping offsets) so only real tags can match.
  const masked = html.replace(/<!--[\s\S]*?(?:-->|$)/g, (c) => " ".repeat(c.length));
  const m = /<meta\s+charset=["']?utf-8["']?\s*\/?>/i.exec(masked);
  // Fail the build rather than ship a page without its Content Security Policy.
  if (!m) throw new Error("verilive-csp: <meta charset> not found in index.html; cannot inject the Content Security Policy.");
  const end = m.index + m[0].length;
  return `${html.slice(0, end)}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />${html.slice(end)}`;
}
