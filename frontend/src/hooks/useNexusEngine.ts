/**
 * useNexusEngine Hook
 *
 * Manages the WebSocket connection to the Nexus Engine for both
 * lobby state and game state. This is the single connection used
 * throughout the entire room lifecycle.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useGameAPI } from '../lib/api-client';

// Lobby state from the Engine DO
export interface LobbyPlayer {
    displayName: string;
    role: string | null;
    connected: boolean;
    isOwner: boolean;
    isBot?: boolean;
}

export interface LobbyState {
    roomId: string;
    ownerId: string;
    gameId: string | null;
    phase: 'lobby' | 'playing' | 'finished';
    players: Record<string, LobbyPlayer>;
    roleMapping: Record<string, string>;
    hasGameConfig: boolean;
    you: {
        userId: string;
        isOwner: boolean;
        role: string | null;
    };
}

interface UseNexusEngineProps {
    roomId: string | null;
}

export function useNexusEngine({ roomId }: UseNexusEngineProps) {
    const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
    const [gameState, setGameState] = useState<any>(null); // Game perspective
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const gameApi = useGameAPI();

    // Connect to Engine
    useEffect(() => {
        if (!roomId) return;

        let cancelled = false;

        const connectToEngine = async () => {
            try {
                // Get Connection Info (URL + Token) from Backend
                const connectionInfo = await gameApi.getEngineConnection(roomId);
                if (cancelled) return;

                const { url, token } = connectionInfo;

                // Build WebSocket URL with token
                const wsUrl = new URL(url);
                wsUrl.searchParams.set('token', token);

                const ws = new WebSocket(wsUrl.toString());

                ws.onopen = () => {
                    console.log("[NexusEngine] Connected");
                    setIsConnected(true);
                    setError(null);
                };

                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        switch (msg.type) {
                            case 'LOBBY_STATE':
                            case 'LOBBY_UPDATE':
                                setLobbyState(msg.payload);
                                break;
                            case 'STATE_UPDATE':
                                setGameState(msg.payload);
                                break;
                            case 'GAME_STARTED':
                            case 'GAME_RESTARTED':
                                // Game phase transition — lobby update will follow
                                console.log(`[NexusEngine] ${msg.type}`, msg.payload);
                                break;
                            case 'GAME_STOPPED':
                                setGameState(null);
                                console.log("[NexusEngine] Game stopped");
                                break;
                            case 'KICKED':
                                setError("You were removed by the room owner");
                                ws.close();
                                break;
                            case 'ERROR':
                                console.error("[NexusEngine] Error:", msg.payload);
                                setError(msg.payload);
                                break;
                            default:
                                console.log("[NexusEngine] Unknown message:", msg);
                        }
                    } catch (e) {
                        console.error("[NexusEngine] Failed to parse message", e);
                    }
                };

                ws.onclose = (event) => {
                    console.log("[NexusEngine] Disconnected", event.code, event.reason);
                    setIsConnected(false);

                    // Auto-reconnect after 3 seconds (unless cancelled or kicked)
                    if (!cancelled && event.code !== 1000) {
                        reconnectTimerRef.current = setTimeout(() => {
                            console.log("[NexusEngine] Attempting reconnect...");
                            connectToEngine();
                        }, 3000);
                    }
                };

                ws.onerror = (event) => {
                    console.error("[NexusEngine] WebSocket error", event);
                };

                wsRef.current = ws;
            } catch (e: any) {
                console.error("[NexusEngine] Connection failed", e);
                if (!cancelled) {
                    setError(e.message || "Connection failed");
                    // Retry after 5 seconds
                    reconnectTimerRef.current = setTimeout(connectToEngine, 5000);
                }
            }
        };

        connectToEngine();

        return () => {
            cancelled = true;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [roomId]);

    // --- Lobby Actions ---

    const selectRole = useCallback((roleId: string | null) => {
        wsRef.current?.send(JSON.stringify({
            type: 'LOBBY_SELECT_ROLE',
            payload: { roleId },
        }));
    }, []);

    const leaveRoom = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: 'LOBBY_LEAVE' }));
    }, []);

    const kickPlayer = useCallback((userId: string) => {
        wsRef.current?.send(JSON.stringify({
            type: 'LOBBY_KICK_PLAYER',
            payload: { userId },
        }));
    }, []);

    const setGame = useCallback((gameId: string, gameWorkerUrl: string, config?: any) => {
        wsRef.current?.send(JSON.stringify({
            type: 'LOBBY_SET_GAME',
            payload: { gameId, gameWorkerUrl, config },
        }));
    }, []);

    const addBot = useCallback((botId: string, displayName: string, config?: any) => {
        wsRef.current?.send(JSON.stringify({
            type: 'LOBBY_ADD_BOT',
            payload: { botId, displayName, config },
        }));
    }, []);

    const startGame = useCallback((gameWorkerUrl: string, roleMapping: Record<string, string>) => {
        wsRef.current?.send(JSON.stringify({
            type: 'GAME_START',
            payload: { gameWorkerUrl, roleMapping },
        }));
    }, []);

    const stopGame = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: 'GAME_STOP' }));
    }, []);

    const restartGame = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: 'GAME_RESTART' }));
    }, []);

    // --- Game Actions ---

    const sendAction = useCallback((action: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'ACT',
                payload: action
            }));
        } else {
            console.error("[NexusEngine] WebSocket not connected, cannot send action");
        }
    }, []);

    return {
        // Connection
        isConnected,
        error,

        // Lobby
        lobbyState,
        selectRole,
        leaveRoom,
        kickPlayer,
        setGame,
        addBot,

        // Game lifecycle
        startGame,
        stopGame,
        restartGame,

        // Game state
        gameState,
        sendAction,
    };
}
