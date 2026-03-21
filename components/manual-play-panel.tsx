"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCellVisual, legendCells } from "@/lib/wumpus-display";
import {
  advanceWumpusConfiguration,
  evaluateManualMove,
  getCellConfigurationShift,
  getConfigurationTransitionSequence,
  getRenderGridAtConfiguration,
  type CellType,
  type MoveDirection,
  type Position,
  type SolveResult,
  WumpusWorld,
} from "@/lib/wumpus-world";
import { GameGrid } from "./game-grid";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Compass,
  RotateCcw,
  Route,
  Skull,
  Target,
} from "lucide-react";

interface ManualPlayPanelProps {
  grid: CellType[][];
  optimalSolution: SolveResult | null;
  failureReason: string | null;
  onBackToEditor: () => void;
  onViewOptimal: () => void;
}

type RunStatus = "active" | "won" | "wumpus" | "stench-limit" | "turn-limit";

const HAZARD_CONFIGURATION_STEP_MS = 350;

interface MoveLogEntry {
  id: number;
  title: string;
  summary: string;
  outcome: RunStatus | "blocked";
  turn: number;
  wumpusConfiguration: number;
  position: Position;
  path: Position[];
  timeCost: number;
  stenchCount: number;
  status: RunStatus;
}

const directions: {
  key: MoveDirection;
  label: string;
  Icon: typeof ArrowUp;
  className: string;
}[] = [
  { key: "up", label: "Move up", Icon: ArrowUp, className: "col-start-2 row-start-1" },
  { key: "left", label: "Move left", Icon: ArrowLeft, className: "col-start-1 row-start-2" },
  { key: "right", label: "Move right", Icon: ArrowRight, className: "col-start-3 row-start-2" },
  { key: "down", label: "Move down", Icon: ArrowDown, className: "col-start-2 row-start-3" },
];

function formatDirection(direction: MoveDirection) {
  switch (direction) {
    case "up":
      return "north";
    case "down":
      return "south";
    case "left":
      return "west";
    case "right":
      return "east";
  }
}

function describeMove(
  direction: MoveDirection,
  result: ReturnType<typeof evaluateManualMove>
): Pick<MoveLogEntry, "title" | "summary" | "outcome"> {
  const heading = formatDirection(direction);
  const [row, col] = result.nextPosition;
  const impactParts: string[] = [];

  if (result.timeDelta !== 0) {
    const signed = result.timeDelta > 0 ? `+${result.timeDelta}s` : `${result.timeDelta}s`;
    impactParts.push(`time change ${signed}`);
  } else {
    impactParts.push("no safe time gain");
  }

  impactParts.push(`Wumpus turn now ${result.wumpusConfiguration}`);

  if (result.cellType === "P") impactParts.push("pit penalty applied");
  if (result.hasBreeze) impactParts.push("breeze detected");
  if (result.hasStench) impactParts.push(`stench count is now ${result.stenchCount}/3`);
  if (result.cellType === "T") impactParts.push("time zone offset applied");

  switch (result.outcome) {
    case "blocked":
      return {
        title: `Blocked move ${heading}`,
        summary:
          result.blockReason === "revisit"
            ? `The agent cannot move ${heading} because revisiting a cell within the same route is not allowed.`
            : `The agent cannot move ${heading} because that step would leave the board boundary.`,
        outcome: "blocked",
      };
    case "wumpus":
      return {
        title: `Fatal move ${heading}`,
        summary: `Turn ${result.turn}: the agent stepped into (${row}, ${col}) after the Wumpuses shifted and was caught immediately.`,
        outcome: "wumpus",
      };
    case "stench-limit":
      return {
        title: `Stench limit exceeded`,
        summary: `Turn ${result.turn}: moving ${heading} to (${row}, ${col}) triggered a third stench exposure, which ends the expedition.`,
        outcome: "stench-limit",
      };
    case "turn-limit":
      return {
        title: `Turn limit exceeded`,
        summary: `The next move would push the route beyond the maximum allowed turn count of 4n^2, so the agent is treated as lost.`,
        outcome: "turn-limit",
      };
    case "goal":
      return {
        title: `Gold recovered`,
        summary: `Turn ${result.turn}: moved ${heading} to (${row}, ${col}), reached the gold, and ${impactParts.join(", ")}.`,
        outcome: "won",
      };
    case "moved":
      return {
        title: `Moved ${heading}`,
        summary: `Turn ${result.turn}: advanced to (${row}, ${col}) and ${impactParts.join(", ")}.`,
        outcome: "active",
      };
  }
}

