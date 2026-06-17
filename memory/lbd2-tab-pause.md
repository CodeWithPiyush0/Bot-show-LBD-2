---
name: lbd2-tab-pause
description: LBD-2 pauses the whole game (timers + SFX) when the tab is hidden/minimized; how it's wired.
metadata:
  type: project
---

In LBD-2 the game must fully PAUSE when the tab is switched or the browser minimized — no SFX, no game progress — and resume where it left off. Wiring:

- **`js/qa-freeze.js`** wraps `setTimeout`/`setInterval`; while "paused" it HOLDS game timer callbacks and replays them in order on resume (QA comment-mode tool reused this). `shouldPause()` now returns true when `document.hidden` OR the QA `qa-intercept-on` body class is set; a `visibilitychange` listener drives it. So hiding the tab freezes all game timers and they resume exactly where they left off.
- **`js/audio.js`**: `SFX.play()` returns null when `document.hidden` (no new sounds while hidden); `visibilitychange` already calls `ctx.suspend()`/`resume()` (freezes looping music/SFX) + pauses the `<audio>` fallback.

Page Visibility (`document.hidden`) covers tab-switch AND minimize on Chrome/Edge/Firefox. Verified headless: SFX null while hidden, a game timer stays unfired while hidden then fires on resume.
