export type CellType = '.' | 'W' | 'P' | 'T' | 'G';
export type Position = [number, number];
export type MoveDirection = 'up' | 'down' | 'left' | 'right';

interface Wumpus {
  row: number;
  startCol: number;
}

export interface SolveResult {
  success: boolean;
  timeCost: number;
  path: Position[];
  failureReason?: string;
  stopReason?: string;
}

export interface GridCounts {
  wumpuses: number;
  pits: number;
  timeZones: number;
  gold: number;
}

export interface GridConstraints {
  minSize: number;
  maxSize: number;
  maxWumpuses: number;
  maxPits: number;
  maxTimeZones: number;
  turnLimit: number;
}

interface SolveDiagnostics {
  exploredStates: number;
  outOfBoundsBlocks: number;
  revisitBlocks: number;
  wumpusBlocks: number;
  stenchBlocks: number;
  turnLimitBlocks: number;
}

interface HaltedAttempt {
  path: Position[];
  timeCost: number;
  distanceToGold: number;
  stopReason: string;
}

export interface ManualMoveResult {
  outcome: 'blocked' | 'moved' | 'goal' | 'wumpus' | 'stench-limit' | 'turn-limit';
  blockReason?: 'boundary' | 'revisit';
  attemptedPosition: Position;
  nextPosition: Position;
  turn: number;
  wumpusConfiguration: number;
  timeDelta: number;
  totalTime: number;
  stenchCount: number;
  hasStench: boolean;
  hasBreeze: boolean;
  cellType: CellType;
  wumpusPositions: Position[];
}

export interface PlaybackFrame {
  renderGrid: string[][];
  accumulatedTime: number;
  stenchCount: number;
  wumpusConfiguration: number;
  wPositions: Position[];
  currentPosition: Position;
  pathStep: number;
  phase: 'start' | 'move' | 'shift';
  shiftDirection: -1 | 0 | 1;
  shiftIndex: number;
  shiftTotal: number;
}

const directionVectors: Record<MoveDirection, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

export function getGridConstraints(size: number): GridConstraints {
  const specialTileLimit = Math.floor((size * size) / 5);

  return {
    minSize: 5,
    maxSize: 15,
    maxWumpuses: size,
    maxPits: specialTileLimit,
    maxTimeZones: specialTileLimit,
    turnLimit: 4 * size * size,
  };
}

export function getGridCounts(grid: CellType[][]): GridCounts {
  return grid.flat().reduce<GridCounts>(
    (counts, cell) => {
      if (cell === 'W') counts.wumpuses++;
      if (cell === 'P') counts.pits++;
      if (cell === 'T') counts.timeZones++;
      if (cell === 'G') counts.gold++;
      return counts;
    },
    { wumpuses: 0, pits: 0, timeZones: 0, gold: 0 }
  );
}

export function getWumpusConfigurationDelta(): number {
  return 1;
}

export function advanceWumpusConfiguration(currentConfiguration: number) {
  return Math.max(0, currentConfiguration + getWumpusConfigurationDelta());
}

export function getCellConfigurationShift(cellType: CellType): number {
  if (cellType === "P") {
    return 5;
  }

  if (cellType === "T") {
    return -3;
  }

  return 0;
}

export function getConfigurationTransitionSequence(
  currentConfiguration: number,
  delta: number
): number[] {
  if (delta === 0) {
    return [];
  }

  const direction = delta > 0 ? 1 : -1;
  const steps = Math.abs(delta);
  const sequence: number[] = [];
  let nextConfiguration = currentConfiguration;

  for (let step = 0; step < steps; step++) {
    nextConfiguration = Math.max(0, nextConfiguration + direction);
    if (sequence[sequence.length - 1] !== nextConfiguration) {
      sequence.push(nextConfiguration);
    }
    if (nextConfiguration === 0 && direction < 0) {
      break;
    }
  }

  return sequence;
}

export function applyCellConfigurationShift(
  currentConfiguration: number,
  cellType: CellType
) {
  const transition = getConfigurationTransitionSequence(
    currentConfiguration,
    getCellConfigurationShift(cellType)
  );

  if (transition.length === 0) {
    return currentConfiguration;
  }

  return transition[transition.length - 1];
}

export function getMoveTimeDelta(cellType: CellType, hasBreeze: boolean) {
  if (cellType === 'G') {
    return 1;
  }

  let delta = 1;
  if (cellType === 'P') delta += 5;
  if (hasBreeze) delta += 2;
  if (cellType === 'T') delta -= 3;
  return delta;
}

function getWumpusTurnSteps(row: number, turn: number) {
  const isEvenRow = row % 2 === 0;
  // Strict PDF interpretation: first pre-move update is Turn A, then A/B/A/B...
  const isTurnA = turn % 2 !== 0;

  if (isEvenRow) {
    return isTurnA ? [1, 1, 1, -1] : [1, -1, -1, -1];
  }

  return isTurnA ? [-1, -1, -1, 1] : [-1, 1, 1, 1];
}

