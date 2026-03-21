"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCellVisual } from "@/lib/wumpus-display";
import { WumpusWorld, type CellType, type Position, type SolveResult } from "@/lib/wumpus-world";
import { GridEditor } from "./grid-editor";
import { ManualPlayPanel } from "./manual-play-panel";
import { SimulationPanel } from "./simulation-panel";
import {
  Compass,
  Route,
  ScanSearch,
  Sparkles,
  Target,
} from "lucide-react";

type GameState = "edit" | "simulation" | "manual" | "no-path";

type SolveWorkerRequest = {
  requestId: string;
  gridSize: number;
  grid: CellType[][];
};

type SolveWorkerResponse = {
  requestId: string;
  result: SolveResult;
};

const presets: { id: string; name: string; size: number; grid: CellType[][] }[] = [
  {
    id: "classic-5x5",
    name: "Classic 5x5",
    size: 5,
    grid: [
      [".", ".", ".", "P", "."],
      ["W", ".", ".", ".", "."],
      [".", "P", ".", ".", "G"],
      [".", ".", "W", ".", "."],
      [".", ".", ".", "T", "."],
    ],
  },
  {
    id: "challenge-6x6",
    name: "Challenge 6x6",
    size: 6,
    grid: [
      [".", ".", "P", ".", ".", "."],
      [".", "W", ".", ".", "P", "."],
      [".", ".", ".", "T", ".", "."],
      ["P", ".", ".", ".", ".", "W"],
      [".", ".", "W", ".", ".", "."],
      [".", "T", ".", ".", "P", "G"],
    ],
  },
  {
    id: "maze-7x7",
    name: "Maze 7x7",
    size: 7,
    grid: [
      [".", ".", "P", ".", ".", ".", "."],
      [".", "W", ".", "P", ".", "W", "."],
      [".", ".", ".", ".", ".", ".", "."],
      ["P", ".", "T", ".", "P", ".", "."],
      [".", ".", ".", ".", ".", "T", "."],
      [".", "W", ".", "P", ".", ".", "."],
      [".", ".", ".", ".", "W", ".", "G"],
    ],
  },
];

function createEmptyGrid(size: number): CellType[][] {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(".") as CellType[]);
}

function solveGrid(gridSize: number, grid: CellType[][]): Promise<SolveResult> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return Promise.resolve(new WumpusWorld(gridSize, grid).solve());
  }

  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const worker = new Worker(new URL("../lib/solver-worker.ts", import.meta.url), {
      type: "module",
    });

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<SolveWorkerResponse>) => {
      if (event.data.requestId !== requestId) {
        return;
      }
      cleanup();
      resolve(event.data.result);
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error("Solver worker failed."));
    };

    const request: SolveWorkerRequest = { requestId, gridSize, grid };
    worker.postMessage(request);
  });
}

