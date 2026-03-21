# Wumpus World Atlas — Return Zero

> **AlgoWars submission** · "Wumpus No Longer Alone"

An interactive, browser-based solver and visualiser for the extended Wumpus World problem. Design a hazard grid, run the A\* solver, watch a turn-by-turn replay, or navigate the cave yourself in manual mode — all in the browser, no backend required.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Grid & Cell Types](#2-grid--cell-types)
3. [Rules Cross-Verified Against PDF](#3-rules-cross-verified-against-pdf)
4. [Algorithm & Architecture](#4-algorithm--architecture)
5. [System Flow](#5-system-flow)
6. [Project Structure](#6-project-structure)
7. [Tech Stack](#7-tech-stack)
8. [How to Run](#8-how-to-run)
9. [Evaluation Criteria Coverage](#9-evaluation-criteria-coverage)

---

## 1. Problem Statement

You are given an **n × n** cave grid (5 ≤ n ≤ 15). An agent starts at cell **(1,1)** and must reach the **Gold (G)** cell. Before the agent moves, the solver determines whether a guaranteed-safe path exists, accounting for:

- Deterministic, oscillating Wumpus movement
- Pit and time-zone tile effects
- Stench accumulation (death at ≥ 3 stench encounters)
- A turn cap of **4n²**

If a safe path exists, the solver returns the **minimum time-cost path**. If multiple paths share the same cost, the **lexicographically smallest** one is returned.

---

## 2. Grid & Cell Types

| Symbol | Name      | Effect on agent                                      |
|--------|-----------|------------------------------------------------------|
| `.`    | Empty     | Safe, no effect                                      |
| `W`    | Wumpus    | Deadly — agent dies on contact                       |
| `P`    | Pit       | +5 s time penalty on entry                           |
| `T`    | Time Zone | −3 s time benefit on entry                           |
| `G`    | Gold      | Goal cell — ends the journey successfully            |

**Percepts (adjacent cells only):**

| Percept | Source | Extra cost |
|---------|--------|------------|
| Stench  | Wumpus | — (death if ≥ 3 accumulated) |
| Breeze  | Pit    | +2 s added to move cost when entering a breeze cell |

Cell (1,1) and the Gold cell are always guaranteed safe (no W, P, or T).

---

## 3. Rules Cross-Verified Against PDF

Every rule below is taken directly from the *Return Zero PS.pdf* problem statement and is implemented in `lib/wumpus-world.ts`.

### 3.1 Time Cost Model

```
T ← max(0, T + δ_cell)
```

| Event                        | Time effect |
|------------------------------|-------------|
| Moving into any cell (base)  | +1 s        |
| Entering a Pit (P)           | +5 s        |
| Entering a Breeze cell       | +2 s        |
| Entering a Time Zone (T)     | −3 s        |
| Entering a Wumpus cell (W)   | Agent dies  |
| Stench count ≥ 3             | Agent dies  |

Time is clamped to zero and cannot go negative. ✅ Implemented in `getMoveTimeDelta()`.

### 3.2 Wumpus Movement

Wumpuses move **horizontally only**, bounded by the grid perimeter. Movement alternates between **Turn A** and **Turn B**, cycling indefinitely. The Wumpus position is updated **before** the agent moves each turn.

**When row i is even:**

| Phase  | Steps              |
|--------|--------------------|
| Turn A | Move right 3, left 1 |
| Turn B | Move right 1, left 3 |

**When row i is odd:**

| Phase  | Steps              |
|--------|--------------------|
| Turn A | Move left 3, right 1 |
| Turn B | Move left 1, right 3 |

Net displacement per full cycle = 0 (zero-net oscillation). ✅ Implemented in `getWumpusTurnSteps()` and `getWumpusPos()`.

### 3.3 Wumpus Configuration Shifts

Landing on certain tiles shifts the Wumpus configuration counter beyond the standard +1/turn advance:

| Tile | Configuration shift |
|------|---------------------|
| P    | +5                  |
| T    | −3                  |
| `.` / `G` | 0 (only +1 base advance) |

✅ Implemented in `getCellConfigurationShift()` and `applyCellConfigurationShift()`.

### 3.4 Stench Death Rule

If the agent enters **3 or more stench-bearing cells** over the entire path (cells adjacent to a Wumpus at the exact turn of entry), the agent dies. A cell adjacent to two Wumpuses simultaneously counts as **one** stench encounter. ✅ Enforced in `solve()` via `stenchCount` state variable.

### 3.5 Constraints

| Parameter         | Bound                    |
|-------------------|--------------------------|
| Grid size n       | 5 ≤ n ≤ 15               |
| Wumpuses          | 0 ≤ \|W\| ≤ n            |
| Pits              | 0 ≤ \|P\| ≤ ⌊n²/5⌋       |
| Time Zones        | 0 ≤ \|T\| ≤ ⌊n²/5⌋       |
| Turn limit        | 4 × n²                   |
| No revisits       | Agent cannot re-enter a visited cell |

✅ All enforced in `getGridConstraints()` and the solver state machine.

---

## 4. Algorithm & Architecture

### 4.1 Algorithm: A\* with DFS Warm-Start

The solver uses **A\* search** over an augmented state space, seeded by a lightweight **DFS** that runs first to obtain an initial feasible solution quickly.

**State tuple:**

```
s = (position, turn, wumpusConfiguration, stenchCount, visitedMask, timeCost)
```

| Field               | Type              | Purpose                              |
|---------------------|-------------------|--------------------------------------|
| `position`          | [row, col]        | Current agent cell                   |
| `turn`              | number            | Moves taken so far                   |
| `wumpusConfiguration` | number          | Wumpus oscillation counter           |
| `stenchCount`       | 0 \| 1 \| 2       | Accumulated stench encounters        |
| `visitedMask`       | n²-bit string     | Encodes no-revisit constraint        |
| `timeCost`          | number            | Accumulated time cost (g-value)      |

**Heuristic (admissible):** A backward dynamic-programming table is built once over the grid, computing the minimum possible remaining cost from any cell to Gold, ignoring all constraints. This lower bound is used as the A\* h-value, guaranteeing optimality.

**Priority key:** `f = g + h*` — states with lower optimistic total cost are expanded first.

**Pruning:** Any state whose `optimisticFinalCost > bestGoal.timeCost` is discarded immediately.

### 4.2 Complexity

| Metric       | Value                                      |
|--------------|--------------------------------------------|
| State space  | O(n⁶ · 2^(n²)) worst case                 |
| Time         | O(n⁸ · 2^(n²)) worst case                 |
| Space        | O(n⁸ · 2^(n²)) worst case                 |
| Heuristic DP | O(n⁴) — built once                        |
| Wumpus cache | O(W · T_max) — memoised per configuration |

Practical performance is well within one second for all supported grid sizes (n ≤ 15) due to aggressive pruning.

---

## 5. System Flow

### 5.1 Overall Application Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        User opens app                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Map Editor (GridEditor)                    │
│  • Select preset or custom grid size (5–15)                  │
│  • Paint cells: W / P / T / G / .                            │
│  • Constraints enforced in real-time                         │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
     [Run Solver]                      [Manual Mode]
           │                                  │
           ▼                                  ▼
┌──────────────────────┐         ┌────────────────────────────┐
│   Web Worker spawned  │         │  Solver runs in background  │
│  (solver-worker.ts)  │         │  to compute optimal path    │
│                      │         │  as benchmark               │
│  WumpusWorld.solve() │         └────────────┬───────────────┘
│  A* + DFS seed       │                      │
└──────────┬───────────┘                      ▼
           │                    ┌────────────────────────────┐
           ▼                    │     ManualPlayPanel         │
    ┌─────────────┐             │  • Arrow-key navigation     │
    │  SAFE?      │             │  • Live percept display     │
    └──┬──────────┘             │  • Stench / breeze alerts   │
       │                        │  • Compare vs optimal       │
    YES│          NO            └────────────────────────────┘
       │           │
       ▼           ▼
┌──────────┐  ┌──────────────────────────────┐
│Simulation│  │  No-Path Panel               │
│  Panel   │  │  • Failure reason displayed  │
│          │  │  • Best partial attempt shown│
│ Turn-by- │  └──────────────────────────────┘
│ turn     │
│ replay   │
└──────────┘
```

### 5.2 Solver Internal Flow

```
WumpusWorld.solve()
│
├── buildOptimisticCostTable()        ← backward DP heuristic, O(n⁴)
│
├── findSeedGoal()                    ← DFS, capped at max(2000, 50n²) states
│   └── returns initial bestGoal (or null)
│
└── A* main loop
    │
    ├── popQueue()                    ← binary min-heap, O(log N)
    │
    ├── pruning checks
    │   ├── optimisticFinalCost > bestGoal?  → skip
    │   └── state already visited with lower cost? → skip
    │
    ├── goal check → update bestGoal
    │
    └── expand neighbours
        ├── boundary check
        ├── revisit check (visitedMask)
        ├── advanceWumpusConfiguration()
        ├── Wumpus collision check
        ├── stenchCount < 3 check
        ├── turnLimit check
        ├── getMoveTimeDelta()
        ├── applyCellConfigurationShift()
        └── pushQueue() if f ≤ bestGoal.cost
```

### 5.3 Wumpus Position Computation

```
getWumpusPos(startCol, row, configuration)
│
├── Check wumpusPositionCache (row, startCol, configuration)
│   └── return cached position if hit
│
└── Replay turn steps 1..configuration
    │
    └── for each turn t:
        ├── getWumpusTurnSteps(row, t)
        │   ├── even row + odd turn  → [+1,+1,+1,−1]  (Turn A)
        │   ├── even row + even turn → [+1,−1,−1,−1]  (Turn B)
        │   ├── odd row + odd turn   → [−1,−1,−1,+1]  (Turn A)
        │   └── odd row + even turn  → [−1,+1,+1,+1]  (Turn B)
        │
        └── apply each step with boundary clamping:
            col ← max(1, min(n, col + step))
```

---

## 6. Project Structure

```
.
├── app/
│   ├── layout.tsx          # Root shell, fonts (Space Grotesk, IBM Plex Mono, Cormorant Garamond)
│   ├── page.tsx            # Mounts <WumpusGame />
│   └── globals.css         # CSS variables, OKLCH tokens, custom animations
│
├── components/
│   ├── wumpus-game.tsx     # Top-level orchestrator — state, mode switching, solver dispatch
│   ├── grid-editor.tsx     # Interactive map builder with constraint enforcement
│   ├── game-grid.tsx       # Shared board renderer (editor + simulation views)
│   ├── simulation-panel.tsx# Solver replay UI with playback controls
│   ├── manual-play-panel.tsx # Manual expedition mode with benchmark comparison
│   └── ui/                 # shadcn/ui + Radix UI primitives (57 files)
│
├── lib/
│   ├── wumpus-world.ts     # Core domain engine — solver, Wumpus movement, percepts, manual eval
│   ├── solver-worker.ts    # Web Worker wrapper — runs solve() off the main thread
│   ├── wumpus-display.tsx  # Tile labels, icons, colours, descriptions
│   └── utils.ts            # clsx + tailwind-merge helper
│
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
│
├── tests/
│   └── wumpus-world.test.ts
│
├── public/                 # Static assets and icons
├── proof-of-concept.tex    # LaTeX proof document (algorithm justification + complexity)
├── Return Zero PS.pdf      # Original problem statement
├── LAUNCH.bat              # Windows one-click launcher
├── next.config.mjs
├── package.json
└── tsconfig.json
```

---

## 7. Tech Stack

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| Framework     | Next.js 16.2 (App Router)               |
| Language      | TypeScript 5.7 (strict mode)            |
| UI library    | React 19                                |
| Styling       | Tailwind CSS 4 + PostCSS                |
| Design system | shadcn/ui (new-york) + Radix UI         |
| Icons         | lucide-react                            |
| Concurrency   | Web Workers (solver runs off main thread)|
| Analytics     | @vercel/analytics                       |
| Package mgr   | npm                                     |

---

## 8. How to Run

### Option A — Windows one-click (recommended)

Double-click **`LAUNCH.bat`**.

It will:
1. Install dependencies if `node_modules` is missing
2. Start the Next.js dev server in a new PowerShell window
3. Wait for the localhost URL and open it in your default browser automatically

### Option B — Manual

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
# → open http://localhost:3000

# 3. Production build (optional)
npm run build
npm run start
```

### Option C — Type-check only

```bash
npx tsc --noEmit
```

> **Note:** `next.config.mjs` sets `typescript.ignoreBuildErrors = true`, so `npm run build` succeeds even with type errors. Always run `npx tsc --noEmit` for a clean type check.

### Requirements

- Node.js 18+
- npm 9+
- Modern browser with Web Worker support (Chrome, Firefox, Edge, Safari)

---

## 9. Evaluation Criteria Coverage

| Criterion                        | Weight | Implementation                                                                                     |
|----------------------------------|--------|----------------------------------------------------------------------------------------------------|
| Proof & Algorithm Choice         | 20%    | `proof-of-concept.tex` — A* justification, admissibility proof, time/space complexity analysis     |
| Correctness                      | 30%    | `lib/wumpus-world.ts` — all PDF rules enforced: Wumpus movement, stench death, time clamping, boundary behaviour, lexicographic tie-breaking |
| Visualization                    | 20%    | `SimulationPanel` — turn-by-turn replay with dynamic stench fields, Wumpus positions, percept overlays, and configuration-shift animations |
| Code Quality                     | 15%    | Domain logic fully separated from UI; typed state machine; memoised caches; self-documenting variable names |
| Test Cases & Innovation          | 15%    | Three built-in presets (5×5, 6×6, 7×7); manual play mode with optimal benchmark comparison; DFS warm-start heuristic; `tests/wumpus-world.test.ts` |

---

## Preset Scenarios

| Preset       | Size | Description                                      |
|--------------|------|--------------------------------------------------|
| Classic 5×5  | 5×5  | Matches the PDF example input exactly            |
| Challenge 6×6| 6×6  | Denser hazard field with multiple Wumpus rows    |
| Maze 7×7     | 7×7  | Complex routing with time zones and pit clusters |

---

*Return Zero — AlgoWars Wumpus World submission*
