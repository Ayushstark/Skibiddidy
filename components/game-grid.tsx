"use client";

import { cn } from "@/lib/utils";
import { getCellVisual, type DisplayCellType } from "@/lib/wumpus-display";
import type { CellType, Position } from "@/lib/wumpus-world";

interface GameGridProps {
  grid: string[][];
  agentPosition?: Position;
  path?: Position[];
  currentTurn?: number;
  isEditable?: boolean;
  onCellClick?: (row: number, col: number) => void;
  selectedTool?: CellType;
}

function getGridMetrics(size: number) {
  if (size >= 15) {
    return { cellPx: 28, headerPx: 22, gapPx: 4, iconClass: "size-3.5", cellTextClass: "text-xs" };
  }

  if (size >= 13) {
    return { cellPx: 32, headerPx: 24, gapPx: 5, iconClass: "size-4", cellTextClass: "text-xs" };
  }

  if (size >= 11) {
    return { cellPx: 36, headerPx: 26, gapPx: 6, iconClass: "size-4", cellTextClass: "text-sm" };
  }

  if (size >= 10) {
    return { cellPx: 40, headerPx: 28, gapPx: 8, iconClass: "size-4", cellTextClass: "text-sm" };
  }

  if (size >= 8) {
    return { cellPx: 48, headerPx: 28, gapPx: 8, iconClass: "size-5", cellTextClass: "text-base" };
  }

  return { cellPx: 56, headerPx: 32, gapPx: 8, iconClass: "size-6", cellTextClass: "text-lg" };
}

