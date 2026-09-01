const STYLE_ID = 'phase-config-import-modal-styles'

export function injectPhaseConfigImportModalStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .phase-config-import-modal { position: fixed; z-index: 985; inset: 0; display: grid; place-items: center; padding: 20px; color: var(--app-text, #17262b); background: var(--app-overlay-scrim, rgba(12, 28, 34, .62)); }
    .phase-config-import-modal[hidden] { display: none; }
    .phase-config-import-modal [hidden] { display: none; }
    .phase-config-import-shell { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: min(500px, 100%); max-height: calc(100vh - 40px); overflow: hidden; border: 1px solid var(--app-border-strong, #b9c7ca); border-radius: var(--app-radius-panel, 6px); background: var(--app-surface-panel, #f8fafa); box-shadow: var(--app-shadow-modal, 0 20px 54px rgba(3, 18, 23, .38)); }
    .phase-config-import-shell > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--app-border, #d2dcde); background: #f8fafa; }
    .phase-config-import-shell > header > div { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .phase-config-import-shell h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
    .phase-config-import-symbol { display: grid; place-items: center; width: 30px; height: 30px; color: #087b58; background: #e5f5ef; }
    .phase-config-import-symbol svg, .phase-config-import-close svg { width: 17px; height: 17px; }
    .phase-config-import-close { display: grid; place-items: center; flex: 0 0 34px; width: 34px; height: 34px; padding: 0; border: 1px solid var(--app-border-strong, #b9c7ca); border-radius: 4px; color: #53676d; background: #fff; cursor: pointer; }
    .phase-config-import-close:hover { border-color: #188461; color: #075d43; background: #edf8f4; }
    .phase-config-import-body { display: grid; gap: 12px; min-height: 0; padding: 18px 16px; overflow-y: auto; }
    .phase-config-import-dropzone { display: grid; justify-items: center; gap: 7px; width: 100%; min-height: 156px; padding: 22px; border: 1px dashed #8ab8aa; border-radius: 4px; color: #3f555b; background: #f4faf8; font: inherit; cursor: pointer; }
    .phase-config-import-dropzone > span:first-child { display: grid; place-items: center; width: 38px; height: 38px; color: #087b58; background: #dff3eb; }
    .phase-config-import-dropzone > span:first-child svg { width: 20px; height: 20px; }
    .phase-config-import-dropzone strong { color: #17262b; font-size: 14px; letter-spacing: 0; }
    .phase-config-import-dropzone > span { font-size: 12px; }
    .phase-config-import-dropzone:hover:not(:disabled), .phase-config-import-dropzone.is-dragging { border-color: #087b58; border-style: solid; background: #e9f7f2; outline: 2px solid rgba(8, 123, 88, .16); outline-offset: 1px; }
    .phase-config-import-dropzone:disabled { cursor: default; opacity: .58; }
    .phase-config-import-browse { padding: 5px 10px; border: 1px solid #9ec4b8; border-radius: 3px; color: #075d43; background: #fff; font-weight: 700; }
    .phase-config-import-validation { margin: 0; color: #a43d34; font-size: 12px; }
    .phase-config-import-selection { border-top: 1px solid var(--app-border, #d2dcde); padding-top: 11px; }
    .phase-config-import-selection > strong { display: block; margin-bottom: 6px; font-size: 12px; }
    .phase-config-import-selection ul { max-height: 116px; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
    .phase-config-import-selection li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 7px 4px; border-bottom: 1px solid #e2e8e9; font-size: 12px; }
    .phase-config-import-selection li span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .phase-config-import-selection li span:last-child { color: #6c7d82; }
    .phase-config-import-progress { display: grid; gap: 7px; }
    .phase-config-import-progress > div:first-child { display: flex; justify-content: space-between; gap: 12px; color: #40565c; font-size: 12px; }
    .phase-config-import-progress-track { height: 8px; overflow: hidden; border-radius: 4px; background: #dce5e5; }
    .phase-config-import-progress-track i { display: block; width: 0; height: 100%; background: #087b58; transition: width 80ms linear; }
    .phase-config-import-shell > footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--app-border, #d2dcde); background: var(--app-surface, #edf2f2); }
    .phase-config-import-shell > footer button { min-width: 76px; min-height: 34px; padding: 6px 14px; border: 1px solid var(--app-border-strong, #b9c7ca); border-radius: 4px; color: #17262b; background: #fff; font: inherit; cursor: pointer; }
    .phase-config-import-shell > footer button:hover:not(:disabled) { border-color: #188461; color: #075d43; background: #edf8f4; }
    .phase-config-import-shell > footer .phase-config-import-confirm { border-color: #087b58; color: #fff; background: #087b58; }
    .phase-config-import-shell > footer .phase-config-import-confirm:hover:not(:disabled) { color: #fff; background: #066d4e; }
    .phase-config-import-shell > footer button:disabled { border-color: #c7d0d2; color: #8b989c; background: #e4e9ea; cursor: default; }
    @media (max-width: 560px) { .phase-config-import-modal { padding: 10px; } .phase-config-import-body { padding: 14px; } .phase-config-import-dropzone { min-height: 140px; padding: 16px; } }
  `
  document.head.append(style)
}