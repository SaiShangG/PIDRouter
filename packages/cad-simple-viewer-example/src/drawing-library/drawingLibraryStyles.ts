const STYLE_ID = 'drawing-library-styles'

export function injectDrawingLibraryStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    body.drawing-library-open { overflow: hidden; }
    .drawing-library-modal { position: fixed; z-index: 920; inset: 0; padding: 24px; color: #17262b; background: rgba(12, 28, 34, .72); }
    .drawing-library-modal[hidden] { display: none; }
    .drawing-library-shell { display: grid; grid-template-rows: 68px minmax(0, 1fr); width: min(1180px, 100%); height: min(760px, 100%); margin: auto; overflow: hidden; border: 1px solid #aebdc1; border-radius: 6px; background: #edf2f2; box-shadow: 0 24px 70px rgba(3, 18, 23, .42); }
    .drawing-library-shell > header { display: grid; grid-template-columns: minmax(0, 1fr) auto 36px; align-items: center; gap: 16px; padding: 9px 18px; border-bottom: 1px solid #bdc9cc; background: #f8fafa; }
    .drawing-library-shell > header > div { display: grid; gap: 2px; }
    .drawing-library-shell > header span { color: #64777d; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .drawing-library-shell h2, .drawing-library-shell h3, .drawing-library-shell p { margin: 0; }
    .drawing-library-shell h2 { font-size: 19px; }
    .drawing-library-shell h3 { font-size: 14px; }
    .drawing-library-shell .drawing-library-summary { color: #176b52; font-size: 12px; }
    .drawing-library-modal button, .drawing-library-modal input { min-height: 36px; border: 1px solid #bcc9cc; border-radius: 5px; background: #fff; color: inherit; padding: 7px 10px; font: inherit; }
    .drawing-library-modal button { cursor: pointer; }
    .drawing-library-modal button:hover:not(:disabled) { border-color: #188461; color: #075d43; background: #edf8f4; }
    .drawing-library-modal button:disabled { opacity: .46; cursor: not-allowed; }
    .drawing-library-icon-button { display: grid; place-items: center; width: 36px; padding: 0 !important; }
    .drawing-library-icon-button svg, .drawing-library-primary-button svg, .drawing-list-toolbar svg { width: 16px; height: 16px; }
    .drawing-library-body { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 0; }
    .drawing-upload-panel { display: flex; flex-direction: column; gap: 18px; padding: 20px; border-right: 1px solid #c9d3d5; background: #f8fafa; }
    .drawing-upload-panel > div { display: grid; gap: 6px; }
    .drawing-upload-panel p { color: #64777d; font-size: 11px; line-height: 1.5; }
    .drawing-upload-panel form { display: grid; gap: 13px; }
    .drawing-upload-panel label { display: grid; gap: 6px; color: #5f7278; font-size: 11px; font-weight: 650; }
    .drawing-upload-panel input { width: 100%; font-size: 12px; font-weight: 400; }
    .drawing-upload-file { padding: 12px; border: 1px dashed #a9b9bc; background: #fff; }
    .drawing-upload-file small { overflow-wrap: anywhere; color: #64777d; font-weight: 400; }
    .drawing-library-modal .drawing-library-primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-color: #087b58; color: #fff; background: #087b58; font-weight: 700; }
    .drawing-library-modal .drawing-library-primary-button:hover:not(:disabled) { color: #fff; background: #066c4e; }
    .drawing-library-message { padding: 9px 10px; border: 1px solid #dec5c2; color: #8a312a !important; background: #fff7f5; }
    .drawing-list-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; min-height: 0; padding: 18px; background: #edf2f2; }
    .drawing-list-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 12px; }
    .drawing-list-toolbar label { display: flex; align-items: center; gap: 7px; min-width: min(330px, 55%); padding-left: 10px; border: 1px solid #bcc9cc; border-radius: 5px; background: #fff; color: #64777d; }
    .drawing-list-toolbar input { width: 100%; border: 0; outline: 0; }
    .drawing-library-list { min-height: 0; overflow: auto; border: 1px solid #c6d1d3; background: #fff; }
    .drawing-library-row { display: grid; grid-template-columns: minmax(180px, 1.5fr) minmax(90px, .65fr) minmax(145px, 1fr) minmax(100px, .75fr) auto; align-items: center; gap: 12px; min-height: 76px; padding: 11px 13px; border-bottom: 1px solid #e0e7e8; }
    .drawing-library-row:last-child { border-bottom: 0; }
    .drawing-row-identity, .drawing-row-meta, .drawing-row-status { display: grid; gap: 5px; min-width: 0; }
    .drawing-row-identity strong, .drawing-row-identity span, .drawing-row-meta strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .drawing-row-identity strong { font-size: 12px; }
    .drawing-row-identity span, .drawing-row-meta span { color: #718287; font-size: 10px; }
    .drawing-row-meta strong { font-size: 10px; font-weight: 650; }
    .drawing-row-status strong { width: fit-content; padding: 3px 7px; border-radius: 3px; color: #176b52; background: #e4f4ee; font-size: 9px; text-transform: uppercase; }
    .drawing-row-status.is-failed strong { color: #9c352d; background: #fbe8e5; }
    .drawing-row-status.is-uploading strong, .drawing-row-status.is-parsing strong { color: #75590f; background: #fff4ce; }
    .drawing-row-status span { color: #9c352d; font-size: 9px; }
    .drawing-row-status progress { width: 100%; height: 5px; accent-color: #087b58; }
    .drawing-row-actions { display: flex; gap: 5px; }
    .drawing-library-empty { display: grid; place-items: center; min-height: 240px; border: 1px dashed #b8c5c7; color: #708186; background: #f8fafa; font-size: 12px; }
    @media (max-width: 900px) {
      .drawing-library-modal { padding: 8px; }
      .drawing-library-body { grid-template-columns: 250px minmax(0, 1fr); }
      .drawing-library-row { grid-template-columns: minmax(150px, 1fr) minmax(100px, .8fr) auto; }
      .drawing-library-row .drawing-row-meta:first-of-type, .drawing-library-row .drawing-row-meta:nth-of-type(3) { display: none; }
    }
    @media (max-width: 620px) {
      .drawing-library-shell { height: 100%; }
      .drawing-library-body { grid-template-columns: 1fr; overflow: auto; }
      .drawing-upload-panel { border-right: 0; border-bottom: 1px solid #c9d3d5; }
      .drawing-list-panel { min-height: 360px; }
      .drawing-list-toolbar { align-items: stretch; flex-direction: column; }
      .drawing-list-toolbar label { min-width: 100%; }
      .drawing-library-row { grid-template-columns: minmax(0, 1fr) auto; }
      .drawing-library-row .drawing-row-meta, .drawing-library-row .drawing-row-status { display: none; }
    }
  `
  document.head.append(style)
}