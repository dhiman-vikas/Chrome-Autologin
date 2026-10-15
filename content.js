/**
 * Content Script - generic, configurable multi-step login.
 *
 * On every page (and on SPA URL changes) the script checks the configured
 * profiles:
 *   - No active run: if the URL matches a profile's first step (the entry /
 *     login page) and the profile has autoStart enabled, a run starts.
 *   - Active run (per tab, expires after RUN_IDLE_TIMEOUT_MS of inactivity):
 *     if the URL matches a not-yet-executed step of that profile, the step runs.
 * Each step is executed at most once per run, so a failed login does not loop.
 */

(() => {
  'use strict';

  // ==========================================================================
  // Constants
  // ==========================================================================

  const LOG_PREFIX = '[Auto-Login]';
  const ELEMENT_TIMEOUT_MS = 10000;
  const POLL_MS = 250;
  const RUN_IDLE_TIMEOUT_MS = 2 * 60 * 1000;
  const RESTART_COOLDOWN_MS = 30 * 1000;
  const RESTART_COOLDOWN_DONE_MS = 5 * 1000;
  const RECHECK_AFTER_STEP_MS = 2500;
  const URL_POLL_MS = 1000;

  // Tried in priority order; the first selector with a visible match wins.
  const DEFAULT_SELECTORS = {
    username: [
      'input[autocomplete="username"]',
      'input[type="email"]',
      'input[name*="user" i]',
      'input[id*="user" i]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[name*="login" i]',
      'input[id*="login" i]',
      'input[type="text"]'
    ],
    password: ['input[type="password"]'],
    totp: [
      'input[autocomplete="one-time-code"]',
      'input[name*="otp" i]',
      'input[id*="otp" i]',
      'input[name*="totp" i]',
      'input[id*="totp" i]',
      'input[name*="code" i]',
      'input[id*="code" i]',
      'input[inputmode="numeric"]',
      'input[type="tel"]',
      'input[type="text"]'
    ],
    submit: ['button[type="submit"]', 'input[type="submit"]']
  };

  let busy = false;

  // ==========================================================================
  // Utilities
  // ==========================================================================

  function log(message, level = 'info') {
    console[level](`${LOG_PREFIX} ${message}`);
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function isVisible(element) {
    return element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden';
  }

  /**
   * Find the first visible element. `selectors` is a CSS selector string
   * (user supplied) or an array of selectors tried in priority order.
   */
  function findElement(selectors, { requireEnabled = false } = {}) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of list) {
      let matches;
      try {
        matches = document.querySelectorAll(selector);
      } catch {
        throw new Error(`Invalid CSS selector: ${selector}`);
      }
      for (const element of matches) {
        if (isVisible(element) && !(requireEnabled && element.disabled)) {
          return element;
        }
      }
    }
    return null;
  }

  async function waitForElement(selectors, options = {}) {
    const timeout = options.timeout ?? ELEMENT_TIMEOUT_MS;
    const start = Date.now();
    for (;;) {
      const element = findElement(selectors, options);
      if (element) return element;
      if (Date.now() - start >= timeout) return null;
      await sleep(POLL_MS);
    }
  }

  function setInputValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ==========================================================================
  // URL matching
  // ==========================================================================

  const trimSlash = (s) => (s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s);
  const escapeRegExp = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  /**
   * wildcard: `*` matches any characters, case-insensitive. The query string and
   * hash are ignored unless the pattern itself contains `?` or `#`.
   * regex: tested against the full URL.
   */
  function urlMatches(step, href) {
    const pattern = (step.urlPattern || '').trim();
    if (!pattern) return false;

    if (step.matchType === 'regex') {
      try {
        return new RegExp(pattern).test(href);
      } catch {
        return false;
      }
    }

    const candidates = [href];
    if (!/[?#]/.test(pattern)) {
      const url = new URL(href);
      candidates.push(url.origin + url.pathname);
    }

    const regex = new RegExp(
      '^' + trimSlash(pattern).split('*').map(escapeRegExp).join('.*') + '$',
      'i'
    );
    return candidates.some((candidate) => regex.test(trimSlash(candidate)));
  }

  // ==========================================================================
  // Credentials (AES-GCM decryption) and TOTP
  // ==========================================================================

  async function decryptCredentials(blob) {
    const stored = await chrome.storage.local.get('gl_encryption_key');
    if (!stored.gl_encryption_key || !blob) {
      throw new Error('No credentials configured for this profile');
    }
    const key = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(stored.gl_encryption_key),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(blob.iv) },
      key,
      new Uint8Array(blob.encrypted)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  function base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = base32.replace(/\s/g, '').replace(/=+$/, '').toUpperCase();
    const bytes = [];
    let bitBuffer = 0;
    let bits = 0;

    for (const char of clean) {
      const value = alphabet.indexOf(char);
      if (value < 0) throw new Error('Invalid Base32 character in TOTP secret');
      bitBuffer = (bitBuffer << 5) | value;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((bitBuffer >> bits) & 0xff);
        bitBuffer &= (1 << bits) - 1;
      }
    }
    return new Uint8Array(bytes);
  }

  async function generateTOTP(secret, timeStep = 30, digits = 6) {
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setUint32(4, counter, false);

    const key = await crypto.subtle.importKey(
      'raw',
      base32Decode(secret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer));
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      (hash[offset + 1] << 16) |
      (hash[offset + 2] << 8) |
      hash[offset + 3];
    return (binary % 10 ** digits).toString().padStart(digits, '0');
  }

  /** Avoid submitting a code that is about to expire. */
  async function freshTOTP(secret) {
    const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
    if (remaining <= 3) await sleep((remaining + 1) * 1000);
    return generateTOTP(secret);
  }

  // ==========================================================================
  // Step execution
  // ==========================================================================

  async function fillField(selectors, value, description) {
    if (!value) throw new Error(`Missing ${description} in profile credentials`);
    const input = await waitForElement(selectors);
    if (!input) throw new Error(`${description} field not found`);

    input.scrollIntoView({ block: 'center' });
    input.focus();
    setInputValue(input, value);
    await sleep(200);
    return input;
  }

  const SUBMIT_TEXT = /^\s*(sign[\s-]?in|log[\s-]?in|login|submit|continue|next|verify|confirm|go)\b/i;
  const CLICKABLE = 'button, input[type="submit"], input[type="button"], input[type="image"], a[role="button"], [role="button"]';

  const isClickable = (element) => isVisible(element) && !element.disabled &&
    element.getAttribute('aria-disabled') !== 'true';

  /**
   * Find the submit control, preferring the one in the same form as the filled
   * input (pages with username and password together, or several forms).
   * Order: user selector, [type=submit], any non-reset button in the form,
   * a button whose text looks like "Sign in", then document-wide defaults.
   */
  function findSubmitControl(step, lastInput) {
    if (step.submitSelector) return findElement(step.submitSelector, { requireEnabled: true });

    const roots = [];
    if (lastInput && lastInput.form) roots.push(lastInput.form);
    roots.push(document);

    for (const root of roots) {
      for (const selector of DEFAULT_SELECTORS.submit) {
        const match = [...root.querySelectorAll(selector)].find(isClickable);
        if (match) return match;
      }
    }

    // Buttons without type="submit" (e.g. <button>Sign in</button>, type="button" handled by JS)
    for (const root of roots) {
      const candidates = [...root.querySelectorAll(CLICKABLE)].filter(isClickable)
        .filter((element) => element.type !== 'reset');
      const labelled = candidates.find((element) =>
        SUBMIT_TEXT.test(element.value || element.textContent || element.getAttribute('aria-label') || ''));
      if (labelled) return labelled;
      if (root !== document && candidates.length === 1) return candidates[0];
    }
    return null;
  }

  async function submitForm(step, lastInput) {
    const start = Date.now();
    let button = null;
    // Some pages enable the button only after input events are processed.
    while (Date.now() - start < 5000) {
      button = findSubmitControl(step, lastInput);
      if (button) break;
      await sleep(POLL_MS);
    }

    if (button) {
      button.scrollIntoView({ block: 'center' });
      await sleep(200);
      button.click();
      return;
    }

    if (lastInput && lastInput.form) {
      lastInput.form.requestSubmit();
      return;
    }

    // Last resort: press Enter in the field.
    if (lastInput) {
      const init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
      lastInput.focus();
      lastInput.dispatchEvent(new KeyboardEvent('keydown', init));
      lastInput.dispatchEvent(new KeyboardEvent('keypress', init));
      lastInput.dispatchEvent(new KeyboardEvent('keyup', init));
      return;
    }
    throw new Error('Submit button not found');
  }

  async function executeStep(step, credentials) {
    const delay = Number(step.delayMs) || 0;
    if (delay > 0) await sleep(delay);

    let lastInput = null;

    switch (step.action) {
      case 'username':
        lastInput = await fillField(step.selector || DEFAULT_SELECTORS.username, credentials.username, 'Username');
        break;

      case 'password':
        lastInput = await fillField(step.selector || DEFAULT_SELECTORS.password, credentials.password, 'Password');
        break;

      case 'userpass':
        await fillField(step.selector || DEFAULT_SELECTORS.username, credentials.username, 'Username');
        lastInput = await fillField(step.passwordSelector || DEFAULT_SELECTORS.password, credentials.password, 'Password');
        break;

      case 'totp': {
        if (!credentials.totpSecret) throw new Error('Missing TOTP secret in profile credentials');
        const code = await freshTOTP(credentials.totpSecret);
        lastInput = await fillField(step.selector || DEFAULT_SELECTORS.totp, code, 'Authenticator code');
        break;
      }

      case 'click': {
        if (!step.selector) throw new Error('Click step requires a selector');
        const target = await waitForElement(step.selector, { requireEnabled: true });
        if (!target) throw new Error(`Element not found: ${step.selector}`);
        target.scrollIntoView({ block: 'center' });
        target.click();
        return;
      }

      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }

    if (step.submit !== false) {
      await submitForm(step, lastInput);
    }
  }

  // ==========================================================================
  // Run coordination
  // ==========================================================================

  const getRun = () => chrome.runtime.sendMessage({ action: 'runState:get' });
  const setRun = (state) => chrome.runtime.sendMessage({ action: 'runState:set', state });

  /**
   * Decide which step (if any) applies to the current page.
   * @returns {{profile, step, run}|null}
   */
  function selectTarget(profiles, run, href, manual) {
    if (manual) {
      for (const profile of profiles) {
        const step = profile.steps.find((s) => urlMatches(s, href));
        if (step) return { profile, step, run: { profileId: profile.id, ranSteps: [] } };
      }
      return null;
    }

    if (run) {
      const profile = profiles.find((p) => p.id === run.profileId);
      const step = profile && profile.steps.find(
        (s) => !run.ranSteps.includes(s.id) && urlMatches(s, href)
      );
      if (step) return { profile, step, run };
    }

    for (const profile of profiles) {
      if (profile.autoStart === false) continue;
      const entry = profile.steps[0];
      // A run that already used this entry step blocks a restart only while it is
      // recent, which prevents loops when a failed login redirects back to the
      // entry page. Finished runs may restart sooner.
      if (run && run.profileId === profile.id && run.ranSteps.includes(entry.id)) {
        const idle = Date.now() - run.lastActivity;
        const cooldown = run.done ? RESTART_COOLDOWN_DONE_MS : RESTART_COOLDOWN_MS;
        if (idle < cooldown) continue;
      }
      if (urlMatches(entry, href)) {
        return { profile, step: entry, run: { profileId: profile.id, ranSteps: [] } };
      }
    }
    return null;
  }

  async function evaluate(manual = false) {
    if (busy) return { success: false, error: 'A login step is already in progress' };
    busy = true;

    try {
      const { gl_enabled, gl_profiles } = await chrome.storage.local.get(['gl_enabled', 'gl_profiles']);
      if (!manual && gl_enabled === false) {
        return { success: false, error: 'Auto-login is disabled' };
      }

      const profiles = (gl_profiles || []).filter(
        (p) => p.enabled !== false && Array.isArray(p.steps) && p.steps.length > 0
      );
      if (profiles.length === 0) {
        return { success: false, error: 'No enabled profiles configured' };
      }

      let run = await getRun();
      if (run && Date.now() - run.lastActivity > RUN_IDLE_TIMEOUT_MS) run = null;

      const target = selectTarget(profiles, run, location.href, manual);
      if (!target) {
        log(`No step to run on ${location.href} (completed steps: ${run ? run.ranSteps.length : 0})`);
        return { success: false, error: 'Current page does not match any login step' };
      }

      const { profile, step } = target;
      run = target.run;
      run.ranSteps.push(step.id);
      run.done = step.id === profile.steps[profile.steps.length - 1].id;
      run.lastActivity = Date.now();
      await setRun(run);

      const stepLabel = step.name || step.action;
      log(`Profile "${profile.name}": running step "${stepLabel}"`);

      const credentials = await decryptCredentials(profile.credentials);
      await executeStep(step, credentials);

      run.lastActivity = Date.now();
      await setRun(run);

      // For pages that change without a reload (SPAs), look for the next step.
      setTimeout(() => evaluate(false), RECHECK_AFTER_STEP_MS);

      return { success: true, profile: profile.name, step: stepLabel };
    } catch (error) {
      log(error.message, 'error');
      return { success: false, error: error.message };
    } finally {
      busy = false;
    }
  }

  // ==========================================================================
  // Init
  // ==========================================================================

  function init() {
    let lastHref = location.href;
    setTimeout(() => evaluate(false), 500);

    // Detect SPA navigations (no page reload).
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        evaluate(false);
      }
    }, URL_POLL_MS);

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'performLogin') {
        evaluate(true).then(sendResponse);
        return true;
      }
      return false;
    });
  }

  init();
})();
