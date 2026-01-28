/**
 * @nexus/game-sdk - useGameState Hook
 * State management hook for game UI components
 */

import { useState, useCallback, useMemo } from 'react';
import type { RolePerspective, ActionSpec } from '../types';
import type { Position } from '../ui/Piece';

export interface UseGameStateOptions {
    /** Flip the board (for games where perspective matters) */
    flipBoard?: boolean;
    /** Number of rows (for coordinate transformation) */
    rows?: number;
    /** Number of columns (for coordinate transformation) */
    cols?: number;
}

export interface UseGameStateResult<TState> {
    /** Current game state */
    state: TState;
    /** Available actions */
    actions: ActionSpec['actions'];
    /** Is it the current player's turn? */
    isMyTurn: boolean;
    /** Selected position (for piece-based games) */
    selectedPos: Position | null;
    /** Set selected position */
    setSelectedPos: (pos: Position | null) => void;
    /** Transform position based on flipBoard option */
    transformPosition: (pos: Position) => Position;
    /** Reverse transform (from display to logical) */
    reverseTransformPosition: (pos: Position) => Position;
}

/**
 * Hook for managing game state in UI components
 */
export function useGameState<TState = unknown>(
    perspective: RolePerspective,
    options: UseGameStateOptions = {}
): UseGameStateResult<TState> {
    const { flipBoard = false, rows = 0, cols = 0 } = options;

    const state = perspective.current_state as TState;
    const actions = perspective.action_space_definition.actions;
    const isMyTurn = perspective.your_role.is_current;

    const [selectedPos, setSelectedPos] = useState<Position | null>(null);

    // Transform position for flipped board
    const transformPosition = useCallback(
        (pos: Position): Position => {
            if (!flipBoard) return pos;
            return {
                row: rows > 0 ? rows - 1 - pos.row : pos.row,
                col: cols > 0 ? cols - 1 - pos.col : pos.col,
            };
        },
        [flipBoard, rows, cols]
    );

    // Reverse transform (display -> logical)
    const reverseTransformPosition = useCallback(
        (pos: Position): Position => {
            // Same as transform for 180-degree flip
            return transformPosition(pos);
        },
        [transformPosition]
    );

    return {
        state,
        actions,
        isMyTurn,
        selectedPos,
        setSelectedPos,
        transformPosition,
        reverseTransformPosition,
    };
}
