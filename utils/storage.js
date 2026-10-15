/**
 * Storage helpers (options page / popup / background).
 *
 * Data model (chrome.storage.local):
 *   gl_enabled        boolean - global on/off switch
 *   gl_encryption_key number[] - raw AES-GCM key used to encrypt credentials
 *   gl_profiles       Profile[]
 *
 * Profile {
 *   id, name, enabled, autoStart,
 *   credentials: { encrypted, iv }   // decrypted form: { username, password, totpSecret }
 *   steps: Step[]                    // ordered; step 0 is the entry (login page) step
 * }
 *
 * Step {
 *   id, name,
 *   action: 'username' | 'password' | 'userpass' | 'totp' | 'click',
 *   urlPattern, matchType: 'wildcard' | 'regex',
 *   selector, passwordSelector, submitSelector,   // optional CSS selectors
 *   submit: boolean, delayMs: number
 * }
 */

export const STORAGE_KEYS = {
  PROFILES: 'gl_profiles',
  ENCRYPTION_KEY: 'gl_encryption_key',
  ENABLED: 'gl_enabled'
};

export function emptyCredentials() {
  return { username: '', password: '', totpSecret: '' };
}

/**
 * Get the AES-GCM key, creating and persisting one on first use.
 */
async function getEncryptionKey() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ENCRYPTION_KEY);
  let raw = result[STORAGE_KEYS.ENCRYPTION_KEY];

  if (!raw) {
    raw = Array.from(crypto.getRandomValues(new Uint8Array(32)));
    await chrome.storage.local.set({ [STORAGE_KEYS.ENCRYPTION_KEY]: raw });
  }

  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(raw),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptJson(value, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    encrypted: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv)
  };
}

async function decryptJson(blob, key) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(blob.iv) },
    key,
    new Uint8Array(blob.encrypted)
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * Load all profiles with credentials decrypted (for the options page).
 * @returns {Promise<Object[]>}
 */
export async function loadProfiles() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILES);
  const stored = result[STORAGE_KEYS.PROFILES] || [];
  if (stored.length === 0) return [];

  const key = await getEncryptionKey();
  return Promise.all(stored.map(async (profile) => {
    let credentials = emptyCredentials();
    if (profile.credentials) {
      try {
        credentials = { ...credentials, ...(await decryptJson(profile.credentials, key)) };
      } catch (error) {
        console.error('Error decrypting credentials for profile', profile.id, error);
      }
    }
    return { ...profile, credentials };
  }));
}

/**
 * Save profiles, encrypting each profile's credentials.
 * @param {Object[]} profiles - profiles with plain-text credentials
 */
export async function saveProfiles(profiles) {
  const key = await getEncryptionKey();
  const stored = await Promise.all(profiles.map(async (profile) => ({
    ...profile,
    credentials: await encryptJson(profile.credentials, key)
  })));
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: stored });
}

export async function getEnabled() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ENABLED);
  return result[STORAGE_KEYS.ENABLED] !== false;
}

export function setEnabled(enabled) {
  return chrome.storage.local.set({ [STORAGE_KEYS.ENABLED]: enabled });
}

export function clearAll() {
  return chrome.storage.local.clear();
}
