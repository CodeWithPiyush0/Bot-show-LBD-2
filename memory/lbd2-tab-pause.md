---
name: lbd2-tab-pause
description: LBD-2 pauses the whole game (timers + SFX) when the tab is hidden/minimized; how it's wired.
metadata:
  type: project
---

In LBD-2 the game must fully PAUSE when the tab is switched or the browser minimized — no SFX, no game progress — and resume where it left off. Wiring:

- **`js/pause.js`** (GAME code; loaded FIRST) wraps `setTimeout`/`setInterval`; while "paused" it HOLDS game timer callbacks and replays them in order on resume. Pauses when `document.hidden` (tab hidden/minimized) via a `visibilitychange` listener. Exposes `window.GamePause.addCondition(fn)`/`addExemption(fn)`/`refresh()`/`isPaused()` so optional tools can add pause conditions. (Split out of the old `js/qa-freeze.js`; the QA half is now **`qa/qa-freeze.js`** — an ESM `initQaFreeze()` imported by `qa/qa-mode.js`, run only when `?qa=true`; it registers the `qa-intercept-on` pause condition + exempts QA's own `/qa/` timers. Whole reusable QA tool stays inside `/qa/`.)
- **`js/audio.js`**: `SFX.play()` returns null when `document.hidden` (no new sounds while hidden); `visibilitychange` already calls `ctx.suspend()`/`resume()` (freezes looping music/SFX) + pauses the `<audio>` fallback.

Page Visibility (`document.hidden`) covers tab-switch AND minimize on Chrome/Edge/Firefox. Verified headless: SFX null while hidden, a game timer stays unfired while hidden then fires on resume.
