# Tab Resource Limiter

Caps what greedy tabs (Spotify, Teams, Outlook, …) can consume, per site rule:

- **CPU** — throttled via the DevTools protocol (`Emulation.setCPUThrottlingRate`). A ×6 rule runs the tab at 1/6 speed.
- **Network** — bandwidth/latency capped via `Network.emulateNetworkConditions` (10mbps / 1mbps / 500kbps / 400kbps profiles).
- **RAM** — no per-tab cap exists in Chrome, so instead matching tabs are auto-**discarded** (memory freed, page reloads on return) after N minutes of inactivity. Audible tabs (music playing) are never discarded.

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select this folder

No sites are limited by default. Use the toolbar popup on a site and select
"Throttle this site" to create a rule. The site's slider position is saved with
that rule.

Version 1.5 removes the old built-in Spotify, Teams, and Outlook presets during
upgrade when their resource settings are unchanged. Customized rules and rules
you created remain available.

## Use

- **Toolbar popup** — turn all limiting on or off, adjust the current site's
  limiting strength, or use one-click "Throttle this site" / "Remove rule" for
  the current tab.
- **Toolbar icon** — green means throttling is actively applied to that tab;
  gray means it is not. Background-only rules show gray while the tab is
  focused and switch to green when the tab moves to the background.
- **Limiting strength** — 100% applies the current site's configured CPU
  slowdown and network cap. Lower settings progressively relax both limits.
  Each site's slider position is saved with its rule and persists across Chrome
  restarts. The master switch still applies to every rule.
- **Options page** — full rule table: pattern (hostname substring), CPU factor, network profile, discard timer, background-only, enable/disable.
- **Background only** — lifts the throttle while the tab is focused, re-applies when you switch away. Good for Teams/Outlook; leave off for Spotify so it stays capped while playing.

## Known trade-offs

- Chrome shows a **"Tab Resource Limiter started debugging this browser"** banner while throttles are attached — that's inherent to the debugger API. Launch Chrome with `--silent-debugger-extension-api` to hide it.
- Opening DevTools on a throttled tab detaches the extension's debugger (only one debugger per tab); the throttle re-applies on the next navigation or tab switch.
- Discarded tabs reload from scratch when activated.

## Launcher: `/Applications/Google Chrome (Quiet).app`

A compiled AppleScript applet that starts Chrome with two switches:

- `--silent-debugger-extension-api` — suppresses the "started debugging this browser" infobar this extension would otherwise show on every throttled tab.
- `--restore-last-session` — reopens the previous session on every launch, for all profiles.

Pin it to the Dock in place of Chrome. Launching it while Chrome is already running just activates the existing window (no `-n`, so no second instance and no profile-lock collision). Flags only apply to a cold start, so Chrome must be fully quit for a change to take effect.

Rebuild after editing:

```
osacompile -o "/Applications/Google Chrome (Quiet).app" \
  -e 'do shell script "open -a \"Google Chrome\" --args --silent-debugger-extension-api --restore-last-session"'
cp "/Applications/Google Chrome.app/Contents/Resources/app.icns" \
   "/Applications/Google Chrome (Quiet).app/Contents/Resources/applet.icns"
```

Note that `session.restore_on_startup` is an HMAC-protected Chrome preference stored in `Secure Preferences`, not `Preferences` — editing it by hand gets reverted. Use the flag above, Chrome's own settings UI, or the `RestoreOnStartup` enterprise policy.