export function WumpusGame() {
  const [gridSize, setGridSize] = useState(5);
  const [grid, setGrid] = useState<CellType[][]>(presets[0].grid);
  const [presetSelection, setPresetSelection] = useState(presets[0].id);
  const [gameState, setGameState] = useState<GameState>("edit");
  const [isSolving, setIsSolving] = useState(false);
  const [isPreparingManual, setIsPreparingManual] = useState(false);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [solution, setSolution] = useState<SolveResult | null>(null);

  const handleGridSizeChange = useCallback((newSize: number) => {
    setGridSize(newSize);
    setGrid(createEmptyGrid(newSize));
    setPresetSelection("custom");
    setGameState("edit");
    setIsPreparingManual(false);
    setFailureReason(null);
    setSolution(null);
  }, []);

  const handlePresetSelect = useCallback((presetId: string) => {
    if (presetId === "custom") {
      setPresetSelection("custom");
      return;
    }

    const preset = presets.find((item) => item.id === presetId);
    if (preset) {
      setGridSize(preset.size);
      setGrid(preset.grid.map((row) => [...row]));
      setPresetSelection(preset.id);
      setGameState("edit");
      setIsPreparingManual(false);
      setFailureReason(null);
      setSolution(null);
    }
  }, []);

  const handleSolve = useCallback(async () => {
    setIsSolving(true);
    try {
      const result = await solveGrid(gridSize, grid);
      setIsSolving(false);

      if (result.success || result.path.length > 0) {
        setSolution(result);
        setFailureReason(result.success ? null : result.failureReason ?? "No safe route could be found for this board.");
        setGameState("simulation");
      } else {
        setFailureReason(result.failureReason ?? "No safe route could be found for this board.");
        setGameState("no-path");
        setSolution(null);
      }
    } catch {
      setIsSolving(false);
      setFailureReason("Route analysis failed due to an internal solver error.");
      setGameState("no-path");
      setSolution(null);
    }
  }, [gridSize, grid]);

  const handleStartManual = useCallback(async () => {
    setIsPreparingManual(true);
    try {
      const result = await solveGrid(gridSize, grid);
      setSolution(result.success ? result : null);
      setFailureReason(result.success ? null : result.failureReason ?? "No safe route could be found for this board.");
      setIsPreparingManual(false);
      setGameState("manual");
    } catch {
      setSolution(null);
      setFailureReason("Manual benchmark preparation failed due to an internal solver error.");
      setIsPreparingManual(false);
      setGameState("manual");
    }
  }, [gridSize, grid]);

  const handleReset = useCallback(() => {
    setGameState("edit");
    setIsPreparingManual(false);
    setFailureReason(null);
  }, []);

  const handleViewOptimal = useCallback(() => {
    if (solution) {
      setGameState("simulation");
    }
  }, [solution]);

  const handleGridChange = useCallback((nextGrid: CellType[][]) => {
    setGrid(nextGrid);
    setPresetSelection("custom");
    setGameState("edit");
    setIsPreparingManual(false);
    setFailureReason(null);
    setSolution(null);
  }, []);

  const wumpusCount = grid.flat().filter((cell) => cell === "W").length;
  const pitCount = grid.flat().filter((cell) => cell === "P").length;
  const timeZoneCount = grid.flat().filter((cell) => cell === "T").length;
  const hasGold = grid.some((row) => row.includes("G"));
  const noPathVisible = gameState === "no-path";
  const ruleTypes: CellType[] = ["W", "P", "T", "G"];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute right-[-8rem] top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(88,158,206,0.18),transparent_70%)] blur-3xl animate-drift" />
      <div className="pointer-events-none absolute left-[-10rem] top-40 size-80 rounded-full bg-[radial-gradient(circle,rgba(212,161,70,0.18),transparent_72%)] blur-3xl animate-drift" />

      <main className="relative mx-auto flex max-w-[1600px] flex-col gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <section className="panel-shell animate-rise-in">
          <div className="hero-grid absolute inset-0" />
          <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1.2fr)_20rem] lg:px-8 lg:py-8">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className="badge-shell gap-2 px-3 py-1.5 text-xs text-foreground">
                  <Compass className="size-3.5 text-primary" />
                  Dynamic Wumpus routing
                </Badge>
                <Badge className="badge-shell gap-2 px-3 py-1.5 text-xs text-foreground">
                  <Route className="size-3.5 text-timezone" />
                  Turn-by-turn replay
                </Badge>
                <Badge className="badge-shell gap-2 px-3 py-1.5 text-xs text-foreground">
                  <ScanSearch className="size-3.5 text-gold" />
                  Exact route search
                </Badge>
              </div>

              <div className="space-y-3">
                <p className="section-kicker">Interactive AI expedition</p>
                <h1 className="max-w-3xl font-[family:var(--font-display)] text-5xl leading-none text-foreground sm:text-6xl lg:text-7xl">
                  Wumpus World Atlas
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Design a hazard field, plant the gold, and watch the solver thread
                  through moving enemies, percept zones, and time-shifting tiles.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="stat-shell p-4">
                  <p className="section-kicker">Threats</p>
                  <p className="mt-3 font-mono text-3xl font-semibold text-wumpus">
                    {wumpusCount + pitCount}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">moving Wumpuses and pits</p>
                </div>
                <div className="stat-shell p-4">
                  <p className="section-kicker">Shortcuts</p>
                  <p className="mt-3 font-mono text-3xl font-semibold text-timezone">
                    {timeZoneCount}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">time-reducing cells</p>
                </div>
                <div className="stat-shell p-4">
                  <p className="section-kicker">Mission state</p>
                  <p className="mt-3 text-xl font-semibold text-foreground">
                    {gameState === "simulation"
                      ? "Replaying route"
                      : gameState === "manual"
                        ? "Manual expedition"
                      : noPathVisible
                        ? "Route blocked"
                        : "Designing map"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {hasGold ? "Gold is placed" : "Destination still missing"}
                  </p>
                </div>
              </div>
            </div>

            <div className="panel-subtle p-5 sm:p-6">
              <p className="section-kicker">Mission controls</p>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Scenario</label>
                  <Select value={presetSelection} onValueChange={handlePresetSelect}>
                    <SelectTrigger className="h-12 w-full rounded-2xl border-slate-700 bg-slate-950/80">
                      <SelectValue placeholder="Preset scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom Map</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Grid size</label>
                  <Select
                    value={gridSize.toString()}
                    onValueChange={(value) => handleGridSizeChange(parseInt(value, 10))}
                  >
                    <SelectTrigger className="h-12 w-full rounded-2xl border-slate-700 bg-slate-950/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 11 }, (_, index) => index + 5).map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}x{size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="panel-subtle p-4">
                  <div className="flex items-center gap-3">
                    <Target className="size-5 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">
                        {hasGold ? "Destination ready" : "Destination required"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        The solver only runs when a gold tile is present on the map.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {gameState !== "simulation" && gameState !== "manual" && (
          <div className="space-y-6">
            {noPathVisible && (
              <Card className="panel-shell border-destructive/20 bg-[rgba(127,29,29,0.18)]">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-2xl text-destructive">
                        No safe route found
                      </CardTitle>
                      <CardDescription className="mt-2 max-w-2xl text-sm sm:text-base">
                        {failureReason ??
                          "This layout traps the agent behind lethal Wumpus timings or pushes the path over the stench limit."}{" "}
                        Adjust the map and run analysis again.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleReset}
                      className="h-11 rounded-2xl bg-destructive text-destructive-foreground"
                    >
                      Return to planning
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            )}

            <section className="grid gap-8 xl:grid-cols-[minmax(0,1.32fr)_24rem]">
              <GridEditor
                gridSize={gridSize}
                grid={grid}
                onGridChange={handleGridChange}
                onSolve={handleSolve}
                onStartManual={handleStartManual}
                isSolving={isSolving}
                isPreparingManual={isPreparingManual}
              />

              <div className="space-y-6">
                <Card className="panel-shell animate-rise-in">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Sparkles className="size-5 text-primary" />
                      Field logic
                    </CardTitle>
                  <CardDescription>
                      The route cost is shaped by both tile contents and nearby percept zones, including what the agent senses at the entrance.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {ruleTypes.map((type) => {
                      const rule = getCellVisual(type);
                      const Icon = rule.Icon;

                      return (
                        <div key={type} className="panel-subtle flex items-start gap-3 p-4">
                          <span
                            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border ${rule.surfaceClass}`}
                          >
                            <Icon className={`size-4 ${rule.iconClass}`} strokeWidth={1.9} />
                          </span>
                          <div>
                            <p className="font-semibold text-foreground">{rule.label}</p>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              {type === "W" &&
                                "Moves horizontally in the PDF oscillation pattern, produces adjacent stench, and overlapping Wumpuses collapse into one occupied cell."}
                              {type === "P" &&
                                "Landing in a pit adds +5 time, and adjacent breeze adds another +2 time."}
                              {type === "T" &&
                                "Landing on a time zone subtracts 3 time and can create efficient shortcuts."}
                              {type === "G" &&
                                "The solver searches for the minimum-time safe route to the gold under the full movement rules."}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>
        )}

        {gameState === "simulation" && solution && (
          <SimulationPanel
            grid={grid}
            path={solution.path}
            timeCost={solution.timeCost}
            success={solution.success}
            stopReason={solution.stopReason ?? solution.failureReason ?? null}
            onReset={handleReset}
          />
        )}

        {gameState === "manual" && (
          <ManualPlayPanel
            grid={grid}
            optimalSolution={solution}
            failureReason={failureReason}
            onBackToEditor={handleReset}
            onViewOptimal={handleViewOptimal}
          />
        )}

        <footer className="pt-2 text-sm text-muted-foreground">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>Dynamic Wumpus pathfinding with time-aware hazards, percept overlays, and replay controls.</p>
            <p className="font-mono text-xs uppercase tracking-[0.34em] text-foreground/50">
              Exact safe-path search
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
