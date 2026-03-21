# Tech Stack README

## Overview

This project is a **Next.js 16** web application for building, simulating, and replaying custom **Wumpus World** scenarios. It is a **frontend-only application** in its current form: there is no database, no authentication layer, and no custom backend API. The Wumpus solver, map editor, manual play mode, and replay system all run in the client application code.

The app is centered around three major concerns:

1. **Map authoring** for Wumpus, pits, time zones, and gold.
2. **Pathfinding and simulation logic** for dynamic Wumpus movement and route evaluation.
3. **Replay and visualization UI** for solver output and manual expedition playback.

---

## Core Runtime Stack

### Framework

- **Next.js 16.2.0**
  - Uses the **App Router** (`app/` directory).
  - Static pages are generated for the current app routes.
  - Config lives in [next.config.mjs](/C:/Users/jakku/Downloads/Wumpus%20V1/next.config.mjs).

### Language

- **TypeScript 5.7.3**
  - Strict mode is enabled in [tsconfig.json](/C:/Users/jakku/Downloads/Wumpus%20V1/tsconfig.json).
  - Path alias `@/*` maps to the project root.

### React

- **React 19.2.4**
- **React DOM 19.2.4**

### Node / Package Management

- Uses **npm** with a generated `package-lock.json`.
- Primary scripts from [package.json](/C:/Users/jakku/Downloads/Wumpus%20V1/package.json):
  - `npm run dev`
  - `npm run build`
  - `npm run start`
  - `npm run lint`

---

## Frontend Architecture

### Rendering Model

- The app uses **client components** heavily for interactive map editing and simulation.
- Main page entry:
  - [app/page.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/app/page.tsx)
- Root shell and fonts:
  - [app/layout.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/app/layout.tsx)

### Main Feature Components

- [components/wumpus-game.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/components/wumpus-game.tsx)
  - Top-level orchestration for editor, solver state, simulation state, and manual mode.
- [components/grid-editor.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/components/grid-editor.tsx)
  - Interactive custom-map builder with rule enforcement.
- [components/simulation-panel.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/components/simulation-panel.tsx)
  - Solver replay UI, playback controls, visual configuration-step playback.
- [components/manual-play-panel.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/components/manual-play-panel.tsx)
  - Manual expedition mode with prompts, run history, and comparison to optimal output.
- [components/game-grid.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/components/game-grid.tsx)
  - Shared board renderer used by editor and simulation views.

---

## Domain Logic Layer

### Core Simulation / Solver Module

- [lib/wumpus-world.ts](/C:/Users/jakku/Downloads/Wumpus%20V1/lib/wumpus-world.ts)

This file is the main domain engine for the project. It handles:

- grid typing and position models
- Wumpus movement/configuration updates
- percept generation (`stench`, `breeze`)
- solver search state and result generation
- manual move evaluation
- replay render-state generation
- visual playback frame generation for time-zone and pit configuration shifts

### Display Metadata

- [lib/wumpus-display.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/lib/wumpus-display.tsx)

This module defines:

- tile labels
- tile descriptions
- icon mapping
- color/style mapping for Wumpus, pits, gold, time zones, breeze, stench, and agent states

### Utilities

- [lib/utils.ts](/C:/Users/jakku/Downloads/Wumpus%20V1/lib/utils.ts)
  - class name merging helper using `clsx` and `tailwind-merge`

---

## UI / Styling Stack

### CSS Framework

- **Tailwind CSS 4**
- **PostCSS**
- **Autoprefixer**

Configured through:

- [postcss.config.mjs](/C:/Users/jakku/Downloads/Wumpus%20V1/postcss.config.mjs)
- [app/globals.css](/C:/Users/jakku/Downloads/Wumpus%20V1/app/globals.css)

### Design System

- **shadcn/ui** setup is present via [components.json](/C:/Users/jakku/Downloads/Wumpus%20V1/components.json)
- Base style: `new-york`
- Icons: `lucide`
- Tailwind CSS variables are enabled

