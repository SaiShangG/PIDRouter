const STYLE_ID = 'parsing-details-styles'

export function injectParsingDetailsStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .parsing-details-modal { position: fixed; z-index: 970; inset: 0; display: grid; place-items: center; padding: 20px; color: #17262b; background: rgba(12, 28, 34, .64); }
    .parsing-details-modal[hidden] { display: none; }
    .parsing-details-shell { width: min(560px, 100%); max-height: min(680px, 100%); overflow: auto; border: 1px solid #b9c7ca; border-radius: 6px; background: #f8fafa; box-shadow: 0 20px 54px rgba(3, 18, 23, .38); }
    .parsing-details-shell > header { display: grid; grid-template-columns: 36px minmax(0, 1fr) 34px; align-items: center; gap: 11px; padding: 14px 16px; border-bottom: 1px solid #d2dcde; }
    .parsing-details-shell > header > span { display: grid; place-items: center; width: 34px; height: 34px; color: #087b58; background: #e3f5ee; }
    .parsing-details-shell > header svg { width: 18px; height: 18px; }
    .parsing-details-shell > header div { display: grid; gap: 2px; }
    .parsing-details-shell > header span { color: #64777d; font-size: 10px; }
    .parsing-details-shell h2, .parsing-details-shell h3, .parsing-details-shell p { margin: 0; }
    .parsing-details-shell h2 { font-size: 16px; }
    .parsing-details-shell header button { display: grid; place-items: center; width: 34px; min-height: 34px; border: 1px solid #bcc9cc; border-radius: 5px; padding: 0; color: inherit; background: #fff; cursor: pointer; }
    .parsing-details-body { display: grid; gap: 16px; padding: 18px; }
    .parsing-details-body dl { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 0; margin: 0; border: 1px solid #d2dcde; background: #fff; }
    .parsing-details-body dt, .parsing-details-body dd { margin: 0; padding: 9px 11px; border-bottom: 1px solid #e3e9ea; font-size: 11px; }
    .parsing-details-body dt { color: #65777d; font-weight: 700; background: #f3f6f6; }
    .parsing-details-body dd { overflow-wrap: anywhere; }
    .parsing-details-body dt:nth-last-of-type(1), .parsing-details-body dd:last-child { border-bottom: 0; }
    .parsing-details-body section { display: grid; gap: 9px; padding: 13px; border: 1px solid #d2dcde; background: #fff; }
    .parsing-details-body h3 { font-size: 12px; }
    .parsing-details-body p, .parsing-details-body li { color: #65777d; font-size: 11px; line-height: 1.5; }
    .parsing-details-body ul { display: grid; gap: 6px; margin: 0; padding-left: 18px; }
  `
  document.head.append(style)
}