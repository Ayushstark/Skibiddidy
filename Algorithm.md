# Wumpus World Pathfinding Algorithm Analysis

This document outlines the pathfinding algorithm used in the Wumpussy project to find the optimal path from the starting position `(1, 1)` to the Gold `(G)`.

## Algorithm Used: A* Search (A-Star)

The project implements an **A* Search algorithm** with a sophisticated, pre-calculated **perfect heuristic**.

### Why A*?
A* is chosen because it is both **complete** (guaranteed to find a solution if one exists) and **optimal** (guaranteed to find the lowest-cost path) when using an admissible heuristic. Given the complex cost structure (Pits and Breeze adding time, Time Zones reducing time) and dynamic environment (moving Wumpuses), A* provides the most efficient way to explore the state space.

---

## Algorithm Pipeline

### 1. Heuristic Generation (Optimistic Cost Table)
Before the main search begins, the algorithm builds an "Optimistic Cost Table". This is a pre-calculation of the absolute minimum possible cost to reach the Gold from any cell on the grid, ignoring dynamic hazards like Wumpuses and stench limits.

**Snippet:**
```typescript
function buildOptimisticCostTable(world: WumpusWorld) {
  // Uses Dynamic Programming to find the shortest path from the goal 
  // back to all other cells, considering static entry costs.
  const dp = Array.from({ length: totalCells + 1 }, () =>
    Array(totalCells).fill(Number.POSITIVE_INFINITY)
  );
  dp[0][goalIdx] = 0;

  for (let steps = 1; steps <= totalCells; steps++) {
    for (let idx = 0; idx < totalCells; idx++) {
      // Updates best cost based on neighbors and their movement deltas
      // ...
    }
  }
  return (position: Position, maxSteps: number) =>
    dp[Math.max(0, Math.min(maxSteps, totalCells))][indexOf(position)];
}
```

### 2. State Definition & Pruning
The search space is multi-dimensional. A "state" is not just the agent's position; it includes:
- Current Position `(row, col)`
- Current Turn (affects Wumpus positions)
- Stench Count (max 2 allowed)
- Wumpus Configuration (dynamic offset)
- Time Cost (the value we want to minimize)

Pruning ensures we don't re-examine a state if we've already reached it with a lower or equal cost and a lexicographically better path.

### 3. Priority Queue Execution
The core of A* is the priority queue, which always evaluates the most "promising" path first. The promise is measured by:
`f(n) = g(n) + h(n)`
- `g(n)`: Actual time cost spent to reach node `n`.
- `h(n)`: Estimated (optimistic) cost to reach the goal from node `n`.

**Snippet:**
```typescript
const pq: QueueItem[] = [];
// ...
pushQueue({
  timeCost: 0,
  path: [[1, 1]],
  // ...
  optimisticFinalCost, // f(n) = timeCost + optimisticAdditional
});

while (pq.length > 0) {
  const current = popQueue()!;
  // Check if we reached Gold or continue exploration
  // ...
}
```

---

## Key Features & Constraints

- **Moving Wumpuses:** The algorithm accounts for Wumpus movement on every turn. A path is blocked if a Wumpus occupies the target cell at the time of arrival.
- **Stench Limit:** The agent can tolerate up to 2 stenches. Encountering a 3rd stench results in path failure.
- **Time Zones:** These cells provide a `-3` time delta, which the A* algorithm actively seeks to minimize the total `timeCost`.
- **Lexicographical Tie-breaking:** If two paths have the same optimal cost, the algorithm uses a `pathKey` comparison to ensure deterministic and consistent path selection.

---

## How it Works (Step-by-Step)

1. **Initialize:** Start at `(1, 1)` with `timeCost = 0` and `turn = 0`.
2. **Expand:** For each possible move (Up, Down, Left, Right):
   - Calculate the `nextTurn` and new Wumpus positions.
   - Check for collisions (Wumpus) or fatal conditions (3rd Stench / Turn Limit).
   - Calculate the new `timeCost` (Base 1 + Pit/Breeze/Time-Zone modifiers).
3. **Estimate:** Add the pre-calculated optimistic cost from the new cell to the Gold to find the `optimisticFinalCost`.
4. **Queue:** Push the new state into the Priority Queue.
5. **Loop:** Repeat until the first item popped from the queue is the Gold position. This is guaranteed to be the optimal path.
