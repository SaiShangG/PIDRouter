import { injectBrandThemeTokens } from './brandThemeTokens'

const STYLE_ID = 'ui-reference-theme-styles'

export function injectUiReferenceThemeStyles() {
  injectBrandThemeTokens()
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    body {
      color: var(--reference-ink);
      background: var(--app-surface);
      font-family: "IBM Plex Sans", "Segoe UI", "Microsoft YaHei UI", sans-serif;
    }

    .app-shell,
    .viewer-pane {
      color: var(--reference-ink);
      background: var(--reference-panel);
    }

    .app-shell {
      padding-top: var(--app-toolbar-height);
    }

    .phase-sidebar {
      flex: 0 0 320px;
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: 100%;
      color: var(--reference-ink);
      background: var(--reference-panel);
      border-right: 1px solid var(--reference-line);
    }

    .phase-sidebar-resize-handle {
      position: relative;
      z-index: 3;
      flex: 0 0 7px;
      width: 7px;
      margin-left: -4px;
      cursor: ew-resize;
      touch-action: none;
      background: transparent;
    }

    .phase-sidebar-resize-handle::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 3px;
      width: 1px;
      background: var(--reference-line);
      transition: width .15s ease, background .15s ease;
    }

    .phase-sidebar-resize-handle:hover::after,
    .phase-sidebar-resize-handle:focus-visible::after {
      width: 3px;
      background: var(--reference-green);
    }

    .phase-sidebar-resize-handle:focus-visible { outline: 2px solid #287eae; outline-offset: -2px; }

    .phase-sidebar-header {
      flex: 0 0 43px;
      display: flex;
      align-items: center;
      padding: 0 14px;
      border-bottom: 1px solid var(--reference-line);
      background: var(--reference-white);
      font-size: 13px;
    }

    .phase-sidebar-header strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .phase-sidebar-style-button {
      flex: 0 0 30px;
      width: 30px;
      height: 30px;
      margin-left: auto;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #b7d4cb;
      border-radius: 5px;
      color: #087b58;
      background: #f5fbf9;
      cursor: pointer;
    }

    .phase-sidebar-style-button:hover:not(:disabled) { border-color: #087b58; background: #e5f5ef; }
    .phase-sidebar-style-button:disabled { opacity: .38; cursor: not-allowed; }
    .phase-sidebar-style-button .phase-ui-icon { width: 16px; height: 16px; }

    .language-toggle-button {
      flex: 0 0 30px;
      width: 30px;
      height: 30px;
      margin-left: auto;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #c4cfd2;
      border-radius: 4px;
      color: var(--reference-green);
      background: var(--reference-white);
      cursor: pointer;
    }

    .language-toggle-button:hover,
    .language-toggle-button:focus-visible { border-color: var(--reference-green); background: #edf9f4; }

    .phase-sidebar-content {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .phase-contextbar {
      flex: 0 0 54px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      border-bottom: 1px solid var(--reference-line);
      background: #f2f5f5;
    }

    .phase-context-field {
      display: flex;
      align-items: center;
      gap: 7px;
      color: var(--reference-muted);
      font-size: 11px;
      font-weight: 700;
    }

    .phase-context-field select {
      width: 160px;
      height: 32px;
      padding: 0 28px 0 9px;
      border: 1px solid #c4cfd2;
      border-radius: 4px;
      color: var(--reference-ink);
      background: var(--reference-white);
    }

    .phase-context-field select:disabled { color: #9aa7ab; }

    .phase-context-summary {
      padding: 4px 8px;
      border: 1px solid #a7cbc0;
      border-radius: 3px;
      color: #176a50;
      background: #e8f6f1;
      font-size: 10px;
      font-weight: 800;
      white-space: nowrap;
    }

    .phase-context-spacer { flex: 1; }

    .phase-context-save {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border: 1px solid var(--app-accent);
      border-radius: 4px;
      color: #ffffff;
      background: var(--app-accent);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    .phase-context-save:hover:not(:disabled) { background: var(--app-accent-hover); }
    .phase-context-save:disabled { border-color: #bdc8ca; color: #7d8b90; background: #e3e8e9; cursor: default; }
    .phase-context-save svg { width: 14px; height: 14px; }

    .phase-context-status {
      display: flex;
      align-items: center;
      gap: 7px;
      height: 30px;
      padding: 0 10px;
      border: 1px solid #b8dacc;
      border-radius: 15px;
      color: #176a50;
      background: #edf9f4;
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }

    .phase-context-status i {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--reference-green);
    }

    .viewer-canvas-area { background: var(--app-surface-canvas); }

    .dev-toolbar {
      position: fixed;
      z-index: 300;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: visible;
      height: var(--app-toolbar-height);
      min-height: var(--app-toolbar-height);
      gap: 7px;
      padding: 6px 10px;
      border-color: #0b252b;
      background: var(--app-surface-nav);
    }

    .dev-toolbar.is-disabled { opacity: 1; }

    .app-toolbar-identity {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      gap: 9px;
      min-width: 0;
      margin-right: 8px;
      color: var(--app-text-on-dark);
    }

    .app-toolbar-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid #3a646c;
      border-radius: var(--app-radius-control);
      color: #a8e6d1;
      background: #0c282f;
      font: 700 10px/1 "IBM Plex Mono", "Cascadia Mono", monospace;
      letter-spacing: 0;
    }

    .app-toolbar-title-group {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.15;
    }

    .app-toolbar-title-group strong {
      overflow: hidden;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .app-toolbar-title-group span {
      overflow: hidden;
      color: #9fb3b7;
      font-size: 10px;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .app-toolbar-spacer { flex: 1 1 auto; min-width: 8px; }

    .app-toolbar-context {
      display: inline-flex;
      align-items: center;
      flex: 0 1 420px;
      min-width: 0;
      gap: 12px;
      padding-left: 14px;
      border-left: 1px solid #35545b;
    }

    .app-toolbar-context-item {
      display: grid;
      min-width: 0;
      gap: 1px;
    }

    .app-toolbar-context-item small {
      color: #8fa5a9;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .app-toolbar-context-item strong {
      overflow: hidden;
      max-width: 180px;
      color: var(--app-text-on-dark);
      font-size: 11px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .app-toolbar-context-divider {
      flex: 0 0 1px;
      align-self: stretch;
      background: #35545b;
    }

    .phase-sidebar-toggle-button { display: none; }

    @media (max-width: 480px) {
      .app-toolbar-title-group span { display: none; }
    }

    @media (max-width: 1100px) {
      .app-toolbar-context { display: none; }
    }

    .dev-toolbar button {
      border-color: #42636a;
      border-radius: var(--app-radius-control);
      color: #eaf2f3;
      background: var(--app-surface-nav-hover);
    }

    .dev-toolbar button:hover:not(:disabled),
    .dev-toolbar button.is-active,
    .dev-toolbar-menu-actions button.is-selected {
      border-color: var(--reference-green);
      color: #ffffff;
      background: var(--app-accent);
    }

    .dev-toolbar-menu {
      position: fixed;
      z-index: 1000;
      overflow-y: auto;
      border-color: #bac8cb;
      border-radius: 4px;
      color: var(--reference-ink);
      background: var(--reference-white);
      box-shadow: 0 8px 24px rgba(14, 42, 49, .18);
    }

    .dev-toolbar-menu-section + .dev-toolbar-menu-section { border-color: var(--reference-line); }
    .dev-toolbar-menu-label, .dev-toolbar-menu-check { color: var(--reference-muted); }

    .dev-toolbar-menu-field input[type='number'],
    .dev-toolbar-menu-field select {
      border-color: #c4cfd2;
      color: var(--reference-ink);
      background: var(--reference-white);
    }

    .dev-toolbar-menu-check input[type='checkbox'] { accent-color: var(--reference-green-dark); }

    .ml-ex-ui-dock-panel {
      color: var(--reference-ink);
      background: var(--reference-panel);
      border-color: var(--reference-line);
      box-shadow: none;
    }

    .ml-ex-ui-dock-header,
    .ml-ex-ui-dock-tabs,
    .ml-ex-ui-dock-actions {
      color: var(--reference-ink);
      background: var(--reference-white);
      border-color: var(--reference-line);
    }

    .ml-ex-ui-dock-tab,
    .ml-ex-ui-dock-action-btn,
    .ml-ex-ui-dock-tab-overflow-btn {
      color: var(--reference-muted);
      background: transparent;
      border-radius: 3px;
    }

    .ml-ex-ui-dock-tab:hover,
    .ml-ex-ui-dock-tab[aria-selected='true'],
    .ml-ex-ui-dock-action-btn:hover,
    .ml-ex-ui-dock-tab-overflow-btn:hover {
      color: #075d43;
      background: #dff4eb;
    }

    .ml-ex-ui-dock-tab[aria-selected='true'] { box-shadow: inset 0 -2px var(--reference-green); }

    .ml-ex-ui-dock-content,
    .ml-ex-ui-dock-tab-panel,
    .ml-ex-ui-dock-body,
    .ml-ex-ui-dock-main {
      color: var(--reference-ink);
      background: var(--reference-panel);
    }

    .ml-ex-ui-dock-resize-handle { background: var(--reference-line); }

    .ml-ex-ui-toolbar {
      padding: 5px;
      border: 1px solid var(--reference-line);
      border-radius: 4px;
      color: var(--reference-ink);
      background: var(--reference-white);
      box-shadow: var(--app-shadow-overlay);
    }

    .ml-ex-ui-toolbar-btn,
    .ml-ex-ui-toolbar-collapse-btn {
      border-radius: 3px;
      color: var(--app-text-muted);
      background: transparent;
    }

    .ml-ex-ui-toolbar-btn:hover,
    .ml-ex-ui-toolbar-btn.is-active,
    .ml-ex-ui-toolbar-btn[aria-pressed='true'],
    .ml-ex-ui-toolbar-collapse-btn:hover {
      color: #ffffff;
      background: var(--app-accent);
    }

    .ml-ex-ui-toolbar-btn:focus-visible,
    .ml-ex-ui-toolbar-collapse-btn:focus-visible {
      outline: 2px solid var(--app-focus);
      outline-offset: 1px;
    }

    .ml-ex-ui-toolbar-separator { background: var(--reference-line); }

    .ml-cli-bar {
      border: 1px solid var(--reference-line);
      border-radius: 4px;
      color: var(--reference-ink);
      background: var(--reference-white);
      box-shadow: var(--app-shadow-overlay);
    }

    .ml-cli-text {
      color: var(--reference-ink);
      background: transparent;
    }

    .ml-cli-text::placeholder { color: var(--reference-muted); }

    .ml-cli-text:focus { outline-color: var(--app-focus); }

    .ml-cli-close-btn,
    .ml-cli-up,
    .ml-cli-down {
      color: var(--app-text-muted);
      background: var(--reference-soft);
      border-color: var(--reference-line);
    }

    .ml-cli-close-btn:hover,
    .ml-cli-up:hover,
    .ml-cli-down:hover {
      color: var(--app-success-text);
      background: var(--app-success-surface);
    }

    .ml-cli-close-btn:focus-visible,
    .ml-cli-up:focus-visible,
    .ml-cli-down:focus-visible {
      outline: 2px solid var(--app-focus);
      outline-offset: 1px;
    }

    .open-main-button {
      border-color: var(--reference-green);
      border-radius: 4px;
      background: var(--reference-green-dark);
    }

    .open-main-button:hover { background: #066c4e; }

    .demo-dock-tab-status {
      border-color: var(--reference-line);
      color: var(--reference-muted);
      background: var(--reference-soft);
    }

    @media (max-width: 768px) {
      .phase-sidebar {
        flex: 0 0 min(42vh, 320px);
        width: 100%;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--reference-line);
      }

      .phase-sidebar-resize-handle { display: none; }

      .phase-contextbar {
        flex: 0 0 auto;
        flex-wrap: wrap;
        gap: 6px 10px;
        padding: 7px 10px;
      }

      .phase-context-field { flex: 1 1 150px; }
      .phase-context-field select { flex: 1; width: auto; min-width: 0; }
      .phase-context-summary { order: 3; }
      .phase-context-spacer { display: none; }
      .phase-context-status { order: 4; margin-left: auto; }
      .phase-context-save { order: 5; }

      .file-sidebar,
      .file-sidebar-toggle,
      .file-sidebar-body.file-sidebar-popover {
        color: var(--reference-ink);
        background: var(--reference-white);
        border-color: var(--reference-line);
      }

      .file-sidebar-toggle:hover { background: var(--reference-soft); }
      .file-sidebar-toggle-subtitle, .file-sidebar-chevron { color: var(--reference-muted); }
    }
  `
  document.head.append(style)
}
