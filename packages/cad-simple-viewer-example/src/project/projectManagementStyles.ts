const STYLE_ID = 'project-management-styles'

export function injectProjectManagementStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    body.project-management-open { overflow: hidden; }
    .project-management-modal { position: fixed; z-index: 930; inset: 0; padding: 24px; color: #17262b; background: rgba(12, 28, 34, .72); }
    .project-management-modal[hidden] { display: none; }
    .project-management-shell { display: grid; grid-template-rows: 68px minmax(0, 1fr); width: min(1040px, 100%); height: min(720px, 100%); margin: auto; overflow: hidden; border: 1px solid #aebdc1; border-radius: 6px; background: #edf2f2; box-shadow: 0 24px 70px rgba(3, 18, 23, .42); }
    .project-management-shell > header { display: grid; grid-template-columns: minmax(0, 1fr) auto 36px; align-items: center; gap: 16px; padding: 9px 18px; border-bottom: 1px solid #bdc9cc; background: #f8fafa; }
    .project-management-shell > header > div { display: grid; gap: 2px; }
    .project-management-shell > header span { color: #64777d; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .project-management-shell h2, .project-management-shell h3, .project-management-shell p { margin: 0; }
    .project-management-shell h2 { font-size: 19px; }
    .project-management-shell h3 { font-size: 14px; }
    .project-management-shell .project-summary { color: #176b52; font-size: 12px; }
    .project-management-modal button, .project-management-modal input { min-height: 36px; border: 1px solid #bcc9cc; border-radius: 5px; background: #fff; color: inherit; padding: 7px 10px; font: inherit; }
    .project-management-modal button { cursor: pointer; }
    .project-management-modal button:hover:not(:disabled) { border-color: #188461; color: #075d43; background: #edf8f4; }
    .project-management-modal button:disabled { opacity: .46; cursor: not-allowed; }
    .project-icon-button { display: grid; place-items: center; width: 36px; padding: 0 !important; }
    .project-icon-button svg, .project-primary-button svg, .project-danger-button svg, .project-secondary-button svg, .project-drawing-search svg { width: 15px; height: 15px; }
    .project-management-body { display: grid; grid-template-columns: 310px minmax(0, 1fr); min-height: 0; }
    .project-list-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; padding: 18px; border-right: 1px solid #c9d3d5; background: #f8fafa; }
    .project-list-panel > div:first-child { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; }
    .project-list { min-height: 0; overflow: auto; border: 1px solid #c6d1d3; background: #fff; }
    .project-list-item { display: grid; gap: 5px; width: 100%; min-height: 64px !important; padding: 7px 10px !important; border: 0 !important; border-bottom: 1px solid #e0e7e8 !important; border-radius: 0 !important; text-align: left; }
    .project-list-item strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .project-list-item span { color: #718287; font-size: 10px; }
    .project-list-item-details { display: flex; flex-wrap: wrap; gap: 4px 10px; }
    .project-list-item-details span:last-child { flex-basis: 100%; color: #8a989c; font-size: 9px; }
    .project-list-item.is-selected { color: #075d43; background: #e3f5ee; box-shadow: inset 3px 0 #087b58; }
    .project-editor-panel { display: grid; gap: 14px; min-width: 0; min-height: 0; padding: 20px; }
    .project-editor-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .project-editor-heading > div { display: grid; gap: 6px; }
    .project-editor-heading p { color: #64777d; font-size: 11px; }
    .project-editor-heading .project-editor-heading-actions { display: flex; align-items: center; gap: 7px; }
    .project-details { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin: 0; overflow: hidden; border: 1px solid #c6d1d3; border-radius: 5px; background: #c6d1d3; }
    .project-details > div { display: grid; gap: 4px; min-width: 0; padding: 9px 10px; background: #f8fafa; }
    .project-details .project-id-field { grid-column: 1 / -1; padding-block: 6px; background: #f1f5f5; }
    .project-details .project-id-field dt { color: #91a0a4; }
    .project-details .project-id-field dd { color: #718287; font-family: monospace; font-size: 9px; font-weight: 400; }
    .project-details dt { color: #718287; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .project-details dd { overflow: hidden; margin: 0; font-size: 11px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .project-editor-panel > label { display: grid; gap: 6px; color: #5f7278; font-size: 11px; font-weight: 650; }
    .project-editor-panel > label input { width: 100%; font-size: 12px; font-weight: 400; }
    .project-editor-panel > label input[readonly] { border-color: #d4dcde; color: #31454b; background: #f8fafa; }
    .project-drawing-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 11px; }
    .project-drawing-header span { color: #176b52; }
    .project-drawing-search { display: flex !important; align-items: center; gap: 7px !important; padding-left: 10px; border: 1px solid #bcc9cc; border-radius: 5px; color: #64777d !important; background: #fff; }
    .project-drawing-search input { width: 100%; min-height: 34px; border: 0; outline: 0; }
    .project-drawing-list { min-height: 0; overflow: auto; border: 1px solid #c6d1d3; background: #fff; }
    .project-drawing-option { display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: center; gap: 9px; min-height: 58px; padding: 8px 12px; border-bottom: 1px solid #e0e7e8; cursor: pointer; }
    .project-drawing-option:last-child { border-bottom: 0; }
    .project-drawing-option:hover { background: #f3f8f7; }
    .project-drawing-option.is-readonly { grid-template-columns: minmax(0, 1fr); cursor: default; }
    .project-drawing-option.is-readonly:hover { background: #fff; }
    .project-drawing-option input { width: 16px; min-height: 16px; accent-color: #087b58; }
    .project-drawing-option > span { display: grid; gap: 4px; min-width: 0; }
    .project-drawing-option strong, .project-drawing-option small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .project-drawing-option strong { font-size: 12px; }
    .project-drawing-option small { color: #718287; font-size: 10px; }
    .project-editor-panel footer { display: flex; justify-content: flex-end; gap: 8px; min-height: 34px; }
    .project-management-modal .project-primary-button, .project-management-modal .project-danger-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; }
    .project-management-modal .project-primary-button, .project-management-modal .project-danger-button, .project-management-modal .project-secondary-button { min-height: 34px; padding: 5px 11px; font-size: 11px; }
    .project-management-modal .project-secondary-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
    .project-management-modal .project-primary-button { border-color: #087b58; color: #fff; background: #087b58; }
    .project-management-modal .project-primary-button:hover:not(:disabled) { color: #fff; background: #066c4e; }
    .project-management-modal .project-danger-button { border-color: #b55a50; color: #9c352d; }
    .project-message { padding: 9px 10px; border: 1px solid #dec5c2; color: #8a312a; background: #fff7f5; font-size: 11px; }
    .project-empty { display: grid; place-items: center; min-height: 180px; padding: 20px; color: #708186; font-size: 12px; text-align: center; }
    @media (max-width: 720px) {
      .project-management-modal { padding: 8px; }
      .project-management-shell { height: 100%; }
      .project-management-body { grid-template-columns: 1fr; overflow: auto; }
      .project-list-panel { min-height: 230px; border-right: 0; border-bottom: 1px solid #c9d3d5; }
      .project-list { max-height: 180px; }
      .project-editor-panel { min-height: 480px; }
      .project-details { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `
  document.head.append(style)
}