### Styling Approach

The app uses a custom dark visual system built on:

- CSS variables for semantic tokens
- OKLCH color definitions
- custom component shells such as:
  - `panel-shell`
  - `panel-subtle`
  - `stat-shell`
  - `map-shell`
- custom animations:
  - `float`
  - `drift`
  - `signal`
  - `rise-in`

### Fonts

Loaded via `next/font/google` in [app/layout.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/app/layout.tsx):

- **Space Grotesk** for primary UI text
- **IBM Plex Mono** for technical / coordinate / stat text
- **Cormorant Garamond** for display headings

---

## Component and Primitive Libraries

### Radix UI

The project includes a broad Radix primitive set, including:

- accordion
- alert dialog
- avatar
- checkbox
- collapsible
- context menu
- dialog
- dropdown menu
- hover card
- label
- menubar
- navigation menu
- popover
- progress
- radio group
- scroll area
- select
- separator
- slider
- slot
- switch
- tabs
- toast
- toggle
- toggle group
- tooltip

These power the shadcn/ui-based components under `components/ui/`.

### Icons

- **lucide-react**

Used across:

- tile rendering
- control buttons
- status badges
- legends
- layout chrome

---

## Validation / Forms / Interaction Helpers

The dependency set includes:

- **react-hook-form**
- **@hookform/resolvers**
- **zod**

These are available for structured form handling and schema validation, though the current Wumpus editor is driven mostly by direct interactive state rather than large form workflows.

Other UI helpers installed:

- **cmdk**
- **input-otp**
- **embla-carousel-react**
- **vaul**
- **react-resizable-panels**
- **react-day-picker**
- **date-fns**
- **sonner**
- **recharts**

Not all of these appear central to the current Wumpus workflow, but they are part of the project stack and available in the codebase.

---

## Analytics

- **@vercel/analytics**

Injected from [app/layout.tsx](/C:/Users/jakku/Downloads/Wumpus%20V1/app/layout.tsx) via `<Analytics />`.

---

## Build and Tooling Notes

### Type Checking

- TypeScript is configured with `strict: true`.
- `npx tsc --noEmit` is the cleanest standalone type-check command.

### Important Next.js Build Note

In [next.config.mjs](/C:/Users/jakku/Downloads/Wumpus%20V1/next.config.mjs), the app currently sets:

- `typescript.ignoreBuildErrors = true`

This means:

- `next build` can succeed even if there are TypeScript errors.
- For reliable engineering checks, use both:
  - `npm run build`
  - `npx tsc --noEmit`

### Images

- `images.unoptimized = true` is enabled in Next config.

---

## Project Structure

### `app/`

- App Router entrypoint and global styling.

### `components/`

- feature-level UI components
- shared board rendering
- shadcn/ui primitives in `components/ui/`

### `lib/`

- domain logic
- visual metadata
- utility helpers

### `hooks/`

- reusable client hooks such as mobile detection and toast utilities

### `public/`

- static assets such as icons

### `styles/`

- additional style assets if expanded later

---

## Local Launch / Developer Workflow

### Standard Commands

```bash
npm run dev
npm run build
npm run start
npx tsc --noEmit
```

### Windows Launch Helper

- [LAUNCH.bat](/C:/Users/jakku/Downloads/Wumpus%20V1/LAUNCH.bat)

This batch file is intended to start the local dev server and open the localhost URL in the browser automatically.

---

## Current Stack Summary

If reduced to the essentials, the active stack is:

- **Next.js 16 + App Router**
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **shadcn/ui + Radix UI**
- **Lucide icons**
- **Custom Wumpus domain engine in TypeScript**
- **Vercel Analytics**

The application is best understood as a **client-side simulation and visualization tool** built on a modern React/Next UI stack, with the actual game rules and replay logic implemented in plain TypeScript inside the `lib/` layer.
