# Chrome Extension - Auto Login Implementation Plan

## Analysis of Playwright Test Login Flow

Based on the analysis of `C:\Code\Goaco\gcgs-cdp-fts-service\E2ETests`, the login process follows these steps:

### Authentication Flow

1. **Initial Navigation**
   - Navigate to the target URL (Find a Tender Service)
   - If redirected to Cognito login, handle it first

2. **Cognito Authentication (Conditional)**
   - URL check: `cdp-sirsi-development.auth.eu-west-2.amazoncognito.com`
   - Input username and password
   - Click submit button

3. **One Login Authentication (Main Flow)**
   - Click "Sign in" link
   - Click sign in button (`#sign-in-button`)
   - Enter email address (`input.govuk-input#email`)
   - Click Continue button
   - Enter password (`input.govuk-input#password`)
   - Click Continue button

4. **TOTP (Two-Factor Authentication)**
   - Wait for OTP input box (`input.govuk-input.govuk-input--width-10#code`)
   - Generate TOTP code using HMAC-SHA1 algorithm with Base32-decoded secret
   - Time step: 30 seconds
   - Code format: 6-digit zero-padded
   - Enter generated code
   - Click Continue button

5. **Post-Login Cognito Check**
   - If redirected back to Cognito, repeat Cognito authentication

### Key Technical Details

**TOTP Generation Algorithm:**
- Algorithm: HMAC-SHA1
- Secret: Base32-encoded string (stored in config)
- Time step: Unix timestamp / 30 seconds
- Output: 6-digit code (zero-padded)

**HTTP Basic Authentication:**
- Applied at browser context level
- Username and password from config

**Selectors Used:**
- Sign in link: `[role="link"][name="Sign in"]`
- Sign in button: `#sign-in-button`
- Email input: `input.govuk-input#email`
- Password input: `input.govuk-input#password`
- Continue button: `button.govuk-button[type='submit']`
- OTP input: `input.govuk-input.govuk-input--width-10#code`
- Cognito username: `[role="textbox"][name="Username"]`
- Cognito password: `[role="textbox"][name="Password"]`
- Cognito submit: `[role="button"][name="submit"]`

## Chrome Extension Implementation Plan

### Architecture

```
LoginBrowserExtension/
├── manifest.json              # Extension configuration
├── background.js              # Background service worker
├── content.js                 # Content script for DOM manipulation
├── options.html               # Options page for user settings
├── options.js                 # Options page logic
├── popup.html                 # Extension popup UI
├── popup.js                   # Popup logic
├── utils/
│   ├── totp.js               # TOTP generator utility
│   └── storage.js            # Chrome storage wrapper
├── styles/
│   └── options.css           # Styling for options page
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Implementation Steps

#### Phase 1: Extension Setup (Manifest V3)
- Create `manifest.json` with required permissions:
  - `activeTab`
  - `storage` (for storing encrypted credentials)
  - `scripting` (for content script injection)
  - Host permissions for Find a Tender domains
- Define content scripts and background worker

#### Phase 2: TOTP Generator Utility
- Port the C# TOTP algorithm to JavaScript
- Implement Base32 decoder
- Implement HMAC-SHA1 using Web Crypto API
- Generate 6-digit codes based on current time

#### Phase 3: Secure Credential Storage
- Create options page for user to input:
  - Email
  - Password
  - TOTP Secret Key
  - Optional: Cognito username/password
- Encrypt credentials before storing (using Web Crypto API)
- Store in `chrome.storage.local`

#### Phase 4: Content Script Implementation
- Detect login page URL patterns
- Implement step-by-step login flow:
  1. Wait for page load
  2. Check for Cognito redirect
  3. Fill One Login email and password
  4. Generate and fill TOTP code
  5. Click appropriate buttons with delays
- Handle errors and edge cases
- Add logging for debugging

#### Phase 5: Background Service Worker
- Listen for navigation events
- Inject content script when on login pages
- Manage storage access
- Handle cross-origin requests if needed

#### Phase 6: User Interface
- Create popup with:
  - Auto-login enable/disable toggle
  - Status indicator
  - Link to options page
- Update badge/icon based on login status

#### Phase 7: Security Considerations
- Encrypt stored credentials using AES-GCM
- Use chrome.storage.local (not sync for sensitive data)
- Clear credentials on uninstall
- Add option to clear stored credentials
- Implement basic rate limiting for TOTP generation

#### Phase 8: Testing & Polish
- Test on all target URLs
- Add error handling and user feedback
- Create user documentation
- Handle edge cases:
  - Network failures
  - Changed selectors
  - Session timeouts
  - Multiple tabs

### Security Best Practices

1. **Credential Storage**
   - Never store credentials in plain text
   - Use Web Crypto API for encryption
   - Generate unique encryption key per installation
   - Store encryption key in secure location

2. **Content Security Policy**
   - Strict CSP in manifest
   - No inline scripts
   - No eval()

3. **Minimal Permissions**
   - Request only necessary permissions
   - Use activeTab instead of broad host permissions where possible

4. **User Transparency**
   - Clear indication when auto-login is active
   - Easy way to disable feature
   - Visible security warnings

### Configuration Required

Users will need to provide:
1. **Email** - One Login email address
2. **Password** - One Login password
3. **TOTP Secret Key** - Base32-encoded secret for 2FA
4. **Cognito Username** (optional) - If accessing SIRSI
5. **Cognito Password** (optional) - If accessing SIRSI

### URLs to Monitor

- `https://fts.dev.supplier-information.find-tender.service.gov.uk`
- `https://dev.supplier-information.find-tender.service.gov.uk`
- `https://fts-app.dev.supplier-information.find-tender.service.gov.uk`
- `https://cdp-sirsi-development.auth.eu-west-2.amazoncognito.com`

### Next Steps

1. Set up basic Chrome extension structure
2. Implement TOTP generator (critical component)
3. Create options page for credential input
4. Develop content script for auto-filling
5. Add security layer for credential storage
6. Test thoroughly on target websites
7. Package and document

### Potential Challenges

1. **Selector Changes** - Website updates may break selectors
   - Solution: Use multiple selector strategies (ID, class, ARIA labels)

2. **Timing Issues** - Race conditions with dynamic content
   - Solution: Use MutationObserver and proper waiting strategies

3. **Security** - Storing sensitive credentials
   - Solution: Strong encryption, user education

4. **TOTP Sync** - Time drift on user's machine
   - Solution: Add time offset configuration option

5. **Browser Detection** - Some sites block automation
   - Solution: Mimic human behavior, add random delays
