import axios from 'axios';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

interface CreateRoomParams {
    roomId: string;
    ownerId: string;
    ownerDisplayName?: string;
    gameWorkerUrl?: string;
    config?: any;
    context?: any;
}

interface CreateRoomResponse {
    roomId: string;
    connectUrl: string;
}

export class NexusEngineClient {
    private engineUrl: string;
    private adminSecret: string;
    private jwtSecret: string;

    constructor() {
        this.engineUrl = process.env.NEXUS_ENGINE_URL || 'http://localhost:8787';
        this.adminSecret = process.env.NEXUS_ENGINE_ADMIN_SECRET || 'dev-secret-123';
        this.jwtSecret = process.env.NEXUS_ENGINE_JWT_SECRET || 'dev-jwt-secret-change-me';
    }

    /**
     * Create a new room container (DO) in Nexus Engine.
     * Called when a room is created (not just when a game starts).
     */
    async createRoom(params: CreateRoomParams): Promise<CreateRoomResponse> {
        try {
            logger.info({ params }, 'Creating room in Nexus Engine');

            const response = await axios.post(
                `${this.engineUrl}/api/engine/create`,
                params,
                {
                    headers: {
                        'Authorization': `Bearer ${this.adminSecret}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info({ data: response.data }, 'Room created successfully');
            return response.data;
        } catch (error: any) {
            logger.error({ error: error.message, response: error.response?.data }, 'Failed to create room in Nexus Engine');
            throw new Error(`Nexus Engine Error: ${error.message}`);
        }
    }

    /**
     * Generate a signed JWT for frontend WebSocket connection to Engine.
     * The JWT contains: sub (userId), roomId, name (displayName).
     * Ownership is determined by comparing sub with ownerId stored in the DO.
     */
    generateToken(roomId: string, userId: string, displayName: string): string {
        const payload = {
            sub: userId,
            roomId,
            name: displayName,
        };

        return jwt.sign(payload, this.jwtSecret, {
            algorithm: 'HS256',
            expiresIn: '5m', // Short-lived, only used for initial WS handshake
        });
    }

    /**
     * Get the WebSocket connection URL for a room
     */
    getConnectUrl(roomId: string): string {
        return this.engineUrl.replace('http', 'ws') + `/connect/${roomId}`;
    }
}

// Singleton instance
export const nexusEngine = new NexusEngineClient();
