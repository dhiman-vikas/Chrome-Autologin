# Generic Auto-Login Chrome Extension

A Manifest V3 extension that automates multi-page sign-in flows: username, password and authenticator (TOTP) codes. Sites, page sequence and credentials are all configurable.

## Concepts

- **Profile**: one website login. Has its own credentials and an ordered list of steps.
- **Step**: one page in the sign-in sequence. Defined by a URL pattern and an action:
  - Fill username
  - Fill password
  - Fill username + password (single-page login)
  - Fill authenticator (TOTP) code
  - Click an element only (for example a "Sign in with SSO" button)
- **Entry step**: step 1. When the browser opens a URL matching it, the login starts (if "Start automatically" is on). Later steps run when the browser reaches their URLs. Each step runs once per login attempt, so a failed login does not loop. A login attempt expires after 2 minutes of inactivity.

## Install

1. Open `chrome://extensions` and enable Developer mode.
2. Click "Load unpacked" and select this folder.
3. The options page opens on first install. Reload tabs that were open before installing.

## Configure

In the options page, click **Add Profile** and set:

| Setting | Description |
| --- | --- |
| Credentials | Username/email, password, optional TOTP secret (Base32). Use "Test TOTP Generator" to compare with your authenticator app. |
| Page URL pattern | Wildcard (`*`) or regular expression. Wildcard patterns ignore query string and hash unless the pattern contains `?` or `#`. |
| Action | What to do on that page. |
| Selectors (advanced) | CSS selectors for the input and submit button. Empty means auto-detect. |
| Submit after filling | Click the submit button after filling. |
| Delay | Wait (ms) before running the step. |

Example (three-page login):

1. Fill username - `https://login.example.com/enter-email`
2. Fill password - `https://login.example.com/enter-password`
3. Fill authenticator code - `https://login.example.com/enter-code`

Steps can be reordered; sequences where username and password share a page use "Fill username + password".

## Use

- **Automatic**: open the URL of a profile's first step.
- **Manual**: on a login page click the extension icon, then "Trigger Login Now". This runs the step matching the current page and continues through the profile's remaining steps.
- The popup also toggles auto-login on/off globally.

## Security

- Credentials are encrypted with AES-GCM before being written to `chrome.storage.local`.
- The encryption key lives in the same browser profile, so this protects against casual inspection only, not against someone with access to your browser profile. Use on trusted devices.
- Nothing is sent to any server.
- The content script is injected on all URLs but does nothing unless a configured step matches the current page.

## Project structure

```
manifest.json     Extension manifest
background.js     Badge, per-tab run state
content.js        URL matching, step execution, TOTP
popup.html/js     Toolbar popup
options.html/js   Profile editor
utils/storage.js  Encrypted profile storage
utils/totp.js     TOTP generator (options page test)
styles/options.css
```

Note: `IMPLEMENTATION_PLAN.md`, `PROJECT_SUMMARY.md`, `QUICK_START.md` and `TESTING_GUIDE.md` describe the previous One Login-specific version.
