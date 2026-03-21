"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { getCellVisual, legendCells } from "@/lib/wumpus-display";
import {
  WumpusWorld,
  buildPlaybackFrames,
  getRenderState,
  type CellType,
  type Position,
} from "@/lib/wumpus-world";
import { GameGrid } from "./game-grid";
import {
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  TimerReset,
  Waypoints,
} from "lucide-react";

interface SimulationPanelProps {
  grid: CellType[][];
  path: Position[];
  timeCost: number;
  success: boolean;
  stopReason: string | null;
  onReset: () => void;
}

export function SimulationPanel({
  grid,
  path,
  timeCost,
  success,
  stopReason,
  onReset,
}: SimulationPanelProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const world = useMemo(() => new WumpusWorld(grid.length, grid), [grid]);
  const playbackFrames = useMemo(() => buildPlaybackFrames(world, path), [world, path]);
  const frame = playbackFrames[currentFrame] ?? playbackFrames[0];
  const liveSnapshot = useMemo(() => getRenderState(world, path, frame?.pathStep ?? 0), [world, path, frame?.pathStep]);
  const progress = playbackFrames.length > 1 ? (currentFrame / (playbackFrames.length - 1)) * 100 : 100;
  const currentPosition = frame?.currentPosition ?? path[0];
  const nextPosition = frame && frame.pathStep < path.length - 1 ? path[frame.pathStep + 1] : undefined;
  const routePreview = path.map(([r, c]) => `(${r},${c})`).join(" -> ");
  const isComplete = currentFrame >= playbackFrames.length - 1;
  const routeEndedEarly = !success;
  const frameLabel =
    frame?.phase === "start"
      ? "Initial state"
      : frame?.phase === "shift"
        ? "Configuration shift"
        : "Turn settled";
  const frameAccumulatedTime = frame?.accumulatedTime ?? liveSnapshot.accumulatedTime;
  const frameStenchCount = frame?.stenchCount ?? liveSnapshot.stenchCount;
  const frameWumpusConfiguration =
    frame?.wumpusConfiguration ?? liveSnapshot.wumpusConfiguration;

  const advanceTurn = useEffectEvent(() => {
    setCurrentFrame((prev) => {
      if (prev >= playbackFrames.length - 1) {
        setIsPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  });

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    intervalRef.current = setInterval(() => {
      advanceTurn();
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, playbackFrames.length]);

  useEffect(() => {
    setCurrentFrame((prev) => Math.min(prev, Math.max(0, playbackFrames.length - 1)));
  }, [playbackFrames.length]);

  const handlePlayPause = () => {
    if (currentFrame >= playbackFrames.length - 1) {
      setCurrentFrame(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    setCurrentFrame((prev) => Math.max(0, prev - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentFrame((prev) => Math.min(playbackFrames.length - 1, prev + 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentFrame(0);
    onReset();
  };

  return (
    <div className="space-y-6 animate-rise-in">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Route step",
            value: frame ? frame.pathStep.toString() : "0",
            tone: "text-primary",
          },
          {
            label: "Position",
            value: `(${currentPosition?.[0]}, ${currentPosition?.[1]})`,
            tone: "text-foreground",
          },
          {
            label: "Elapsed time",
            value: `${frameAccumulatedTime}s`,
            tone: "text-timezone",
          },
          {
            label: "Stench count",
            value: `${frameStenchCount}/3`,
            tone: "text-stench",
          },
        ].map((stat) => (
          <div key={stat.label} className="stat-shell p-5">
            <p className="section-kicker">{stat.label}</p>
            <p className={cn("mt-3 font-mono text-3xl font-semibold", stat.tone)}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_21rem]">
        <Card className="panel-shell">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="section-kicker">Route replay</p>
                <CardTitle className="text-2xl sm:text-3xl">
                  {routeEndedEarly
                    ? isComplete
                      ? "Route halted"
                      : "Solver playback"
                    : isComplete
                      ? "Gold recovered"
                      : "Solver playback"}
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  Inspect how the chosen route navigates moving Wumpuses, hazard
                  penalties, and dynamic stench fields turn by turn.
                </CardDescription>
              </div>
              <Badge className="badge-shell gap-2 px-3 py-1.5 text-xs text-foreground">
                <Waypoints className="size-3.5 text-primary" />
                {path.length} path cells, {playbackFrames.length} replay frames
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge className="badge-shell px-3 py-1.5 text-xs text-foreground">
                {isComplete
                  ? routeEndedEarly
                    ? "Replay stopped"
                    : "Replay complete"
                  : isPlaying
                    ? "Autoplay engaged"
                    : "Paused"}
              </Badge>
              <Badge className="badge-shell px-3 py-1.5 text-xs text-foreground">
                {routeEndedEarly ? "Analyzed route cost" : "Final route cost"} {timeCost}s
              </Badge>
              {frame && (
                <Badge className="badge-shell px-3 py-1.5 text-xs text-foreground">
                  {frameLabel}
                </Badge>
              )}
            </div>

            <div className="map-shell overflow-x-auto p-4 sm:p-6">
              <GameGrid
                grid={frame?.renderGrid ?? []}
                path={path}
                currentTurn={frame?.pathStep ?? 0}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="panel-shell">
            <CardHeader>
              <CardTitle className="text-xl">Replay controls</CardTitle>
              <CardDescription>
                Step manually, autoplay the route, or jump back into the editor.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStepBack}
                  disabled={currentFrame === 0}
                  className="size-11 rounded-2xl border-slate-700 bg-slate-950/80"
                >
                  <SkipBack className="size-4" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={handlePlayPause}
                  className="size-14 rounded-3xl bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(157,82,49,0.22)]"
                >
                  {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStepForward}
                  disabled={currentFrame >= playbackFrames.length - 1}
                  className="size-11 rounded-2xl border-slate-700 bg-slate-950/80"
                >
                  <SkipForward className="size-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>
                    {currentFrame + 1} / {playbackFrames.length}
                  </span>
                </div>
                <Progress value={progress} className="h-2.5 bg-primary/10" />
                <Slider
                  value={[currentFrame]}
                  min={0}
                  max={Math.max(0, playbackFrames.length - 1)}
                  step={1}
                  onValueChange={([value]) => {
                    setIsPlaying(false);
                    setCurrentFrame(value);
                  }}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Playback speed</span>
                  <span>{speed}ms</span>
                </div>
                <Slider
                  value={[speed]}
                  min={100}
                  max={1500}
                  step={100}
                  onValueChange={([value]) => setSpeed(value)}
                />
              </div>

              <div className="panel-subtle p-4 text-sm text-muted-foreground">
                <p className="section-kicker">Live snapshot</p>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>Current tile</span>
                    <span className="font-mono text-foreground">
                      ({currentPosition?.[0]}, {currentPosition?.[1]})
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Next move</span>
                    <span className="font-mono text-foreground">
                      {nextPosition
                        ? `(${nextPosition[0]}, ${nextPosition[1]})`
                        : routeEndedEarly
                          ? "analysis stopped"
                          : "goal secured"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Wumpus turn</span>
                    <span className="font-mono text-foreground">
                      t={frameWumpusConfiguration}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Stench count</span>
                    <span className="font-mono text-foreground">
                      {frameStenchCount}/3
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Final cost</span>
                    <span className="font-mono text-foreground">{timeCost}s</span>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handleReset}
                className="h-12 w-full rounded-2xl border-slate-700 bg-slate-950/80 text-foreground"
              >
                <RotateCcw className="size-4" />
                Back to map editor
              </Button>
            </CardContent>
          </Card>

          <div className="stat-shell flex items-start gap-3 p-5">
            <TimerReset className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="section-kicker">Replay note</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Wumpus positions update before every agent move, and the replay reflects that turn-by-turn state directly.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <Card className="panel-shell">
          <CardHeader>
            <CardTitle className="text-xl">Route trace</CardTitle>
            <CardDescription>
              {routeEndedEarly
                ? "Replay of the analyzed route until the run became invalid."
                : "Full step sequence for the selected optimal route."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="panel-subtle p-4">
              <p className="font-mono text-xs leading-6 text-muted-foreground sm:text-sm">
                {routePreview}
              </p>
            </div>
            {routeEndedEarly && stopReason && (
              <div className="panel-subtle mt-4 p-4">
                <p className="section-kicker">Why it stopped</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{stopReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-shell">
          <CardHeader>
            <CardTitle className="text-xl">Legend</CardTitle>
            <CardDescription>Every tile state used in the replay overlay.</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 sm:grid-cols-2">
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
      </div>
    </div>
  );
}
