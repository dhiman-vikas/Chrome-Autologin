# Testing Guide

Manual test plan for the Generic Auto-Login extension. Tests use a placeholder site (`https://login.example.com/...`); substitute a real login flow you have an account for.

## Setup

1. Verify the files are present:
   ```
   manifest.json
   background.js
   content.js
   popup.html / popup.js
   options.html / options.js
   utils/storage.js, utils/totp.js
   styles/options.css
   icons/icon16.png, icon48.png, icon128.png
   ```
2. Open `chrome://extensions/`, enable **Developer mode**, click **Load unpacked** and select this folder.
3. Pin the extension to the toolbar.

**Expected**: the extension loads without errors, the options page opens on first install, and the badge shows `ON`.

## Options page

### Profiles

1. Click **Add Profile**.
   **Expected**: a profile named "New login" appears with three steps (username, password, TOTP).
2. Click **Save All** with the URL patterns empty.
   **Expected**: error "page URL pattern is required".
3. Clear the profile name and save.
   **Expected**: error "Every profile needs a name".
4. Set a regex URL pattern such as `(` with match type *Regular expression*.
   **Expected**: error "invalid regular expression".
5. Add a *Click an element only* step with no selector.
   **Expected**: error that a CSS selector is required.
6. Use an action that needs a credential (for example *Fill password*) with the password empty.
   **Expected**: error "missing password".
7. Enter a TOTP secret such as `123456`.
   **Expected**: error that the secret must be Base32.
8. Enter valid values and click **Save All**.
   **Expected**: "Settings saved".

### Steps

1. Use the up/down buttons to reorder steps.
   **Expected**: steps swap; the first step is labelled "(entry page)".
2. Remove a step with the remove button.
   **Expected**: the step disappears and numbering updates.
3. Change the action to *Fill username + password* and open **Advanced**.
   **Expected**: a separate password field selector is shown.

### TOTP generator

1. Enter a valid Base32 secret and click **Test TOTP Generator**.
   **Expected**: a 6-digit code is displayed.
2. Compare it with an authenticator app using the same secret.
   **Expected**: the codes match.
3. Click the button with an empty secret.
   **Expected**: error "Enter a TOTP secret first".

### Persistence and clearing

1. Save a profile, close the options page and reopen it from the popup.
   **Expected**: the profile, steps and credentials are loaded.
2. Click **Clear All Data** and confirm.
   **Expected**: all profiles are removed. Reload the page and verify they remain empty.
3. Delete a single profile with **Delete Profile**.
   **Expected**: a confirmation appears and only that profile is removed.

## Popup

1. Open the popup.
   **Expected**: "Auto-Login: ON/OFF" and "Profiles: N active" or "None".
2. Click **Toggle Auto-Login**.
   **Expected**: status flips, a message appears, and the toolbar badge changes between ON and OFF.
3. Click **Open Settings**.
   **Expected**: the options page opens.
4. Disable a profile in the options page and save.
   **Expected**: the popup's active profile count decreases.

## Login flow

Prerequisites: a saved profile with valid credentials, auto-login ON, and tabs reloaded after installing.

### Multi-page flow

1. Configure a profile with steps: username page, password page, TOTP page (or the pages of your site).
2. Open the URL matching step 1.
   **Expected**: the username is filled and submitted.
3. When the password page loads:
   **Expected**: the password is filled and submitted.
4. When the code page loads:
   **Expected**: a TOTP code is filled and submitted, and login completes.
5. Open the console (F12) and filter by `[Auto-Login]`.
   **Expected**: a log line per step run, for example `Profile "..." : running step "..."`.

### Single-page login (username + password)

1. Configure one *Fill username + password* step.
2. Open the matching URL.
   **Expected**: both fields are filled and the form is submitted.

### Click step

1. Add a *Click an element only* step with a valid selector (for example `button#sso`).
2. Reach the matching page.
   **Expected**: the element is clicked, then the next step runs on its page.

### Manual trigger

1. Disable auto-login.
2. Navigate to a page matching one of the steps and click **Trigger Login Now**.
   **Expected**: the matching step runs and the popup shows "Ran step: ...". Remaining steps run as their pages load.

