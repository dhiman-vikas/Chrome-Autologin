/**
 * Options Page
 * Manage login profiles (steps + credentials).
 */

import { generateTOTP } from './utils/totp.js';
import {
  emptyCredentials,
  loadProfiles,
  saveProfiles,
  getEnabled,
  setEnabled,
  clearAll
} from './utils/storage.js';

const ACTIONS = [
  { value: 'username', label: 'Fill username' },
  { value: 'password', label: 'Fill password' },
  { value: 'userpass', label: 'Fill username + password (same page)' },
  { value: 'totp', label: 'Fill authenticator (TOTP) code' },
  { value: 'click', label: 'Click an element only' }
];

const MATCH_TYPES = [
  { value: 'wildcard', label: 'Wildcard (*)' },
  { value: 'regex', label: 'Regular expression' }
];

const REQUIRED_CREDENTIALS = {
  username: ['username'],
  password: ['password'],
  userpass: ['username', 'password'],
  totp: ['totpSecret']
};

const CREDENTIAL_LABELS = {
  username: 'username',
  password: 'password',
  totpSecret: 'TOTP secret'
};

const autoLoginCheckbox = document.getElementById('autoLoginEnabled');
const profilesContainer = document.getElementById('profiles');
const noProfilesMessage = document.getElementById('noProfiles');
const addProfileButton = document.getElementById('addProfileButton');
const saveButton = document.getElementById('saveButton');
const clearButton = document.getElementById('clearButton');
const statusMessage = document.getElementById('statusMessage');

/** @type {{profiles: Object[]}} */
const state = { profiles: [] };

let statusTimer;

// ============================================================================
// Model helpers
// ============================================================================

function createStep(action = 'username') {
  return {
    id: crypto.randomUUID(),
    name: '',
    action,
    urlPattern: '',
    matchType: 'wildcard',
    selector: '',
    passwordSelector: '',
    submitSelector: '',
    submit: true,
    delayMs: 0
  };
}

function createProfile() {
  return {
    id: crypto.randomUUID(),
    name: 'New login',
    enabled: true,
    autoStart: true,
    credentials: emptyCredentials(),
    steps: [createStep('username'), createStep('password'), createStep('totp')],
    _open: true
  };
}

// ============================================================================
// DOM helpers
// ============================================================================

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

function field(label, input, hint) {
  return el('div', { class: 'form-group' },
    el('label', {}, label, input),
    hint ? el('small', { text: hint }) : null
  );
}

function textField(label, value, onChange, { type = 'text', placeholder = '', hint = '', autocomplete = 'off' } = {}) {
  const input = el('input', {
    type,
    value,
    placeholder,
    autocomplete,
    oninput: (event) => onChange(event.target.value)
  });
  return field(label, input, hint);
}

function selectField(label, options, value, onChange) {
  const select = el('select', { onchange: (event) => onChange(event.target.value) },
    ...options.map((option) => el('option', { value: option.value, text: option.label }))
  );
  select.value = value;
  return field(label, select);
}

function checkboxField(label, checked, onChange, hint) {
  const input = el('input', { type: 'checkbox', checked, onchange: (event) => onChange(event.target.checked) });
  return el('div', { class: 'form-group checkbox-group' },
    el('label', { class: 'checkbox-label' }, input, el('span', { text: label })),
    hint ? el('small', { text: hint }) : null
  );
}

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusMessage.style.display = 'none'; }, 6000);
}

// ============================================================================
// Rendering
// ============================================================================

function render() {
  profilesContainer.replaceChildren(...state.profiles.map(renderProfile));
  noProfilesMessage.hidden = state.profiles.length > 0;
}

function renderProfile(profile, profileIndex) {
  const title = el('span', { class: 'profile-title', text: profile.name || 'Untitled' });
  const details = el('details', {
    class: 'profile',
    open: !!profile._open,
    ontoggle: () => { profile._open = details.open; }
  });

  details.append(
    el('summary', {}, title, el('span', {
      class: 'profile-meta',
      text: `${profile.steps.length} step${profile.steps.length === 1 ? '' : 's'}${profile.enabled ? '' : ' - disabled'}`
    })),
    el('div', { class: 'profile-body' },
      textField('Profile name', profile.name, (value) => {
        profile.name = value;
        title.textContent = value || 'Untitled';
      }, { placeholder: 'e.g. Company portal' }),
      el('div', { class: 'inline-fields' },
        checkboxField('Profile enabled', profile.enabled, (value) => { profile.enabled = value; }),
        checkboxField('Start automatically on step 1 URL', profile.autoStart !== false, (value) => { profile.autoStart = value; })
      ),
      renderCredentials(profile),
      el('h3', { text: 'Login sequence' }),
      ...profile.steps.map((step, stepIndex) => renderStep(profile, step, stepIndex)),
      el('div', { class: 'actions' },
        el('button', {
          class: 'btn btn-secondary',
          type: 'button',
          text: 'Add Step',
          onclick: () => { profile.steps.push(createStep('username')); render(); }
        }),
        el('button', {
          class: 'btn btn-danger',
          type: 'button',
          text: 'Delete Profile',
          onclick: () => {
            if (confirm(`Delete profile "${profile.name || 'Untitled'}"?`)) {
              state.profiles.splice(profileIndex, 1);
              render();
            }
          }
        })
      )
    )
  );

  return details;
}