export function GameGrid({
  grid,
  path,
  currentTurn = 0,
  isEditable = false,
  onCellClick,
}: GameGridProps) {
  const n = grid.length;
  const { cellPx, headerPx, gapPx, iconClass, cellTextClass } = getGridMetrics(n);
  const visiblePath = path ? path.slice(0, Math.min(currentTurn + 1, path.length)) : [];
  const overlayOffsetX = headerPx + gapPx;
  const overlayOffsetY = headerPx + gapPx;
  const overlayWidth = overlayOffsetX + n * cellPx + (n - 1) * gapPx;
  const overlayHeight = overlayOffsetY + n * cellPx + (n - 1) * gapPx;
  const trailHaloWidth = Math.max(7, cellPx * 0.24);
  const trailWidth = Math.max(3, cellPx * 0.12);
  const pathPoints = visiblePath.map(([row, col]) => ({
    x: overlayOffsetX + (col - 1) * (cellPx + gapPx) + cellPx / 2,
    y: overlayOffsetY + (row - 1) * (cellPx + gapPx) + cellPx / 2,
  }));
  const pathSegments = pathPoints.slice(1).map((point, index) => ({
    start: pathPoints[index],
    end: point,
    key: `${pathPoints[index].x}-${pathPoints[index].y}-${point.x}-${point.y}-${index}`,
  }));

  const isInPath = (row: number, col: number) => {
    if (!path) return false;
    return path.slice(0, currentTurn + 1).some(([r, c]) => r === row + 1 && c === col + 1);
  };

  const getPathIndex = (row: number, col: number) => {
    if (!path) return -1;

    let latestIndex = -1;
    for (let index = 0; index <= currentTurn && index < path.length; index++) {
      const [r, c] = path[index];
      if (r === row + 1 && c === col + 1) {
        latestIndex = index;
      }
    }

    return latestIndex;
  };

  return (
    <div className="relative inline-block">
      {pathPoints.length >= 2 && (
        <svg
          className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
          width={overlayWidth}
          height={overlayHeight}
          aria-hidden="true"
        >
          {pathSegments.map((segment) => (
            <g key={segment.key}>
              <line
                x1={segment.start.x}
                y1={segment.start.y}
                x2={segment.end.x}
                y2={segment.end.y}
                stroke="rgba(15, 23, 42, 0.5)"
                strokeWidth={trailHaloWidth}
                strokeLinecap="round"
                opacity="0.55"
              />
              <line
                x1={segment.start.x}
                y1={segment.start.y}
                x2={segment.end.x}
                y2={segment.end.y}
                stroke="rgba(34, 211, 238, 0.92)"
                strokeWidth={trailWidth}
                strokeLinecap="round"
              />
            </g>
          ))}
          <circle
            cx={pathPoints[0].x}
            cy={pathPoints[0].y}
            r={Math.max(2.5, cellPx * 0.085)}
            fill="rgba(34, 211, 238, 0.95)"
          />
          <circle
            cx={pathPoints[pathPoints.length - 1].x}
            cy={pathPoints[pathPoints.length - 1].y}
            r={Math.max(3.5, cellPx * 0.11)}
            fill="rgba(250, 204, 21, 1)"
          />
        </svg>
      )}

      <div className="relative z-10 flex flex-col" style={{ gap: `${gapPx}px` }}>
        <div className="flex" style={{ gap: `${gapPx}px`, paddingLeft: `${overlayOffsetX}px` }}>
          {Array.from({ length: n }, (_, index) => (
            <div
              key={index}
              className="flex items-center justify-center"
              style={{ width: `${cellPx}px`, height: `${headerPx}px` }}
            >
              <div
                className="badge-shell flex items-center justify-center font-mono text-muted-foreground"
                style={{ width: `${headerPx}px`, height: `${headerPx}px` }}
              >
                {index + 1}
              </div>
            </div>
          ))}
        </div>

        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-center" style={{ gap: `${gapPx}px` }}>
            <div
              className="flex items-center justify-center"
              style={{ width: `${headerPx}px`, height: `${cellPx}px` }}
            >
              <div
                className="badge-shell flex items-center justify-center font-mono text-muted-foreground"
                style={{ width: `${headerPx}px`, height: `${headerPx}px` }}
              >
                {rowIdx + 1}
              </div>
            </div>

            {row.map((cell, colIdx) => {
              const isStartTile = isEditable && rowIdx === 0 && colIdx === 0;
              const visualKey: DisplayCellType = isStartTile ? "A" : ((cell as DisplayCellType) || ".");
              const visual = getCellVisual(visualKey);
              const Icon = visual.Icon;
              const pathIdx = getPathIndex(rowIdx, colIdx);
              const isCurrentAgent = visualKey === "A" || visualKey === "@";
              const wasVisited = isInPath(rowIdx, colIdx) && pathIdx < currentTurn;
              const isCurrentStep = pathIdx === currentTurn && pathIdx >= 0;

              return (
                <button
                  key={colIdx}
                  onClick={() => isEditable && !isStartTile && onCellClick?.(rowIdx, colIdx)}
                  disabled={!isEditable || isStartTile}
                  aria-label={visual.label}
                  title={visual.label}
                  className={cn(
                    "group relative flex items-center justify-center rounded-[18px] border transition-all duration-300",
                    cellTextClass,
                    visual.surfaceClass,
                    isEditable &&
                      !isStartTile &&
                      "cursor-pointer hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/30",
                    !isEditable && "cursor-default",
                    isStartTile && "cursor-not-allowed ring-2 ring-agent/25",
                    isCurrentAgent && "animate-signal ring-2 ring-agent/40",
                    isCurrentStep && "ring-2 ring-primary/55",
                    wasVisited && "ring-2 ring-primary/25",
                    visualKey === "G" && "animate-float"
                  )}
                  style={{ width: `${cellPx}px`, height: `${cellPx}px` }}
                  type="button"
                >
                  <span className="absolute inset-0 rounded-[inherit] bg-white/8 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <Icon className={cn("relative z-10", iconClass, visual.iconClass)} strokeWidth={1.9} />
                  {isStartTile && (
                    <span className="absolute left-1.5 top-1 rounded-full bg-agent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-agent">
                      S
                    </span>
                  )}
                  {pathIdx >= 0 && pathIdx <= currentTurn && (
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-slate-700/80 bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary shadow-sm">
                      {pathIdx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