### Selectors and submit options

1. Use a page where auto-detection picks the wrong input and set a CSS selector under **Advanced**.
   **Expected**: the specified field is filled.
2. Uncheck **Submit after filling**.
   **Expected**: the field is filled but the form is not submitted.
3. Set a **Delay before running** of 2000 ms.
   **Expected**: the step runs about two seconds after the page matches.

### Wildcard and regex patterns

| Pattern | Match type | URL | Expected |
| --- | --- | --- | --- |
| `https://login.example.com/signin` | Wildcard | `https://login.example.com/signin?next=/home` | Match |
| `https://*.example.com/signin*` | Wildcard | `https://a.example.com/signin/step2` | Match |
| `https://login.example.com/signin` | Wildcard | `https://login.example.com/other` | No match |
| `^https://login\.example\.com/` | Regular expression | `https://login.example.com/x` | Match |

### Loop prevention and run expiry

1. Save a profile with a wrong password.
2. Open the entry URL.
   **Expected**: each step runs once; when the site redirects back to the entry page, the login does not restart immediately (30 second cool-down).
3. Leave a run idle for more than 2 minutes, then open the entry URL again.
   **Expected**: a new run starts.

### Error handling

| Case | Steps | Expected |
| --- | --- | --- |
| Auto-login off | Toggle off, open entry URL | Nothing runs |
| No profiles | Clear all data, open any page | Nothing runs |
| Profile disabled | Uncheck "Profile enabled", save | Nothing runs |
| Wrong page | Click **Trigger Login Now** on an unrelated site | Error "Current page does not match any login step" |
| Missing field | Use a selector that does not exist | Console error `... field not found` after about 10 seconds |
| Start automatically off | Uncheck "Start automatically on step 1 URL" | Login only starts via **Trigger Login Now** |

## Security

1. Save credentials, then open DevTools for the extension (service worker from `chrome://extensions/`) and run:
   ```javascript
   chrome.storage.local.get(null, console.log)
   ```
   **Expected**: each profile's `credentials` is an object with `encrypted` and `iv` arrays, not plain text.
2. Save the same credentials twice.
   **Expected**: the `encrypted` and `iv` values differ each time.
3. Close and reopen the browser.
   **Expected**: profiles still load in the options page.
4. Confirm that no network requests are made by the extension (DevTools Network tab for the service worker).

## Performance and compatibility

- The content script runs on all URLs but should do nothing on non-matching pages. Check that browsing unrelated sites shows no console output from `[Auto-Login]` and no noticeable slowdown.
- Check memory use in the browser Task Manager (Shift+Esc).
- Test on Chrome, Edge and any other Chromium-based browser you use.

## Known limitations

1. Websites that change their markup may require updating selectors.
2. TOTP requires an accurate system clock.
3. Pages rendered in cross-origin iframes are not handled (the content script does not run in subframes).
4. Run state is tracked per tab; several simultaneous logins in different tabs are independent.

## Debugging

- Console filter: `[Auto-Login]`
- Check the popup: auto-login ON and the profile is enabled
- Re-check the URL pattern against the actual page URL (including `http` vs `https` and subdomains)
- Use **Advanced** selectors when auto-detection fails
- To reset everything: **Clear All Data** in the options page, then reconfigure

## Completion checklist

- [ ] Extension installs without errors
- [ ] Profiles and steps can be created, edited, reordered and deleted
- [ ] Validation messages appear for invalid input
- [ ] TOTP generator matches an authenticator app
- [ ] Credentials are encrypted in storage
- [ ] Multi-page, single-page and click flows work
- [ ] Manual trigger works from the popup
- [ ] Global toggle and per-profile enable work
- [ ] Failed logins do not loop
- [ ] Clear All Data removes everything
- [ ] No unexpected console errors

## Test report template

- **Date**:
- **Tester**:
- **Browser and version**:
- **OS**:
- **Site tested**:
- **Result** (Pass/Fail):
- **Issues found**:
- **Notes**:
