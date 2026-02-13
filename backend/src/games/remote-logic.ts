import {
    GameLogic,
    GameMetadata,
    GameState,
    InitContext,
    ActionSpec,
    Action,
    ActionResult,
    RolePerspective,
    HistoryEvent,
} from '@nexus/game-sdk';
import axios from 'axios';
import logger from '../utils/logger.js';

export class RemoteGameLogic implements GameLogic {
    private workerUrl: string;
    private gameId: string;

    constructor(gameId: string, workerUrl: string) {
        this.gameId = gameId;
        this.workerUrl = workerUrl.replace(/\/$/, ''); // Remove trailing slash
    }

    async getMetadata(): Promise<GameMetadata> {
        try {
            const response = await axios.get(`${this.workerUrl}/metadata`);
            const metadata = response.data as GameMetadata;
            // Ensure ID matches
            if (metadata.id !== this.gameId) {
                logger.warn({ expected: this.gameId, actual: metadata.id }, 'Remote game ID mismatch');
            }
            return metadata;
        } catch (error) {
            logger.error({ error, url: this.workerUrl }, 'Failed to fetch metadata from remote worker');
            throw error;
        }
    }

    async initState(ctx: InitContext): Promise<GameState> {
        const response = await axios.post(`${this.workerUrl}/init`, ctx);
        return response.data;
    }

    async getCurrentRole(state: GameState): Promise<string> {
        // This might be tricky if the state doesn't explicitly store currentRole in a standard way.
        // However, usually the state object has it.
        // If we want to rely on the worker, we might need an endpoint or just read it from state if we know the schema.
        // But GameLogic interface requires this method.
        // Let's assume the worker state structure is consistent or we can't easily implement this without an endpoint.
        // Optimization: Read local state if possible, otherwise call worker?
        // Let's add an endpoint to worker for consistency? Or just property access?
        // The worker implementation exposes `getCurrentRole` logic.
        // BUT acting on state locally is fragile if logic is complex.
        // Let's assume we can modify the worker to expose it or just use a helper if it's standard.
        // Wait, `getCurrentRole` is part of GameLogic.
        // For RemoteGameLogic, we should probably add an endpoint if we want to be pure.
        // But typically `currentRole` is a property of state.
        // Let's use an endpoint to be safe and logic-agnostic.
        // My previous worker implementation didn't have `/current-role`.
        // Let me check worker/src/index.ts again or just add it.
        // Actually, for now, let's assume the state has `currentRole` property as per BaseGameLogic conventions?
        // No, let's strictly proxy to worker.
        // I need to update worker/src/index.ts to expose /current-role or just rely on state.
        // Let's look at `index.ts` I wrote for worker.
        // It has `metadata`, `init`, `legal-actions`, `act`, `check-terminal`, `perspective`.
        // Missing `getCurrentRole`, `getWinners` (partially in check-terminal).

        // Let's try to just read it from state for now as a fallback, 
        // or better, update worker to expose it if strictly needed.
        // Actually, `check-terminal` returns winners.
        // `currentRole` is usually needed for UI.
        // Let's add `GET /role` or `POST /role` to worker?
        // Or just admit that for now we might read `state.currentRole`.

        if ('currentRole' in state) {
            return (state as any).currentRole;
        }
        // Fallback or todo
        return 'unknown';
    }

    async getLegalActions(state: GameState, roleId: string): Promise<ActionSpec> {
        const response = await axios.post(`${this.workerUrl}/legal-actions`, { state, roleId });
        return response.data;
    }

    async applyAction(state: GameState, action: Action): Promise<ActionResult> {
        const response = await axios.post(`${this.workerUrl}/act`, { state, action });
        return response.data;
    }

    async isTerminal(state: GameState): Promise<boolean> {
        const response = await axios.post(`${this.workerUrl}/check-terminal`, { state });
        return response.data.isTerminal;
    }

    async getWinners(state: GameState): Promise<string[] | null> {
        const response = await axios.post(`${this.workerUrl}/check-terminal`, { state });
        return response.data.winners;
    }

    async toRolePerspective(
        state: GameState,
        roleId: string,
        wholeHistory: HistoryEvent[],
        diffHistory: HistoryEvent[]
    ): Promise<RolePerspective> {
        const response = await axios.post(`${this.workerUrl}/perspective`, {
            state,
            roleId,
            wholeHistory,
            diffHistory,
        });
        return response.data;
    }

    generateStatePrompt(perspective: RolePerspective): string {
        // Since prompt generation is usually stateless or just formatting, 
        // we can either implementation it here or call worker.
        // Calling worker for a simple string format might be overkill but ensures consistency.
        // However, this method is synchronous in the interface?
        // Wait, BaseGameLogic has it synchronous. GameLogic interface has it synchronous?
        // My restore in Step 494 made it synchronous: generateStatePrompt(perspective: RolePerspective): string;
        // So I cannot await a worker call here!
        // I must implement a default generic prompt here or use the one from SDK.

        return JSON.stringify(perspective.current_state, null, 2);
    }
}
