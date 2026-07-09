## 2026-07-08 - [Enhance secure randomness usage in queue shuffling and ID generation]
**Vulnerability:** Used Math.random() for ID generation fallback and Fisher-Yates array shuffling, which relies on a predictably seeded pseudorandom number generator (PRNG) and increases risk of ID collision or reverse engineering.
**Learning:** Not all environments polyfill global.crypto, so robust security enhancements need defensive `typeof crypto !== 'undefined'` feature detection to avoid ReferenceError crashes in SSR/older environments while executing crypto.getRandomValues().
**Prevention:** For features requiring cryptographically secure randomness, always implement explicit availability checks for the `crypto` API or `crypto.getRandomValues` before attempting to use it, falling back to a standard Math.random() if acceptable or throwing an explicit error.

## 2026-07-09 - [Prevent XSS in audio player purchaseUrl]
**Vulnerability:** The `purchaseUrl` property on a track object was interpolated directly into an anchor tag's `href` attribute in `AudioPlayer.tsx`. If this URL were ever dynamically user-provided or came from an untrusted source, it would be vulnerable to a `javascript:` or `data:` URI Cross-Site Scripting (XSS) attack.
**Learning:** React escapes text children automatically, but it does not sanitize the content of URL attributes like `href`. Simple regex checks for URLs often fail on edge cases; relying on the built-in `URL` constructor with a safe dummy base (for relative URLs) is a much stronger pattern.
**Prevention:** Always validate external or potentially untrusted URLs before rendering them in `href` attributes. Ensure the protocol is explicitly within a safe list (e.g., `['http:', 'https:', 'mailto:', 'tel:']`) using a helper function like `isSafeUrl`.
