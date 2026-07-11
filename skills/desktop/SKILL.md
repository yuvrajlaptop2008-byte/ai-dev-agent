---
name: desktop
description: Real OS-level desktop control — see the screen, move the mouse, click, type, press keys.
keywords: desktop, screen, mouse, keyboard, click, type, screenshot, see screen, vision, control computer
tools: screen_screenshot, screen_look, mouse_move, mouse_click, keyboard_type, keyboard_key
---

# Desktop Control Skill

Operates the actual machine like a person sitting at it — not a simulation. Needs a real
display (X11/Wayland/macOS/Windows desktop session) to work; in headless/server environments
these tools report that plainly instead of pretending to succeed.

## Capabilities
- `screen_look` — take a screenshot and describe what's on it via vision AI. Use this FIRST,
  before clicking or typing anything, so you know what's actually there.
- `mouse_move` / `mouse_click` — real cursor control
- `keyboard_type` / `keyboard_key` — real keystrokes, including shortcuts (ctrl+c, alt+Tab, etc.)
- `screen_screenshot` — raw screenshot without the vision description, if you just need the file

## Workflow
```
screen_look (see what's there) → decide → mouse_click / keyboard_type → screen_look (verify it worked)
```
Always verify with another `screen_look` after an action that's supposed to change what's
on screen — don't assume a click landed correctly.

## Platform notes
- Linux: needs `xdotool` + a screenshot tool (`scrot`/`imagemagick`/`gnome-screenshot`)
- macOS: needs `cliclick` (mouse) — keyboard/screenshot use built-in `osascript`/`screencapture`
- Windows: uses built-in PowerShell/.NET, no extra install needed
If a tool reports "not installed," say so plainly rather than pretending the action happened.
