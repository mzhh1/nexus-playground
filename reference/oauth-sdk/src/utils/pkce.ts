// PKCE (S256 only) helpers

const VERIFIER_STORAGE_PREFIX = 'autolab_pkce_verifier_';

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function getCrypto(): any {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto) return (globalThis as any).crypto;
  } catch (_e) {}
  return undefined;
}

function randomBytes(length: number): Uint8Array {
  const cryptoObj = getCrypto();
  const arr = new Uint8Array(length);
  if (cryptoObj && cryptoObj.getRandomValues) {
    cryptoObj.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return arr;
}

export function generateCodeVerifier(length: number = 64): string {
  // RFC7636: length 43..128, charset = ALPHA / DIGIT / "-" / "." / "_" / "~"
  const size = Math.min(128, Math.max(43, length));
  const bytes = randomBytes(size);
  let verifier = '';
  for (let i = 0; i < bytes.length; i++) {
    verifier += UNRESERVED[bytes[i] % UNRESERVED.length];
  }
  return verifier;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function computeS256CodeChallenge(verifier: string): Promise<string> {
  const cryptoObj = getCrypto();
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto not available: S256 is required');
  }
  const data = new TextEncoder().encode(verifier);
  const digest = await cryptoObj.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

export function persistVerifier(stateKey: string, verifier: string): void {
  try {
    sessionStorage.setItem(VERIFIER_STORAGE_PREFIX + stateKey, verifier);
  } catch (_e) {}
}

export function consumeVerifier(stateKey: string): string | null {
  const key = VERIFIER_STORAGE_PREFIX + stateKey;
  try {
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value;
  } catch (_e) {
    return null;
  }
}

export function generateState(length: number = 24): string {
  const bytes = randomBytes(length);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

