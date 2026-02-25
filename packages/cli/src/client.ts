import { ADMIN_SECRET, DEFAULT_PORT, FIXED_ROOM_ID, FIXED_OWNER_ID } from "./constants.js";

export class EngineClient {
    private baseUrl: string;

    constructor(port: number = DEFAULT_PORT) {
        this.baseUrl = `http://localhost:${port}`;
    }

    private get headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ADMIN_SECRET}`,
        };
    }

    async createRoom(): Promise<any> {
        const res = await fetch(`${this.baseUrl}/api/engine/create`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
                roomId: FIXED_ROOM_ID,
                ownerId: FIXED_OWNER_ID,
            }),
        });
        return res.json();
    }

    async getState(): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/api/monitor/room/${FIXED_ROOM_ID}`,
            { headers: this.headers },
        );
        return res.json();
    }

    async getPerspective(roleId: string): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/api/monitor/room/${FIXED_ROOM_ID}/perspective?roleId=${encodeURIComponent(roleId)}`,
            { headers: this.headers },
        );
        return res.json();
    }

    async submitAction(
        roleId: string,
        action: { action_id: string; params?: Record<string, any> },
    ): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/api/monitor/room/${FIXED_ROOM_ID}/action`,
            {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({ roleId, action }),
            },
        );
        return res.json();
    }

    async setGame(gameWorkerUrl: string, gameId?: string, players?: number): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/api/monitor/room/${FIXED_ROOM_ID}/set-game`,
            {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({ gameWorkerUrl, gameId, selectedPlayerCount: players }),
            },
        );
        return res.json();
    }

    async startGame(): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/api/monitor/room/${FIXED_ROOM_ID}/start-game`,
            { method: "POST", headers: this.headers, body: "{}" },
        );
        return res.json();
    }

    async stopGame(): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/api/monitor/room/${FIXED_ROOM_ID}/stop-game`,
            { method: "POST", headers: this.headers, body: "{}" },
        );
        return res.json();
    }

    async restartGame(): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/api/monitor/room/${FIXED_ROOM_ID}/restart-game`,
            { method: "POST", headers: this.headers, body: "{}" },
        );
        return res.json();
    }
}
