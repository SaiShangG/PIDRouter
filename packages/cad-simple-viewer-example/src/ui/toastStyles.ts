const STYLE_ID = 'app-toast-styles'

export function injectToastStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .app-toast { position: fixed; z-index: 1100; top: 58px; right: 12px; display: flex; align-items: flex-start; gap: 10px; width: min(390px, calc(100vw - 24px)); padding: 10px 10px 10px 12px; border: 1px solid var(--app-border-strong, #b9c7ca); border-left-width: 3px; border-radius: var(--app-radius-control, 4px); color: var(--app-text, #162126); background: var(--app-surface-elevated, #fff); box-shadow: var(--app-shadow-overlay, 0 8px 24px rgba(14, 42, 49, .18)); }
    .app-toast.is-success { border-left-color: var(--app-accent, #087b58); }
    .app-toast.is-info { border-left-color: var(--app-selection, #287eae); }
    .app-toast.is-warning { border-left-color: var(--app-warning, #c77b12); }
    .app-toast.is-error { border-left-color: var(--app-danger, #b42318); }
    .app-toast-message { flex: 1; min-width: 0; padding: 5px 0; overflow-wrap: anywhere; font-size: 12px; line-height: 1.45; }
    .app-toast-close { flex: 0 0 30px; display: inline-grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 1px solid transparent; border-radius: var(--app-radius-control, 4px); color: var(--app-text-muted, #627279); background: transparent; cursor: pointer; }
    .app-toast-close:hover { border-color: var(--app-border, #d3dcde); color: var(--app-text, #162126); background: var(--app-surface, #eef2f3); }
    .app-toast-close:focus-visible { outline: 2px solid var(--app-focus, #36a3d9); outline-offset: 1px; }
    .app-toast-close svg { width: 15px; height: 15px; }
  `
  document.head.append(style)
}