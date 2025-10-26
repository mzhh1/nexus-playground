/**
 * State Utilities
 * Encode/decode custom state for OAuth redirects
 */

/**
 * Encode state object to base64 string
 */
export function encodeState(stateObj: any): string {
  try {
    // Add nonce for uniqueness
    const payload = {
      ...stateObj,
      nonce: crypto.randomUUID?.() || String(Date.now()),
    };
    
    const json = JSON.stringify(payload);
    return btoa(encodeURIComponent(json));
  } catch (error) {
    console.error('Failed to encode state:', error);
    return '';
  }
}

/**
 * Decode state string to object
 */
export function decodeState(stateStr: string): any | null {
  try {
    const json = decodeURIComponent(atob(stateStr));
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to decode state:', error);
    return null;
  }
}

/**
 * Create return URL state
 */
export function createReturnState(returnTo?: string): string {
  return encodeState({
    returnTo: returnTo || window.location.href,
  });
}

/**
 * Parse return URL from state
 */
export function parseReturnUrl(stateStr: string): string {
  const state = decodeState(stateStr);
  return state?.returnTo || '/';
}

