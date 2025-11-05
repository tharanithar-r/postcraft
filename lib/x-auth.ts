import crypto from 'crypto';

export function generatePKCE() {
  // Generate a random 32-byte code verifier
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  
  // Create SHA256 hash of the verifier for the challenge
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return {
    codeVerifier,
    codeChallenge,
  };
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}
