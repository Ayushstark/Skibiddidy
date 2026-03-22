# Wumpus World Project: Interview Preparation Guide

This document contains potential interview questions and detailed answers based on the technical implementation of the Wumpus World solver.

---

## 1. Algorithmic Questions

### Q1: Which pathfinding algorithm is used in this project and why?
**Answer:** The project uses **A* Search (A-Star)**. A* is an informed search algorithm that is both complete and optimal. It was chosen over BFS (which is only optimal for uniform costs) and Dijkstra (which is slower as it doesn't use heuristics) because our world has varying costs (Pits, Time Zones, Breeze) and a clear goal position. A* allows us to efficiently find the lowest-cost path by prioritizing nodes that seem most "promising" based on their distance to the goal.

### Q2: Is the heuristic used in this project admissible and consistent?
**Answer:** Yes. The project uses a **pre-calculated Dijkstra/DP table** from the Gold position back to every cell as its heuristic. 
- **Admissible:** Since the table calculates the absolute minimum cost to reach the goal (ignoring dynamic hazards), it never overestimates the cost.
- **Consistent:** For any two neighboring nodes *n* and *p*, the difference in their heuristic values is less than or equal to the actual cost of moving between them. This makes it a "perfect" (or near-perfect) heuristic for the static grid, leading to zero expansion of suboptimal paths in a static environment.

### Q3: How is "State" defined in your solver?
**Answer:** A state is not just a `(row, col)` coordinate. In this project, a state is defined by:
1. **Position:** Current `(row, col)`.
2. **Turn:** Total turns elapsed (determines Wumpus positions).
3. **Stench Count:** Number of stench encounters (max 2 allowed).
4. **Wumpus Configuration:** A dynamic variable used to track the "phase" of Wumpus movement.
5. **Visited Mask:** A bitmask of explored cells to prevent simple cycles.

---

## 2. Dynamic Environment Handling

### Q4: How does the algorithm handle moving Wumpuses?
**Answer:** Wumpuses move horizontally on every turn. The solver simulates this logic by:
- Calculating the Wumpus's position based on the current `turn` number using `getWumpusPos()`.
- Checking if any Wumpus will occupy the target cell at the exact moment (`turn + 1`) the agent arrives.
- If a collision is detected, that move is considered invalid and the branch is pruned.

### Q5: How do "Time Zones" and "Pits" affect the Pathfinding?
**Answer:** They modify the **edge weights** (`g(n)`) in the A* calculation:
- **Pits:** Entering a Pit cell adds a heavy time penalty (`+5`). Additionally, being adjacent to a Pit (Breeze) adds a small penalty (`+2`).
- **Time Zones:** These are beneficial. Landing on one results in a time reduction (`-3`).
The A* algorithm naturally incorporates these weights to find the global minimum time cost, even if it means taking a physically longer route to "collect" time reductions.

---

## 3. Engineering & Concurrency

### Q6: Why did you use Web Workers for the solver implementation?
**Answer:** Pathfinding in a large grid with dynamic constraints can be computationally expensive (CPU-intensive). Running the `world.solve()` function on the main UI thread would cause the browser to freeze and become unresponsive (Jank). By offloading the solver to a **Web Worker** (`solver-worker.ts`), the UI remains smooth while the search executes in the background.

### Q7: How do you prevent the search space from exploding (State Space Pruning)?
**Answer:** 
- **Visited States Map:** We store visited states in a map where the key is `pos + turn + stenchCount + wumpusConfig`. If we reach the same state again with a higher cost, we prune it.
- **Optimistic Pruning:** If the current `f(n)` (cost-so-far + heuristic) is already worse than the best path to gold found so far, we stop exploring that branch.

---

## 4. UI & Systems

### Q8: How is the "Simulation Playback" handled?
**Answer:** Once the A* algorithm finds the optimal path, it returns a sequence of positions. The UI then iterates through these steps, generating `PlaybackFrame` objects that capture the grid state, wumpus positions, and agent position at each discrete moment. This allow for "step-through" or "animated" visualization of the agent's journey.

### Q9: what happen if the Gold is unreachable?
**Answer:** The solver performs an exhaustive search (up to the turn limit). If no path works, it returns a `SolveResult` with `success: false` and a `failureReason`. Our implementation provides specific reasons, such as "Stench Limit Reached" or "Blocked by Wumpuses," to help the user understand why the grid is unsolvable.

### Q10: How would you scale this to a 50x50 or 100x100 grid?
**Answer:** On very large grids, the current state space might become too large. I would consider:
1. **Iterative Deepening A* (IDA*):** To save memory.
2. **Jump Point Search (JPS):** To speed up exploration in open areas.
3. **Hierarchical Pathfinding:** Breaking the grid into sub-grids.
4. **Stricter Heuristic:** Currently, we use a very good heuristic, but for 100x100, we might need to pre-allocate even more memory or use compressed bitmasks for visited states.
