/**
 * useNexusEngine Hook — v4.0 Heavy Engine
 *
 * THE single hook for all room interactions. Manages WebSocket
 * connection to Engine DO, receives SYNC_STATE updates, and
 * exposes Admin + Lobby + Game action methods.
 *
 * Replaces: useRoom (partially), usePerspective (entirely)
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useGameAPI } from '../lib/api-client';
import { Player } from '../lib/types';

// ─── Types matching Engine's ClientEngineState ───────────────

export interface ClientPlayerInfo extends Player {
    isOwner: boolean;
    role: string | null;
    connected: boolean;
}

export interface ClientEngineState {
    roomId: string;
    phase: 'lobby' | 'playing' | 'finished';
    players: Record<string, ClientPlayerInfo>;
    gameConfig: {
        gameId: string;
        maxPlayers: number;
        roleIds: string[];
    } | null;
    you: {
        userId: string;
        isOwner: boolean;
        role: string | null;
    };
}

// ─── Hook ────────────────────────────────────────────────────

interface UseNexusEngineProps {
    roomId: string | null;
}

export function useNexusEngine({ roomId }: UseNexusEngineProps) {
    const [engineState, setEngineState] = useState<ClientEngineState | null>(null);
    const [gameState, setGameState] = useState<any>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const gameApi = useGameAPI();

    // ─── Connect to Engine ────────────────────────────────

    useEffect(() => {
        if (!roomId) return;

        let cancelled = false;

        const connectToEngine = async () => {
            try {
                const connectionInfo = await gameApi.getEngineConnection(roomId);
                if (cancelled) return;

                const { url, token } = connectionInfo;
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
                            case 'SYNC_STATE':
                                setEngineState(msg.payload.engine);
                                setGameState(msg.payload.game);
                                break;
                            case 'KICKED':
                                setError(msg.payload || "You were removed by the room owner");
                                ws.close();
                                break;
                            case 'ERROR':
                                console.error("[NexusEngine] Error:", msg.payload);
                                setError(msg.payload);
                                // Clear error after 5s for transient errors
                                setTimeout(() => setError(null), 5000);
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

    // ─── Helper: send WS message ─────────────────────────

    const send = useCallback((type: string, payload?: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload !== undefined ? { type, payload } : { type }));
        } else {
            console.error("[NexusEngine] WebSocket not connected");
        }
    }, []);

    // ─── Lobby Actions ───────────────────────────────────

    const selectRole = useCallback((roleId: string | null) => {
        send('LOBBY_SELECT_ROLE', { roleId });
    }, [send]);

    const leaveRoom = useCallback(() => {
        send('LOBBY_LEAVE');
    }, [send]);

    // ─── Admin Actions (owner only) ──────────────────────

    const setGame = useCallback((gameId: string, gameWorkerUrl: string) => {
        send('ADMIN_SET_GAME', { gameId, gameWorkerUrl });
    }, [send]);

    const addBot = useCallback((config: {
        display_name: string;
        model_name: string;
        system_prompt?: string;
        temperature?: number;
    }) => {
        // Map to Engine's expected camelCase if necessary, 
        // but the Engine DO currently expects exactly what it gets.
        // Let's keep it consistent with the protocol defined in game-do.ts
        send('ADMIN_ADD_BOT', {
            displayName: config.display_name,
            modelName: config.model_name,
            systemPrompt: config.system_prompt,
            temperature: config.temperature
        });
    }, [send]);

    const removePlayer = useCallback((userId: string) => {
        send('ADMIN_REMOVE_PLAYER', { userId });
    }, [send]);

    const assignRole = useCallback((roleId: string, userId: string) => {
        send('ADMIN_ASSIGN_ROLE', { roleId, userId });
    }, [send]);

    const startGame = useCallback(() => {
        send('ADMIN_START_GAME');
    }, [send]);

    const stopGame = useCallback(() => {
        send('ADMIN_STOP_GAME');
    }, [send]);

    const restartGame = useCallback(() => {
        send('ADMIN_RESTART_GAME');
    }, [send]);

    const pauseGame = useCallback(() => {
        send('ADMIN_PAUSE_GAME');
    }, [send]);

    const resumeGame = useCallback(() => {
        send('ADMIN_RESUME_GAME');
    }, [send]);

    // ─── Game Actions ────────────────────────────────────

    const sendAction = useCallback((actionId: string, params?: Record<string, any>) => {
        send('ACT', { actionId, params });
    }, [send]);

    // ─── Return ──────────────────────────────────────────

    return {
        // Connection
        isConnected,
        error,

        // Unified state (from SYNC_STATE)
        engineState,
        gameState,

        // Convenience derived state
        phase: engineState?.phase ?? null,
        isOwner: engineState?.you.isOwner ?? false,
        myRole: engineState?.you.role ?? null,
        myUserId: engineState?.you.userId ?? null,

        // Lobby actions
        selectRole,
        leaveRoom,

        // Admin actions (owner only)
        setGame,
        addBot,
        removePlayer,
        assignRole,
        startGame,
        stopGame,
        restartGame,
        pauseGame,
        resumeGame,

        // Game actions
        sendAction,
    };
}
