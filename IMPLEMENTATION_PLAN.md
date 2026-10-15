# Implementation Notes

Design and architecture of the Generic Auto-Login extension.

## Goals

- Automate username, password and authenticator (TOTP) sign-in for any website.
- Make sites, page sequence and credentials configurable, with no site-specific code.
- Keep credentials local and encrypted; request minimal permissions.

## Architecture

```
manifest.json         MV3 manifest; content script on <all_urls>; permission: storage
background.js         Service worker (ES module)
content.js            Content script (runs at document_end)
popup.html / .js      Toolbar popup
options.html / .js    Options page (ES module)
utils/storage.js      Profile storage and AES-GCM encryption
utils/totp.js         TOTP generator for the options page test button
styles/options.css
```

### Data model (`chrome.storage.local`)

| Key | Content |
| --- | --- |
| `gl_enabled` | Global on/off switch |
| `gl_encryption_key` | Raw AES-GCM key bytes (generated on first save) |
| `gl_profiles` | Array of profiles |

```
Profile {
  id, name, enabled, autoStart,
  credentials: { encrypted, iv }     // plain form: { username, password, totpSecret }
  steps: Step[]                      // ordered; steps[0] is the entry step
}

Step {
  id, name,
  action: 'username' | 'password' | 'userpass' | 'totp' | 'click',
  urlPattern, matchType: 'wildcard' | 'regex',
  selector, passwordSelector, submitSelector,   // optional CSS selectors
  submit, delayMs
}
```

Per-tab run state lives in `chrome.storage.session` under `run_<tabId>` and is removed when the tab closes.

## Login flow

1. The content script runs on every page load and when the URL changes (SPA navigations are detected by polling every second).
2. It loads the enabled profiles and the tab's run state (a run expires after 2 minutes of inactivity).
3. **Selecting a step**:
   - Manual trigger: the first step, in any profile, whose URL pattern matches the current page.
   - Active run: a step of the run's profile that has not run yet and matches the URL.
   - No run: a profile with `autoStart` whose entry step matches the URL. A run that already used the entry step blocks a restart for 30 seconds (5 seconds once finished) to prevent loops after a failed login.
4. The step is recorded as run before it executes, so each step runs at most once per run.
5. Credentials are decrypted, the action is executed, and the page is re-evaluated after 2.5 seconds for SPAs that move to the next step without reloading.

### Step actions

| Action | Behavior |
| --- | --- |
| `username` | Fill the username field |
| `password` | Fill the password field |
| `userpass` | Fill both fields on one page |
| `totp` | Generate a code (waits if it is about to expire) and fill it |
| `click` | Click the element matching the required CSS selector |

Fields are located with the step's selector if set, otherwise by a prioritized list of default selectors (for example `input[type="email"]`, `input[type="password"]`, `input[autocomplete="one-time-code"]`). Values are set through the native value setter followed by `input` and `change` events so frameworks such as React pick them up.

### Submitting

If "Submit after filling" is on, the submit control is chosen in this order: the step's submit selector; `[type=submit]` in the same form, then in the document; a button whose text looks like "Sign in", "Continue", "Next" etc.; the only button in the form. As fallbacks it calls `form.requestSubmit()` or sends an Enter key press to the field.

### URL matching

- **Wildcard**: `*` matches any characters, case-insensitive; trailing slash ignored. The query string and hash are ignored unless the pattern contains `?` or `#`.
- **Regex**: JavaScript regular expression tested against the full URL.

## Security

1. Credentials are encrypted with AES-GCM (256-bit key, random 12-byte IV per save) before being stored.
2. The key is stored in the same browser profile, so protection is against casual inspection only.
3. No network requests; no analytics.
4. Options page DOM is built with `textContent`/properties, not HTML strings, to avoid injection.
5. Minimal permission set (`storage`). The content script is injected everywhere but does nothing unless a configured step matches.
6. Users can clear all stored data from the options page.

## Design decisions

- **Per-step URL matching instead of fixed flow code**: lets any multi-page sign-in be described as data.
- **Run state in the service worker session storage**: survives page navigations within a tab without persisting to disk.
- **Run-once per step**: avoids infinite loops when credentials are wrong.
- **Auto-detected selectors with override**: works for most standard forms, with a way out when it does not.

## Potential challenges

| Challenge | Mitigation |
| --- | --- |
| Site markup changes | Override selectors per step |
| Late-rendered fields | Content script polls up to 10 seconds for elements |
| TOTP clock drift | Test in the options page; keep system time accurate |
| Login in iframes | Not supported (content script is not injected into subframes) |
| Multiple profiles matching one URL | The first matching profile in list order wins |

## Possible future work

- Export/import profiles
- Per-profile host allow-list with optional host permissions
- Success/failure notifications
- Keyboard shortcut for manual trigger
- Optional master password for encryption
