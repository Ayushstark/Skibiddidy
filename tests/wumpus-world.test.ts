import assert from "node:assert/strict";
import {
  WumpusWorld,
  buildPlaybackFrames,
  evaluateManualMove,
  getGridConstraints,
  type CellType,
} from "../lib/wumpus-world";

function testWumpusMovementPattern() {
  const grid: CellType[][] = [
    [".", ".", ".", ".", "."],
    [".", "W", ".", ".", "."],
    [".", ".", "W", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "G"],
  ];

  const world = new WumpusWorld(5, grid);
  const evenRowCols = [1, 2, 3, 4].map((turn) => world.getWumpusPos(2, 2, turn)[1]);
  const oddRowCols = [1, 2, 3, 4].map((turn) => world.getWumpusPos(3, 3, turn)[1]);

  assert.deepEqual(evenRowCols, [4, 2, 4, 2]);
  assert.deepEqual(oddRowCols, [2, 4, 2, 4]);
}

function testOverlappingWumpusCollapse() {
  const grid: CellType[][] = [
    ["W", "W", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "G"],
  ];

  const world = new WumpusWorld(5, grid);
  const positions = world.getAllWumpusesAtConfiguration(1);
  assert.equal(positions.length, 1);
  assert.deepEqual(positions[0], [1, 2]);
}

function testSymbolRulesAndPercepts() {
  const perceptGrid: CellType[][] = [
    [".", "W", "P", "T", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "G"],
  ];

  const perceptWorld = new WumpusWorld(5, perceptGrid);
  const startPercepts = perceptWorld.getCellPercepts([1, 1], 0);
  assert.equal(startPercepts.hasStench, true);
  assert.equal(startPercepts.hasBreeze, false);

  const wumpusGrid: CellType[][] = [
    [".", ".", ".", ".", "."],
    [".", ".", ".", "W", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "G"],
  ];
  const wumpusWorld = new WumpusWorld(5, wumpusGrid);
  const intoWumpus = evaluateManualMove(wumpusWorld, [1, 4], "down", 0, 0, 0, 0, [[1, 4]]);
  assert.equal(intoWumpus.outcome, "wumpus");

  const costGrid: CellType[][] = [
    [".", "P", "T", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "G"],
  ];
  const costWorld = new WumpusWorld(5, costGrid);
  const intoPit = evaluateManualMove(costWorld, [1, 1], "right", 0, 0, 0, 0, [
    [1, 1],
  ]);
  assert.equal(intoPit.outcome, "moved");
  assert.equal(intoPit.timeDelta, 6);
  assert.equal(intoPit.totalTime, 6);

  const intoTimeZone = evaluateManualMove(costWorld, [1, 2], "right", 1, 6, 0, 1, [
    [1, 1],
    [1, 2],
  ]);
  assert.equal(intoTimeZone.outcome, "moved");
  assert.equal(intoTimeZone.timeDelta, 0);
  assert.equal(intoTimeZone.totalTime, 6);
}

function testStenchLimit() {
  const grid: CellType[][] = [
    [".", "W", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "G"],
  ];

  const world = new WumpusWorld(5, grid);
  const result = evaluateManualMove(world, [1, 4], "left", 0, 0, 2, 0, [[1, 4]]);
  assert.equal(result.outcome, "stench-limit");
}

function testHazardConfigurationShifts() {
  const grid: CellType[][] = [
    [".", "P", "T", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "G"],
  ];

  const world = new WumpusWorld(5, grid);
  const intoPit = evaluateManualMove(world, [1, 1], "right", 0, 0, 0, 0, [[1, 1]]);
  assert.equal(intoPit.outcome, "moved");
  assert.equal(intoPit.turn, 1);
  assert.equal(intoPit.wumpusConfiguration, 6);

  const intoTimeZone = evaluateManualMove(world, [1, 2], "right", 1, 6, 0, 6, [
    [1, 1],
    [1, 2],
  ]);
  assert.equal(intoTimeZone.outcome, "moved");
  assert.equal(intoTimeZone.turn, 2);
  assert.equal(intoTimeZone.wumpusConfiguration, 4);
}

function testTurnLimitEnforced() {
  const grid: CellType[][] = [
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "G"],
  ];

  const world = new WumpusWorld(5, grid);
  const turnLimit = getGridConstraints(5).turnLimit;
  const result = evaluateManualMove(
    world,
    [1, 1],
    "right",
    turnLimit,
    0,
    0,
    0,
    [[1, 1]]
  );
  assert.equal(result.outcome, "turn-limit");
}

function testPlaybackShiftAfterEnteringPitOrTimeZone() {
  const grid: CellType[][] = [
    [".", "P", "T", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "."],
    [".", ".", ".", ".", "G"],
  ];
  const world = new WumpusWorld(5, grid);
  const path: [number, number][] = [
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
  ];

  const frames = buildPlaybackFrames(world, path);
  const moveStep1 = frames.find((frame) => frame.phase === "move" && frame.pathStep === 1);
  const moveStep2 = frames.find((frame) => frame.phase === "move" && frame.pathStep === 2);
  const moveStep3 = frames.find((frame) => frame.phase === "move" && frame.pathStep === 3);
  const pitShiftConfigs = frames
    .filter((frame) => frame.phase === "shift" && frame.pathStep === 1)
    .map((frame) => frame.wumpusConfiguration);
  const timeZoneShiftConfigs = frames
    .filter((frame) => frame.phase === "shift" && frame.pathStep === 2)
    .map((frame) => frame.wumpusConfiguration);

  assert.equal(moveStep1?.wumpusConfiguration, 1);
  assert.deepEqual(pitShiftConfigs, [2, 3, 4, 5, 6]);
  assert.equal(moveStep2?.wumpusConfiguration, 7);
  assert.deepEqual(timeZoneShiftConfigs, [6, 5, 4]);
  assert.equal(moveStep3?.wumpusConfiguration, 5);
}

function run() {
  testWumpusMovementPattern();
  testOverlappingWumpusCollapse();
  testSymbolRulesAndPercepts();
  testStenchLimit();
  testHazardConfigurationShifts();
  testTurnLimitEnforced();
  testPlaybackShiftAfterEnteringPitOrTimeZone();
  console.log("All wumpus-world tests passed.");
}

run();
