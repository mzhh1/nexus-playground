import axios from 'axios';
import logger from '../utils/logger.js';

interface CreateRoomParams {
    roomId: string;
    gameWorkerUrl: string;
    config: any;
    context: any;
}

interface CreateRoomResponse {
    roomId: string;
    connectUrl: string;
}

export class NexusEngineClient {
    private engineUrl: string;
    private adminSecret: string;

    constructor() {
        this.engineUrl = process.env.NEXUS_ENGINE_URL || 'http://localhost:8787';
        this.adminSecret = process.env.NEXUS_ENGINE_ADMIN_SECRET || 'dev-secret-123';
    }

    /**
     * Create a new game container (DO) in Nexus Engine
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
     * Generate a JWT token for frontend to connect to Engine
     * (In production this should use jsonwebtoken with private key)
     */
    generateToken(_roomId: string, userId: string, role: string): string {
        // For M0/MVP, we use a simple format that our detailed engine implementation can parse
        // Format: userId:role
        // or actually construct a fake JWT structure if the engine expects it

        // In our Engine implementation `index.ts`:
        // if (token.includes(':')) { [userId, role] = token.split(':'); }

        // So we can just return this simple format for now.
        // In PROD: return jwt.sign({ roomId, userId, role }, privateKey);
        return `${userId}:${role}`;
    }
}

// Singleton instance
export const nexusEngine = new NexusEngineClient();
