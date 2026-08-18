const STYLE_ID = 'confirmation-modal-styles'

export function injectConfirmationModalStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .confirmation-modal { position: fixed; z-index: 980; inset: 0; display: grid; place-items: center; padding: 20px; color: #17262b; background: rgba(12, 28, 34, .62); }
    .confirmation-modal[hidden] { display: none; }
    .confirmation-modal-shell { width: min(430px, 100%); overflow: hidden; border: 1px solid #b9c7ca; border-radius: 6px; background: #f8fafa; box-shadow: 0 20px 54px rgba(3, 18, 23, .38); }
    .confirmation-modal-shell header { display: grid; grid-template-columns: 32px minmax(0, 1fr) 34px; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #d2dcde; }
    .confirmation-modal-shell h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
    .confirmation-modal-symbol { display: grid; place-items: center; width: 30px; height: 30px; color: #9c352d; background: #fbe8e5; }
    .confirmation-modal-symbol svg, .confirmation-modal-close svg { width: 17px; height: 17px; }
    .confirmation-modal-shell p { margin: 0; padding: 20px 16px; color: #53676d; font-size: 12px; line-height: 1.6; }
    .confirmation-modal-shell footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid #d2dcde; background: #edf2f2; }
    .confirmation-modal button { min-height: 34px; border: 1px solid #b9c7ca; border-radius: 5px; padding: 6px 14px; color: #17262b; background: #fff; font: inherit; cursor: pointer; }
    .confirmation-modal button:hover { border-color: #188461; color: #075d43; background: #edf8f4; }
    .confirmation-modal .confirmation-modal-close { display: grid; place-items: center; width: 34px; padding: 0; }
    .confirmation-modal-shell.is-danger .confirmation-modal-confirm { border-color: #a43d34; color: #fff; background: #a43d34; }
    .confirmation-modal-shell.is-danger .confirmation-modal-confirm:hover { border-color: #873129; color: #fff; background: #873129; }
  `
  document.head.append(style)
}