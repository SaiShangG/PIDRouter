const STYLE_ID = 'report-workspace-styles'

export function injectReportWorkspaceStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    body.report-workspace-open { overflow: hidden; }
    body.report-pdf-exporting .ml-ccl-overlay { display: none !important; }
    .report-workspace-modal { position: fixed; z-index: 900; inset: 0; padding: 18px; color: var(--app-text, #17262b); background: var(--app-overlay-scrim-strong, rgba(12, 28, 34, .72)); }
    .report-workspace-modal[hidden] { display: none; }
    .report-workspace-shell { position: relative; display: grid; grid-template-rows: 64px minmax(0, 1fr); width: 100%; height: 100%; overflow: hidden; border: 1px solid var(--app-border-strong, #aebdc1); border-radius: var(--app-radius-panel, 6px); background: var(--app-surface, #edf2f2); box-shadow: var(--app-shadow-modal, 0 24px 70px rgba(3, 18, 23, .42)); }
    .report-workspace-shell > header { display: grid; grid-template-columns: minmax(0, 1fr) auto 34px; align-items: center; gap: 18px; padding: 8px 18px; border-bottom: 1px solid var(--app-border-strong, #bdc9cc); background: var(--app-surface-panel, #f8fafa); }
    .report-workspace-shell > header div { display: grid; gap: 1px; }
    .report-workspace-shell > header span { color: #64777d; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .report-workspace-shell > header h2 { margin: 0; font-size: 18px; letter-spacing: 0; }
    .report-workspace-shell > header .report-workspace-summary { color: #176b52; font-size: 12px; }
    .report-workspace-modal button, .report-workspace-modal input, .report-workspace-modal select { min-height: 34px; border: 1px solid var(--app-border-strong, #bcc9cc); border-radius: var(--app-radius-control, 4px); background: var(--app-surface-elevated, #fff); color: inherit; padding: 6px 9px; font: inherit; }
    .report-workspace-modal button { cursor: pointer; }
    .report-workspace-modal button:hover:not(:disabled) { border-color: var(--app-accent, #188461); color: var(--app-success-text, #075d43); background: var(--app-success-surface, #edf8f4); }
    .report-workspace-modal button:disabled { opacity: .48; cursor: not-allowed; }
    .report-workspace-modal .report-icon-button { display: grid; place-items: center; width: 34px; padding: 0; }
    .report-workspace-body { display: grid; grid-template-columns: minmax(290px, 340px) minmax(400px, 1fr) minmax(250px, 300px); min-height: 0; }
    .report-page-browser, .report-page-preview, .report-page-inspector { min-width: 0; min-height: 0; padding: 14px; }
    .report-page-browser { display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 9px; border-right: 1px solid #c9d3d5; background: #f8fafa; }
    .report-search-row { display: grid; grid-template-columns: minmax(0, 1fr) 76px; gap: 7px; }
    .report-filter-row { display: flex; gap: 5px; overflow-x: auto; }
    .report-filter-row button { min-height: 29px; padding: 4px 8px; white-space: nowrap; font-size: 10px; }
    .report-filter-row button.is-active { border-color: var(--app-accent, #087b58); color: #fff; background: var(--app-accent, #087b58); }
    .report-page-viewport { position: relative; min-height: 0; overflow-y: auto; border: 1px solid #cbd5d7; border-radius: 5px; background: #fff; }
    .report-page-window { position: relative; width: 100%; }
    .report-page-row { position: absolute; left: 0; display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: 8px; width: 100%; height: 66px; padding: 8px; border: 0; border-bottom: 1px solid #e2e8e9; border-radius: 0; text-align: left; }
    .report-page-row > strong { color: #5d7076; font-size: 11px; font-variant-numeric: tabular-nums; }
    .report-page-identity { display: grid; gap: 3px; min-width: 0; }
    .report-page-identity b, .report-page-identity span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .report-page-identity b { font-size: 11px; }
    .report-page-identity span { color: #65777d; font-size: 10px; }
    .report-page-row i { color: #27775f; font-size: 9px; font-style: normal; font-weight: 700; }
    .report-page-row.is-selected { color: var(--app-success-text, #075d43); background: var(--app-success-surface, #e3f5ee); box-shadow: inset 3px 0 var(--app-accent, #087b58); }
    .report-page-row.is-excluded { opacity: .56; }
    .report-page-row.is-excluded .report-page-identity { text-decoration: line-through; }
    .report-page-preview { display: grid; align-content: start; gap: 8px; overflow: auto; padding: 28px; background: #e7eeee; }
    .report-preview-page-number { color: #087b58; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .report-page-preview h3 { margin: 0; font-size: 24px; }
    .report-page-preview > p { margin: 0; color: #66787e; font-size: 12px; }
    .report-preview-surface { display: grid; place-items: center; gap: 12px; min-height: 360px; margin-top: 16px; padding: 30px; border: 1px solid #bccacc; background-color: #fdfefe; background-image: linear-gradient(#edf1f1 1px, transparent 1px), linear-gradient(90deg, #edf1f1 1px, transparent 1px); background-size: 20px 20px; text-align: center; }
    .report-preview-surface strong { font-size: 18px; }
    .report-preview-surface span { max-width: 420px; color: #687a80; font-size: 12px; line-height: 1.55; }
    .report-workspace-modal .report-primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-color: var(--app-accent, #087b58); color: #fff; background: var(--app-accent, #087b58); font-weight: 650; }
    .report-workspace-modal .report-primary-button:hover:not(:disabled) { color: #fff; background: var(--app-accent-hover, #066c4e); }
    .report-page-inspector { display: flex; flex-direction: column; gap: 12px; overflow: auto; border-left: 1px solid #c9d3d5; background: #f8fafa; }
    .report-page-inspector h3 { margin: 0; font-size: 14px; }
    .report-page-inspector dl { display: grid; grid-template-columns: 68px minmax(0, 1fr); gap: 9px; margin: 0; padding: 12px; border: 1px solid #d2dcde; background: #fff; font-size: 11px; }
    .report-page-inspector dt { color: #6b7d82; font-weight: 650; }
    .report-page-inspector dd { margin: 0; overflow-wrap: anywhere; }
    .report-page-inspector label { display: grid; gap: 6px; color: #5f7278; font-size: 11px; font-weight: 650; }
    .report-page-inspector select { width: 100%; color: #17262b; font-size: 11px; font-weight: 400; }
    .report-issue-details { display: grid; gap: 8px; }
    .report-issue-details ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
    .report-issue-details li { display: grid; gap: 5px; padding: 9px 10px; border: 1px solid var(--app-danger-border, #dec5c2); border-left: 3px solid var(--app-danger, #b8463b); background: var(--app-danger-surface, #fff7f5); }
    .report-issue-details li.is-warning { border-color: var(--app-warning-border, #dfd1a7); border-left-color: var(--app-warning, #9a7623); background: var(--app-warning-surface, #fffaf0); }
    .report-issue-details li > div { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .report-issue-details b { font-size: 10px; line-height: 1.4; }
    .report-issue-details span { flex: none; color: var(--app-danger-text, #9f332b); font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .report-issue-details .is-warning span { color: var(--app-warning-text, #806018); }
    .report-issue-details p { margin: 0; color: #5f4946; font-size: 10px; line-height: 1.45; }
    .report-export-controls { display: grid; gap: 8px; margin-top: auto; padding-top: 14px; border-top: 1px solid #d2dcde; }
    .report-export-controls h3 { margin: 0; }
    .report-export-controls p { min-height: 32px; margin: 0; color: #65777d; font-size: 11px; line-height: 1.45; }
    .report-export-estimates { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 10px; margin: 0; padding: 9px 10px; border: 1px solid #d2dcde; background: #fff; font-size: 10px; }
    .report-export-estimates dt { color: #6b7d82; }
    .report-export-estimates dd { margin: 0; font-weight: 750; text-align: right; }
    .report-warning-confirmation { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 9px; border: 1px solid var(--app-warning-border, #dfd1a7); background: var(--app-warning-surface, #fffaf0); }
    .report-warning-confirmation p { grid-column: 1 / -1; min-height: 0; color: var(--app-warning-text, #6f5519); }
    .report-export-failures { max-height: 100px; overflow: auto; margin: 0; padding: 8px 8px 8px 24px; border: 1px solid var(--app-danger-border, #dec5c2); background: var(--app-danger-surface, #fff7f5); color: var(--app-danger-text, #7f3029); font-size: 10px; line-height: 1.5; }
    .report-export-overlay { position: absolute; z-index: 10; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; color: #fff; background: var(--app-overlay-scrim, rgba(0, 0, 0, .62)); text-align: center; }
    .report-export-overlay strong { font-size: 18px; letter-spacing: 0; }
    .report-export-overlay span { max-width: 680px; color: #d7dede; font-size: 12px; line-height: 1.5; }
    .report-export-spinner { width: 46px; height: 46px; border: 4px solid rgba(255, 255, 255, .28); border-top-color: #42b98e; border-radius: 50%; animation: report-export-spin .85s linear infinite; }
    .report-workspace-modal .report-export-overlay button { min-width: 120px; border-color: rgba(255, 255, 255, .68); color: #fff; background: transparent; }
    .report-workspace-modal .report-export-overlay button:hover:not(:disabled) { border-color: #fff; color: #fff; background: rgba(255, 255, 255, .12); }
    @keyframes report-export-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .report-export-spinner { animation: none; } }
    @media (max-width: 980px) {
      .report-workspace-modal { padding: 8px; }
      .report-workspace-body { grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); }
      .report-page-inspector { position: absolute; right: 8px; bottom: 8px; width: min(300px, calc(100vw - 32px)); max-height: 48vh; border: 1px solid #b9c7ca; box-shadow: 0 12px 32px rgba(12, 28, 34, .2); }
    }
    @media (max-width: 680px) {
      .report-workspace-body { grid-template-columns: 1fr; }
      .report-page-preview { display: none; }
      .report-page-browser { border-right: 0; }
    }
  `
  document.head.append(style)
}
