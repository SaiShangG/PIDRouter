# PID Viewer Lite

PID Viewer Lite is a browser-based P&ID (Piping and Instrumentation Diagram) viewing and annotation application designed for process engineering and flow analysis. It parses and renders DXF and DWG drawings in the browser and uses the ProcessAssistant API to manage projects, procedures, phases, and drawing data.

Drawing parsing, geometry processing, and rendering are primarily performed locally in the browser. The application uses Three.js/WebGL to display CAD content and processes DXF and DWG files with Web Workers and WebAssembly.

## Features

- Open and view local or server-hosted DXF and DWG drawings
- Zoom, pan, window-select, manage layers, and display lineweights
- Manage projects, procedures, phases, and their associated drawings
- Create phase snapshots and copy configurations from previous or historical phases
- Configure device states, colors, line widths, opacity, and flow-path highlighting rules
- Add or erase drawing highlights with brush tools
- Import and export phase configurations and report data
- Export self-contained HTML, PDF, and SVG files
- Switch between English and Chinese interfaces
- Use responsive layouts on desktop and mobile devices

## Technology Stack

- TypeScript
- Vite 5
- Vue 3 (selected interfaces and plugins)
- Three.js / WebGL
- Nx + pnpm workspace
- Jest

## Project Structure

| Path                                 | Description                                        |
| ------------------------------------ | -------------------------------------------------- |
| `packages/cad-simple-viewer-example` | PID Viewer Lite frontend application               |
| `packages/cad-simple-viewer`         | CAD document management, commands, and viewer core |
| `packages/three-renderer`            | Three.js graphics rendering implementation         |
| `packages/cad-simple-ui-plugin`      | Shared UI including the toolbar and layer panel    |
| `packages/cad-html-plugin`           | Self-contained HTML export                         |
| `packages/cad-pdf-plugin`            | PDF import and export                              |
| `packages/cad-svg-plugin`            | SVG export                                         |
| `packages/cad-agent-plugin`          | CAD intelligent assistant plugin                   |

## Prerequisites

Install the following before starting the application:

- [Node.js](https://nodejs.org/) 24 or later
- [pnpm](https://pnpm.io/) 10 or later
- A modern browser with WebGL, WebAssembly, and Web Worker support; Microsoft Edge or Google Chrome is recommended

Check the installed versions:

```powershell
node --version
pnpm --version
```

If pnpm is not installed, run the following after installing Node.js:

```powershell
corepack enable
corepack prepare pnpm@10.33.4 --activate
```

## Quick Start

### Start the Application

If dependencies and workspace build artifacts are already available, run the following command from the project root:

```powershell
pnpm dev:simple
```

The frontend address is listed in [Network Configuration](#network-configuration).

### First-Time Setup

After cloning the repository, or if `node_modules` and required build artifacts are missing, run:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @mlightcad/cad-simple-viewer-example... build
pnpm dev:simple
```

The build step creates workspace package outputs required by the development server, including `packages/cad-html-plugin/dist/viewer-runtime.iife.js`. You do not need to repeat the install and build steps for normal daily startup unless dependencies change, build artifacts are cleaned, or the development server reports a missing artifact.

## Network Configuration

All local addresses and ports can be set in `packages/cad-simple-viewer-example/.env.local`. Copy `packages/cad-simple-viewer-example/.env.example` as a starting point. The defaults below are defined once in `packages/cad-simple-viewer-example/src/networkConfig.ts` and shared by the Vite server and browser application.

| Setting | Default | Purpose |
| --- | --- | --- |
| `PID_FRONTEND_HOST` | `127.0.0.1` | Host used by the development and preview servers |
| `PID_FRONTEND_PORT` | `5173` | Development server port |
| `PID_PREVIEW_PORT` | `4173` | Production preview server port |
| `VITE_PROCESS_ASSISTANT_API_URL` | `http://127.0.0.1:5153` | ProcessAssistant backend URL and development proxy target |
| `VITE_PROCESS_ASSISTANT_USE_PROXY` | `true` | Send development API requests through Vite; set `false` for direct browser requests |
| `VITE_PROCESS_ASSISTANT_PROJECT_ID` | `1` | Backend Project ID that owns the Procedure; must be a positive integer |

The development URL is `http://127.0.0.1:5173` with these defaults. Vite fails if the configured port is occupied instead of silently switching ports. Restart Vite after editing `.env.local`.

For a deployed build, edit `dist/config.js` and set `window.PID_VIEWER_CONFIG.processAssistantApiUrl` to the deployed backend URL. A nonempty runtime value overrides the build-time backend URL in production; leaving it empty uses the build-time setting and then the shared default. The development proxy reads `.env.local` when Vite starts and does not use `config.js`. When frontend and backend origins differ, allow the frontend origin in the backend CORS configuration.

## Production Build

Build the entire workspace:

```powershell
pnpm build
```

Build only PID Viewer Lite and its dependencies:

```powershell
pnpm --filter @mlightcad/cad-simple-viewer-example... build
```

The build output is written to:

```text
packages/cad-simple-viewer-example/dist
```

Preview the production build locally:

```powershell
pnpm preview:simple
```

Deployment network settings are described in [Network Configuration](#network-configuration).

## Common Commands

| Command               | Description                                  |
| --------------------- | -------------------------------------------- |
| `pnpm dev:simple`     | Start the PID Viewer Lite development server |
| `pnpm build`          | Build all packages in the workspace          |
| `pnpm preview:simple` | Preview the PID Viewer Lite production build |
| `pnpm test`           | Run Jest tests                               |
| `pnpm lint`           | Check workspace code style                   |
| `pnpm clean`          | Remove package build artifacts               |

## Basic Workflow

1. Start the ProcessAssistant backend and the PID Viewer Lite frontend.
2. Open the configured frontend address in a browser and sign in.
3. Create or select a Project and associate P&ID drawings with it.
4. Open the **Processes & Phases** panel and create a procedure and phases.
5. Select a Project P&ID, local drawing, remote drawing, or blank drawing for the phase.
6. Configure device states and flow-path highlights, then save the phase data.
7. Export HTML, PDF, SVG, or report data as needed.

## Troubleshooting

### The Page Cannot Be Reached

Check the startup terminal for errors and verify that the configured frontend port is available.

### The Backend Cannot Be Reached

Confirm that the ProcessAssistant service is running and check the backend URL in [Network Configuration](#network-configuration).

### `viewer-runtime.iife.js` Is Missing

Build the dependencies and restart:

```powershell
pnpm --filter @mlightcad/cad-simple-viewer-example... build
pnpm dev:simple
```

### A DWG Drawing Cannot Be Opened

DWG parsing depends on WebAssembly, and large drawings may require significant memory. Use the latest version of Edge or Chrome and make sure WebAssembly is enabled.

## License

The base project code is licensed under the MIT License. See [LICENSE](./LICENSE) for details. Third-party dependencies and proprietary parsers are governed by their respective licenses and project documentation.