function getPathKey(path: Position[]) {
  return path
    .map(([row, col]) => `${row.toString().padStart(2, "0")},${col.toString().padStart(2, "0")}`)
    .join("|");
}

function getPositionKey([row, col]: Position) {
  return `${row.toString().padStart(2, "0")},${col.toString().padStart(2, "0")}`;
}

function getUniquePositions(positions: Position[]) {
  // Overlapping Wumpuses are treated as a single occupied cell.
  const uniquePositions = new Map<string, Position>();

  for (const position of positions) {
    const key = getPositionKey(position);
    if (!uniquePositions.has(key)) {
      uniquePositions.set(key, position);
    }
  }

  return [...uniquePositions.values()];
}

function getVisitedIndex(position: Position, size: number) {
  return (position[0] - 1) * size + (position[1] - 1);
}

function hasVisitedPosition(mask: string, position: Position, size: number) {
  return mask[getVisitedIndex(position, size)] === "1";
}

function updateVisitedMask(mask: string, position: Position, size: number) {
  const index = getVisitedIndex(position, size);
  return `${mask.slice(0, index)}1${mask.slice(index + 1)}`;
}

function buildOptimisticCostTable(world: WumpusWorld) {
  const totalCells = world.n * world.n;
  const indexOf = ([row, col]: Position) => (row - 1) * world.n + (col - 1);
  const neighbors: Position[][] = Array.from({ length: totalCells }, () => []);
  const entryCosts = Array(totalCells).fill(0);

  for (let row = 1; row <= world.n; row++) {
    for (let col = 1; col <= world.n; col++) {
      const position: Position = [row, col];
      const idx = indexOf(position);
      const cellType = world.grid[row - 1][col - 1];
      const hasBreeze = world.pits.some(
        ([pitRow, pitCol]) =>
          (Math.abs(pitRow - row) === 1 && pitCol === col) ||
          (Math.abs(pitCol - col) === 1 && pitRow === row)
      );
      entryCosts[idx] = getMoveTimeDelta(cellType, hasBreeze);

      const deltas: [number, number][] = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ];

      for (const [dr, dc] of deltas) {
        const nextRow = row + dr;
        const nextCol = col + dc;

        if (nextRow >= 1 && nextRow <= world.n && nextCol >= 1 && nextCol <= world.n) {
          neighbors[idx].push([nextRow, nextCol]);
        }
      }
    }
  }

  const goalIdx = indexOf(world.goldPos!);
  const dp = Array.from({ length: totalCells + 1 }, () =>
    Array(totalCells).fill(Number.POSITIVE_INFINITY)
  );
  dp[0][goalIdx] = 0;

  for (let steps = 1; steps <= totalCells; steps++) {
    for (let idx = 0; idx < totalCells; idx++) {
      let best = dp[steps - 1][idx];

      for (const neighbor of neighbors[idx]) {
        const neighborIdx = indexOf(neighbor);
        const candidate = entryCosts[neighborIdx] + dp[steps - 1][neighborIdx];
        if (candidate < best) {
          best = candidate;
        }
      }

      dp[steps][idx] = best;
    }
  }

  return (position: Position, maxSteps: number) =>
    dp[Math.max(0, Math.min(maxSteps, totalCells))][indexOf(position)];
}

function compareQueueItems(
  a: {
    optimisticFinalCost: number;
    timeCost: number;
    pathKey: string;
  },
  b: {
    optimisticFinalCost: number;
    timeCost: number;
    pathKey: string;
  }
) {
  const optimisticDiff = a.optimisticFinalCost - b.optimisticFinalCost;
  if (optimisticDiff !== 0) return optimisticDiff;

  const costDiff = a.timeCost - b.timeCost;
  if (costDiff !== 0) return costDiff;

  return a.pathKey.localeCompare(b.pathKey);
}

function getInitialPercepts(world: WumpusWorld) {
  return world.getCellPercepts([1, 1], 0);
}

function getDistanceToGold(world: WumpusWorld, pos: Position) {
  if (!world.goldPos) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(world.goldPos[0] - pos[0]) + Math.abs(world.goldPos[1] - pos[1]);
}

function shouldReplaceAttempt(current: HaltedAttempt | null, next: HaltedAttempt) {
  if (!current) {
    return true;
  }

  if (next.distanceToGold !== current.distanceToGold) {
    return next.distanceToGold < current.distanceToGold;
  }

  if (next.timeCost !== current.timeCost) {
    return next.timeCost < current.timeCost;
  }

  if (next.path.length !== current.path.length) {
    return next.path.length > current.path.length;
  }

  return getPathKey(next.path).localeCompare(getPathKey(current.path)) < 0;
}

