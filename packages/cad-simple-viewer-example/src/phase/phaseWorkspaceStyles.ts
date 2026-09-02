const STYLE_ID = 'phase-workspace-styles'

export function injectPhaseWorkspaceStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .phase-workspace { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; color: var(--app-text, #152026); background: var(--app-surface-panel, #f5f8f8); }
    .phase-workspace-content { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 14px; }
    .phase-workspace-block { display: grid; gap: 9px; padding: 12px 0; border-bottom: 1px solid var(--app-border-subtle, #dbe3e5); }
    .phase-workspace-block:first-child { padding-top: 0; }
    .phase-workspace-block h3 { margin: 0; color: var(--app-text, #34474e); font-size: 11px; font-weight: 750; text-transform: uppercase; }
    .phase-workspace-block p { margin: 0; color: var(--reference-muted, #64747c); font-size: 12px; line-height: 1.5; }
    .phase-workspace form { display: grid; gap: 8px; }
    .phase-workspace input, .phase-workspace select, .phase-workspace button, .phase-workspace-modal input, .phase-workspace-modal select, .phase-workspace-modal button { min-height: 34px; border: 1px solid var(--app-border-strong, #c4cfd2); border-radius: var(--app-radius-control, 4px); background: var(--app-surface-elevated, #ffffff); color: inherit; padding: 6px 9px; font: inherit; }
    .phase-workspace button, .phase-workspace-modal button { cursor: pointer; }
    .phase-workspace button:hover:not(:disabled), .phase-workspace-modal button:hover:not(:disabled) { border-color: var(--app-success-border, #7ebda9); color: var(--app-success-text, #075d43); background: var(--app-success-surface, #edf8f4); }
    .phase-workspace button:disabled, .phase-workspace-modal button:disabled { opacity: .55; cursor: wait; }
    .phase-workspace .phase-workspace-primary, .phase-workspace-modal .phase-workspace-primary { border-color: var(--app-accent, #087b58); background: var(--app-accent, #087b58); color: #fff; font-weight: 650; }
    .phase-workspace .phase-workspace-primary:hover:not(:disabled), .phase-workspace-modal .phase-workspace-primary:hover:not(:disabled) { border-color: var(--app-accent-hover, #075f46); background: var(--app-accent-hover, #075f46); color: #fff; }
    .phase-ui-icon { display: block; flex: 0 0 auto; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.75; }
    .phase-process-selector { display: grid; grid-template-columns: minmax(0, 1fr) 34px 34px; gap: 7px; }
    .phase-process-creator { display: grid; grid-template-columns: minmax(0, 1fr) auto 34px; gap: 7px; padding: 9px; border: 1px solid var(--app-border-subtle, #d8e2e4); border-radius: var(--app-radius-panel, 6px); background: var(--app-surface-elevated, #fff); }
    .phase-workspace .phase-icon-button, .phase-workspace-modal .phase-icon-button { display: inline-grid; place-items: center; min-width: 28px; width: 28px; min-height: 28px; height: 28px; padding: 0; border-color: var(--app-border-strong, #c4cfd2); color: var(--app-accent, #087b58); background: var(--app-surface-elevated, #fff); }
    .phase-process-selector > .phase-icon-button, .phase-workspace .phase-process-cancel { min-width: 34px; width: 34px; min-height: 34px; height: 34px; }
    .phase-workspace .phase-process-delete { border-color: var(--app-danger-border, #cf7d75); color: var(--app-danger-text, #a7352d); background: var(--app-danger-surface, #fff8f7); }
    .phase-workspace .phase-process-delete:hover { border-color: var(--app-danger, #a7352d); color: var(--app-danger-hover, #8f2d26); background: var(--app-danger-surface, #fdecea); }
    .phase-workspace-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 6px; }
    .phase-tree-section { gap: 5px; }
    .phase-tree-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .phase-sequence-tree { display: grid; gap: 7px; }
    .phase-sequence-group { display: grid; gap: 4px; padding: 5px; border: 1px solid var(--app-border-subtle, #d8e2e4); border-radius: var(--app-radius-panel, 6px); background: var(--app-surface-elevated, #fff); }
    .phase-sequence-group.is-active { border-color: var(--app-success-border, #87c8b3); box-shadow: inset 3px 0 var(--app-accent, #087b58); }
    .phase-sequence-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
    .phase-workspace .phase-sequence-toggle { display: grid; grid-template-columns: 14px minmax(0, 1fr); align-items: center; gap: 6px; width: 100%; min-height: 35px; padding: 4px 6px; border: 0; background: transparent; text-align: left; }
    .phase-workspace .phase-sequence-toggle:hover:not(:disabled) { border-color: transparent; background: var(--app-success-surface, #edf8f4); }
    .phase-sequence-identity { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto auto; align-items: center; gap: 6px; min-width: 0; }
    .phase-sequence-identity strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .phase-sequence-number { color: #60747b; font-size: 11px; font-variant-numeric: tabular-nums; }
    .phase-sequence-status { color: #467067; font-size: 9px; font-weight: 750; }
    .phase-sequence-controls { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 3px; padding: 0 3px 3px; opacity: .48; transition: opacity .15s ease; }
    .phase-sequence-group:hover .phase-sequence-controls, .phase-sequence-group:focus-within .phase-sequence-controls { opacity: 1; }
    .phase-sequence-editor { display: grid; grid-template-columns: 70px minmax(0, 1fr) auto; gap: 6px; padding: 7px; border: 1px solid var(--app-border-subtle, #d8e2e4); border-radius: var(--app-radius-control, 4px); background: var(--app-surface-elevated, #fff); }
    .phase-workspace .phase-tree-header { display: grid; grid-template-columns: 16px auto auto 1fr; align-items: center; gap: 6px; min-height: 32px; padding: 2px 0; border: 0; background: transparent; text-align: left; }
    .phase-workspace .phase-tree-header:hover:not(:disabled) { border-color: transparent; background: transparent; }
    .phase-tree-header-title { color: #34474e; font-size: 11px; font-weight: 750; text-transform: uppercase; }
    .phase-count-badge { display: inline-grid; place-items: center; min-width: 21px; height: 20px; padding: 0 6px; border-radius: 10px; color: var(--app-text-muted, #53666d); background: var(--app-surface, #e3eaec); font-size: 10px; font-weight: 750; }
    .phase-tree-chevron { width: 14px; height: 14px; color: #60747b; transition: transform .16s ease; }
    .phase-tree-header[aria-expanded='false'] .phase-tree-chevron { transform: rotate(-90deg); }
    .phase-tree-list { display: grid; gap: 4px; padding-left: 13px; }
    .phase-tree-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px; }
    .phase-tree-item.is-dragging { opacity: .45; }
    .phase-tree-item.is-drag-over .phase-tree-node { border-color: var(--app-accent, #00a870); box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent, #00a870) 14%, transparent); }
    .phase-workspace .phase-tree-node { display: grid; grid-template-columns: 14px minmax(0, 1fr); align-items: center; gap: 7px; width: 100%; min-height: 42px; padding: 5px 8px; text-align: left; cursor: grab; }
    .phase-workspace .phase-tree-node:active { cursor: grabbing; }
    .phase-workspace .phase-tree-node.is-active { border-color: var(--app-success-border, #24a77d); color: var(--app-success-text, #075d43); background: var(--app-success-surface, #e1f5ed); box-shadow: inset 3px 0 var(--app-accent, #087b58); }
    .phase-tree-grip { width: 14px; height: 14px; color: #91a1a6; }
    .phase-tree-node-label { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 6px; min-width: 0; }
    .phase-tree-node-label span { display: block; overflow: hidden; color: inherit; font-size: 12px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .phase-tree-node-label .phase-tree-node-number { color: #718288; font-size: 10px; font-variant-numeric: tabular-nums; }
    .phase-tree-node-label .phase-tree-drawing-status { color: #60747b; font-size: 9px; font-weight: 600; }
    .phase-tree-order-controls { display: grid; grid-template-columns: repeat(3, 28px); align-items: center; gap: 3px; opacity: .38; transition: opacity .15s ease; }
    .phase-tree-item:hover .phase-tree-order-controls, .phase-tree-item:focus-within .phase-tree-order-controls { opacity: 1; }
    .phase-workspace .phase-tree-order-button { color: var(--app-accent, #087b58); }
    .phase-workspace .phase-tree-order-button:disabled { cursor: not-allowed; opacity: .3; }
    .phase-overview-card { gap: 12px; }
    .phase-overview-identity { display: grid; padding: 10px 11px; border-left: 3px solid var(--app-accent, #087b58); border-radius: 0 var(--app-radius-control, 4px) var(--app-radius-control, 4px) 0; background: var(--app-success-surface, #eaf5f1); }
    .phase-overview-identity span { color: var(--app-accent, #087b58); font-size: 10px; font-weight: 800; }
    .phase-overview-identity strong { overflow-wrap: anywhere; font-size: 14px; }
    .phase-overview-identity-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; }
    .phase-overview-identity-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 7px; min-width: 0; }
    .phase-workspace-overview { display: grid; gap: 0; margin: 0; border: 1px solid var(--app-border-subtle, #d8e2e4); border-radius: var(--app-radius-panel, 6px); background: var(--app-surface-elevated, #fff); font-size: 12px; }
    .phase-overview-row { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 10px; align-items: start; padding: 9px 10px; border-bottom: 1px solid #e4eaec; }
    .phase-overview-row:last-child { border-bottom: 0; }
    .phase-workspace-overview dt { color: #718288; font-size: 11px; font-weight: 650; }
    .phase-workspace-overview dd { min-width: 0; margin: 0; color: #273b42; overflow-wrap: anywhere; }
    .phase-overview-drawing { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; }
    .phase-overview-drawing-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .phase-workspace .phase-overview-edit { min-width: 28px; width: 28px; min-height: 28px; height: 28px; }
    .phase-workspace .phase-overview-delete { justify-self: end; min-width: 28px; width: 28px; min-height: 28px; height: 28px; padding: 0; border-color: var(--app-danger-border, #cf7d75); color: var(--app-danger-text, #a7352d); background: var(--app-danger-surface, #fff8f7); }
    .phase-workspace .phase-overview-delete:hover { border-color: var(--app-danger, #a7352d); color: var(--app-danger-hover, #8f2d26); background: var(--app-danger-surface, #fdecea); }
    .phase-overview-statuses { display: flex; flex-wrap: wrap; gap: 5px; }
    .phase-status-badge { padding: 3px 6px; border: 1px solid var(--app-success-border, #c8ddd6); border-radius: 10px; color: var(--app-success-text, #176a50); background: var(--app-success-surface, #edf8f4); font-size: 10px; white-space: nowrap; }
    .phase-overview-rename { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 5px; }
    .phase-create-section { flex: 0 0 auto; z-index: 2; padding: 12px 14px 14px; border-top: 1px solid #d3dfe1; border-bottom: 0; background: rgba(245, 248, 248, .96); box-shadow: 0 -8px 18px rgba(40, 65, 73, .06); backdrop-filter: blur(8px); }
    .phase-create-section .phase-workspace-primary { width: 100%; }
    .phase-workspace-modal { position: fixed; z-index: 950; inset: 0; display: grid; place-items: center; padding: 20px; background: var(--app-overlay-scrim, rgba(15, 32, 38, .48)); }
    .phase-workspace-modal[hidden] { display: none; }
    .phase-workspace-modal [hidden] { display: none; }
    .phase-workspace-modal-dialog { width: min(520px, 100%); max-height: min(720px, calc(100vh - 40px)); overflow: auto; border: 1px solid var(--app-border-strong, #b9c7ca); border-radius: var(--app-radius-panel, 6px); background: var(--app-surface-elevated, #ffffff); box-shadow: var(--app-shadow-modal, 0 18px 48px rgba(15, 32, 38, .28)); }
    .phase-workspace-modal-dialog > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 52px; padding: 10px 16px; border-bottom: 1px solid var(--reference-line, #d4dde0); }
    .phase-workspace-modal-dialog h2 { margin: 0; font-size: 16px; }
    .phase-workspace .phase-workspace-modal-close, .phase-workspace-modal .phase-workspace-modal-close { min-width: 30px; width: 30px; min-height: 30px; height: 30px; }
    .phase-workspace-modal-form { display: grid; gap: 10px; padding: 16px; }
    .phase-drawing-association-dialog { width: min(560px, 100%); overflow: hidden; }
    .phase-drawing-association-form { gap: 14px; padding: 18px; }
    .phase-drawing-association-form .phase-modal-field { gap: 6px; }
    .phase-drawing-association-form .phase-modal-field > input, .phase-drawing-association-form .phase-modal-field > select { min-height: 38px; }
    .phase-drawing-association-form .phase-drawing-source-field { padding-bottom: 14px; border-bottom: 1px solid #e1e7e8; }
    .phase-drawing-association-form .phase-drawing-name-field { margin-top: 2px; }
    .phase-drawing-association-form .phase-workspace-modal-actions { margin: 2px -18px -18px; padding: 12px 18px; border-top: 1px solid #dbe3e5; background: #f5f8f8; }
    .phase-operation-dialog { width: min(440px, 100%); }
    .phase-sequence-modal-form { gap: 14px; }
    .phase-modal-field-grid { display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 10px; }
    .phase-modal-field { display: grid; gap: 5px; min-width: 0; color: #53676e; font-size: 11px; font-weight: 650; }
    .phase-modal-field > input, .phase-modal-field > select { width: 100%; color: #152026; font-size: 12px; font-weight: 400; }
    .phase-workspace-modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 6px; }
    .phase-workspace-modal-actions button { min-width: 88px; }
    .phase-delete-dialog { width: min(430px, 100%); }
    .phase-delete-dialog-body { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 12px; align-items: start; padding: 18px 18px 12px; }
    .phase-delete-warning-icon { width: 30px; height: 30px; margin: 3px; color: #a3382e; }
    .phase-delete-dialog-body p { margin: 0 0 10px; color: #53676e; font-size: 12px; line-height: 1.55; }
    .phase-delete-target { display: block; padding: 9px 10px; border: 1px solid #e1e7e8; border-radius: 5px; color: #263b42; background: #f7f9f9; font-size: 12px; overflow-wrap: anywhere; }
    .phase-delete-actions { padding: 10px 18px 16px; border-top: 1px solid #e5eaeb; }
    .phase-workspace .phase-delete-confirm { border-color: var(--app-danger, #9f352c); color: #fff; background: var(--app-danger, #a83d33); }
    .phase-workspace .phase-delete-confirm:hover { background: var(--app-danger-hover, #922f27); }
    .highlight-style-dialog { width: min(780px, 100%); }
    .highlight-style-header-actions { display: flex; gap: 6px; align-items: center; }
    .highlight-style-tabs { display: flex; gap: 2px; padding: 10px 16px 0; border-bottom: 1px solid #dbe3e5; }
    .phase-workspace .highlight-style-tabs button, .phase-workspace-modal .highlight-style-tabs button { min-height: 34px; border: 0; border-bottom: 3px solid transparent; border-radius: 0; background: transparent; color: #53676e; font-size: 12px; font-weight: 700; }
    .phase-workspace .highlight-style-tabs button[aria-selected='true'], .phase-workspace-modal .highlight-style-tabs button[aria-selected='true'] { border-bottom-color: var(--app-accent, #087b58); color: var(--app-success-text, #075d43); }
    .highlight-style-content { min-height: 300px; max-height: min(520px, calc(100vh - 220px)); overflow: auto; padding: 16px; }
    .highlight-style-list, .highlight-device-table { display: grid; gap: 12px; }
    .highlight-device-card { display: grid; gap: 8px; padding: 10px; border: 1px solid #dbe3e5; border-radius: 6px; background: #f8fafa; }
    .highlight-device-card > header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    .highlight-device-card > header input { min-width: 0; font-weight: 700; }
    .highlight-item-actions { display: flex; gap: 4px; align-items: center; }
    .highlight-style-row { display: grid; align-items: center; gap: 8px; padding: 9px; border: 1px solid #dbe3e5; border-radius: 6px; background: #f8fafa; }
    .flow-style-row { grid-template-columns: minmax(110px, 1fr) minmax(130px, .8fr) minmax(150px, 1.3fr) auto; }
    .flow-style-row > .highlight-checkbox { grid-column: 1 / 3; }
    .utility-style-row { grid-template-columns: minmax(130px, .8fr) minmax(0, 2fr) 28px; }
    .utility-style-row > .phase-icon-button { justify-self: center; align-self: center; }
    .highlight-style-controls { display: grid; grid-template-columns: 34px minmax(0, 1fr) minmax(62px, .8fr) minmax(62px, .8fr); align-items: end; gap: 6px; min-width: 0; }
    .highlight-style-field { display: grid; grid-template-rows: auto minmax(30px, auto); gap: 3px; min-width: 0; color: #53676e; font-size: 10px; font-weight: 650; }
    .highlight-style-field > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .highlight-style-field input { width: 100%; min-width: 0; }
    .phase-workspace .highlight-style-controls input[type='color'], .phase-workspace-modal .highlight-style-controls input[type='color'] { width: 34px; min-height: 30px; padding: 2px; }
    .phase-workspace .highlight-style-controls input[type='checkbox'], .phase-workspace .highlight-checkbox input[type='checkbox'], .phase-workspace-modal .highlight-style-controls input[type='checkbox'], .phase-workspace-modal .highlight-checkbox input[type='checkbox'] { width: 16px; min-height: 16px; margin: 0; padding: 0; accent-color: var(--app-accent, #087b58); }
    .highlight-checkbox { display: inline-flex; align-items: center; gap: 6px; color: #53676e; font-size: 11px; font-weight: 650; }
    .highlight-device-row { display: grid; grid-template-columns: minmax(100px, .8fr) minmax(120px, 1fr) minmax(0, 2fr) auto; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid #e1e7e8; }
    .highlight-device-row > .highlight-checkbox { grid-column: 1 / 3; }
    .highlight-device-row > .highlight-style-field:last-child { grid-column: 3 / 4; }
    .highlight-device-row > .highlight-item-actions { justify-self: center; align-self: center; }
    .highlight-device-row strong { color: #075d43; font-size: 10px; }
    .highlight-device-creator { display: grid; grid-template-columns: minmax(180px, 1fr) auto; gap: 8px; padding-top: 8px; }
    .highlight-default-field { display: grid; grid-template-columns: minmax(150px, .8fr) minmax(220px, 1.2fr); align-items: center; gap: 12px; padding: 9px; border: 1px solid #dbe3e5; border-radius: 6px; background: #f8fafa; color: #53676e; font-size: 11px; font-weight: 650; }
    .highlight-style-actions { padding: 10px 16px 16px; border-top: 1px solid #dbe3e5; }
    .highlight-import-preview-dialog { width: min(560px, 100%); }
    .highlight-import-preview-dialog h2 { display: flex; align-items: center; gap: 8px; }
    .highlight-import-preview-body { display: grid; gap: 14px; padding: 16px; }
    .highlight-import-summary { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #dbe3e5; border-radius: 6px; overflow: hidden; }
    .highlight-import-summary > div { display: grid; gap: 3px; padding: 12px; text-align: center; background: #f8fafa; }
    .highlight-import-summary > div + div { border-left: 1px solid #dbe3e5; }
    .highlight-import-summary strong { color: #075d43; font-size: 22px; }
    .highlight-import-summary span { color: #53676e; font-size: 11px; }
    .highlight-import-issues { display: grid; gap: 6px; max-height: 180px; margin: 0; padding: 0; overflow: auto; list-style: none; }
    .highlight-import-issues li { display: flex; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid #e0c176; border-radius: 4px; color: #735b16; background: #fff9e8; font-size: 11px; }
    .highlight-import-issues li.is-error { border-color: #d9948e; color: #8f2d26; background: #fff4f3; }
    .highlight-import-valid { margin: 0; color: #467067; font-size: 12px; }
    .highlight-import-modes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 3px; border: 1px solid #cbd7d9; border-radius: 6px; background: #eef3f3; }
    .phase-workspace-modal .highlight-import-modes button { border: 0; background: transparent; color: #53676e; font-size: 12px; font-weight: 700; }
    .phase-workspace-modal .highlight-import-modes button[aria-checked='true'] { color: #fff; background: var(--app-accent, #087b58); }
    .highlight-import-actions { padding: 10px 16px 16px; border-top: 1px solid #dbe3e5; }
    .style-source-dialog { width: min(560px, 100%); }
    .style-source-body { display: grid; gap: 16px; padding: 16px; }
    .style-source-segments { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 2px; padding: 3px; border: 1px solid #cbd7d9; border-radius: 6px; background: #eef3f3; }
    .phase-workspace-modal .style-source-segments button { border: 0; background: transparent; color: #53676e; font-size: 12px; font-weight: 700; }
    .phase-workspace-modal .style-source-segments button[aria-checked='true'] { color: #fff; background: var(--app-accent, #087b58); }
    .style-source-controls { display: grid; gap: 12px; }
    .style-source-controls > label { display: grid; grid-template-columns: 120px minmax(0, 1fr); align-items: center; gap: 12px; color: #53676e; font-size: 12px; font-weight: 650; }
    .style-source-color-inputs, .style-source-range-inputs { display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: center; gap: 8px; }
    .style-source-range-inputs { grid-template-columns: minmax(0, 1fr) 48px; }
    .phase-workspace-modal .style-source-color-inputs input[type='color'] { width: 44px; padding: 2px; }
    .style-source-range-inputs output { color: #263b42; font: 12px/1.2 "IBM Plex Mono", monospace; text-align: right; }
    .style-source-preview { display: grid; grid-template-columns: minmax(80px, 1fr) auto; align-items: center; gap: 12px; min-height: 46px; padding: 10px 12px; border: 1px solid #dbe3e5; border-radius: 6px; background: #f8fafa; color: #53676e; font-size: 11px; }
    .style-source-preview > span:first-child { display: block; min-height: 1px; border-radius: 1px; }
    .style-source-actions { padding: 10px 16px 16px; border-top: 1px solid #dbe3e5; }
    .phase-workspace [hidden] { display: none; }
    @media (max-width: 600px) {
      .phase-workspace-modal { align-items: end; padding: 10px; }
      .phase-workspace-modal-dialog { max-height: calc(100vh - 66px); }
      .phase-modal-field-grid { grid-template-columns: 1fr; }
      .highlight-style-tabs { overflow-x: auto; padding-inline: 10px; }
      .highlight-style-content { min-height: 240px; padding: 10px; }
      .flow-style-row, .utility-style-row, .highlight-device-row, .highlight-default-field { grid-template-columns: 1fr; }
      .flow-style-row > .highlight-checkbox { grid-column: auto; }
      .highlight-style-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .highlight-style-field:first-child { grid-column: 1 / -1; }
      .highlight-style-actions { display: grid; grid-template-columns: repeat(3, 1fr); }
      .highlight-style-actions button { min-width: 0; }
      .style-source-segments { grid-auto-flow: row; }
      .style-source-controls > label { grid-template-columns: 1fr; }
    }
  `
  document.head.append(style)
}