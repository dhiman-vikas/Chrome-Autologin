# Quick Start Guide

Set up a login profile for any website in a few minutes.

## Prerequisites

- Chrome, Edge, or another Chromium-based browser
- The credentials for the site you want to log into (username/email, password)
- Optional: the TOTP secret (Base32) if the site uses an authenticator app
- The URL of each page in the site's sign-in sequence

## Setup

### Step 1: Icons

The `icons/` folder already contains `icon16.png`, `icon48.png` and `icon128.png`. To use your own, open `icon-generator.html` in a browser, download the three sizes and replace the files.

### Step 2: Install the extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. The options page opens on first install

Reload any tabs that were open before installing, so the content script is injected.

### Step 3: Create a profile

1. In the options page, click **Add Profile**
2. Enter a profile name (for example `Company portal`)
3. Fill in the credentials:
   ```
   Username / email: your-email@example.com
   Password:         your-password
   TOTP secret:      (optional) YOUR-BASE32-SECRET
   ```
4. Define the login sequence. Each step is one page:

   | Step | Action | Page URL pattern |
   | --- | --- | --- |
   | 1 (entry page) | Fill username | `https://login.example.com/enter-email` |
   | 2 | Fill password | `https://login.example.com/enter-password` |
   | 3 | Fill authenticator code | `https://login.example.com/enter-code` |

   - If username and password are on the same page, use one **Fill username + password** step.
   - If a page needs a button clicked first (for example "Sign in with SSO"), add a **Click an element only** step and set its CSS selector under *Advanced*.
5. Click **Save All**

### Step 4: Test the TOTP secret (if used)

1. Click **Test TOTP Generator** in the profile's credentials section
2. Compare the 6-digit code with your authenticator app
3. If they match, the secret is correct

### Step 5: Use it

- **Automatic**: open the URL that matches step 1. The extension runs each step as the browser reaches its page.
- **Manual**: on a login page, click the extension icon and choose **Trigger Login Now**.

## URL patterns

| Type | Example | Matches |
| --- | --- | --- |
| Wildcard | `https://example.com/login` | That page, ignoring any query string or hash |
| Wildcard | `https://*.example.com/signin*` | Any subdomain, any path starting with `/signin` |
| Regular expression | `^https://example\.com/(login\|auth)` | Tested against the full URL |

Wildcard patterns only consider the query string and hash if the pattern itself contains `?` or `#`.

## Where to find a TOTP secret

When setting up an authenticator app on a site:

1. Look for "Can't scan the QR code?" or "Enter key manually"
2. Copy the string shown (for example `JBSWY3DPEHPK3PXP`)
3. Paste it into the profile's TOTP secret field

```
Valid:   JBSWY3DPEHPK3PXP
Valid:   JBSW Y3DP EHPK 3PXP   (spaces are ignored)
Invalid: 123456                (digits 0, 1, 8, 9 are not Base32)
Invalid: abc@def.com
```

## Toolbar popup

- **Auto-Login**: global on/off status
- **Profiles**: number of enabled profiles
- **Trigger Login Now**: run the step matching the current page, then continue through the profile's remaining steps
- **Toggle Auto-Login**: enable or disable all automatic logins
- **Open Settings**: open the options page

## Troubleshooting

### Login does not start

1. Check the popup shows Auto-Login ON and at least one active profile
2. Confirm the URL pattern of step 1 matches the page URL
3. Reload the tab (content script only loads on pages opened after install)
4. Open the console (F12) and filter by `[Auto-Login]`

### A field is not filled or the wrong field is filled

1. Open the step's **Advanced** section
2. Enter a CSS selector for the input (for example `#username`)
3. Optionally set a selector for the submit button

### The form is filled but not submitted

- Set the **Submit button selector** in Advanced, or
- Make sure **Submit after filling** is checked

### TOTP code rejected

1. Check your computer's clock is accurate
2. Verify the secret is Base32
3. Compare with **Test TOTP Generator** and your authenticator app

### Login stops after a failed attempt

This is intentional. Each step runs once per login attempt (to avoid loops), and an attempt expires after 2 minutes of inactivity. Fix the configuration and open the entry URL again, or use **Trigger Login Now**.

## Security notes

- Credentials are encrypted with AES-GCM before being stored in `chrome.storage.local`
- The encryption key is stored in the same browser profile, so this protects against casual inspection only
- No data is sent to any server, and there is no analytics or tracking
- Do not enable browser sync for extension data, and use only on trusted devices

## More information

- Full documentation: [README.md](README.md)
- Design and architecture: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- Testing: [TESTING_GUIDE.md](TESTING_GUIDE.md)
- Project overview: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)

Tip: pin the extension to your toolbar for quick access to the manual trigger.