function getFailureReason(diagnostics: SolveDiagnostics): string {
  if (diagnostics.exploredStates === 0) {
    return "The start area has no safe outgoing move under the current Wumpus timing.";
  }

  if (diagnostics.wumpusBlocks > 0 && diagnostics.stenchBlocks > 0) {
    return "Every reachable route is cut off: some branches are intercepted by moving Wumpuses, while the rest exceed the stench limit before reaching the gold.";
  }

  if (diagnostics.wumpusBlocks > 0) {
    return "Moving Wumpus positions intercept every safe route to the gold before the agent can arrive.";
  }

  if (diagnostics.stenchBlocks > 0) {
    return "All reachable routes require a third stench encounter, so the gold cannot be reached within the safety limit.";
  }

  if (diagnostics.turnLimitBlocks > 0) {
    return "No valid route reached the gold before the 4n^2 turn cap.";
  }

  return "No safe path to the gold exists under the current movement and hazard rules.";
}

export class WumpusWorld {
  n: number;
  grid: CellType[][];
  wumpuses: Wumpus[];
  pits: Position[];
  timeZones: Position[];
  goldPos: Position | null;
  startPos: Position;
  wumpusPositionCache: Map<string, Position>;
  allWumpusesCache: Map<number, Position[]>;

  constructor(size: number, grid: CellType[][]) {
    this.n = size;
    this.grid = grid;
    this.wumpuses = [];
    this.pits = [];
    this.timeZones = [];
    this.goldPos = null;
    this.startPos = [1, 1];
    this.wumpusPositionCache = new Map();
    this.allWumpusesCache = new Map();

    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        const cell = this.grid[r][c];
        const pos: Position = [r + 1, c + 1];
        if (cell === 'W') {
          this.wumpuses.push({ row: r + 1, startCol: c + 1 });
        } else if (cell === 'P') {
          this.pits.push(pos);
        } else if (cell === 'T') {
          this.timeZones.push(pos);
        } else if (cell === 'G') {
          this.goldPos = pos;
        }
      }
    }
  }

  getWumpusPos(startCol: number, row: number, configuration: number): Position {
    const normalizedConfiguration = Math.max(0, configuration);
    const cacheKey = `${row},${startCol},${normalizedConfiguration}`;
    const cachedPosition = this.wumpusPositionCache.get(cacheKey);
    if (cachedPosition) {
      return cachedPosition;
    }

    let currentCol = startCol;

    for (let t = 1; t <= normalizedConfiguration; t++) {
      const steps = getWumpusTurnSteps(row, t);
      for (const step of steps) {
        const nextCol = currentCol + step;
        if (nextCol >= 1 && nextCol <= this.n) {
          currentCol = nextCol;
        }
      }
    }

    const position: Position = [row, currentCol];
    this.wumpusPositionCache.set(cacheKey, position);
    return position;
  }

  getAllWumpusesAtConfiguration(configuration: number): Position[] {
    const normalizedConfiguration = Math.max(0, configuration);
    const cachedPositions = this.allWumpusesCache.get(normalizedConfiguration);
    if (cachedPositions) {
      return cachedPositions;
    }

    const positions = getUniquePositions(
      this.wumpuses.map((w) =>
        this.getWumpusPos(w.startCol, w.row, normalizedConfiguration)
      )
    );
    this.allWumpusesCache.set(normalizedConfiguration, positions);
    return positions;
  }

  getCellPercepts(pos: Position, configuration: number): { hasStench: boolean; hasBreeze: boolean } {
    const [r, c] = pos;
    const wPositions = this.getAllWumpusesAtConfiguration(configuration);

    let hasStench = false;
    for (const [wr, wc] of wPositions) {
      if ((Math.abs(wr - r) === 1 && wc === c) || (Math.abs(wc - c) === 1 && wr === r)) {
        hasStench = true;
        break;
      }
    }

    let hasBreeze = false;
    for (const [pr, pc] of this.pits) {
      if ((Math.abs(pr - r) === 1 && pc === c) || (Math.abs(pc - c) === 1 && pr === r)) {
        hasBreeze = true;
        break;
      }
    }

    return { hasStench, hasBreeze };
  }

  solve(): SolveResult {
    if (!this.goldPos) {
      return {
        success: false,
        timeCost: 0,
        path: [],
        failureReason: "Place a gold tile before running the solver.",
      };
    }
    const constraints = getGridConstraints(this.n);
    const totalCells = this.n * this.n;

    type QueueItem = {
      timeCost: number;
      path: Position[];
      pathKey: string;
      visitedMask: string;
      turn: number;
      stenchCount: number;
      wumpusConfiguration: number;
      optimisticFinalCost: number;
    };

    const initialPercepts = getInitialPercepts(this);
    const initialPathKey = getPositionKey([1, 1]);
    const initialVisitedMask = updateVisitedMask("0".repeat(totalCells), [1, 1], this.n);
    const optimisticCostFrom = buildOptimisticCostTable(this);
    const initialOptimisticAdditional = optimisticCostFrom([1, 1], totalCells - 1);

    const buildNextState = (
      current: {
        timeCost: number;
        path: Position[];
        pathKey: string;
        visitedMask: string;
        turn: number;
        stenchCount: number;
        wumpusConfiguration: number;
      },
      nextPosition: Position
    ): QueueItem | null => {
      const nextTurn = current.turn + 1;
      if (nextTurn > constraints.turnLimit) {
        return null;
      }

      const [nextRow, nextCol] = nextPosition;
      const cellType = this.grid[nextRow - 1][nextCol - 1];
      const landingWumpusConfiguration = advanceWumpusConfiguration(current.wumpusConfiguration);
      const wPositions = this.getAllWumpusesAtConfiguration(landingWumpusConfiguration);

      if (wPositions.some(([wr, wc]) => wr === nextRow && wc === nextCol)) {
        return null;
      }

      const { hasStench, hasBreeze } = this.getCellPercepts(
        nextPosition,
        landingWumpusConfiguration
      );
      const nextStenchCount = current.stenchCount + (hasStench ? 1 : 0);

      if (nextStenchCount >= 3) {
        return null;
      }

      const nextTimeCost = Math.max(0, current.timeCost + getMoveTimeDelta(cellType, hasBreeze));
      const nextPath = [...current.path, nextPosition];
      const remainingMoves = Math.min(constraints.turnLimit - nextTurn, totalCells - nextPath.length);
      const optimisticAdditional = optimisticCostFrom(nextPosition, remainingMoves);
      const optimisticFinalCost =
        optimisticAdditional === Number.POSITIVE_INFINITY
          ? Number.POSITIVE_INFINITY
          : Math.max(0, nextTimeCost + optimisticAdditional);
      const nextWumpusConfiguration = applyCellConfigurationShift(
        landingWumpusConfiguration,
        cellType
      );

      return {
        timeCost: nextTimeCost,
        path: nextPath,
        pathKey: `${current.pathKey}|${getPositionKey(nextPosition)}`,
        visitedMask: updateVisitedMask(current.visitedMask, nextPosition, this.n),
        turn: nextTurn,
        stenchCount: nextStenchCount,
        wumpusConfiguration: nextWumpusConfiguration,
        optimisticFinalCost,
      };
    };

    const findSeedGoal = () => {
      let explored = 0;
      // Keep seed-search lightweight to avoid long blocking setup costs.
      const seedStateLimit = Math.max(2000, this.n * this.n * 50);
      const stack: QueueItem[] = [
        {
          timeCost: 0,
          path: [[1, 1]],
          pathKey: initialPathKey,
          visitedMask: initialVisitedMask,
          turn: 0,
          stenchCount: initialPercepts.hasStench ? 1 : 0,
          wumpusConfiguration: 0,
          optimisticFinalCost:
            initialOptimisticAdditional === Number.POSITIVE_INFINITY
              ? Number.POSITIVE_INFINITY
              : Math.max(0, initialOptimisticAdditional),
        },
      ];

      while (stack.length > 0) {
        explored++;
        if (explored > seedStateLimit) {
          break;
        }
        const current = stack.pop()!;
        const [row, col] = current.path[current.path.length - 1];

        if (row === this.goldPos![0] && col === this.goldPos![1]) {
          return { success: true, timeCost: current.timeCost, path: current.path } satisfies SolveResult;
        }

        const candidates: QueueItem[] = [];
        const deltas: [number, number][] = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ];

        for (const [dr, dc] of deltas) {
          const nextRow = row + dr;
          const nextCol = col + dc;
          const nextPosition: Position = [nextRow, nextCol];

          if (nextRow < 1 || nextRow > this.n || nextCol < 1 || nextCol > this.n) {
            continue;
          }

          if (hasVisitedPosition(current.visitedMask, nextPosition, this.n)) {
            continue;
          }

          const nextState = buildNextState(current, nextPosition);
          if (nextState) {
            candidates.push(nextState);
          }
        }

        candidates.sort(compareQueueItems);
        for (let index = candidates.length - 1; index >= 0; index--) {
          stack.push(candidates[index]);
        }
      }

      return null;
    };

    const pq: QueueItem[] = [];
    const pushQueue = (item: QueueItem) => {
      pq.push(item);
      let index = pq.length - 1;

      while (index > 0) {
        const parentIndex = Math.floor((index - 1) / 2);
        if (compareQueueItems(pq[index], pq[parentIndex]) >= 0) {
          break;
        }

        [pq[index], pq[parentIndex]] = [pq[parentIndex], pq[index]];
        index = parentIndex;
      }
    };
    const popQueue = () => {
      if (pq.length === 0) {
        return null;
      }

      const top = pq[0];
      const last = pq.pop()!;

      if (pq.length > 0) {
        pq[0] = last;
        let index = 0;

        while (true) {
          const leftIndex = index * 2 + 1;
          const rightIndex = leftIndex + 1;
          let smallestIndex = index;

          if (
            leftIndex < pq.length &&
            compareQueueItems(pq[leftIndex], pq[smallestIndex]) < 0
          ) {
            smallestIndex = leftIndex;
          }

          if (
            rightIndex < pq.length &&
            compareQueueItems(pq[rightIndex], pq[smallestIndex]) < 0
          ) {
            smallestIndex = rightIndex;
          }

          if (smallestIndex === index) {
            break;
          }

          [pq[index], pq[smallestIndex]] = [pq[smallestIndex], pq[index]];
          index = smallestIndex;
        }
      }

      return top;
    };
    const visited = new Map<string, Map<string, { cost: number; pathKey: string }>>();
    let bestGoal: SolveResult | null = findSeedGoal();
    let bestGoalPathKey = bestGoal ? getPathKey(bestGoal.path) : null;
    let bestAttempt: HaltedAttempt | null = null;
    const diagnostics: SolveDiagnostics = {
      exploredStates: 0,
      outOfBoundsBlocks: 0,
      revisitBlocks: 0,
      wumpusBlocks: 0,
      stenchBlocks: 0,
      turnLimitBlocks: 0,
    };

    const registerAttempt = (attempt: HaltedAttempt) => {
      if (shouldReplaceAttempt(bestAttempt, attempt)) {
        bestAttempt = attempt;
      }
    };

    pushQueue({
      timeCost: 0,
      path: [[1, 1]],
      pathKey: initialPathKey,
      visitedMask: initialVisitedMask,
      turn: 0,
      stenchCount: initialPercepts.hasStench ? 1 : 0,
      wumpusConfiguration: 0,
      optimisticFinalCost:
        initialOptimisticAdditional === Number.POSITIVE_INFINITY
          ? Number.POSITIVE_INFINITY
          : Math.max(0, initialOptimisticAdditional),
    });

    while (pq.length > 0) {
      const current = popQueue()!;
      const { timeCost, path, pathKey, visitedMask, turn, stenchCount, wumpusConfiguration, optimisticFinalCost } = current;
      const [row, col] = path[path.length - 1];

      if (bestGoal && optimisticFinalCost > bestGoal.timeCost) {
        continue;
      }

      const stateKey = `${row},${col},${turn},${stenchCount},${wumpusConfiguration}`;
      const stateVisits = visited.get(stateKey);
      const previousVisit = stateVisits?.get(visitedMask);
      if (previousVisit) {
        if (timeCost > previousVisit.cost) {
          continue;
        }

        if (timeCost === previousVisit.cost && pathKey >= previousVisit.pathKey) {
          continue;
        }
      }
      if (!stateVisits) {
        visited.set(stateKey, new Map([[visitedMask, { cost: timeCost, pathKey }]]));
      } else {
        stateVisits.set(visitedMask, { cost: timeCost, pathKey });
      }
      diagnostics.exploredStates++;

      if (row === this.goldPos![0] && col === this.goldPos![1]) {
        if (
          !bestGoal ||
          timeCost < bestGoal.timeCost ||
          (timeCost === bestGoal.timeCost &&
            (bestGoalPathKey === null || pathKey.localeCompare(bestGoalPathKey) < 0))
        ) {
          bestGoal = { success: true, timeCost, path };
          bestGoalPathKey = pathKey;
        }
        continue;
      }

      if (turn >= constraints.turnLimit) {
        diagnostics.turnLimitBlocks++;
        registerAttempt({
          path,
          timeCost,
          distanceToGold: getDistanceToGold(this, [row, col]),
          stopReason: `The route halted at (${row}, ${col}) because the turn limit of 4n^2 was reached before the gold could be reached.`,
        });
        continue;
      }

      const moves: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      let validMoves = 0;
      let localWumpusBlocks = 0;
      let localStenchBlocks = 0;
      let localRevisitBlocks = 0;
      let localBoundaryBlocks = 0;

      for (const [dr, dc] of moves) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        const nextPosition: Position = [nextRow, nextCol];

        if (nextRow < 1 || nextRow > this.n || nextCol < 1 || nextCol > this.n) {
          diagnostics.outOfBoundsBlocks++;
          localBoundaryBlocks++;
          continue;
        }

        if (hasVisitedPosition(visitedMask, nextPosition, this.n)) {
          diagnostics.revisitBlocks++;
          localRevisitBlocks++;
          continue;
        }

        const nextTurn = turn + 1;
        const nextWumpusConfiguration = advanceWumpusConfiguration(wumpusConfiguration);
        const wPositions = this.getAllWumpusesAtConfiguration(nextWumpusConfiguration);

        if (wPositions.some(([wr, wc]) => wr === nextRow && wc === nextCol)) {
          diagnostics.wumpusBlocks++;
          localWumpusBlocks++;
          registerAttempt({
            path: [...path, nextPosition],
            timeCost,
            distanceToGold: getDistanceToGold(this, nextPosition),
            stopReason: `The route halted at turn ${nextTurn} because moving into (${nextRow}, ${nextCol}) would place the agent directly on a Wumpus after the Wumpuses shifted.`,
          });
          continue;
        }

        const { hasStench } = this.getCellPercepts(nextPosition, nextWumpusConfiguration);
        const nextStenchCount = stenchCount + (hasStench ? 1 : 0);

        if (nextStenchCount >= 3) {
          diagnostics.stenchBlocks++;
          localStenchBlocks++;
          registerAttempt({
            path: [...path, nextPosition],
            timeCost,
            distanceToGold: getDistanceToGold(this, nextPosition),
            stopReason: `The route halted at turn ${nextTurn} because entering (${nextRow}, ${nextCol}) would trigger the third stench encounter and invalidate the run.`,
          });
          continue;
        }

        const nextState = buildNextState(current, nextPosition);
        if (!nextState) {
          continue;
        }

        if (bestGoal && nextState.optimisticFinalCost > bestGoal.timeCost) {
          continue;
        }

        validMoves++;
        pushQueue(nextState);
      }

      if (validMoves === 0) {
        let stopReason =
          `The route halted at (${row}, ${col}) because no legal onward move remained under the current rules.`;

        if (localWumpusBlocks > 0 && localStenchBlocks > 0) {
          stopReason =
            `The route halted at (${row}, ${col}) because every onward move was blocked: some were intercepted by Wumpuses and the rest would exceed the stench limit.`;
        } else if (localWumpusBlocks > 0) {
          stopReason =
            `The route halted at (${row}, ${col}) because every onward move would be intercepted by a Wumpus after the next shift.`;
        } else if (localStenchBlocks > 0) {
          stopReason =
            `The route halted at (${row}, ${col}) because every onward move would trigger the third stench encounter.`;
        } else if (localRevisitBlocks > 0 || localBoundaryBlocks > 0) {
          stopReason =
            `The route halted at (${row}, ${col}) because the remaining moves would either revisit an earlier cell or leave the board.`;
        }

        registerAttempt({
          path,
          timeCost,
          distanceToGold: getDistanceToGold(this, [row, col]),
          stopReason,
        });
      }
    }

    if (bestGoal) {
      return bestGoal;
    }

    const finalAttempt = bestAttempt as HaltedAttempt | null;

    if (finalAttempt) {
      return {
        success: false,
        timeCost: finalAttempt.timeCost,
        path: finalAttempt.path,
        failureReason: getFailureReason(diagnostics),
        stopReason: finalAttempt.stopReason,
      };
    }

    return {
      success: false,
      timeCost: 0,
      path: [],
      failureReason: getFailureReason(diagnostics),
    };
  }
}

