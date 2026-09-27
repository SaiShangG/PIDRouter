# CAD Simple Viewer Example

A vanilla TypeScript demo that shows how to embed [`@mlightcad/cad-simple-viewer`](https://github.com/mlightcad/cad-viewer/tree/main/packages/cad-simple-viewer) in a web page: open DXF/DWG files, drive viewer commands from a small toolbar, and lazy-load HTML/PDF export plugins.

## Features

- **Local files** — Open `.dxf` / `.dwg` via file picker (toolbar **Open** or center **Open File**)
- **Sample drawings** — Sidebar loads predefined files from the [cad-data](https://github.com/mlightcad/cad-data) CDN
- **Viewer toolbar** — Zoom fit, zoom window, background toggle, pickbox size, line-weight display, export HTML/PDF
- **Lazy plugins** — registered from `@mlightcad/cad-*-plugin/register` in `src/register.ts`; `-chtml` / `cpdf` / `csvg` load plugin chunks on demand (`chtml` runs the same command-line export when no dialog command is registered)
- **Browser-only** — Parsing and rendering run in the browser (Web Workers + WebAssembly for DWG)
- **Responsive layout** — Sidebar + viewer pane; stacks vertically on narrow screens
- **Process phases** — Create processes and phases, clone the previous or any historical phase, and navigate phase snapshots without replacing the existing viewer tools
- **Local persistence** — Process metadata is stored in `localStorage`; imported DXF/DWG content is stored in IndexedDB so active phases can be restored after a refresh

## Prerequisites

- Node.js **≥ 24** and pnpm **≥ 10** (monorepo workspace)
- Built dependencies before **dev** or **build**:
  - `@mlightcad/cad-simple-viewer`
  - `@mlightcad/cad-html-plugin` (produces `viewer-runtime.iife.js`, copied into the example dist)

From the repo root, a full workspace build satisfies this:

```bash
pnpm install
pnpm build
```

Or build only what this example needs:

```bash
pnpm --filter @mlightcad/cad-simple-viewer build
pnpm --filter @mlightcad/cad-html-plugin build
```

## Getting Started

### Development

From the monorepo root:

```bash
pnpm dev:simple
```

Or from this package:

```bash
cd packages/cad-simple-viewer-example
pnpm dev
```

Vite prints the local URL (default `http://localhost:5173`).

### Production

```bash
pnpm build
pnpm preview
```

The build copies parser workers and `viewer-runtime.iife.js` into `dist/` (see `vite.config.ts`).

### Backend API

The ProcessAssistant API address can be changed after deployment without
rebuilding the application. Edit `dist/config.js` and set the server protocol,
IP address, and port:

```js
window.PID_VIEWER_CONFIG = {
  processAssistantApiUrl: 'http://192.168.1.100:5153'
}
```

A non-empty runtime value takes precedence over
`VITE_PROCESS_ASSISTANT_API_URL`. Keep the value empty to use the build-time
setting (default: `http://localhost:5153`). The backend must allow the deployed
frontend origin through CORS when they use different origins.

## Usage

### Default Device Styles / 默认设备样式

- Built-in defaults are maintained in [defaultDeviceStyles.json](src/presentation/defaultDeviceStyles.json), using the same `presentationProfile.deviceStyles` / `utilities` format as exported files. The file can be imported directly, or replaced with a valid export; changes require rebuilding. Initialization, import, and drawing supplementation share [parseHighlightStyleDocument](src/presentation/highlightStyleDocument.ts). It validates required fields, hex colors, line widths (1-12 px), opacity (0-1), flow rules, and duplicate IDs/states before normalization. Historical backend data still uses the existing compatibility reader.
- Drawing supplementation matches Document `Areas[].ControlModules[].Name` against `deviceType`, ignoring case and surrounding whitespace, and retains the drawing's category name. To add categories, add flat `deviceStyles` entries with distinct stable IDs; the former `categoryMappings` / `templates` format is no longer used. The built-in version is maintained in [defaultDeviceStyles.ts](src/presentation/defaultDeviceStyles.ts), not in the import file.
- Template version 2 covers `Valve`: `OPEN` displays as `ON` (green `#00C853`, opacity 0.5, conducting, automatic flow highlighting enabled); `CLOSE` displays as `OFF` (gray `#B8B8B8`, opacity 0.5, blocking); `PULSE` is green `#00C853`, opacity 1, neutral. All use 3 px lines; automatic flow highlighting is off for CLOSE/PULSE. `PP`, `MX`, and other categories absent from the defaults remain unconfigured. Adding styles does not change flow-graph classification.
- New project initialization also loads two enabled Utilities from the same JSON: `Utility 1` uses cyan `#10D7DA`, 4 px, opacity 0.5; `Utility 2` uses gold `#C79C00`, 3 px, opacity 0.5. Both have stable built-in IDs. Drawing supplementation leaves Utilities unchanged, and existing projects are not automatically upgraded to these defaults.
- A project without previous style configuration loads bundled defaults when it opens, even before a phase or drawing exists. Empty device/Utility arrays without initialization metadata are treated as unconfigured, including old unmarked empty configurations. Nonempty configurations and explicitly marked empty configurations are preserved. Initialization changes neither other presentation settings, device states, nor source Document data, and does not submit to the server. Use Apply to save.
- **Add missing styles from drawing** previews additions and unmatched categories. Confirmation appends missing categories/states only; existing IDs, colors, utilities, and states are preserved. Cancel leaves the project unchanged. Repeating the operation creates no duplicates.
- `presentationProfile.defaultStyleSeed` records `pending`, `generated`, or `configured`, with the template version when generated. Initialization assigns `generated`; confirmed imports and explicit user edits assign `configured`. Saving an explicit empty configuration prevents automatic regeneration only when the backend retains this metadata in saveStyle/configure round trips. Without metadata, an old intentionally cleared configuration cannot be distinguished from a new empty project and will load defaults. Template upgrades never overwrite marked or nonempty project settings.

- 内置默认配置位于 [defaultDeviceStyles.json](src/presentation/defaultDeviceStyles.json)，采用与导出文件相同的 `presentationProfile.deviceStyles` / `utilities` 格式，可直接导入，也可用有效导出文件替换；修改后需要重新构建。初始化、导入和按图纸补齐共用 [parseHighlightStyleDocument](src/presentation/highlightStyleDocument.ts)，在归一化前校验必填字段、十六进制颜色、线宽（1-12 px）、透明度（0-1）、流路规则及重复 ID/状态。后台历史数据仍使用原有兼容读取逻辑。
- 按图纸补齐通过 `deviceType` 匹配 Document 的 `Areas[].ControlModules[].Name`，忽略大小写和首尾空格，生成类别名保留图纸原名。扩展类别时在 `deviceStyles` 中新增扁平记录并设置唯一稳定 ID，不再使用原 `categoryMappings` / `templates` 格式。内置版本号在 [defaultDeviceStyles.ts](src/presentation/defaultDeviceStyles.ts) 中维护，不属于导入文件格式。
- 模板版本 2 包含 `Valve` 三状态：`OPEN` 显示为 `ON`（绿色 `#00C853`、透明度 0.5、导通、开启自动流路高亮）；`CLOSE` 显示为 `OFF`（灰色 `#B8B8B8`、透明度 0.5、阻断）；`PULSE` 为绿色 `#00C853`、透明度 1、中性。线宽均为 3 px，CLOSE/PULSE 关闭自动流路高亮。`PP`、`MX` 等默认配置未包含的类别仍需手动配置，增加样式不会改变流路图的设备分类。
- 新项目初始化时还从同一份 JSON 加载两套已启用的 Utility：`Utility 1` 为青色 `#10D7DA`、4 px、透明度 0.5；`Utility 2` 为金黄色 `#C79C00`、3 px、透明度 0.5。两者使用稳定的内置 ID。“根据图纸补齐”不修改 Utility，已有项目不会自动升级为这些默认值。
- 从未配置样式的项目在打开时即加载内置默认配置，不必先创建阶段或加载图纸。无初始化标记且设备/Utility 均为空时视为未配置，包含无标记的旧空配置；非空配置和带明确标记的空配置保持不变。初始化不修改其他显示设置、设备当前状态或源 Document，也不自动提交后台，需要点击“应用”保存。
- “根据图纸补齐”先预览新增状态和未匹配类别，确认后只追加缺失类别或状态，保留已有 ID、颜色、Utility 和状态。取消不影响项目，重复操作不产生重复项。
- `presentationProfile.defaultStyleSeed` 保存待初始化、已生成或用户配置状态，以及生成时的模板版本。初始化标记为 `generated`，确认导入和显式编辑标记为 `configured`。后台须在 saveStyle/configure 往返中保留此字段，才能保证主动清空后不自动恢复；无标记的旧主动清空配置无法与新项目区分，会加载默认值。模板升级不覆盖带标记或非空的项目配置。

### Drawing Workflow

1. Start the dev server and open the URL shown in the terminal.
2. Open the **工艺与阶段** dock tab, create a process such as `CIP`, then create its first phase from a local drawing, drawing URL, or blank drawing.
3. Later phases can use the previous marked drawing, any historical phase, or a new drawing. Cloned highlight and device state is independent from its source phase.
4. A phase drawing can be renamed from its overview. This changes only the business display name; it does not rename the original file or change the default export file name.
5. **Predefined files** — Click a name in the left sidebar to load a sample from the CDN outside the current phase workflow.
6. **Your own file** — Click **Open File** (empty state) or **Open** (toolbar) to open an ad-hoc `.dxf` or `.dwg` without replacing phase metadata.
7. After a drawing loads, use the toolbar:
   - **Zoom Fit** / **Zoom to Window** — `ZOOM` commands
   - **Switch BG** — Toggle drawing background
   - **Set Pickbox** — Prompt to set `PICKBOX` system variable
   - **LineWeight: On/Off** — Toggle `lwdisplay` on the current database
   - **Export HTML** / **Export PDF** — Run `chtml` / `cpdf` from the toolbar (`chtml` uses command-line prompts here; `-chtml` is equivalent). Plugins must be registered; see `src/main.ts`.

Toast messages at the top report success or errors. The window title updates when a document is activated.

## Supported formats

| Format | Notes |
|--------|--------|
| **DXF** | Parsed in a Web Worker (`dxf-parser-worker.js`) |
| **DWG** | LibreDWG WebAssembly via `libredwg-parser-worker.js` |

## What this example demonstrates

Integration patterns useful when building your own host app (not a full CAD UI like `@mlightcad/cad-viewer`):

| Topic | Implementation |
|-------|----------------|
| Document manager | `AcApDocManager.createInstance({ container, baseUrl, webworkerFileUrls, commandAliases, … })` |
| Local open | `openDocument(name, ArrayBuffer, options)` with `AcApOpenDatabaseOptions` |
| Remote open | `openUrl(url, options)` for CDN sample files |
| Commands | `sendStringToExecute('zoom\\nall')`, `switchbg`, plugin commands `chtml` / `-chtml` / `cpdf` |
| System variables | `AcDbSysVarManager` + `sendStringToExecute` (e.g. `PICKBOX`) |
| Plugins | Lazy registration via `@mlightcad/*/register` in `src/register.ts` (only needed plugins) |
| Command aliases | Demo overrides (`LINE` → `LX`, etc.) via `commandAliases` |
| Workers & assets | `webworkerFileUrls`, `htmlViewerRuntimeUrl`, static copy in Vite |

The document manager initializes at page load so the process/phase dock is available in an empty workspace. CAD documents and export plugins continue to load on demand.

### Local phase data

- `localStorage` key `cad-simple-viewer-example-phase-workspace` contains versioned process, phase, drawing-reference, highlight-handle, and device-state metadata.
- IndexedDB database `cad-simple-viewer-example`, object store `drawing-assets`, contains imported local drawing content.
- Remote drawings persist their URL; blank drawings persist a reconstructable drawing reference.
- Clearing site data removes both the workspace metadata and stored local drawings.
- If a stored drawing is unavailable, its process and phase metadata remains visible so the drawing can be re-associated later.

## Project structure

| Path | Role |
|------|------|
| `index.html` | Layout: sidebar, toolbar, canvas container, styles |
| `src/main.ts` | `CadViewerApp` — wiring UI to `AcApDocManager` |
| `src/phase/` | Process/phase model, dock panel, metadata store, and IndexedDB drawing store |
| `src/register.ts` | Registers export plugins from `@mlightcad/cad-*-plugin/register` |
| `vite.config.ts` | `base: './'`, copies workers + `viewer-runtime.iife.js` |
| `package.json` | Scripts and workspace dependencies |

## Dependencies

| Package | Role |
|---------|------|
| `@mlightcad/cad-simple-viewer` | Core viewer, `AcApDocManager`, commands |
| `@mlightcad/data-model` | Database, system variables, logging |
| `@mlightcad/cad-html-plugin` | Offline HTML export (`-chtml`; toolbar uses `chtml` as alias when no dialog is registered) |
| `@mlightcad/cad-pdf-plugin` | PDF export (`cpdf`) |
| `three` | Peer of the viewer render stack |

## Scripts

```bash
pnpm dev          # Vite dev server
pnpm build        # Typecheck + production build
pnpm preview      # Serve `dist/`
pnpm clean        # Remove `dist/`, `lib/`, tsbuildinfo
pnpm lint         # ESLint on `src/`
pnpm lint:fix     # ESLint with auto-fix
```

From the monorepo root: `pnpm dev:simple`, `pnpm preview:simple`.

## Browser requirements

- Modern browser with **WebGL**
- **WebAssembly** for DWG
- **Web Workers** for DXF/DWG parsing and MTEXT rendering

## Related packages

- [`@mlightcad/cad-viewer`](../cad-viewer) + [`cad-viewer-example`](../cad-viewer-example) — Full Vue UI, i18n, ribbons, dialogs
- [`@mlightcad/cad-html-plugin`](../cad-html-plugin) — HTML export details and `viewer-runtime.iife.js`
- [`@mlightcad/cad-html-exporter-cli`](../cad-html-exporter-cli) — Headless HTML export (same viewer path as this example)

## License

MIT — see the repository root `LICENSE`.