function renderCredentials(profile) {
  const credentials = profile.credentials;
  const result = el('div', { class: 'totp-result' });

  const secretInput = textField('TOTP secret key (optional)', credentials.totpSecret, (value) => {
    credentials.totpSecret = value;
    result.style.display = 'none';
  }, { placeholder: 'ABCD EFGH IJKL MNOP', hint: 'Base32 key for authenticator-based login. Leave empty if not used.' });

  const testButton = el('button', {
    class: 'btn btn-secondary',
    type: 'button',
    text: 'Test TOTP Generator',
    onclick: async () => {
      result.replaceChildren();
      result.style.display = 'block';
      try {
        const secret = credentials.totpSecret.replace(/\s/g, '');
        if (!secret) throw new Error('Enter a TOTP secret first');
        const code = await generateTOTP(secret);
        result.className = 'totp-result totp-success';
        result.append(
          el('p', { text: 'Current code (valid for up to 30 seconds):' }),
          el('strong', { class: 'totp-code', text: code })
        );
      } catch (error) {
        result.className = 'totp-result totp-error';
        result.append(el('p', { text: `TOTP generation failed: ${error.message}` }));
      }
    }
  });

  return el('div', { class: 'subsection' },
    el('h3', { text: 'Credentials' }),
    textField('Username / email', credentials.username, (value) => { credentials.username = value; },
      { placeholder: 'user@example.com', autocomplete: 'off' }),
    textField('Password', credentials.password, (value) => { credentials.password = value; },
      { type: 'password', autocomplete: 'new-password' }),
    secretInput,
    testButton,
    result
  );
}

function renderStep(profile, step, index) {
  const isFirst = index === 0;
  const isClick = step.action === 'click';
  const isUserPass = step.action === 'userpass';

  const move = (offset) => {
    const target = index + offset;
    if (target < 0 || target >= profile.steps.length) return;
    [profile.steps[index], profile.steps[target]] = [profile.steps[target], profile.steps[index]];
    render();
  };

  const advanced = el('details', { class: 'advanced' },
    el('summary', { text: 'Advanced (selectors, submit, delay)' }),
    textField(
      isClick ? 'Element to click (CSS selector, required)' : isUserPass ? 'Username field selector' : 'Input field selector',
      step.selector,
      (value) => { step.selector = value; },
      { placeholder: isClick ? 'button#continue' : 'Auto-detected if empty' }
    ),
    isUserPass
      ? textField('Password field selector', step.passwordSelector, (value) => { step.passwordSelector = value; },
        { placeholder: 'Auto-detected if empty' })
      : null,
    isClick ? null : textField('Submit button selector', step.submitSelector, (value) => { step.submitSelector = value; },
      { placeholder: 'Auto-detected if empty (button[type="submit"])' }),
    isClick ? null : checkboxField('Submit after filling', step.submit !== false, (value) => { step.submit = value; }),
    textField('Delay before running (ms)', String(step.delayMs || 0), (value) => { step.delayMs = Math.max(0, Number(value) || 0); },
      { type: 'number' })
  );

  return el('div', { class: 'step' },
    el('div', { class: 'step-header' },
      el('strong', { text: `Step ${index + 1}${isFirst ? ' (entry page)' : ''}` }),
      el('span', { class: 'step-buttons' },
        el('button', { class: 'icon-btn', type: 'button', title: 'Move up', text: '\u2191', disabled: isFirst, onclick: () => move(-1) }),
        el('button', { class: 'icon-btn', type: 'button', title: 'Move down', text: '\u2193', disabled: index === profile.steps.length - 1, onclick: () => move(1) }),
        el('button', {
          class: 'icon-btn',
          type: 'button',
          title: 'Remove step',
          text: '\u2715',
          onclick: () => { profile.steps.splice(index, 1); render(); }
        })
      )
    ),
    textField('Step name (optional)', step.name, (value) => { step.name = value; }, { placeholder: 'e.g. Enter password' }),
    selectField('Action', ACTIONS, step.action, (value) => { step.action = value; render(); }),
    el('div', { class: 'inline-fields' },
      selectField('URL match type', MATCH_TYPES, step.matchType, (value) => { step.matchType = value; }),
      textField('Page URL pattern', step.urlPattern, (value) => { step.urlPattern = value; },
        { placeholder: 'https://example.com/login', hint: isFirst ? 'Opening a URL that matches this starts the login.' : 'The step runs when the browser is on a matching URL.' })
    ),
    advanced
  );
}