export function evaluateManualMove(
  world: WumpusWorld,
  currentPosition: Position,
  direction: MoveDirection,
  currentTurn: number,
  currentTime: number,
  currentStenchCount: number,
  currentWumpusConfiguration: number,
  currentPath: Position[]
): ManualMoveResult {
  const constraints = getGridConstraints(world.n);
  const [dr, dc] = directionVectors[direction];
  const attemptedPosition: Position = [currentPosition[0] + dr, currentPosition[1] + dc];
  const [nr, nc] = attemptedPosition;

  if (currentTurn + 1 > constraints.turnLimit) {
    return {
      outcome: 'turn-limit',
      attemptedPosition,
      nextPosition: currentPosition,
      turn: currentTurn,
      wumpusConfiguration: currentWumpusConfiguration,
      timeDelta: 0,
      totalTime: currentTime,
      stenchCount: currentStenchCount,
      hasStench: false,
      hasBreeze: false,
      cellType: world.grid[currentPosition[0] - 1][currentPosition[1] - 1],
      wumpusPositions: world.getAllWumpusesAtConfiguration(currentWumpusConfiguration),
    };
  }

  if (currentPath.some(([row, col]) => row === nr && col === nc)) {
    return {
      outcome: 'blocked',
      blockReason: 'revisit',
      attemptedPosition,
      nextPosition: currentPosition,
      turn: currentTurn,
      wumpusConfiguration: currentWumpusConfiguration,
      timeDelta: 0,
      totalTime: currentTime,
      stenchCount: currentStenchCount,
      hasStench: false,
      hasBreeze: false,
      cellType: world.grid[currentPosition[0] - 1][currentPosition[1] - 1],
      wumpusPositions: world.getAllWumpusesAtConfiguration(currentWumpusConfiguration),
    };
  }

  if (nr < 1 || nr > world.n || nc < 1 || nc > world.n) {
    return {
      outcome: 'blocked',
      blockReason: 'boundary',
      attemptedPosition,
      nextPosition: currentPosition,
      turn: currentTurn,
      wumpusConfiguration: currentWumpusConfiguration,
      timeDelta: 0,
      totalTime: currentTime,
      stenchCount: currentStenchCount,
      hasStench: false,
      hasBreeze: false,
      cellType: world.grid[currentPosition[0] - 1][currentPosition[1] - 1],
      wumpusPositions: world.getAllWumpusesAtConfiguration(currentWumpusConfiguration),
    };
  }

  const nextTurn = currentTurn + 1;
  const cellType = world.grid[nr - 1][nc - 1];
  const landingWumpusConfiguration = advanceWumpusConfiguration(currentWumpusConfiguration);
  const wumpusPositions = world.getAllWumpusesAtConfiguration(landingWumpusConfiguration);

  if (wumpusPositions.some(([wr, wc]) => wr === nr && wc === nc)) {
    return {
      outcome: 'wumpus',
      attemptedPosition,
      nextPosition: attemptedPosition,
      turn: nextTurn,
      wumpusConfiguration: landingWumpusConfiguration,
      timeDelta: 0,
      totalTime: currentTime,
      stenchCount: currentStenchCount,
      hasStench: false,
      hasBreeze: false,
      cellType,
      wumpusPositions,
    };
  }

  const { hasStench, hasBreeze } = world.getCellPercepts(
    attemptedPosition,
    landingWumpusConfiguration
  );
  const nextStenchCount = currentStenchCount + (hasStench ? 1 : 0);

  if (nextStenchCount >= 3) {
    return {
      outcome: 'stench-limit',
      attemptedPosition,
      nextPosition: attemptedPosition,
      turn: nextTurn,
      wumpusConfiguration: landingWumpusConfiguration,
      timeDelta: 0,
      totalTime: currentTime,
      stenchCount: nextStenchCount,
      hasStench,
      hasBreeze,
      cellType,
      wumpusPositions,
    };
  }

  const timeDelta = getMoveTimeDelta(cellType, hasBreeze);
  const totalTime = Math.max(0, currentTime + timeDelta);
  const nextWumpusConfiguration = applyCellConfigurationShift(
    landingWumpusConfiguration,
    cellType
  );

  return {
    outcome: cellType === 'G' ? 'goal' : 'moved',
    attemptedPosition,
    nextPosition: attemptedPosition,
    turn: nextTurn,
    wumpusConfiguration: nextWumpusConfiguration,
    timeDelta,
    totalTime,
    stenchCount: nextStenchCount,
    hasStench,
    hasBreeze,
    cellType,
    wumpusPositions: world.getAllWumpusesAtConfiguration(nextWumpusConfiguration),
  };
}