export function ManualPlayPanel({
  grid,
  optimalSolution,
  failureReason,
  onBackToEditor,
  onViewOptimal,
}: ManualPlayPanelProps) {
  const world = useMemo(() => new WumpusWorld(grid.length, grid), [grid]);
  const initialPercepts = useMemo(() => world.getCellPercepts([1, 1], 0), [world]);
  const initialStenchCount = initialPercepts.hasStench ? 1 : 0;
  const initialSummaryParts: string[] = [];
  if (initialPercepts.hasStench) initialSummaryParts.push("stench is present at the entrance");
  if (initialPercepts.hasBreeze) initialSummaryParts.push("breeze is present at the entrance");
  const initialSummarySuffix =
    initialSummaryParts.length > 0
      ? ` Initial percepts: ${initialSummaryParts.join(" and ")}.`
      : "";
  const [path, setPath] = useState<Position[]>([[1, 1]]);
  const [turn, setTurn] = useState(0);
  const [wumpusConfiguration, setWumpusConfiguration] = useState(0);
  const [timeCost, setTimeCost] = useState(0);
  const [stenchCount, setStenchCount] = useState(initialStenchCount);
  const [status, setStatus] = useState<RunStatus>("active");
  const [isResolvingHazardTurn, setIsResolvingHazardTurn] = useState(false);
  const [previewWumpusConfiguration, setPreviewWumpusConfiguration] = useState<number | null>(null);
  const nextLogId = useRef(1);
  const resolveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [log, setLog] = useState<MoveLogEntry[]>([
    {
      id: 0,
      title: "Expedition started",
      summary:
        `The agent begins at (1, 1). Every manual move will report cost changes, nearby hazards, and whether the run is still valid.${initialSummarySuffix}`,
      outcome: "active",
      turn: 0,
      wumpusConfiguration: 0,
      position: [1, 1],
      path: [[1, 1]],
      timeCost: 0,
      stenchCount: initialStenchCount,
      status: "active",
    },
  ]);

  const currentPosition = path[path.length - 1];
  const settledRenderGrid = getRenderGridAtConfiguration(
    world,
    currentPosition,
    wumpusConfiguration
  );
  const renderGrid =
    previewWumpusConfiguration === null
      ? settledRenderGrid
      : getRenderGridAtConfiguration(world, currentPosition, previewWumpusConfiguration);
  const latestLog = log[0];
  const isFinished = status !== "active";
  const manualRoutePreview = path.map(([row, col]) => `(${row},${col})`).join(" -> ");

  const pushLog = (entry: Omit<MoveLogEntry, "id">) => {
    const nextId = nextLogId.current;
    nextLogId.current += 1;
    setLog((current) => [{ id: nextId, ...entry }, ...current]);
  };

  const clearResolveAnimation = () => {
    if (resolveIntervalRef.current) {
      clearInterval(resolveIntervalRef.current);
      resolveIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (resolveIntervalRef.current) {
        clearInterval(resolveIntervalRef.current);
        resolveIntervalRef.current = null;
      }
    };
  }, []);

  const restoreToEntry = (entry: MoveLogEntry) => {
    clearResolveAnimation();
    setIsResolvingHazardTurn(false);
    setPreviewWumpusConfiguration(null);
    setPath(entry.path);
    setTurn(entry.turn);
    setWumpusConfiguration(entry.wumpusConfiguration);
    setTimeCost(entry.timeCost);
    setStenchCount(entry.stenchCount);
    setStatus(entry.status);
    setLog((current) => current.filter((item) => item.id <= entry.id));
  };

  const applyMoveResult = (
    direction: MoveDirection,
    result: ReturnType<typeof evaluateManualMove>
  ) => {
    const entry = describeMove(direction, result);

    if (result.outcome === "blocked") {
      pushLog({
        ...entry,
        turn,
        wumpusConfiguration,
        position: currentPosition,
        path: [...path],
        timeCost,
        stenchCount,
        status,
      });
      return;
    }

    const nextPath = [...path, result.nextPosition];
    const nextStatus: RunStatus =
      result.outcome === "goal"
        ? "won"
        : result.outcome === "wumpus"
          ? "wumpus"
          : result.outcome === "stench-limit"
            ? "stench-limit"
            : result.outcome === "turn-limit"
              ? "turn-limit"
            : "active";

    setPath(nextPath);
    setTurn(result.turn);
    setWumpusConfiguration(result.wumpusConfiguration);
    setTimeCost(result.totalTime);
    setStenchCount(result.stenchCount);
    setStatus(nextStatus);

    pushLog({
      ...entry,
      turn: result.turn,
      wumpusConfiguration: result.wumpusConfiguration,
      position: result.nextPosition,
      path: nextPath,
      timeCost: result.totalTime,
      stenchCount: result.stenchCount,
      status: nextStatus,
    });
  };

  const handleMove = (direction: MoveDirection) => {
    if (isFinished || isResolvingHazardTurn) return;

    const result = evaluateManualMove(
      world,
      currentPosition,
      direction,
      turn,
      timeCost,
      stenchCount,
      wumpusConfiguration,
      path
    );
    if (result.outcome === "blocked") {
      applyMoveResult(direction, result);
      return;
    }
    applyMoveResult(direction, result);

    if (result.outcome !== "moved") {
      return;
    }

    const landingWumpusConfiguration = advanceWumpusConfiguration(wumpusConfiguration);
    const pauseConfigurations = getConfigurationTransitionSequence(
      landingWumpusConfiguration,
      getCellConfigurationShift(result.cellType)
    );

    if (pauseConfigurations.length === 0) {
      return;
    }

    clearResolveAnimation();
    setIsResolvingHazardTurn(true);
    setPreviewWumpusConfiguration(pauseConfigurations[0]);

    let index = 1;
    resolveIntervalRef.current = setInterval(() => {
      if (index >= pauseConfigurations.length) {
        clearResolveAnimation();
        setPreviewWumpusConfiguration(null);
        setIsResolvingHazardTurn(false);
        return;
      }

      setPreviewWumpusConfiguration(pauseConfigurations[index]);
      index += 1;
    }, HAZARD_CONFIGURATION_STEP_MS);
  };

  const handleRestart = () => {
    clearResolveAnimation();
    setIsResolvingHazardTurn(false);
    setPreviewWumpusConfiguration(null);
    setPath([[1, 1]]);
    setTurn(0);
    setWumpusConfiguration(0);
    setTimeCost(0);
    setStenchCount(initialStenchCount);
    setStatus("active");
    nextLogId.current = 1;
    setLog([
      {
        id: 0,
        title: "Expedition restarted",
        summary:
          `The agent is back at the entrance. Try a new route and compare it against the optimal benchmark.${initialSummarySuffix}`,
        outcome: "active",
        turn: 0,
        wumpusConfiguration: 0,
        position: [1, 1],
        path: [[1, 1]],
        timeCost: 0,
        stenchCount: initialStenchCount,
        status: "active",
      },
    ]);
  };

  const benchmarkDelta =
    optimalSolution && status === "won" ? timeCost - optimalSolution.timeCost : null;

  return (
    <div className="space-y-6 animate-rise-in">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Turn", value: turn.toString(), tone: "text-primary" },
          {
            label: "Position",
            value: `(${currentPosition[0]}, ${currentPosition[1]})`,
            tone: "text-foreground",
          },
          { label: "Manual time", value: `${timeCost}s`, tone: "text-timezone" },
          { label: "Stench count", value: `${stenchCount}/3`, tone: "text-stench" },
        ].map((stat) => (
          <div key={stat.label} className="stat-shell p-5">
            <p className="section-kicker">{stat.label}</p>
            <p className={cn("mt-3 font-mono text-3xl font-semibold", stat.tone)}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="panel-shell">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="section-kicker">Manual expedition</p>
                <CardTitle className="text-2xl sm:text-3xl">Player-controlled run</CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  Move the agent yourself and compare your decisions against the best route
                  the solver could find for the same board.
                </CardDescription>
              </div>
              <Badge className="badge-shell gap-2 px-3 py-1.5 text-xs text-foreground">
                <Compass className="size-3.5 text-agent" />
                {isFinished
                  ? "Run finished"
                  : isResolvingHazardTurn
                    ? "Resolving turn shift"
                    : "Awaiting move"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="map-shell overflow-x-auto p-4 sm:p-6">
              <GameGrid grid={renderGrid} path={path} currentTurn={turn} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <div className="panel-subtle p-4">
                <p className="section-kicker">Move controls</p>
                <div className="mt-4 grid grid-cols-3 grid-rows-3 gap-2">
                  {directions.map(({ key, label, Icon, className }) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="icon"
                      onClick={() => handleMove(key)}
                      disabled={isFinished || isResolvingHazardTurn}
                      className={cn(
                        "size-14 rounded-2xl border-slate-700 bg-slate-950/90 text-foreground hover:bg-slate-900",
                        className
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="sr-only">{label}</span>
                    </Button>
                  ))}
                </div>

                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <span>Run state</span>
                    <span className="font-semibold text-foreground">
                      {isResolvingHazardTurn
                        ? "resolving shift"
                        : status === "active"
                          ? "active"
                          : status === "won"
                            ? "gold found"
                            : status === "wumpus"
                              ? "lost to Wumpus"
                              : status === "stench-limit"
                                ? "stench cap hit"
                                : "turn limit hit"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Current tile</span>
                    <span className="font-mono text-foreground">
                      ({currentPosition[0]}, {currentPosition[1]})
                    </span>
                  </div>
                </div>
                {isResolvingHazardTurn && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Pit/time-zone pause: Wumpus configuration is settling before the next move is allowed.
                  </p>
                )}
              </div>

              <div className="panel-subtle p-4">
                <p className="section-kicker">Latest prompt</p>
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="badge-shell px-3 py-1.5 text-xs text-foreground">
                      Turn {latestLog.turn}
                    </Badge>
                    <Badge className="badge-shell px-3 py-1.5 text-xs text-foreground">
                      Tile ({latestLog.position[0]}, {latestLog.position[1]})
                    </Badge>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{latestLog.title}</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {latestLog.summary}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="panel-shell">
            <CardHeader>
              <CardTitle className="text-xl">Benchmark</CardTitle>
              <CardDescription>
                Compare your manual run against the best safe route available.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="panel-subtle p-4 text-sm text-muted-foreground">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>Your path cost</span>
                    <span className="font-mono text-lg font-semibold text-timezone">
                      {timeCost}s
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Your steps</span>
                    <span className="font-mono text-foreground">{path.length}</span>
                  </div>
                </div>
                <p className="mt-4 font-mono text-xs leading-6 text-muted-foreground">
                  {manualRoutePreview}
                </p>
              </div>

              <div className="panel-subtle p-4 text-sm text-muted-foreground">
                {optimalSolution ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span>Optimal cost</span>
                      <span className="font-mono text-lg font-semibold text-gold">
                        {optimalSolution.timeCost}s
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Optimal steps</span>
                      <span className="font-mono text-foreground">
                        {optimalSolution.path.length}
                      </span>
                    </div>
                    {benchmarkDelta !== null && (
                      <div className="flex items-center justify-between gap-3">
                        <span>Difference</span>
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            benchmarkDelta === 0
                              ? "text-agent"
                              : benchmarkDelta > 0
                                ? "text-destructive"
                                : "text-agent"
                          )}
                        >
                          {benchmarkDelta > 0 ? `+${benchmarkDelta}s` : `${benchmarkDelta}s`}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p>
                    {failureReason ??
                      "No safe optimal route was found for this board, so the manual run has no benchmark replay available."}
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                onClick={onViewOptimal}
                disabled={!optimalSolution || isResolvingHazardTurn}
                className="h-12 w-full rounded-2xl border-slate-700 bg-slate-950/80 text-foreground"
              >
                <Route className="size-4" />
                View optimal simulation
              </Button>
            </CardContent>
          </Card>

          <Card className="panel-shell">
            <CardHeader>
              <CardTitle className="text-xl">Legend</CardTitle>
              <CardDescription>Tile meanings remain the same during manual play.</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3">
              {legendCells.map((type) => {
                const visual = getCellVisual(type);
                const Icon = visual.Icon;

                return (
                  <div key={type} className="panel-subtle flex items-center gap-3 p-3">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-2xl border",
                        visual.surfaceClass
                      )}
                    >
                      <Icon className={cn("size-4", visual.iconClass)} strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{visual.label}</p>
                      <p className="text-sm text-muted-foreground">{visual.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="panel-shell">
            <CardHeader>
              <CardTitle className="text-xl">Run history</CardTitle>
              <CardDescription>
                Each prompt records what the last move changed.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
                {log.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      if (isResolvingHazardTurn) return;
                      restoreToEntry(entry);
                    }}
                    className={cn(
                      "panel-subtle block w-full p-4 text-left transition-colors hover:border-primary/30 hover:bg-slate-900/95",
                      entry.id === log[0]?.id && "border-primary/35 bg-slate-900/95"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">{entry.title}</p>
                      <span className="font-mono text-xs text-muted-foreground">
                        t{entry.turn}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {entry.summary}
                    </p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.24em] text-primary/80">
                      Click to restore this move
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={handleRestart}
              disabled={isResolvingHazardTurn}
              className="h-12 rounded-2xl border-slate-700 bg-slate-950/80 text-foreground"
            >
              <RotateCcw className="size-4" />
              Restart manual run
            </Button>
            <Button
              variant="outline"
              onClick={onBackToEditor}
              disabled={isResolvingHazardTurn}
              className="h-12 rounded-2xl border-slate-700 bg-slate-950/80 text-foreground"
            >
              <Target className="size-4" />
              Back to editor
            </Button>
          </div>

          <div className="stat-shell flex items-start gap-3 p-5">
            {status === "wumpus" ? (
              <Skull className="mt-0.5 size-5 text-wumpus" />
            ) : (
              <Target className="mt-0.5 size-5 text-primary" />
            )}
            <div>
              <p className="section-kicker">Run note</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Manual play follows the same hazard rules as the solver. The entrance can still carry breeze or stench from adjacent hazards, and collision with a Wumpus or a third stench encounter ends the run immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
