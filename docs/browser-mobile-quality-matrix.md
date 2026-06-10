# Browser and mobile quality matrix

This matrix documents the officially supported behavior for the SEIHOUSE audio player. Use it before merging changes that touch playback, seeking, volume, animation, queue behavior, or the preview/build pipeline.

## Support levels

- **Supported** — expected to work and should be verified for every release.
- **Supported with platform limits** — expected to work except for browser or OS restrictions the player cannot bypass.
- **Smoke tested** — covered by repository automation, but still needs targeted manual browser checks when related code changes.

| Area | Official support | Expected behavior | Manual verification | Automated check | Known limitations |
| --- | --- | --- | --- | --- | --- |
| Desktop playback: Chrome, Edge, Firefox, Safari current stable | Supported | Play, pause, ±10 second seek, scrubber, buffered progress, retry, share, keyboard shortcuts, and track-list selection remain scoped to the player root. Playlist mode honors shuffle, repeat-all, and repeat-one. | Open the Vite preview in each browser. Play a single track, switch to a playlist, toggle shuffle, cycle repeat `off → all → one`, verify end-of-track behavior, and confirm `Space`, `J`, `K`, `L`, `N`, and `P` do not fire while a control is focused. | `npm run typecheck`, `npm run build`, and `npm run preview:smoke`. | Automated smoke testing validates the preview shell and built assets only; it does not drive real media playback in each browser engine. |
| iOS Safari and iPadOS Safari | Supported with platform limits | Playback starts from a user gesture when autoplay is blocked. Native mute works. The UI surfaces `volumeUnsupported` when Safari ignores programmatic volume changes. Tap targets remain usable in phone layouts. | On a physical iPhone/iPad or iOS simulator, tap Play, scrub with touch, toggle mute, try the volume slider, and verify the volume limitation hint appears instead of implying volume control works. | `npm run typecheck` guards the `volumeUnsupported` API shape. | iOS Safari does not allow reliable programmatic output-volume control for web audio elements; users must use hardware/system volume. Autoplay remains subject to Safari policy. |
| Android Chrome current stable | Supported | User-gesture playback, mute/volume, pointer scrubbing, playlist navigation, shuffle, repeat-one, and repeat-all work in responsive layouts. | Use Chrome device emulation and at least one physical Android device when possible. Verify tap-to-play, scrubber drag, mute/volume, shuffle order, repeat wrapping, and broken-track retry. | `npm run build` catches production-bundle regressions before device testing. | Device media policy and background playback behavior can vary by vendor/browser shell. |
| Autoplay-blocked recovery | Supported with platform limits | `autoPlay` is best effort. When the browser rejects audible autoplay, the player sets `autoplayBlocked`, announces the state, and shows a “Tap play” recovery path without presenting it as a fatal audio error. | Enable `autoPlay`, load the preview in a fresh tab/profile, confirm the informational banner appears, click Play, and confirm playback starts or surfaces a real media error. | `npm run typecheck` and `npm run build`; manual browser policy checks are required. | Browser autoplay policy is intentionally user- and site-engagement-dependent. The player can explain/recover, not force playback. |
| Pointer, touch, and keyboard scrubbing | Supported | Progress and volume sliders use pointer-friendly drag/click behavior with keyboard support. Touch interactions should not scroll the page while dragging the slider. | In desktop and mobile views, click the bar ends, drag across the full width, use arrow keys on focused sliders, and verify time/volume values stay bounded and never become `NaN`. | `npm run typecheck` covers component contracts. | Browser media duration can be unavailable until metadata loads; disabled/empty states should remain inert. |
| Reduced motion | Supported | With `prefers-reduced-motion: reduce`, decorative animation such as pulses, equalizer bars, spinners, and animated entry states is removed or minimized while controls remain visible. | Toggle the OS/browser reduced-motion setting, reload the preview, play audio, and verify no essential state relies on motion. | `npm run build` includes the reduced-motion CSS in the production bundle. | The browser/OS owns reduced-motion preference detection; no in-app override is provided. |
| Preview smoke test | Smoke tested | The production preview starts on `127.0.0.1:4173`, serves the demo HTML, and every referenced built asset returns HTTP 200. | Run the command locally before merge and open the preview for visual checks if player UI changed. | `npm run preview:smoke` or the full `npm test` script. | The smoke test is not a browser automation suite and does not assert audio playback, autoplay policy, or mobile device APIs. |

## Release checklist

1. Run `npm test` from the repository root.
2. Manually verify any row above that matches the changed code path.
3. For playback-mode changes, test at least one playlist with:
   - shuffle off + repeat off,
   - shuffle on + repeat off,
   - repeat-all wrapping at the end,
   - repeat-one staying on the active track.
4. For mobile/browser-policy changes, record the exact browser/OS versions used in the pull request notes.
