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
    :root body select {
      box-sizing: border-box;
      min-width: 0;
      border: 1px solid var(--app-border-strong);
      border-radius: var(--app-radius-control);
      background-color: var(--app-surface-elevated);
      color: var(--app-text);
      accent-color: var(--app-accent);
      font-family: inherit;
      cursor: pointer;
    }
    :root body select:hover:not(:disabled) { border-color: var(--app-accent); }
    :root body select:focus-visible {
      border-color: var(--app-accent);
      outline: 2px solid var(--app-accent);
      outline-offset: 2px;
      box-shadow: none;
    }
    :root body select:disabled {
      color: var(--app-text-muted);
      background-color: var(--app-surface-subtle);
      border-color: var(--app-border);
      cursor: not-allowed;
      opacity: .65;
    }
    :root body select[aria-invalid="true"] { border-color: var(--app-danger); }
    :root body select option, :root body select optgroup {
      background: var(--app-surface-elevated);
      color: var(--app-text);
    }
    :root body select option:checked {
      background: var(--app-accent);
      color: var(--app-text-on-dark);
    }
    :root body select option:disabled { color: var(--app-text-muted); }
    :root body .ml-ex-ui-dropdown {
      background: var(--app-surface-elevated);
      border-color: var(--app-border-strong);
      border-radius: var(--app-radius-panel);
      box-shadow: var(--app-shadow-overlay);
    }
    :root body .ml-ex-ui-dropdown-item { color: var(--app-text); }
    :root body .ml-ex-ui-dropdown-item:is(:hover, :focus-visible):not(:disabled) {
      background: var(--app-success-surface);
      color: var(--app-success-text);
    }
    :root body .ml-ex-ui-dropdown-item:focus-visible {
      outline: 2px solid var(--app-accent);
      outline-offset: -2px;
    }
    @supports (appearance: base-select) {
      :root body select:not([multiple]):where(:not([size]), [size="1"]),
      :root body select:not([multiple]):where(:not([size]), [size="1"])::picker(select) {
        appearance: base-select;
      }
      :root body select:not([multiple]):where(:not([size]), [size="1"]) {
        align-items: center;
        gap: 8px;
        padding-inline: 10px;
        background-image: none;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      :root body select::picker-icon {
        flex: 0 0 auto;
        margin-inline-start: auto;
        color: var(--app-accent);
      }
      :root body select:disabled::picker-icon { color: var(--app-text-muted); }
      :root body select:open { border-color: var(--app-accent); }
      :root body select::picker(select) {
        box-sizing: border-box;
        min-width: anchor-size(width);
        max-width: calc(100vw - 16px);
        max-height: min(320px, 60dvh);
        margin-block: 4px;
        padding: 4px;
        overflow: auto;
        border: 1px solid var(--app-border-strong);
        border-radius: var(--app-radius-panel);
        background: var(--app-surface-elevated);
        color: var(--app-text);
        box-shadow: var(--app-shadow-overlay);
        font: inherit;
        scrollbar-width: thin;
        scrollbar-color: var(--app-border-strong) var(--app-surface-elevated);
      }
      :root body select option {
        min-height: 34px;
        gap: 10px;
        padding: 7px 10px;
        border-radius: var(--app-radius-control);
        line-height: 1.4;
        white-space: normal;
        overflow-wrap: anywhere;
        cursor: pointer;
      }
      :root body select option:is(:hover, :focus-visible):not(:disabled) {
        outline: none;
        background: var(--app-success-surface);
        color: var(--app-success-text);
      }
      :root body select option:checked,
      :root body select option:checked:is(:hover, :focus-visible) {
        background: var(--app-accent);
        color: var(--app-text-on-dark);
      }
      :root body select option::checkmark { color: currentColor; }
      :root body select option:disabled {
        color: var(--app-text-muted);
        cursor: not-allowed;
      }
    }
  `
  document.head.append(style)
}
