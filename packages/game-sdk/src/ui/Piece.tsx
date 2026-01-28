/**
 * @nexus/game-sdk - Piece Component
 * A flexible piece component for board games
 */

import React from 'react';

export interface Position {
    row: number;
    col: number;
}

export interface PieceProps<T = unknown> {
    /** Piece data */
    data: T;
    /** Position on the board */
    position: Position;
    /** Is this piece selected? */
    selected?: boolean;
    /** Is this a highlighted position (e.g., legal move)? */
    highlighted?: boolean;
    /** Is interaction disabled? */
    disabled?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Custom render function for piece content */
    render: (data: T) => React.ReactNode;
    /** Additional CSS class */
    className?: string;
    /** Custom styles */
    style?: React.CSSProperties;
}

/**
 * Piece component for displaying game pieces on a board
 */
export function Piece<T>({
    data,
    position,
    selected = false,
    highlighted = false,
    disabled = false,
    onClick,
    render,
    className = '',
    style,
}: PieceProps<T>): React.ReactElement {
    const classes = [
        'nexus-sdk-piece',
        className,
        selected && 'nexus-sdk-piece--selected',
        highlighted && 'nexus-sdk-piece--highlighted',
        disabled && 'nexus-sdk-piece--disabled',
    ]
        .filter(Boolean)
        .join(' ');

    const pieceStyle: React.CSSProperties = {
        gridRow: position.row + 1,
        gridColumn: position.col + 1,
        ...style,
    };

    return (
        <div
            className={classes}
            style={pieceStyle}
            onClick={disabled ? undefined : onClick}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-selected={selected}
            aria-disabled={disabled}
        >
            {render(data)}
        </div>
    );
}
