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
- Use the **Valve toggle brush** below **Brush** to toggle valve highlights once
  per stroke in manual mode; other entities retain normal brush behavior.
  Automatic mode still skips configured devices. Both brushes share style
  selection, undo/redo, and saved phase corrections without changing device
  states or automatic routing. Once enabled, the valve brush and its selected
  style remain enabled across Phase switches in the current session. Drawing
  is paused during loading and resumes only when the target Phase is ready.
  Turning the tool off, pressing Escape, or choosing the ordinary brush or
  eraser cancels this continuation; each Phase retains its own highlights.
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

Use a startup argument to choose whether to show the login page:

```powershell
pnpm dev:simple --login=true
pnpm dev:simple --login=false
```

The default is `true`. `false` opens the workspace directly without a demo
account or logout control. Invalid or repeated login arguments fail startup.
The choice applies only to that development server process; no configuration
file is changed. Restart the server to change it. This controls the frontend
demo login, not backend authorization.

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

Configure all frontend/backend IP addresses and ports directly in `packages/cad-simple-viewer-example/.env.example`. Despite its name, this is the active, single configuration file for both development and production builds, not a template to copy. Vite reads it directly and disables automatic env-file loading. Other env files and shell environment variables do not override its network settings.

所有前后端地址规则和端口统一在 `packages/cad-simple-viewer-example/.env.example` 中配置。该文件直接生效，不再只是模板，无需复制到其他 env 文件。开发与打包只读取这里的网络配置，其他 env 文件、系统环境变量及部署后的运行时配置均不能覆盖配置。默认 `auto` 模式在浏览器中使用访问前端的主机名，换网络无需修改 IP 或重新打包。

| Setting | Default | Purpose |
| --- | --- | --- |
| `PID_FRONTEND_HOST` | `0.0.0.0` | Development/preview server listens on all IPv4 interfaces for local and LAN access |
| `PID_FRONTEND_PORT` | `5173` | Development server port |
| `VITE_PROCESS_ASSISTANT_API_URL` | `http://auto:5153` | Reserved `auto` hostname: browser uses the frontend hostname; development proxy uses `127.0.0.1`. An explicit backend URL is also supported |
| `VITE_PROCESS_ASSISTANT_USE_PROXY` | `true` | Send development API requests through Vite; set `false` for direct browser requests |
| `VITE_PROCESS_ASSISTANT_PROJECT_ID` | `1` | Backend Project ID that owns the Procedure; must be a positive integer |

With these settings, open `http://localhost:5173` locally or `http://<this-computer-IP>:5173` from another device on the same LAN. `0.0.0.0` is the listening address, not a browser destination. Allow inbound frontend traffic on port `5173` in the host firewall. Vite fails if the configured port is occupied instead of silently switching ports. Restart Vite after editing `.env.example` during development.

Use `auto` only when the frontend and ProcessAssistant run on the same computer. It is a reserved placeholder, not a DNS lookup or network-adapter scan. Development API and upload requests use Vite's proxy to `127.0.0.1:5153`, even when the browser is on another device. Production builds and development with the proxy disabled replace `auto` with `window.location.hostname`, keeping the configured protocol, backend port, and path. For example, opening `http://192.168.1.20:5173` uses backend `http://192.168.1.20:5153`; opening the same build at `http://10.0.0.30:5173` uses `http://10.0.0.30:5153`. No file is rewritten, no specific adapter is selected, and no restart or rebuild is needed merely because the IP changes. Open the frontend using its new IP after switching networks; an old numeric IP/bookmark cannot automatically follow the computer.

前后端同机时保留 `http://auto:5153`。前端监听所有 IPv4 网卡，开发代理始终访问本机后台；生产页面直接使用浏览器当前访问前端的主机名。换网络后，其他设备使用本机的新 IP 打开前端即可，无需修改配置、重启 Vite 或重新打包。`localhost/127.0.0.1` 始终指向访问者自己的电脑，不是局域网 IP；`0.0.0.0` 仅用于监听，不能作为浏览器访问地址。

For a backend on a different computer, configure an explicit URL reachable from users' browsers instead:

```dotenv
VITE_PROCESS_ASSISTANT_API_URL=https://api.example.com
```

After changing the configured backend URL, protocol, port, or path, rebuild and deploy the complete `dist/` directory:

```powershell
pnpm --filter @mlightcad/cad-simple-viewer-example... build
```

The backend URL must be a valid, nonempty HTTP/HTTPS URL; there is no silent fallback IP in application source. Production builds embed the configured URL rule and no longer generate or load a runtime `config.js`. Explicit backend address changes require editing `.env.example` and rebuilding; frontend hostname/IP changes in `auto` mode do not. Existing deployment configuration files are ignored by the new bundle. When the browser contacts the backend directly from another device (production or development without the proxy), ProcessAssistant must listen on a LAN-accessible address such as `0.0.0.0`, with its port allowed through the firewall. For proxied development, the backend only needs to be reachable on the frontend computer's loopback address. When origins differ, allow the frontend origin in backend CORS, including its new origin after a network change. An HTTPS frontend needs an HTTPS backend (for example, `https://auto:5153` with backend TLS configured) to avoid mixed-content blocking. LAN listening exposes the development server to other devices; use it only on trusted networks, or set `PID_FRONTEND_HOST=127.0.0.1` for local-only access.

开发时修改此文件后重启 Vite；部署时修改地址规则、协议或端口后必须重新打包并部署完整 `dist/`，`auto` 模式仅 IP 变化则不需要。后台地址不能为空且必须为 HTTP/HTTPS URL。新包不再生成或读取 `config.js`，旧部署配置不会生效。局域网直接访问后台时，后台必须监听可访问地址并放行端口；开发代理模式只要求后台可从前端电脑本机访问。跨域访问需配置后台 CORS 并允许新的前端来源，HTTPS 前端应使用 HTTPS 后台。仅在可信网络上开放开发服务器。

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

When importing Phase Excel configurations, the import dialog waits for the
backend task to finish before refreshing the process and phase lists
automatically. No project or page refresh is needed. A failed task or a
two-minute wait timeout is shown in the dialog instead of reporting success.

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
