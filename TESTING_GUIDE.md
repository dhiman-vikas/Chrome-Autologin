# Chrome Extension Testing Guide

## Pre-Testing Setup

### 1. Generate Icons

1. Open `icon-generator.html` in Chrome
2. Download all three icons (16x16, 48x48, 128x128)
3. Save them in the `icons/` folder as:
   - `icon16.png`
   - `icon48.png`  
   - `icon128.png`

### 2. Verify File Structure

Ensure all files are present:
```
LoginBrowserExtension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── options.html
├── options.js
├── utils/
│   ├── totp.js
│   └── storage.js
├── styles/
│   └── options.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Installation Testing

### Step 1: Load Extension

1. Open Chrome/Edge browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `LoginBrowserExtension` folder
6. **Expected**: Extension loads without errors

### Step 2: Verify Extension Appears

1. Check extension appears in extensions list
2. Click puzzle icon in toolbar → Pin extension
3. **Expected**: Extension icon visible in toolbar
4. **Expected**: Badge shows "ON"

## Options Page Testing

### Test 1: Open Options Page

1. Click extension icon
2. Click "Open Settings" button
3. **Expected**: Options page opens in new tab
4. **Expected**: Form fields are empty (first run)

### Test 2: Save Credentials

**Test Case 2.1: Validation**
1. Leave all fields empty
2. Click "Save Credentials"
3. **Expected**: Error message "Please fill in all One Login credentials"

**Test Case 2.2: Invalid Email**
1. Enter invalid email: `notanemail`
2. Fill password and TOTP secret
3. Click "Save Credentials"
4. **Expected**: Error message "Please enter a valid email address"

**Test Case 2.3: Invalid TOTP Secret**
1. Enter valid email
2. Enter password
3. Enter invalid TOTP secret: `123456` (not Base32)
4. Click "Save Credentials"
5. **Expected**: Error message about invalid TOTP format

**Test Case 2.4: Valid Credentials**
1. Enter valid email: `test@example.com`
2. Enter password: `TestPassword123`
3. Enter valid Base32 TOTP secret (from your test account)
4. Click "Save Credentials"
5. **Expected**: Success message "✅ Credentials saved successfully!"

### Test 3: TOTP Generator

1. Enter a valid TOTP secret
2. Click "Test TOTP Generator"
3. **Expected**: Displays 6-digit code
4. **Expected**: Code format matches: `123456`
5. **Optional**: Verify code matches authenticator app

### Test 4: Load Saved Credentials

1. Close options page
2. Click extension icon → "Open Settings"
3. **Expected**: Previously saved credentials are loaded
4. **Expected**: Email and TOTP secret visible
5. **Expected**: Password field shows dots (secured)

### Test 5: Clear All Data

1. Click "Clear All Data" button
2. **Expected**: Confirmation dialog appears
3. Click "OK"
4. **Expected**: Success message
5. **Expected**: All form fields cleared
6. Refresh page
7. **Expected**: Fields still empty (data actually cleared)

## Popup Testing

### Test 1: Status Display

1. Click extension icon
2. **Expected**: Popup opens
3. **Expected**: Shows "Auto-Login: ON" or "OFF"
4. **Expected**: Shows "Credentials: Saved" or "Not Set"

### Test 2: Toggle Auto-Login

1. Click "Toggle Auto-Login" button
2. **Expected**: Status changes (ON ↔ OFF)
3. **Expected**: Success message appears
4. **Expected**: Badge on extension icon updates

### Test 3: Open Options

1. In popup, click "Open Settings"
2. **Expected**: Options page opens

## Content Script Testing

### Test 1: Detection on Login Page

1. Navigate to: `https://signin.service.gov.uk/`
2. Open browser console (F12)
3. Filter console for "FTS Auto-Login"
4. **Expected**: See "[FTS Auto-Login] Content script loaded"
5. **Expected**: See "[FTS Auto-Login] Login page detected"

### Test 2: Auto-Fill Behavior (Manual Test)

**Prerequisites**: 
- Have valid credentials saved
- Auto-login enabled

**Steps**:
1. Navigate to Find a Tender Service login page
2. Wait 1-2 seconds
3. **Expected**: Email field auto-fills
4. **Expected**: Continue button clicks automatically
5. **Expected**: Password field auto-fills
6. **Expected**: TOTP code generates and fills
7. **Expected**: Login completes (or attempts to)