function getPathSnapshot(world: WumpusWorld, path: Position[], turn: number) {
  let accumulatedTime = 0;
  let stenchCount = getInitialPercepts(world).hasStench ? 1 : 0;
  let wumpusConfiguration = 0;

  for (let t = 1; t <= turn && t < path.length; t++) {
    const pos = path[t];
    const [r, c] = pos;
    const cellType = world.grid[r - 1][c - 1];
    const landingWumpusConfiguration = advanceWumpusConfiguration(wumpusConfiguration);

    const { hasStench, hasBreeze } = world.getCellPercepts(pos, landingWumpusConfiguration);
    accumulatedTime = Math.max(0, accumulatedTime + getMoveTimeDelta(cellType, hasBreeze));

    if (hasStench) {
      stenchCount++;
    }

    wumpusConfiguration = applyCellConfigurationShift(landingWumpusConfiguration, cellType);
  }

  return {
    accumulatedTime,
    stenchCount,
    wumpusConfiguration,
    wPositions: world.getAllWumpusesAtConfiguration(wumpusConfiguration),
  };
}

function buildRenderGrid(
  world: WumpusWorld,
  agentPosition: Position,
  wumpusConfiguration: number,
  wPositions: Position[]
) {
  const renderGrid: string[][] = Array(world.n).fill(null).map(() => Array(world.n).fill('.'));

  for (let r = 0; r < world.n; r++) {
    for (let c = 0; c < world.n; c++) {
      const cell = world.grid[r][c];
      if (cell === 'P' || cell === 'T' || cell === 'G') {
        renderGrid[r][c] = cell;
      }
    }
  }

  for (let r = 0; r < world.n; r++) {
    for (let c = 0; c < world.n; c++) {
      const { hasStench, hasBreeze } = world.getCellPercepts([r + 1, c + 1], wumpusConfiguration);
      if (hasStench && renderGrid[r][c] === '.') {
        renderGrid[r][c] = 's';
      }
      if (hasBreeze && renderGrid[r][c] === '.') {
        renderGrid[r][c] = 'b';
      }
    }
  }

  for (const [wr, wc] of wPositions) {
    if (wr >= 1 && wr <= world.n && wc >= 1 && wc <= world.n) {
      renderGrid[wr - 1][wc - 1] = 'W';
    }
  }

  const [ar, ac] = agentPosition;
  renderGrid[ar - 1][ac - 1] = renderGrid[ar - 1][ac - 1] === '.' ? 'A' : '@';

  return renderGrid;
}

