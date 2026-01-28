/**
 * Gomoku Game Metadata
 * Exported for Module Federation version handshake
 */

export const metadata = {
    gameId: 'gomoku',
    name: '五子棋 (Gomoku)',
    version: '1.0.0',
    logicVersion: 1,
};

// Also export logicVersion directly for easy access
export const logicVersion = metadata.logicVersion;

export default metadata;
