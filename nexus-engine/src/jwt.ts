/**
 * JWT verification for Cloudflare Workers using Web Crypto API (HS256).
 * No external dependencies required.
 */

import { TokenPayload } from './types';

/**
 * Base64url decode (handles padding)
 */
function base64urlDecode(str: string): Uint8Array {
    // Replace URL-safe chars and add padding
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Import HS256 secret key for HMAC verification
 */
async function importKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );
}

/**
 * Verify an HS256 JWT and return the payload.
 * Throws on invalid signature or expired token.
 */
export async function verifyJwt(token: string, secret: string): Promise<TokenPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // 1. Verify header
    const headerJson = new TextDecoder().decode(base64urlDecode(headerB64));
    const header = JSON.parse(headerJson);
    if (header.alg !== 'HS256') {
        throw new Error(`Unsupported algorithm: ${header.alg}`);
    }

    // 2. Verify signature
    const key = await importKey(secret);
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = base64urlDecode(signatureB64);

    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) {
        throw new Error('Invalid JWT signature');
    }

    // 3. Decode payload
    const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as TokenPayload;

    // 4. Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
        throw new Error('JWT expired');
    }

    return payload;
}
