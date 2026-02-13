
import path from 'path';
import fs from 'fs';
import { GameLogic } from '@nexus/game-sdk'; // Use SDK type directly
import logger from '../utils/logger.js';



export async function loadGameLogic(gameId: string, bundlePath: string): Promise<GameLogic> {
    // Use time-busting query param if needed for hot reload, 
    // but for now simple import is enough.
    // Note: 'import' with variable requires the path to be absolute or relative to CWD.

    let absolutePath = bundlePath;
    if (!path.isAbsolute(bundlePath)) {
        absolutePath = path.resolve(process.cwd(), bundlePath);
    }

    try {
        // Check if file exists first
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Game bundle not found at: ${absolutePath}`);
        }

        logger.info({ gameId, absolutePath }, 'Loading game bundle...');
        const module = await import(absolutePath);

        // Check default export
        if (!module.default) {
            throw new Error(`Game bundle ${gameId} has no default export`);
        }

        const logic: GameLogic = module.default;
        validateGameLogic(logic, gameId);

        return logic;
    } catch (error) {
        logger.error({ gameId, absolutePath, error }, 'Failed to load game bundle');
        throw error;
    }
}

function validateGameLogic(logic: any, gameId: string): void {
    const required = [
        'getMetadata',
        'initState',
        'getCurrentRole',
        'getLegalActions',
        'applyAction',
        'isTerminal',
        'getWinners',
        'toRolePerspective'
    ];

    for (const method of required) {
        if (typeof logic[method] !== 'function') {
            throw new Error(`Game ${gameId}: missing required method '${method}'`);
        }
    }
}
