# Quick Start Guide

Get the Chrome extension running in 5 minutes!

## ⚡ Prerequisites

- Chrome, Edge, or Chromium-based browser
- Your One Login credentials (email, password)
- Your TOTP secret key (Base32 format)

## 🚀 5-Minute Setup

### Step 1: Generate Icons (30 seconds)

1. Open `icon-generator.html` in browser
2. Click "Download" under each icon (16, 48, 128)
3. Save all three files in `icons/` folder

### Step 2: Install Extension (1 minute)

1. Open browser
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select `LoginBrowserExtension` folder
6. Done! Extension appears in toolbar

### Step 3: Configure Credentials (2 minutes)

1. Click extension icon in toolbar
2. Click **Open Settings**
3. Fill in the form:
   ```
   Email: your-email@example.com
   Password: your-password
   TOTP Secret: YOUR-BASE32-SECRET
   ```
4. Click **Save Credentials**
5. See success message ✅

### Step 4: Test (1 minute)

1. Click **Test TOTP Generator** button
2. Verify 6-digit code appears
3. Optional: Compare with authenticator app
4. If match → Ready to use! 🎉

### Step 5: Use It! (30 seconds)

1. Navigate to Find a Tender Service
2. Watch it auto-login 🔐
3. Done!

## 🎯 One Login Secret Key

### Where to Find It

When setting up 2FA:
1. Look for "Can't scan QR code?"
2. Click "Enter key manually"
3. Copy the string shown (e.g., `JBSWY3DPEHPK3PXP`)
4. Paste into extension settings

### Format Example
```
✅ Valid:   JBSWY3DPEHPK3PXP
✅ Valid:   JBSW Y3DP EHPK 3PXP (spaces OK)
❌ Invalid: 123456
❌ Invalid: abc@def.com
```

## 🎮 Quick Controls

### Extension Popup

Click extension icon to:
- 📊 **View Status**: Auto-login on/off, credentials saved
- ▶️ **Trigger Login**: Manual login on current page
- 🔄 **Toggle Auto-Login**: Quick enable/disable
- ⚙️ **Open Settings**: Configure credentials

### Keyboard Shortcuts

No keyboard shortcuts by default. Add via:
`chrome://extensions/shortcuts`

## 🔧 Quick Troubleshooting

### "Login not working"

1. Check console (F12) for errors
2. Verify credentials saved (check popup status)
3. Test TOTP generator in settings
4. Ensure auto-login is enabled

### "TOTP code invalid"

1. Check your computer's time is accurate
2. Verify secret key is Base32 format
3. Test generator and compare with authenticator app

### "Extension not loading"

1. Check all files are present
2. Verify icons exist in `icons/` folder
3. Look for errors in `chrome://extensions/`

## 📁 Required Files Checklist

Before loading:
```
✅ manifest.json
✅ background.js
✅ content.js
✅ popup.html / popup.js
✅ options.html / options.js
✅ utils/totp.js
✅ utils/storage.js
✅ styles/options.css
✅ icons/icon16.png
✅ icons/icon48.png
✅ icons/icon128.png
```

## 🌐 Supported Sites

Works on:
- Find a Tender Service (all environments)
- One Login (signin.service.gov.uk)
- AWS Cognito (optional)

## 🔐 Security Notes

- ✅ Credentials encrypted locally
- ✅ No external servers contacted
- ✅ No analytics or tracking
- ✅ Open source - review the code!

## 📚 More Information

- **Full docs**: See `README.md`
- **Implementation**: See `IMPLEMENTATION_PLAN.md`
- **Testing**: See `TESTING_GUIDE.md`

## 🆘 Need Help?

1. Read `README.md` troubleshooting section
2. Check browser console for errors
3. Test TOTP generator
4. Verify all files are present
5. Try clearing data and reconfiguring

## 🎉 You're Ready!

Extension is now:
- ✅ Installed
- ✅ Configured  
- ✅ Tested
- ✅ Ready to use

Just navigate to Find a Tender Service and watch the magic! 🚀

---

**Pro Tip**: Pin the extension to your toolbar for easy access to settings and manual trigger.
