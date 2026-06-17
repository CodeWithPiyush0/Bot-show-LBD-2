---
name: lbd2-final-cleanup
description: Reminder — do a dead-code/asset cleanup pass on LBD-2 ONLY at the very end, once the game is fully done.
metadata:
  type: project
---

The user asked to be reminded to delete unused things (code, assets, files) at the END — only once the whole game is completed successfully. Do NOT delete mid-development (things keep getting reused/reverted).

When the game is final, surface a cleanup list and confirm before deleting. Known dead/dormant candidates as of this restructure (verify each is truly unreferenced first):
- **Part 2 flow** (now dormant — single tutorial + 5 levels, no separate Part 2): screens 5/6/7/8 in index.html, `js/part2.js`, the `startPart2Tutorial`/`showYourTurn(2)`/`TURN_BOTS[2]` paths in main.js, Part-2 dev-menu entries.
- **Overcharged bot assets** if Part-2-only: `*_bot_overcharged.webp`, the 3 chooser bots dropped (green/teal/yellow) + their `slot_*`/`panel_*`/`*_bot_charged` if unused, `White_purple_bot*`.
- **Battery-era leftovers**: `*_battery.svg`, `battery_slots*.webp`, `Bigger_Slot*`/`Smaller_Slot.svg`, old `panel.svg`, `play_btn.*`/`orange_bot.svg` etc. — grep each filename across the repo before removing.
- **Dead CSS/JS**: `.battery*`, `.tray*`, old `slot-glow*`/`charge-fx`/`.panel--*` rules, unused `ghostLoop`, `getCounts` remnants.

Grep every candidate (`git grep <name>`) to confirm zero references, and re-test the full flow after deleting.
