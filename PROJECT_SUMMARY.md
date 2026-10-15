# Project Summary: Generic Auto-Login Chrome Extension

## Overview

A Manifest V3 browser extension that automates multi-page sign-in flows for any website. You define profiles (credentials plus an ordered list of login pages and actions) and the extension fills and submits each page as the browser reaches it. It supports username, password and authenticator (TOTP) codes, and is not tied to any specific site or identity provider.

## Project structure

```
manifest.json         Extension manifest (MV3)
background.js         Service worker: badge, per-tab run state, opens options on install
content.js            URL matching, step execution, credential decryption, TOTP
popup.html / popup.js Toolbar popup: status, manual trigger, toggle, settings
options.html / .js    Profile editor
styles/options.css    Options page styling
utils/storage.js      Encrypted profile storage
utils/totp.js         TOTP generator (used by the options page test button)
icons/                Extension icons
icon-generator.html   Tool to generate icon PNGs
```

Documentation: [README.md](README.md), [QUICK_START.md](QUICK_START.md), [TESTING_GUIDE.md](TESTING_GUIDE.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Key features

### Profiles and steps

- A **profile** is one website login with its own credentials and an ordered list of steps.
- A **step** is one page in the sign-in sequence: a URL pattern (wildcard or regular expression) plus an action:
  - Fill username
  - Fill password
  - Fill username + password (single-page login)
  - Fill authenticator (TOTP) code
  - Click an element only
- Step 1 is the **entry step**: opening a matching URL starts the login (if "Start automatically" is on). Later steps run when the browser reaches their URLs.
- Optional per-step settings: CSS selectors for the input and submit button, submit after filling, delay before running.

### Content script

- Injected on all URLs but only acts when a configured step matches the current page.
- Auto-detects username, password, one-time-code inputs and submit buttons; selectors can be overridden.
- Detects single-page-app navigation via URL polling.
- Each step runs once per login attempt, preventing loops after failed logins. Attempts expire after 2 minutes of inactivity.
- Waits if a TOTP code is about to expire before submitting it.

### Storage and security

- Credentials are encrypted with AES-GCM (256-bit key) before being written to `chrome.storage.local`.
- The key is generated per installation and stored in the same browser profile, so this protects against casual inspection only.
- Nothing is sent to any server; no analytics.
- Minimal permissions: `storage`.

### UI

- **Popup**: auto-login ON/OFF, number of active profiles, Trigger Login Now, Toggle Auto-Login, Open Settings.
- **Options page**: add/edit/delete profiles, reorder steps, test the TOTP generator, clear all data.
- **Badge**: ON/OFF indicator on the toolbar icon.

## Technology

- Chrome Extension Manifest V3
- Web Crypto API (AES-GCM, HMAC-SHA1 for TOTP)
- `chrome.storage.local` and `chrome.storage.session` (per-tab run state)
- ES modules (options page, service worker), plain content script

## Getting started

See [QUICK_START.md](QUICK_START.md). In short:

1. Load the folder at `chrome://extensions/` with Developer mode on.
2. In the options page, add a profile with credentials and the login steps.
3. Open the first step's URL, or use Trigger Login Now.

## Known limitations

1. Chromium-based browsers only.
2. Sites that change their markup may need updated selectors.
3. TOTP requires an accurate system clock.
4. Content scripts do not run inside subframes, so logins embedded in iframes are not supported.
5. The encryption key lives next to the encrypted data; use on trusted devices only.

## Possible enhancements

- [ ] Export/import profiles
- [ ] Per-profile host allow-list instead of all-URL injection
- [ ] Login success/failure notifications
- [ ] Keyboard shortcut for manual trigger
- [ ] Optional master password for encryption

## Troubleshooting

See the troubleshooting section of [QUICK_START.md](QUICK_START.md). Console logs are prefixed with `[Auto-Login]`.

**Last updated:** October 15, 2026
