import { Env } from "../types";

/**
 * Unified client for interacting with game workers.
 * Directs traffic to Service Bindings if available, otherwise uses fetch.
 */
export interface GameWorkerClient {
    fetch(path: string, init?: RequestInit): Promise<Response>;
}

/**
 * Creates or resolves a GameWorkerClient for the given game.
 * 
 * Logic:
 * 1. Checks for a Service Binding named `GAME_<GAME_ID>` (case-insensitive).
 * 2. If binding exists, returns a client using that binding.
 * 3. Otherwise, returns a client using global `fetch` with the provided `baseUrl`.
 */
export function resolveGameWorkerClient(
    gameId: string,
    baseUrl: string,
    env: Env
): GameWorkerClient {
    const bindingName = `GAME_${gameId.toUpperCase()}`;
    const binding = env[bindingName];

    // Case 1: Service Binding exists
    if (binding && typeof binding.fetch === 'function') {
        console.log("Using service binding for game", gameId);
        return {
            async fetch(path: string, init?: RequestInit): Promise<Response> {
                // Ensure path starts with /
                const cleanPath = path.startsWith("/") ? path : `/${path}`;
                // Service Bindings can take a relative URL or a full URL (host is ignored)
                return binding.fetch(`http://internal${cleanPath}`, init);
            }
        };
    }
    console.log("Using global fetch for game", gameId);
    // Case 2: Use global fetch
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    return {
        async fetch(path: string, init?: RequestInit): Promise<Response> {
            const cleanPath = path.startsWith("/") ? path : `/${path}`;
            return fetch(`${normalizedBaseUrl}${cleanPath}`, init);
        }
    };
}
