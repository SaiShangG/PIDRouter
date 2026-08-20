const STYLE_ID = 'pid-viewer-brand-theme-tokens'

export function injectBrandThemeTokens() {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    :root {
      --app-surface: #eef2f3;
      --app-surface-panel: #f8faf9;
      --app-surface-elevated: #ffffff;
      --app-surface-canvas: #e5eaec;
      --app-surface-subtle: #f3f6f6;
      --app-surface-nav: #132f36;
      --app-surface-nav-hover: #204750;
      --app-text: #162126;
      --app-text-muted: #627279;
      --app-text-subtle: #718288;
      --app-text-on-dark: #edf4f4;
      --app-border: #d3dcde;
      --app-border-strong: #b9c7ca;
      --app-border-subtle: #dbe3e5;
      --app-accent: #087b58;
      --app-accent-hover: #066c4e;
      --app-selection: #287eae;
      --app-selection-surface: #e7f2f7;
      --app-warning: #c77b12;
      --app-danger: #b42318;
      --app-focus: #36a3d9;
      --app-radius-control: 4px;
      --app-radius-panel: 6px;
      --app-toolbar-height: 56px;
      --app-shadow-overlay: 0 8px 24px rgba(14, 42, 49, .18);
      --app-shadow-modal: 0 24px 70px rgba(3, 18, 23, .42);
      --app-overlay-scrim: rgba(12, 28, 34, .64);
      --app-overlay-scrim-strong: rgba(12, 28, 34, .72);
      --app-success-surface: #e3f5ee;
      --app-success-text: #176b52;
      --app-success-border: #87c8b3;
      --app-warning-surface: #fffaf0;
      --app-warning-text: #806018;
      --app-warning-border: #dfd1a7;
      --app-danger-surface: #fff7f5;
      --app-danger-text: #8a312a;
      --app-danger-border: #dec5c2;
      --app-danger-hover: #922f27;
      --reference-ink: var(--app-text);
      --reference-muted: var(--app-text-muted);
      --reference-line: var(--app-border);
      --reference-soft: var(--app-surface);
      --reference-panel: var(--app-surface-panel);
      --reference-white: var(--app-surface-elevated);
      --reference-nav: var(--app-surface-nav);
      --reference-nav-2: var(--app-surface-nav-hover);
      --reference-green: #00a870;
      --reference-green-dark: var(--app-accent);
      --reference-amber: var(--app-warning);
      --reference-blue: var(--app-selection);
      --ml-ui-bg: var(--app-surface-elevated);
      --ml-ui-bg-secondary: var(--app-surface-panel);
      --ml-ui-surface: var(--app-surface-elevated);
      --ml-ui-text: var(--app-text);
      --ml-ui-text-muted: var(--app-text-muted);
      --ml-ui-muted-text: var(--app-text-muted);
      --ml-ui-border: var(--app-border);
      --ml-ui-accent: var(--app-accent);
    }
  `
  document.head.append(style)
}
