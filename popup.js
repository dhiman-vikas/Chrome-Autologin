/**
 * Popup JavaScript
 * Handles popup UI interactions
 */

// Get DOM elements
const autoLoginStatus = document.getElementById('autoLoginStatus');
const profilesStatus = document.getElementById('profilesStatus');
const triggerLoginBtn = document.getElementById('triggerLoginBtn');
const toggleAutoLoginBtn = document.getElementById('toggleAutoLoginBtn');
const openOptionsBtn = document.getElementById('openOptionsBtn');
const message = document.getElementById('message');

/**
 * Show message in popup
 */
function showMessage(text, type = 'success') {
  message.textContent = text;
  message.className = `show ${type}`;
  
  setTimeout(() => {
    message.className = '';
  }, 3000);
}

/**
 * Update status display
 */
async function updateStatus() {
  try {
    const result = await chrome.storage.local.get([
      'gl_enabled',
      'gl_profiles'
    ]);
    
    // Update auto-login status
    const autoLoginEnabled = result.gl_enabled !== false;
    autoLoginStatus.textContent = autoLoginEnabled ? 'ON' : 'OFF';
    autoLoginStatus.className = `badge ${autoLoginEnabled ? 'on' : 'off'}`;
    
    // Update profiles status
    const enabledProfiles = (result.gl_profiles || []).filter(p => p.enabled !== false).length;
    profilesStatus.textContent = enabledProfiles > 0 ? `${enabledProfiles} active` : 'None';
    profilesStatus.className = `badge ${enabledProfiles > 0 ? 'yes' : 'no'}`;
    
    // Update toggle button text
    toggleAutoLoginBtn.textContent = autoLoginEnabled 
      ? '⏸️ Disable Auto-Login' 
      : '▶️ Enable Auto-Login';
      
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

/**
 * Trigger login on current tab
 */
async function triggerLogin() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showMessage('No active tab found', 'error');
      return;
    }
    
    // Ask the content script to run the step matching the current page
    chrome.tabs.sendMessage(tab.id, { action: 'performLogin' }, (response) => {
      if (chrome.runtime.lastError) {
        showMessage('Cannot run on this page. Try reloading the tab.', 'error');
      } else if (response && response.success) {
        showMessage(`Ran step: ${response.step}`, 'success');
      } else {
        showMessage((response && response.error) || 'Login trigger failed', 'error');
      }
    });
    
  } catch (error) {
    console.error('Error triggering login:', error);
    showMessage('Error: ' + error.message, 'error');
  }
}

/**
 * Toggle auto-login on/off
 */
async function toggleAutoLogin() {
  try {
    const result = await chrome.storage.local.get(['gl_enabled']);
    const currentValue = result.gl_enabled !== false;
    const newValue = !currentValue;
    
    await chrome.storage.local.set({ gl_enabled: newValue });
    
    showMessage(
      newValue ? 'Auto-login enabled' : 'Auto-login disabled',
      'success'
    );
    
    await updateStatus();
    
  } catch (error) {
    console.error('Error toggling auto-login:', error);
    showMessage('Error: ' + error.message, 'error');
  }
}

/**
 * Open options page
 */
function openOptions() {
  chrome.runtime.openOptionsPage();
}

// Event listeners
triggerLoginBtn.addEventListener('click', triggerLogin);
toggleAutoLoginBtn.addEventListener('click', toggleAutoLogin);
openOptionsBtn.addEventListener('click', openOptions);

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    updateStatus();
  }
});

// Initial status update
updateStatus();
