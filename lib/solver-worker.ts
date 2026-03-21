import { WumpusWorld, type CellType, type SolveResult } from "./wumpus-world";

type SolveRequest = {
  requestId: string;
  gridSize: number;
  grid: CellType[][];
};

type SolveResponse = {
  requestId: string;
  result: SolveResult;
};

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  const { requestId, gridSize, grid } = event.data;
  const world = new WumpusWorld(gridSize, grid);
  const result = world.solve();
  const response: SolveResponse = { requestId, result };
  self.postMessage(response);
};

export {};
