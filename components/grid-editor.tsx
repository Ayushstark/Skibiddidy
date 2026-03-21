"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { editableTools, getCellVisual } from "@/lib/wumpus-display";
import { getGridCounts, type CellType } from "@/lib/wumpus-world";
import { GameGrid } from "./game-grid";
import { MapPinned, ScanSearch, ShieldAlert, Sparkles } from "lucide-react";

interface GridEditorProps {
  gridSize: number;
  grid: CellType[][];
  onGridChange: (grid: CellType[][]) => void;
  onSolve: () => void;
  onStartManual: () => void;
  isSolving: boolean;
  isPreparingManual: boolean;
}

export function GridEditor({
  gridSize,
  grid,
  onGridChange,
  onSolve,
  onStartManual,
  isSolving,
  isPreparingManual,
}: GridEditorProps) {
  const [selectedTool, setSelectedTool] = useState<CellType>("W");
  const counts = useMemo(() => getGridCounts(grid), [grid]);

  const handleCellClick = (row: number, col: number) => {
    if (isSolving || isPreparingManual) return;
    if (row === 0 && col === 0) return;

    const newGrid = grid.map((gridRow) => [...gridRow]);

    if (selectedTool === "G") {
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (newGrid[r][c] === "G") {
            newGrid[r][c] = ".";
          }
        }
      }
    }

    newGrid[row][col] = newGrid[row][col] === selectedTool ? "." : selectedTool;

    onGridChange(newGrid);
  };

  const hasGold = counts.gold > 0;
  const selectedVisual = getCellVisual(selectedTool);
  const SelectedIcon = selectedVisual.Icon;
  const wumpusCount = counts.wumpuses;
  const pitCount = counts.pits;
  const timeZoneCount = counts.timeZones;

  return (
    <Card className="panel-shell animate-rise-in">
      <CardHeader>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <p className="section-kicker">Build the world</p>
            <CardTitle className="text-2xl text-foreground sm:text-3xl">
              Mission planner
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm sm:text-base">
              Lay out hazards, drop the gold, and shape the exact encounter space the
              solver has to decode. The start tile at (1,1) stays fixed.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="badge-shell gap-2 px-3 py-1.5 text-xs text-foreground">
              <MapPinned className="size-3.5 text-primary" />
              {gridSize}x{gridSize} map
            </Badge>
            <Badge className="badge-shell gap-2 px-3 py-1.5 text-xs text-foreground">
              <Sparkles className="size-3.5 text-wumpus" />
              {wumpusCount} wumpus
            </Badge>
            <Badge className="badge-shell gap-2 px-3 py-1.5 text-xs text-foreground">
              <Sparkles className="size-3.5 text-pit" />
              {pitCount} pits
            </Badge>
            <Badge className="badge-shell gap-2 px-3 py-1.5 text-xs text-foreground">
              <Sparkles className="size-3.5 text-timezone" />
              {timeZoneCount} time zones
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {editableTools.map((toolType) => {
            const tool = getCellVisual(toolType);
            const ToolIcon = tool.Icon;

            return (
              <button
                key={toolType}
                disabled={isSolving || isPreparingManual}
                onClick={() => {
                  setSelectedTool(toolType);
                }}
                className={cn(
                  "panel-subtle flex min-h-28 flex-col items-start gap-3 p-4 text-left transition-all duration-300",
                  (isSolving || isPreparingManual) && "opacity-70",
                  selectedTool === toolType
                    ? "border-primary/30 bg-primary/10 shadow-[0_18px_45px_rgba(157,82,49,0.12)]"
                    : "hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-[0_14px_34px_rgba(118,86,34,0.08)]"
                )}
                type="button"
              >
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-2xl border",
                    tool.surfaceClass
                  )}
                >
                  <ToolIcon className={cn("size-5", tool.iconClass)} strokeWidth={1.9} />
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{tool.label}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="map-shell p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="section-kicker">Placement board</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click any tile except the fixed start cell to paint the selected object.
                </p>
              </div>
              <Badge
                className={cn(
                  "gap-2 px-3 py-1.5 text-xs",
                  hasGold
                    ? "border-gold/40 bg-gold/15 text-gold"
                    : "border-border/60 bg-slate-950/80 text-muted-foreground"
                )}
              >
                <Sparkles className="size-3.5" />
                {hasGold ? "Goal placed" : "Goal missing"}
              </Badge>
            </div>

            <div className="overflow-x-auto pb-2">
              <GameGrid
                grid={grid}
                isEditable
                onCellClick={handleCellClick}
                selectedTool={selectedTool}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel-subtle p-4">
              <p className="section-kicker">Active brush</p>
              <div className="mt-3 flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-12 items-center justify-center rounded-2xl border",
                    selectedVisual.surfaceClass
                  )}
                >
                  <SelectedIcon
                    className={cn("size-5", selectedVisual.iconClass)}
                    strokeWidth={1.9}
                  />
                </span>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">
                    {selectedVisual.label}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selectedVisual.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="panel-subtle p-4">
              <p className="section-kicker">Route readiness</p>
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Gold destination</span>
                  <span className={cn("font-semibold", hasGold ? "text-gold" : "text-destructive")}>
                    {hasGold ? "ready" : "required"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Wumpuses</span>
                  <span className="font-semibold text-foreground">{wumpusCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Pits</span>
                  <span className="font-semibold text-foreground">{pitCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Time zones</span>
                  <span className="font-semibold text-foreground">{timeZoneCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Start tile</span>
                  <span className="font-semibold text-foreground">(1,1) fixed</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <Button
                onClick={onSolve}
                disabled={!hasGold || isSolving || isPreparingManual}
                className="h-14 w-full rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(250,204,21,0.16)] transition-transform hover:-translate-y-0.5 hover:bg-primary/95"
                size="lg"
              >
                <ScanSearch className="size-4" />
                {isSolving
                  ? "Computing shortest safe route..."
                  : hasGold
                    ? "Run route analysis"
                    : "Place a gold tile to begin"}
              </Button>

              <Button
                variant="outline"
                onClick={onStartManual}
                disabled={!hasGold || isSolving || isPreparingManual}
                className="h-14 w-full rounded-2xl border-slate-700 bg-slate-950/80 text-foreground hover:bg-slate-900"
                size="lg"
              >
                {isPreparingManual
                  ? "Preparing manual expedition..."
                  : hasGold
                    ? "Start manual expedition"
                    : "Gold required for manual play"}
              </Button>
            </div>

            <div className="panel-subtle p-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="size-5 text-primary" />
                <div>
                  <p className="text-base font-semibold text-foreground">Search constraints</p>
                  <p className="text-sm text-muted-foreground">
                    The solver evaluates time cost, Wumpus timing, and the stench cap together.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <div className="panel-subtle p-3">
                  Each move carries a base cost of 1, with pit and breeze penalties stacked on top.
                </div>
                <div className="panel-subtle p-3">
                  Wumpus positions shift once per turn before the agent moves, using the PDF row-based horizontal oscillation.
                </div>
                <div className="panel-subtle p-3">
                  The entrance at (1,1) stays safe to stand on, but it can still begin with breeze, stench, or both if hazards are adjacent.
                </div>
                <div className="panel-subtle p-3">
                  Only the board size range is constrained in the editor; hazard counts are otherwise left up to the map you build.
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
