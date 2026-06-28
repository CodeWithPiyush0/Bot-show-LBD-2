---
name: lbd2-tab-pause
description: LBD-2 pauses the whole game (timers + SFX) when the tab is hidden/minimized; how it's wired.
metadata:
  type: project
---

In LBD-2 the game must fully PAUSE when the tab is switched or the browser minimized — no SFX, no game progress — and resume where it left off. Wiring:

- **`js/pause.js`** (GAME code; loaded FIRST) wraps `setTimeout`/`setInterval`; while "paused" it HOLDS game timer callbacks and replays them in order on resume. Pauses when `document.hidden` (tab hidden/minimized) via a `visibilitychange` listener. Exposes `window.GamePause.addCondition(fn)`/`addExemption(fn)`/`refresh()`/`isPaused()` so an optional tool can add extra pause conditions.
- **QA tool removed (user is dropping in a newer version).** The old `/qa/` folder + its `qa-mode.js` `<script>` in index.html were deleted. Game-side integration hooks were KEPT for the new tool to plug into: `GamePause` (above), `navigation.js qaCommentMode()` (defers screen switches while `qa-intercept-on` is on the body), and the `body.qa-intercept-on` freeze CSS in `css/main.css`. If the new tool uses a different convention, these can be removed.
- **`js/audio.js`**: `SFX.play()` returns null when `document.hidden` (no new sounds while hidden); `visibilitychange` already calls `ctx.suspend()`/`resume()` (freezes looping music/SFX) + pauses the `<audio>` fallback.

Page Visibility (`document.hidden`) covers tab-switch AND minimize on Chrome/Edge/Firefox. Verified headless: SFX null while hidden, a game timer stays unfired while hidden then fires on resume.
