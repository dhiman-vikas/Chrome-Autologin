/**
 * TOTP Generator Utility
 * Generates Time-based One-Time Passwords compatible with RFC 6238
 * Ported from C# Playwright tests
 */

/**
 * Base32 decode function
 * @param {string} base32 - Base32 encoded string
 * @returns {Uint8Array} - Decoded bytes
 */
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.replace(/\s/g, '').replace(/=+$/, '').toUpperCase();
  
  const bytes = [];
  let bitBuffer = 0;
  let bitsInBuffer = 0;
  
  for (const char of clean) {
    const val = alphabet.indexOf(char);
    if (val < 0) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    
    bitBuffer = (bitBuffer << 5) | val;
    bitsInBuffer += 5;
    
    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      bytes.push((bitBuffer >> bitsInBuffer) & 0xFF);
      bitBuffer &= (1 << bitsInBuffer) - 1;
    }
  }
  
  return new Uint8Array(bytes);
}

/**
 * Generate TOTP code
 * @param {string} base32Secret - Base32 encoded secret key
 * @param {number} timeStep - Time step in seconds (default: 30)
 * @param {number} digits - Number of digits in the code (default: 6)
 * @returns {Promise<string>} - 6-digit TOTP code
 */
async function generateTOTP(base32Secret, timeStep = 30, digits = 6) {
  try {
    // Decode the base32 secret
    const secretBytes = base32Decode(base32Secret);
    
    // Calculate time step (Unix timestamp / 30 seconds)
    const epoch = Math.floor(Date.now() / 1000);
    const time = Math.floor(epoch / timeStep);
    
    // Convert time to 8-byte array (big-endian)
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setUint32(4, time, false); // big-endian
    
    // Import the key for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    // Compute HMAC-SHA1
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      timeBuffer
    );
    
    const hash = new Uint8Array(signature);
    
    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0f;
    const binary = 
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);
    
    // Generate code
    const otp = binary % Math.pow(10, digits);
    
    // Zero-pad to specified digits
    return otp.toString().padStart(digits, '0');
  } catch (error) {
    console.error('Error generating TOTP:', error);
    throw error;
  }
}

/**
 * Validate a TOTP code against expected value
 * @param {string} code - Code to validate
 * @param {string} base32Secret - Base32 encoded secret key
 * @param {number} window - Time window to check (default: 1, checks ±1 time step)
 * @returns {Promise<boolean>} - True if valid
 */
async function validateTOTP(code, base32Secret, window = 1) {
  const timeStep = 30;
  const currentTime = Math.floor(Date.now() / 1000 / timeStep);
  
  for (let i = -window; i <= window; i++) {
    const testTime = currentTime + i;
    const testCode = await generateTOTP(base32Secret, timeStep);
    if (testCode === code) {
      return true;
    }
  }
  
  return false;
}

// Export for use in other modules
export { generateTOTP, validateTOTP, base32Decode };
