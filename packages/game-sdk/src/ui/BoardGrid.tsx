/**
 * @nexus/game-sdk - BoardGrid Component
 * A flexible grid component for board games
 */

import React from 'react';

export interface BoardGridProps {
    /** Number of rows */
    rows: number;
    /** Number of columns */
    cols: number;
    /** Size of each cell in pixels */
    cellSize?: number;
    /** Whether to render grid lines */
    renderLines?: boolean;
    /** Callback when a cell is clicked */
    onCellClick?: (row: number, col: number) => void;
    /** Additional CSS class */
    className?: string;
    /** Children (typically Piece components) */
    children?: React.ReactNode;
    /** Custom styles */
    style?: React.CSSProperties;
}

/**
 * SVG grid lines for the board
 */
const BoardLines: React.FC<{ rows: number; cols: number; cellSize: number }> = ({
    rows,
    cols,
    cellSize,
}) => {
    const width = cols * cellSize;
    const height = rows * cellSize;

    return (
        <svg
            className="nexus-sdk-board-lines"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
        >
            {/* Horizontal lines */}
            {Array.from({ length: rows + 1 }).map((_, i) => (
                <line
                    key={`h-${i}`}
                    x1={0}
                    y1={i * cellSize}
                    x2={width}
                    y2={i * cellSize}
                    stroke="var(--nexus-line-color, #333)"
                    strokeWidth="var(--nexus-line-width, 1)"
                />
            ))}
            {/* Vertical lines */}
            {Array.from({ length: cols + 1 }).map((_, i) => (
                <line
                    key={`v-${i}`}
                    x1={i * cellSize}
                    y1={0}
                    x2={i * cellSize}
                    y2={height}
                    stroke="var(--nexus-line-color, #333)"
                    strokeWidth="var(--nexus-line-width, 1)"
                />
            ))}
        </svg>
    );
};

/**
 * Board grid component for board-based games
 */
export const BoardGrid: React.FC<BoardGridProps> = ({
    rows,
    cols,
    cellSize = 40,
    renderLines = true,
    onCellClick,
    className = '',
    children,
    style,
}) => {
    const gridStyle: React.CSSProperties = {
        width: cols * cellSize,
        height: rows * cellSize,
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        '--nexus-cell-size': `${cellSize}px`,
        '--nexus-cols': cols,
        '--nexus-rows': rows,
        ...style,
    } as React.CSSProperties;

    const handleCellClick = (index: number) => {
        if (onCellClick) {
            const row = Math.floor(index / cols);
            const col = index % cols;
            onCellClick(row, col);
        }
    };

    return (
        <div
            data-nexus-sdk
            className={`nexus-sdk-board-grid ${className}`}
            style={gridStyle}
        >
            {renderLines && <BoardLines rows={rows} cols={cols} cellSize={cellSize} />}

            <div className="nexus-sdk-board-cells">
                {Array.from({ length: rows * cols }).map((_, i) => (
                    <div
                        key={i}
                        className="nexus-sdk-board-cell"
                        onClick={() => handleCellClick(i)}
                    />
                ))}
            </div>

            <div
                className="nexus-sdk-board-pieces"
                style={{
                    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
                }}
            >
                {children}
            </div>
        </div>
    );
};