**Note**: For full testing, you need a real test account

### Test 3: Manual Trigger

1. Navigate to a login page
2. Click extension icon
3. Click "Trigger Login Now"
4. **Expected**: Login process starts
5. **Expected**: Popup shows success message

### Test 4: Error Handling

**Test Case 4.1: No Credentials**
1. Clear all data in options
2. Navigate to login page
3. **Expected**: Console shows warning about no credentials
4. **Expected**: No auto-fill occurs

**Test Case 4.2: Wrong Page**
1. Navigate to `https://google.com`
2. Click extension icon
3. Click "Trigger Login Now"
4. **Expected**: Error message "Not on a supported login page"

## Security Testing

### Test 1: Encrypted Storage

1. Save credentials in options
2. Open Chrome DevTools (F12)
3. Go to Application → Storage → Local Storage
4. Find extension's storage
5. **Expected**: Credentials data is encrypted (not readable)
6. **Expected**: See objects with `encrypted` and `iv` properties

### Test 2: Credential Persistence

1. Save credentials
2. Close browser completely
3. Reopen browser
4. Open extension options
5. **Expected**: Credentials still loaded
6. **Expected**: Can decrypt and display

### Test 3: Encryption Key Uniqueness

1. Clear all data
2. Save test credentials
3. Note encrypted values in DevTools
4. Clear all data again
5. Save same credentials
6. **Expected**: Encrypted values are different (new encryption each time)

## Performance Testing

### Test 1: Initialization Speed

1. Reload extension
2. Note time to load
3. **Expected**: Loads in < 1 second
4. **Expected**: No console errors

### Test 2: Page Load Impact

1. Navigate to login page with extension enabled
2. Note page load time
3. Disable extension
4. Reload page and note time
5. **Expected**: Minimal difference (< 100ms)

### Test 3: Memory Usage

1. Open Chrome Task Manager (Shift+Esc)
2. Find extension process
3. **Expected**: Memory usage < 50 MB
4. **Expected**: No memory leaks over time

## Browser Compatibility Testing

Test on:
- ✅ Google Chrome (latest)
- ✅ Microsoft Edge (latest)
- ✅ Brave Browser (latest)
- ✅ Opera (latest)

## Known Issues & Limitations

Document any issues found during testing:

1. **Timing Issues**: May need to adjust wait times in content script
2. **Selector Changes**: Website updates can break selectors
3. **TOTP Sync**: System time must be accurate
4. **Multiple Tabs**: Opening multiple login pages simultaneously may cause issues

## Test Completion Checklist

- [ ] Extension installs without errors
- [ ] Icons display correctly
- [ ] Options page opens and functions
- [ ] Credentials save and load correctly
- [ ] TOTP generator produces valid codes
- [ ] Auto-login triggers on correct pages
- [ ] Manual trigger works from popup
- [ ] Credentials are encrypted in storage
- [ ] Toggle auto-login works
- [ ] Clear data removes all credentials
- [ ] No console errors during normal operation
- [ ] Works across all supported domains
- [ ] Popup UI displays correct status
- [ ] Badge updates reflect status

## Debugging Tips

### Console Filtering

In browser console, filter by: `FTS Auto-Login`

### Common Issues

1. **"Cannot read property"**: Check element selectors in content.js
2. **TOTP fails**: Verify secret is Base32, check system time
3. **Not auto-filling**: Check auto-login is enabled, credentials saved
4. **Encryption error**: Clear storage and re-enter credentials

### Enable Verbose Logging

In `content.js`, change log level to see all messages:
```javascript
log(message, 'info'); // Always visible
```

## Production Readiness Checklist

Before deploying to users:

- [ ] All tests pass
- [ ] Icons are professional quality
- [ ] Documentation is complete
- [ ] Security review completed
- [ ] Performance is acceptable
- [ ] Tested on production URLs
- [ ] Error handling is robust
- [ ] User feedback collected

## Test Reports

Document test results:

### Test Run: [Date]
- **Tester**: [Name]
- **Chrome Version**: [Version]
- **OS**: [OS Name and Version]
- **Results**: [Pass/Fail]
- **Issues Found**: [List issues]
- **Notes**: [Additional notes]