function getPostMoveVisualizationConfigurations(
  currentConfiguration: number,
  cellType: CellType
) {
  return getConfigurationTransitionSequence(
    currentConfiguration,
    getCellConfigurationShift(cellType)
  );
}

export function buildPlaybackFrames(world: WumpusWorld, path: Position[]): PlaybackFrame[] {
  if (path.length === 0) {
    return [];
  }

  const frames: PlaybackFrame[] = [];
  let accumulatedTime = 0;
  let stenchCount = getInitialPercepts(world).hasStench ? 1 : 0;
  let wumpusConfiguration = 0;
  let currentPosition = path[0];

  const initialWPositions = world.getAllWumpusesAtConfiguration(0);
  frames.push({
    renderGrid: buildRenderGrid(world, currentPosition, 0, initialWPositions),
    accumulatedTime,
    stenchCount,
    wumpusConfiguration: 0,
    wPositions: initialWPositions,
    currentPosition,
    pathStep: 0,
    phase: 'start',
    shiftDirection: 0,
    shiftIndex: 0,
    shiftTotal: 0,
  });

  for (let step = 1; step < path.length; step++) {
    currentPosition = path[step];
    const landingConfiguration = advanceWumpusConfiguration(wumpusConfiguration);

    const [row, col] = currentPosition;
    const cellType = world.grid[row - 1][col - 1];
    const { hasStench, hasBreeze } = world.getCellPercepts(currentPosition, landingConfiguration);
    accumulatedTime = Math.max(0, accumulatedTime + getMoveTimeDelta(cellType, hasBreeze));
    if (hasStench) {
      stenchCount++;
    }

    const moveWumpusPositions = world.getAllWumpusesAtConfiguration(landingConfiguration);
    frames.push({
      renderGrid: buildRenderGrid(world, currentPosition, landingConfiguration, moveWumpusPositions),
      accumulatedTime,
      stenchCount,
      wumpusConfiguration: landingConfiguration,
      wPositions: moveWumpusPositions,
      currentPosition,
      pathStep: step,
      phase: "move",
      shiftDirection: 0,
      shiftIndex: 0,
      shiftTotal: 0,
    });

    const visualizationConfigurations = getPostMoveVisualizationConfigurations(
      landingConfiguration,
      cellType
    );
    const totalShiftFrames = visualizationConfigurations.length;
    const settledConfiguration =
      totalShiftFrames > 0
        ? visualizationConfigurations[totalShiftFrames - 1]
        : landingConfiguration;
    const shiftDirection =
      totalShiftFrames > 0
        ? settledConfiguration > landingConfiguration
          ? 1
          : settledConfiguration < landingConfiguration
            ? -1
            : 0
        : 0;

    for (let index = 0; index < visualizationConfigurations.length; index++) {
      const frameConfiguration = visualizationConfigurations[index];
      const wPositions = world.getAllWumpusesAtConfiguration(frameConfiguration);

      frames.push({
        renderGrid: buildRenderGrid(world, currentPosition, frameConfiguration, wPositions),
        accumulatedTime,
        stenchCount,
        wumpusConfiguration: frameConfiguration,
        wPositions,
        currentPosition,
        pathStep: step,
        phase: "shift",
        shiftDirection,
        shiftIndex: index + 1,
        shiftTotal: totalShiftFrames,
      });
    }

    wumpusConfiguration = settledConfiguration;
  }

  return frames;
}

// Helper to get render state at a specific turn
export function getRenderState(world: WumpusWorld, path: Position[], turn: number) {
  const { accumulatedTime, stenchCount, wumpusConfiguration, wPositions } = getPathSnapshot(
    world,
    path,
    turn
  );
  const agentPosition = turn < path.length ? path[turn] : path[path.length - 1];
  const renderGrid = buildRenderGrid(world, agentPosition, wumpusConfiguration, wPositions);

  return { renderGrid, accumulatedTime, stenchCount, wPositions, wumpusConfiguration };
}

export function getRenderGridAtConfiguration(
  world: WumpusWorld,
  agentPosition: Position,
  wumpusConfiguration: number
) {
  const wPositions = world.getAllWumpusesAtConfiguration(wumpusConfiguration);
  return buildRenderGrid(world, agentPosition, wumpusConfiguration, wPositions);
}
