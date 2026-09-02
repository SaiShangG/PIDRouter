const STYLE_ID = 'excel-preview-styles'

export const injectExcelPreviewStyles = () => {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    body.excel-preview-open { overflow: hidden; }
    .excel-preview-modal { position: fixed; z-index: 960; inset: 0; padding: 12px; color: #17262b; background: rgba(12, 28, 34, .82); }
    .excel-preview-modal[hidden] { display: none; }
    .excel-preview-shell { display: grid; grid-template-rows: 50px 43px 48px minmax(0, 1fr); width: 100%; height: 100%; overflow: hidden; border: 1px solid #aebdc1; border-radius: 6px; background: #eef2f2; box-shadow: 0 24px 70px rgba(3, 18, 23, .5); }
    .excel-preview-shell > header { display: grid; grid-template-columns: minmax(0, 1fr) 34px; align-items: center; gap: 12px; padding: 7px 14px; border-bottom: 1px solid #bdc9cc; background: #f8fafa; }
    .excel-preview-shell h2 { overflow: hidden; margin: 0; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; letter-spacing: 0; }
    .excel-preview-shell button, .excel-preview-shell input, .excel-preview-status button { min-height: 34px; border: 1px solid #bcc9cc; border-radius: 4px; color: inherit; background: #fff; }
    .excel-preview-shell button { cursor: pointer; }
    .excel-preview-shell button:hover:not(:disabled) { border-color: #188461; color: #075d43; background: #edf8f4; }
    .excel-preview-shell button:disabled { opacity: .45; cursor: not-allowed; }
    .excel-preview-shell header button, .excel-preview-toolbar > button { display: grid; flex: none; place-items: center; width: 34px; padding: 0; }
    .excel-preview-tabs { display: flex; gap: 2px; overflow-x: auto; padding: 5px 12px 0; border-bottom: 1px solid #bdc9cc; background: #e5ebec; }
    .excel-preview-tabs button { flex: none; min-height: 32px; padding: 5px 14px; border-bottom: 0; border-radius: 4px 4px 0 0; font-size: 11px; }
    .excel-preview-tabs button[aria-selected='true'] { border-color: #7ba99a; color: #075d43; background: #fff; font-weight: 700; }
    .excel-preview-toolbar { display: flex; align-items: center; gap: 7px; overflow-x: auto; padding: 7px 12px; border-bottom: 1px solid #bdc9cc; background: #f8fafa; }
    .excel-preview-toolbar label { display: flex; align-items: center; flex: 1 1 260px; min-width: 180px; max-width: 420px; }
    .excel-preview-toolbar label svg { position: relative; z-index: 1; width: 15px; margin-right: -25px; margin-left: 9px; color: #60767b; }
    .excel-preview-toolbar input { width: 100%; padding: 5px 10px 5px 32px; }
    .excel-preview-summary { flex: 1 0 auto; color: #52666c; font-size: 11px; }
    .excel-preview-page { flex: none; min-width: 56px; color: #52666c; text-align: center; font-size: 11px; font-variant-numeric: tabular-nums; }
    .excel-preview-stage { position: relative; min-width: 0; min-height: 0; overflow: auto; background: #fff; }
    .excel-preview-stage table { border-spacing: 0; min-width: 100%; table-layout: fixed; font-size: 11px; }
    .excel-preview-stage th, .excel-preview-stage td { box-sizing: border-box; min-width: 120px; max-width: 320px; height: 29px; overflow: hidden; padding: 5px 8px; border-right: 1px solid #dce3e4; border-bottom: 1px solid #dce3e4; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
    .excel-preview-stage thead th { position: sticky; z-index: 2; top: 0; color: #42575d; background: #e9eeee; text-align: center; font-weight: 600; }
    .excel-preview-stage tr > :first-child { position: sticky; z-index: 1; left: 0; min-width: 52px; width: 52px; color: #596d72; background: #f1f4f4; text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
    .excel-preview-stage thead tr > :first-child { z-index: 3; }
    .excel-preview-stage tbody tr:nth-child(even) td { background: #fbfcfc; }
    .excel-preview-stage td.is-match { color: #153d31; background: #dff4b8 !important; box-shadow: inset 0 0 0 1px #8caf4c; }
    .excel-preview-empty, .excel-preview-status { position: absolute; inset: 50% auto auto 50%; margin: 0; transform: translate(-50%, -50%); color: #65777d; }
    .excel-preview-status { display: grid; gap: 10px; min-width: 260px; padding: 22px; border: 1px solid #aebdc1; background: #fff; text-align: center; }
    .excel-preview-status span { color: #65777d; font-size: 11px; }
    @media (max-width: 680px) {
      .excel-preview-modal { padding: 0; }
      .excel-preview-shell { grid-template-rows: 50px 43px auto minmax(0, 1fr); border: 0; border-radius: 0; }
      .excel-preview-toolbar { flex-wrap: wrap; }
      .excel-preview-toolbar label { flex-basis: calc(100% - 42px); max-width: none; }
    }
  `
  document.head.append(style)
}