const STYLE_ID = 'ui-reference-theme-styles'

export function injectUiReferenceThemeStyles() {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    :root {
      --reference-ink: #152026;
      --reference-muted: #64747c;
      --reference-line: #d4dde0;
      --reference-soft: #edf2f3;
      --reference-panel: #f7f9f9;
      --reference-white: #ffffff;
      --reference-nav: #16353d;
      --reference-nav-2: #214951;
      --reference-green: #00a870;
      --reference-green-dark: #087b58;
      --reference-amber: #e69a20;
      --reference-blue: #287eae;
      --ml-ui-bg: var(--reference-white);
      --ml-ui-bg-secondary: var(--reference-panel);
      --ml-ui-surface: var(--reference-white);
      --ml-ui-text: var(--reference-ink);
      --ml-ui-text-muted: var(--reference-muted);
      --ml-ui-muted-text: var(--reference-muted);
      --ml-ui-border: var(--reference-line);
      --ml-ui-accent: var(--reference-green-dark);
    }

    body {
      color: var(--reference-ink);
      background: #dfe7e9;
      font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif;
    }

    .app-shell,
    .viewer-pane {
      color: var(--reference-ink);
      background: var(--reference-panel);
    }

    .app-shell {
      padding-top: 46px;
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
      border: 1px solid #087a5a;
      border-radius: 4px;
      color: #ffffff;
      background: var(--reference-green);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    .phase-context-save:hover:not(:disabled) { background: #087052; }
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

    .viewer-canvas-area { background: #e7ecee; }

    .dev-toolbar {
      position: fixed;
      z-index: 300;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      overflow-x: auto;
      overflow-y: visible;
      min-height: 46px;
      gap: 7px;
      padding: 6px 10px;
      border-color: #0d2930;
      background: #16353d;
    }

    .dev-toolbar.is-disabled { opacity: 1; }

    .dev-toolbar button {
      border-color: #42636a;
      border-radius: 4px;
      color: #eaf2f3;
      background: #214951;
    }

    .dev-toolbar button:hover:not(:disabled),
    .dev-toolbar button.is-active,
    .dev-toolbar-menu-actions button.is-selected {
      border-color: var(--reference-green);
      color: #ffffff;
      background: var(--reference-green-dark);
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
      box-shadow: 0 3px 13px rgba(18, 44, 52, .12);
    }

    .ml-ex-ui-toolbar-btn,
    .ml-ex-ui-toolbar-collapse-btn {
      border-radius: 3px;
      color: #40545b;
      background: transparent;
    }

    .ml-ex-ui-toolbar-btn:hover,
    .ml-ex-ui-toolbar-btn.is-active,
    .ml-ex-ui-toolbar-btn[aria-pressed='true'],
    .ml-ex-ui-toolbar-collapse-btn:hover {
      color: #ffffff;
      background: #2d626c;
    }

    .ml-ex-ui-toolbar-separator { background: var(--reference-line); }

    .ml-cli-bar {
      border: 1px solid var(--reference-line);
      border-radius: 4px;
      color: var(--reference-ink);
      background: var(--reference-white);
      box-shadow: 0 3px 13px rgba(18, 44, 52, .12);
    }

    .ml-cli-text {
      color: var(--reference-ink);
      background: transparent;
    }

    .ml-cli-text::placeholder { color: var(--reference-muted); }

    .ml-cli-text:focus { outline-color: var(--reference-green); }

    .ml-cli-close-btn,
    .ml-cli-up,
    .ml-cli-down {
      color: #40545b;
      background: var(--reference-soft);
      border-color: var(--reference-line);
    }

    .ml-cli-close-btn:hover,
    .ml-cli-up:hover,
    .ml-cli-down:hover {
      color: #075d43;
      background: #dff4eb;
    }

    .open-main-button {
      border-color: var(--reference-green);
      border-radius: 4px;
      background: var(--reference-green-dark);
    }

    .open-main-button:hover { background: #066c4e; }

    .selection-action-menu {
      border-color: #bac8cb;
      border-radius: 4px;
      background: var(--reference-white);
      box-shadow: 0 8px 24px rgba(14, 42, 49, .2);
    }

    .selection-action-menu button {
      border-color: #cbd5d7;
      border-radius: 4px;
      color: #3e555c;
      background: var(--reference-white);
    }

    .selection-action-menu button:hover {
      border-color: var(--reference-green);
      color: #075d43;
      background: #dff4eb;
    }

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