// ============================================================================
// Validation and persistence
// ============================================================================

function validate() {
  for (const profile of state.profiles) {
    const label = `Profile "${profile.name.trim() || 'Untitled'}"`;
    if (!profile.name.trim()) return 'Every profile needs a name';
    if (profile.steps.length === 0) return `${label}: add at least one step`;

    const secret = profile.credentials.totpSecret.replace(/\s/g, '');
    if (secret && !/^[A-Z2-7]+=*$/i.test(secret)) {
      return `${label}: TOTP secret must be Base32 (letters A-Z and digits 2-7)`;
    }

    for (const [index, step] of profile.steps.entries()) {
      const stepLabel = `${label}, step ${index + 1}`;
      if (!step.urlPattern.trim()) return `${stepLabel}: page URL pattern is required`;

      if (step.matchType === 'regex') {
        try {
          new RegExp(step.urlPattern);
        } catch {
          return `${stepLabel}: invalid regular expression`;
        }
      }

      if (step.action === 'click' && !step.selector.trim()) {
        return `${stepLabel}: a CSS selector is required for click steps`;
      }

      for (const credential of REQUIRED_CREDENTIALS[step.action] || []) {
        const value = profile.credentials[credential];
        if (!value || !value.trim()) return `${stepLabel}: missing ${CREDENTIAL_LABELS[credential]}`;
      }
    }
  }
  return null;
}

function toStoredProfile(profile) {
  return {
    id: profile.id,
    name: profile.name.trim(),
    enabled: profile.enabled,
    autoStart: profile.autoStart !== false,
    credentials: {
      username: profile.credentials.username.trim(),
      password: profile.credentials.password,
      totpSecret: profile.credentials.totpSecret.replace(/\s/g, '')
    },
    steps: profile.steps.map((step) => ({
      id: step.id,
      name: step.name.trim(),
      action: step.action,
      urlPattern: step.urlPattern.trim(),
      matchType: step.matchType,
      selector: step.selector.trim(),
      passwordSelector: step.passwordSelector.trim(),
      submitSelector: step.submitSelector.trim(),
      submit: step.submit !== false,
      delayMs: Number(step.delayMs) || 0
    }))
  };
}

async function saveSettings() {
  const error = validate();
  if (error) {
    showStatus(error, 'error');
    return;
  }

  try {
    await saveProfiles(state.profiles.map(toStoredProfile));
    await setEnabled(autoLoginCheckbox.checked);
    showStatus('Settings saved', 'success');
  } catch (err) {
    console.error('Error saving settings:', err);
    showStatus(`Error saving settings: ${err.message}`, 'error');
  }
}

async function clearAllData() {
  if (!confirm('Clear all profiles and credentials? This cannot be undone.')) return;

  try {
    await clearAll();
    state.profiles = [];
    autoLoginCheckbox.checked = true;
    render();
    showStatus('All data cleared', 'success');
  } catch (err) {
    console.error('Error clearing data:', err);
    showStatus(`Error clearing data: ${err.message}`, 'error');
  }
}

async function loadSavedData() {
  try {
    const profiles = await loadProfiles();
    state.profiles = profiles.map((profile) => ({
      ...profile,
      steps: profile.steps.map((step) => ({ ...createStep(step.action), ...step })),
      _open: profiles.length === 1
    }));
    autoLoginCheckbox.checked = await getEnabled();
    render();
  } catch (err) {
    console.error('Error loading settings:', err);
    showStatus('Error loading saved settings', 'error');
  }
}

addProfileButton.addEventListener('click', () => {
  state.profiles.push(createProfile());
  render();
});
saveButton.addEventListener('click', saveSettings);
clearButton.addEventListener('click', clearAllData);
document.addEventListener('DOMContentLoaded', loadSavedData);
