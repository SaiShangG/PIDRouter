const STYLE_ID = 'report-workspace-styles'

export function injectReportWorkspaceStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    body.report-workspace-open, body.pdf-preview-open { overflow: hidden; }
    body.report-pdf-exporting .ml-ccl-overlay { display: none !important; }
    .report-workspace-modal { position: fixed; z-index: 900; inset: 0; padding: 18px; color: var(--app-text, #17262b); background: var(--app-overlay-scrim-strong, rgba(12, 28, 34, .72)); }
    .report-workspace-modal[hidden] { display: none; }
    .report-workspace-shell { position: relative; display: grid; grid-template-rows: 64px minmax(0, 1fr); width: 100%; height: 100%; overflow: hidden; border: 1px solid var(--app-border-strong, #aebdc1); border-radius: var(--app-radius-panel, 6px); background: var(--app-surface, #edf2f2); box-shadow: var(--app-shadow-modal, 0 24px 70px rgba(3, 18, 23, .42)); }
    .report-workspace-shell.is-exporting { grid-template-rows: 64px auto minmax(0, 1fr); }
    .report-workspace-shell > header { display: grid; grid-template-columns: minmax(180px, 1fr) auto minmax(150px, 1fr) 34px; align-items: center; gap: 18px; padding: 8px 18px; border-bottom: 1px solid var(--app-border-strong, #bdc9cc); background: var(--app-surface-panel, #f8fafa); }
    .report-workspace-shell > header div { display: grid; gap: 1px; }
    .report-workspace-shell > header span { color: #64777d; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .report-workspace-shell > header h2 { margin: 0; font-size: 18px; letter-spacing: 0; }
    .report-workspace-shell > header .report-workspace-summary { justify-self: end; color: #176b52; font-size: 12px; text-align: right; }
    .report-export-tabs { display: flex !important; align-self: stretch; gap: 2px !important; padding: 3px; border: 1px solid #c7d2d4; border-radius: 5px; background: #e8eeee; }
    .report-workspace-modal .report-export-tab { min-height: 32px; padding: 5px 16px; border-color: transparent; background: transparent; font-size: 11px; font-weight: 700; }
    .report-workspace-modal .report-export-tab[aria-selected='true'] { border-color: #aabbbc; color: #075d43; background: #fff; box-shadow: 0 1px 3px rgba(12, 28, 34, .12); }
    .report-workspace-modal button, .report-workspace-modal input, .report-workspace-modal select { min-height: 34px; border: 1px solid var(--app-border-strong, #bcc9cc); border-radius: var(--app-radius-control, 4px); background: var(--app-surface-elevated, #fff); color: inherit; padding: 6px 9px; font: inherit; }
    .report-workspace-modal button { cursor: pointer; }
    .report-workspace-modal button:hover:not(:disabled) { border-color: var(--app-accent, #188461); color: var(--app-success-text, #075d43); background: var(--app-success-surface, #edf8f4); }
    .report-workspace-modal button:disabled { opacity: .48; cursor: not-allowed; }
    .report-workspace-modal .report-icon-button { display: grid; place-items: center; width: 34px; padding: 0; }
    .report-workspace-body { display: grid; grid-template-columns: minmax(290px, 35%) minmax(0, 65%); min-height: 0; }
    .report-page-browser, .report-page-inspector { min-width: 0; min-height: 0; padding: 14px; }
    .report-page-browser { display: grid; grid-template-rows: auto auto auto auto minmax(0, 1fr); gap: 9px; border-right: 1px solid #c9d3d5; background: #f8fafa; }
    .report-pdf-process-field { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: 8px; color: #52676d; font-size: 11px; font-weight: 650; }
    .report-search-row { display: grid; grid-template-columns: minmax(0, 1fr) 76px; gap: 7px; }
    .report-sequence-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 5px; }
    .report-sequence-row select { min-width: 0; font-size: 10px; }
    .report-workspace-modal .report-sequence-row button { min-height: 30px; padding: 4px 8px; white-space: nowrap; font-size: 10px; }
    .report-filter-row { display: flex; gap: 5px; overflow-x: auto; }
    .report-filter-row button { min-height: 29px; padding: 4px 8px; white-space: nowrap; font-size: 10px; }
    .report-filter-row button.is-active { border-color: var(--app-accent, #087b58); color: #fff; background: var(--app-accent, #087b58); }
    .report-page-viewport { position: relative; min-height: 0; overflow-y: auto; border: 1px solid #cbd5d7; border-radius: 5px; background: #fff; }
    .report-page-tree { display: grid; align-content: start; }
    .report-sequence-group + .report-sequence-group { border-top: 1px solid #b8c8cb; }
    .report-workspace-modal .report-sequence-node { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; align-items: center; gap: 7px; width: 100%; min-height: 40px; padding: 8px 12px; border: 0; border-radius: 0; color: #263f45; background: #eef4f2; text-align: left; font-size: 11px; font-weight: 750; }
    .report-sequence-chevron { transition: transform 140ms ease; }
    .report-sequence-node[aria-expanded='false'] .report-sequence-chevron { transform: rotate(-90deg); }
    .report-sequence-count { color: #587068; font-size: 9px; font-weight: 650; white-space: nowrap; }
    .report-phase-list[hidden] { display: none; }
    .report-workspace-modal .report-page-row { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 52px 64px; align-items: center; gap: 8px; width: 100%; height: 48px; min-height: 48px; padding: 7px 8px 7px 35px; border: 0; border-top: 1px solid #e2e8e9; border-radius: 0; text-align: left; }
    .report-page-row::before { position: absolute; top: 0; bottom: 50%; left: 14px; width: 13px; border-bottom: 1px solid #9babad; border-left: 1px solid #9babad; content: ''; }
    .report-page-row:not(:last-child)::after { position: absolute; top: 50%; bottom: 0; left: 14px; border-left: 1px solid #9babad; content: ''; }
    .report-page-row > strong { grid-column: 2; grid-row: 1; color: #5d7076; font-size: 9px; font-variant-numeric: tabular-nums; font-weight: 650; white-space: nowrap; }
    .report-page-identity { min-width: 0; overflow: hidden; color: #536b71; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .report-page-status { display: inline-flex; grid-column: 3; align-items: center; justify-content: flex-end; gap: 4px; color: #27775f; font-size: 9px; font-style: normal; font-weight: 700; white-space: nowrap; }
    .report-page-status .phase-ui-icon { width: 13px; height: 13px; }
    .report-page-status.is-issue { color: #9a5a00; }
    .report-page-status.is-excluded { color: #69777b; }
    .report-page-status.is-replaced { color: #28658a; }
    .report-page-row.is-selected { color: var(--app-success-text, #075d43); background: var(--app-success-surface, #e3f5ee); box-shadow: inset 3px 0 var(--app-accent, #087b58); }
    .report-page-row.is-excluded { opacity: .56; }
    .report-page-row.is-excluded .report-page-identity { text-decoration: line-through; }
    .report-pdf-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; min-height: 0; background: #f8fafa; }
    .report-pdf-tabs { display: flex; gap: 2px; padding: 8px 12px 0; border-bottom: 1px solid #c9d3d5; background: #eef3f3; }
    .report-workspace-modal .report-pdf-tabs button { min-width: 112px; border-bottom: 0; border-radius: 4px 4px 0 0; color: #52666c; background: #e5ecec; font-size: 11px; font-weight: 700; }
    .report-workspace-modal .report-pdf-tabs button[aria-selected='true'] { border-color: #aabbbc; color: #075d43; background: #fff; box-shadow: inset 0 3px #087b58; }
    .report-pdf-panel-content { min-width: 0; min-height: 0; overflow: auto; background: #f8fafa; }
    .report-workspace-modal .report-primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-color: var(--app-accent, #087b58); color: #fff; background: var(--app-accent, #087b58); font-weight: 650; }
    .report-workspace-modal .report-primary-button:hover:not(:disabled) { color: #fff; background: var(--app-accent-hover, #066c4e); }
    .report-page-inspector { display: flex; flex-direction: column; gap: 12px; padding: 18px 14px 14px; background: #f8fafa; }
    .report-page-inspector h3, .report-export-controls h3 { display: flex; align-items: center; gap: 9px; margin: 0; color: #17262b; font-size: 13px; line-height: 1.25; }
    .report-page-inspector h3::before, .report-export-controls h3::before { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 20px; border: 1px solid #b9c9c6; border-radius: 3px; color: #087b58; background: #edf7f3; content: attr(data-section-number); font-size: 9px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .report-page-inspector dl { display: grid; grid-template-columns: 68px minmax(0, 1fr); gap: 9px; margin: 0; padding: 12px; border: 1px solid #d2dcde; background: #fff; font-size: 11px; }
    .report-page-inspector dt { color: #6b7d82; font-weight: 650; }
    .report-page-inspector dd { margin: 0; overflow-wrap: anywhere; }
    .report-page-inspector label { display: grid; gap: 6px; color: #5f7278; font-size: 11px; font-weight: 650; }
    .report-page-inspector select { width: 100%; color: #17262b; font-size: 11px; font-weight: 400; }
    .report-pdf-panel-content > .report-issue-details { margin: 14px 14px 0; }
    .report-issue-details { display: grid; gap: 8px; }
    .report-issue-details ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
    .report-issue-details li { display: grid; gap: 5px; padding: 9px 10px; border: 1px solid var(--app-danger-border, #dec5c2); border-left: 3px solid var(--app-danger, #b8463b); background: var(--app-danger-surface, #fff7f5); }
    .report-issue-details li.is-warning { border-color: var(--app-warning-border, #dfd1a7); border-left-color: var(--app-warning, #9a7623); background: var(--app-warning-surface, #fffaf0); }
    .report-issue-details li > div { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .report-issue-details b { font-size: 10px; line-height: 1.4; }
    .report-issue-details span { flex: none; color: var(--app-danger-text, #9f332b); font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .report-issue-details .is-warning span { color: var(--app-warning-text, #806018); }
    .report-issue-details p { margin: 0; color: #5f4946; font-size: 10px; line-height: 1.45; }
    .report-export-controls { display: grid; gap: 10px; margin: 8px 14px 18px; padding: 18px 0 0; border-top: 1px solid #c9d3d5; }
    .report-export-controls p { min-height: 32px; margin: 0; color: #65777d; font-size: 11px; line-height: 1.45; }
    .report-export-field { display: grid; gap: 6px; color: #52676d; font-size: 10px; font-weight: 750; }
    .report-export-scope { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 0; padding: 10px; border: 1px solid #d2dcde; background: #fff; }
    .report-export-scope legend { padding: 0 4px; color: #52676d; font-size: 10px; font-weight: 750; }
    .report-export-scope label { display: flex; align-items: center; gap: 6px; color: #33484e; font-size: 10px; }
    .report-export-scope input { width: 15px; min-height: 15px; margin: 0; padding: 0; accent-color: #087b58; }
    .report-export-sequences { display: grid; flex: 1 0 100%; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px 12px; padding-top: 8px; border-top: 1px solid #e1e7e8; }
    .report-matrix-workspace { min-height: 0; overflow: hidden; background: #e7eeee; }
    .report-matrix-panel-content { min-height: 0; overflow: auto; }
    .report-matrix-controls { display: grid; grid-template-columns: minmax(290px, 35%) minmax(0, 65%); width: 100%; height: 100%; min-height: 0; background: #f8fafa; }
    .report-matrix-scope-panel, .report-matrix-settings-panel { display: grid; align-content: start; min-width: 0; min-height: 0; padding: 14px; }
    .report-matrix-scope-panel { grid-template-rows: auto auto auto auto minmax(0, 1fr); gap: 9px; border-right: 1px solid #c9d3d5; }
    .report-matrix-settings-panel { grid-template-columns: minmax(120px, .7fr) minmax(220px, 1.3fr); gap: 12px 18px; min-height: 100%; overflow: visible; }
    .report-matrix-controls h3 { margin: 0; font-size: 14px; }
    .report-matrix-settings-panel > h3, .report-matrix-settings-panel > fieldset, .report-matrix-settings-panel > p, .report-matrix-settings-panel > button { grid-column: 1 / -1; }
    .report-matrix-settings-panel > label { display: grid; grid-template-columns: 90px minmax(0, 1fr); align-items: center; gap: 7px; color: #52676d; font-size: 11px; font-weight: 650; }
    .report-matrix-process-field { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: 8px; color: #52676d; font-size: 11px; font-weight: 650; }
    .report-matrix-scope-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
    .report-workspace-modal .report-matrix-scope-actions button { min-height: 30px; padding: 4px 6px; font-size: 10px; }
    .report-matrix-tree { min-height: 0; overflow: auto; border: 1px solid #cbd5d7; border-radius: 5px; background: #fff; }
    .report-matrix-controls fieldset { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; min-width: 0; margin: 0; padding: 12px; border: 1px solid #d2dcde; background: #fff; }
    .report-matrix-controls legend { padding: 0 4px; color: #52676d; font-size: 10px; font-weight: 750; }
    .report-matrix-controls fieldset label, .report-matrix-tree label { display: flex; align-items: center; gap: 7px; min-width: 0; color: #33484e; font-weight: 500; line-height: 1.35; }
    .report-matrix-controls input[type='checkbox'] { flex: 0 0 auto; width: 16px; min-height: 16px; margin: 0; padding: 0; accent-color: var(--app-accent, #087b58); }
    .report-matrix-process + .report-matrix-process { border-top: 1px solid #b9c9cc; }
    .report-matrix-process-header, .report-matrix-sequence-header { display: grid; grid-template-columns: 24px minmax(0, 1fr); align-items: center; }
    .report-matrix-process-header { padding: 6px 8px; background: #edf4f4; }
    .report-matrix-process-option { min-height: 28px; font-weight: 750 !important; }
    .report-matrix-process-sequences { border-top: 1px solid #d3dfe1; }
    .report-workspace-modal .report-matrix-tree-toggle { display: grid; width: 24px; min-height: 24px; place-items: center; padding: 0; border: 0; background: transparent; color: #52676d; }
    .report-matrix-tree-chevron { transition: transform 140ms ease; }
    .report-matrix-tree-toggle[aria-expanded='false'] .report-matrix-tree-chevron { transform: rotate(-90deg); }
    .report-matrix-sequence { display: grid; gap: 7px; padding: 10px; }
    .report-matrix-sequence + .report-matrix-sequence { border-top: 1px solid #e1e7e8; }
    .report-matrix-phases { display: grid; gap: 7px; }
    .report-matrix-sequence .is-phase { padding-left: 46px; color: #60747a; font-size: 10px; }
    .report-matrix-empty { margin: 0; padding: 28px 12px; color: #64777d; text-align: center; font-size: 11px; }
    .report-matrix-summary { min-height: 36px; margin: auto 0 0; padding-top: 12px; border-top: 1px solid #d9e1e2; color: #52676d; font-size: 11px; }
    .report-export-estimates { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 10px; margin: 0; padding: 9px 10px; border: 1px solid #d2dcde; background: #fff; font-size: 10px; }
    .report-export-estimates dt { color: #6b7d82; }
    .report-export-estimates dd { margin: 0; font-weight: 750; text-align: right; }
    .report-warning-confirmation { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 9px; border: 1px solid var(--app-warning-border, #dfd1a7); background: var(--app-warning-surface, #fffaf0); }
    .report-warning-confirmation p { grid-column: 1 / -1; min-height: 0; color: var(--app-warning-text, #6f5519); }
    .report-export-failures { max-height: 100px; overflow: auto; margin: 0; padding: 8px 8px 8px 24px; border: 1px solid var(--app-danger-border, #dec5c2); background: var(--app-danger-surface, #fff7f5); color: var(--app-danger-text, #7f3029); font-size: 10px; line-height: 1.5; }
    .report-generated-files { display: grid; align-content: start; gap: 10px; padding: 14px; }
    .report-generated-files > h3 { margin: 0; font-size: 14px; }
    .report-generated-empty { margin: 0; padding: 28px; border: 1px dashed #becbcd; color: #64777d; background: #fff; text-align: center; }
    .report-generated-item { border: 1px solid #cbd5d7; background: #fff; }
    .report-generated-header { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 12px; }
    .report-generated-header > svg { color: #087b58; }
    .report-generated-identity { display: grid; gap: 4px; min-width: 0; }
    .report-generated-identity strong, .report-generated-identity span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .report-generated-identity strong { font-size: 12px; }
    .report-generated-identity span { color: #65777d; font-size: 10px; }
    .report-generated-actions, .report-generated-children li > div { display: flex; gap: 5px; }
    .report-workspace-modal .report-generated-actions button, .report-workspace-modal .report-generated-children button { display: grid; place-items: center; width: 32px; min-height: 32px; padding: 0; }
    .report-generated-children { display: grid; margin: 0; padding: 0; border-top: 1px solid #dce4e5; list-style: none; }
    .report-generated-children li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px 7px 44px; border-bottom: 1px solid #edf1f2; color: #40565c; font-size: 10px; }
    .report-generated-children li:last-child { border-bottom: 0; }
    .report-export-status { z-index: 2; display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 52px; padding: 8px 14px; border-bottom: 1px solid #b9d5ca; color: #173d32; background: #e8f5f0; box-shadow: 0 2px 8px rgba(12, 28, 34, .08); }
    .report-export-status > div:not(.report-export-spinner) { display: grid; gap: 2px; min-width: 0; }
    .report-export-status strong { font-size: 12px; letter-spacing: 0; }
    .report-export-status span { overflow: hidden; color: #526f66; font-size: 10px; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
    .report-export-spinner { width: 20px; height: 20px; border: 3px solid #b8d8cc; border-top-color: #087b58; border-radius: 50%; animation: report-export-spin .85s linear infinite; }
    .report-workspace-modal .report-export-status button { min-width: 96px; min-height: 32px; border-color: #75a994; color: #075d43; background: #fff; }
    .report-workspace-modal .report-export-status button:hover:not(:disabled) { border-color: #087b58; color: #075d43; background: #f7fcfa; }
    .pdf-preview-modal { position: fixed; z-index: 950; inset: 0; padding: 12px; color: #17262b; background: rgba(12, 28, 34, .82); }
    .pdf-preview-modal[hidden] { display: none; }
    .pdf-preview-shell { display: grid; grid-template-rows: 50px 48px minmax(0, 1fr); width: 100%; height: 100%; overflow: hidden; border: 1px solid #aebdc1; border-radius: 6px; background: #dfe6e7; box-shadow: 0 24px 70px rgba(3, 18, 23, .5); }
    .pdf-preview-shell > header { display: grid; grid-template-columns: minmax(0, 1fr) 34px; align-items: center; gap: 12px; padding: 7px 14px; border-bottom: 1px solid #bdc9cc; background: #f8fafa; }
    .pdf-preview-shell h2 { overflow: hidden; margin: 0; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
    .pdf-preview-shell button, .pdf-preview-shell input, .pdf-preview-status button { min-height: 34px; border: 1px solid #bcc9cc; border-radius: 4px; color: inherit; background: #fff; }
    .pdf-preview-shell button { display: grid; place-items: center; width: 34px; padding: 0; cursor: pointer; }
    .pdf-preview-shell button:hover:not(:disabled) { border-color: #188461; color: #075d43; background: #edf8f4; }
    .pdf-preview-shell button:disabled { opacity: .45; cursor: not-allowed; }
    .pdf-preview-toolbar { display: flex; align-items: center; justify-content: center; gap: 6px; overflow-x: auto; padding: 7px 12px; border-bottom: 1px solid #bdc9cc; background: #edf2f2; }
    .pdf-preview-toolbar input { width: 58px; padding: 5px; text-align: center; }
    .pdf-preview-toolbar span { flex: none; color: #52666c; font-size: 11px; font-variant-numeric: tabular-nums; }
    .pdf-preview-zoom { width: 72px; text-align: center; }
    .pdf-preview-stage { min-width: 0; min-height: 0; overflow: auto; padding: 24px; text-align: center; }
    .pdf-preview-stage canvas { display: inline-block; background: #fff; box-shadow: 0 4px 18px rgba(12, 28, 34, .24); }
    .pdf-preview-status { position: absolute; inset: 50% auto auto 50%; display: grid; gap: 10px; min-width: 260px; margin: 0; padding: 22px; transform: translate(-50%, -50%); border: 1px solid #aebdc1; background: #fff; text-align: center; }
    .pdf-preview-status span { color: #65777d; font-size: 11px; }
    @keyframes report-export-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .report-export-spinner { animation: none; } }
    @media (max-width: 980px) {
      .report-workspace-modal { padding: 8px; }
      .report-workspace-shell > header { grid-template-columns: minmax(160px, 1fr) auto 34px; gap: 10px; }
      .report-workspace-shell > header .report-workspace-summary { display: none; }
      .report-workspace-body { grid-template-columns: minmax(260px, 35%) minmax(0, 65%); }
    }
    @media (max-width: 680px) {
      .report-workspace-shell { grid-template-rows: auto minmax(0, 1fr); }
      .report-workspace-shell.is-exporting { grid-template-rows: auto auto minmax(0, 1fr); }
      .report-workspace-shell > header { grid-template-columns: minmax(0, 1fr) 34px; }
      .report-export-tabs { grid-column: 1 / -1; grid-row: 2; }
      .report-workspace-modal .report-export-tab { flex: 1; }
      .report-workspace-body { grid-template-columns: 1fr; }
      .report-page-browser { border-right: 0; }
      .report-sequence-row { grid-template-columns: minmax(0, 1fr) auto; }
      .report-sequence-row select { grid-column: 1 / -1; }
      .report-pdf-panel { border-top: 1px solid #c9d3d5; }
      .report-pdf-tabs { overflow-x: auto; }
      .report-workspace-modal .report-pdf-tabs button { min-width: 104px; }
      .pdf-preview-modal { padding: 0; }
      .pdf-preview-shell { border: 0; border-radius: 0; }
      .pdf-preview-toolbar { justify-content: flex-start; }
      .pdf-preview-stage { padding: 12px; }
      .report-matrix-workspace { overflow: auto; }
      .report-matrix-controls { grid-template-columns: 1fr; height: auto; }
      .report-matrix-scope-panel { min-height: 360px; border-right: 0; border-bottom: 1px solid #c9d3d5; }
      .report-matrix-settings-panel { grid-template-columns: 1fr; }
      .report-matrix-settings-panel > label { grid-template-columns: 1fr; }
      .report-matrix-controls fieldset { grid-template-columns: 1fr; }
    }
  `
  document.head.append(style)
}
