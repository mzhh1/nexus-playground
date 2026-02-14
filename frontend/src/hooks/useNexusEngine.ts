import { useEffect, useState, useRef, useCallback } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import { useGameAPI } from '../lib/api-client';

interface EngineConfig {
    connectUrl: string;
    engineRoomId: string;
}

interface UseNexusEngineProps {
    roomId: string | null;
    engineConfig: EngineConfig | null;
}

export function useNexusEngine({ roomId, engineConfig }: UseNexusEngineProps) {
    const [lastMessage, setLastMessage] = useState<any>(null); // Last received game state/perspective
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const { user } = useOAuth();
    const gameApi = useGameAPI();

    // Connect to Engine
    useEffect(() => {
        if (!roomId) return;

        // Fetch connection details if not provided (or re-fetch to get token)
        // Actually, backend should provide the token via an API call because it needs signing
        const connectToEngine = async () => {
            try {
                // Get Connection Info (URL + Token) from Backend
                let connectionInfo;
                try {
                    connectionInfo = await gameApi.getEngineConnection(roomId);
                } catch (e) {
                    console.warn("Nexus Engine connection info not available yet or request failed", e);
                    return;
                }

                const { url, token: engineToken } = connectionInfo;

                // Connect WebSocket
                const wsUrl = new URL(url);
                wsUrl.searchParams.set('token', engineToken);

                const ws = new WebSocket(wsUrl.toString());

                ws.onopen = () => {
                    console.log("Connected to Nexus Engine");
                    setIsConnected(true);
                    setError(null);
                };

                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === 'STATE_UPDATE') {
                            setLastMessage(msg.payload);
                        } else if (msg.type === 'ERROR') {
                            console.error("Engine Error:", msg.payload);
                        }
                    } catch (e) {
                        console.error("Failed to parse engine message", e);
                    }
                };

                ws.onclose = () => {
                    console.log("Disconnected from Nexus Engine");
                    setIsConnected(false);
                };

                wsRef.current = ws;

            } catch (e) {
                console.error("Failed to connect to Nexus Engine", e);
                setError("Connection failed");
            }
        };

        // Trigger connection if we are in playing state
        // We can check this via a separate prop or just try connecting
        connectToEngine();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [roomId, user]);

    // Send Action
    const sendAction = useCallback((action: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'ACT',
                payload: action
            }));
        } else {
            console.error("WebSocket not connected");
        }
    }, []);

    return {
        gameState: lastMessage,
        isConnected,
        sendAction,
        error
    };
}
