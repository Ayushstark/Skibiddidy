import type { CellType } from "@/lib/wumpus-world";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Circle,
  Clock3,
  CloudFog,
  Coins,
  Skull,
  TriangleAlert,
  Wind,
} from "lucide-react";

export type DisplayCellType = CellType | "s" | "b" | "A" | "@";

interface CellVisual {
  label: string;
  shortLabel: string;
  description: string;
  Icon: LucideIcon;
  surfaceClass: string;
  iconClass: string;
  badgeClass: string;
}

export const cellVisuals: Record<DisplayCellType, CellVisual> = {
  ".": {
    label: "Open Tile",
    shortLabel: "Open",
    description: "Traversable terrain with no direct effect on the route.",
    Icon: Circle,
    surfaceClass:
      "border-slate-600/70 bg-slate-900/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    iconClass: "text-slate-500",
    badgeClass: "border-slate-600/60 bg-slate-900/90 text-slate-300",
  },
  W: {
    label: "Wumpus",
    shortLabel: "Wumpus",
    description: "A hostile unit that slides horizontally every turn and merges on overlap.",
    Icon: Skull,
    surfaceClass:
      "border-wumpus/55 bg-wumpus/15 shadow-[0_14px_30px_rgba(255,91,71,0.2)]",
    iconClass: "text-wumpus",
    badgeClass: "border-wumpus/40 bg-wumpus/15 text-wumpus",
  },
  P: {
    label: "Pit",
    shortLabel: "Pit",
    description: "Adds a heavy movement penalty and creates nearby breeze.",
    Icon: TriangleAlert,
    surfaceClass:
      "border-pit/55 bg-pit/15 shadow-[0_14px_30px_rgba(192,132,252,0.18)]",
    iconClass: "text-pit",
    badgeClass: "border-pit/40 bg-pit/15 text-pit",
  },
  T: {
    label: "Time Zone",
    shortLabel: "Time",
    description: "Cuts travel time when the agent lands on it.",
    Icon: Clock3,
    surfaceClass:
      "border-timezone/55 bg-timezone/15 shadow-[0_14px_30px_rgba(56,189,248,0.2)]",
    iconClass: "text-timezone",
    badgeClass: "border-timezone/40 bg-timezone/15 text-timezone",
  },
  G: {
    label: "Gold",
    shortLabel: "Goal",
    description: "The destination tile the solver is trying to recover.",
    Icon: Coins,
    surfaceClass:
      "border-gold/60 bg-gold/20 shadow-[0_14px_30px_rgba(250,204,21,0.24)]",
    iconClass: "text-gold",
    badgeClass: "border-gold/45 bg-gold/18 text-gold",
  },
  s: {
    label: "Stench",
    shortLabel: "Stench",
    description: "Adjacent warning produced by a nearby Wumpus.",
    Icon: CloudFog,
    surfaceClass:
      "border-stench/50 bg-stench/14 shadow-[0_10px_24px_rgba(163,230,53,0.16)]",
    iconClass: "text-stench",
    badgeClass: "border-stench/40 bg-stench/15 text-stench",
  },
  b: {
    label: "Breeze",
    shortLabel: "Breeze",
    description: "Ambient warning created by a neighboring pit.",
    Icon: Wind,
    surfaceClass:
      "border-breeze/50 bg-breeze/14 shadow-[0_10px_24px_rgba(96,165,250,0.16)]",
    iconClass: "text-breeze",
    badgeClass: "border-breeze/40 bg-breeze/15 text-breeze",
  },
  A: {
    label: "Agent",
    shortLabel: "Agent",
    description: "Current position of the explorer.",
    Icon: Bot,
    surfaceClass:
      "border-agent/55 bg-agent/15 shadow-[0_14px_30px_rgba(74,222,128,0.2)]",
    iconClass: "text-agent",
    badgeClass: "border-agent/40 bg-agent/15 text-agent",
  },
  "@": {
    label: "Agent on Target",
    shortLabel: "Agent+",
    description: "The explorer occupying a special tile.",
    Icon: Bot,
    surfaceClass:
      "border-agent/55 bg-[linear-gradient(135deg,rgba(74,222,128,0.16),rgba(250,204,21,0.18))] shadow-[0_14px_30px_rgba(74,222,128,0.2)]",
    iconClass: "text-agent",
    badgeClass: "border-agent/40 bg-agent/15 text-agent",
  },
};

export const editableTools: CellType[] = [".", "W", "P", "T", "G"];

export const legendCells: DisplayCellType[] = ["A", "W", "P", "T", "G", "s", "b"];

export function getCellVisual(type: DisplayCellType) {
  return cellVisuals[type];
}
