import { injectBrandThemeTokens } from '../brandThemeTokens'

export function injectLoginStyles() {
  injectBrandThemeTokens()
  if (document.getElementById('login-styles')) return
  const style = document.createElement('style')
  style.id = 'login-styles'
  style.textContent = `
    body.login-active .app-shell { display: none !important; }
    .login-page {
      position: fixed; inset: 0; z-index: 100; overflow: auto;
      display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(420px, 1fr); min-width: 0;
      color: var(--app-text); background: var(--app-surface-panel);
      font-family: "IBM Plex Sans", "Segoe UI", "Microsoft YaHei UI", sans-serif;
      letter-spacing: 0;
    }
    .login-page *, .auth-account * { box-sizing: border-box; }
    .login-media { position: relative; min-width: 0; min-height: 100%; overflow: hidden; background: var(--app-surface-canvas); }
    .login-photo { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
    .login-panel { display: flex; flex-direction: column; min-width: 0; min-height: 100%; background: var(--app-surface-elevated); }
    .login-header, .login-footer {
      flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
      gap: 16px; padding: 28px 32px; background: var(--app-surface-elevated);
    }
    .login-header { border-bottom: 0; }
    .login-brand { display: flex; align-items: center; gap: 12px; font-size: 16px; }
    .login-mark { display: grid; place-items: center; width: 42px; height: 36px; font-size: 14px; color: white; background: var(--app-accent); border-radius: 4px; }
    .login-content { flex: 1 0 auto; display: grid; place-items: center; padding: 48px 40px; }
    .login-form-wrap { width: min(100%, 380px); min-width: 0; padding: 24px 0; }
    .login-form-wrap h1 { margin: 0 0 32px; font-size: 28px; font-weight: 600; line-height: 1.3; }
    .login-form-wrap form { display: flex; flex-direction: column; }
    .login-form-wrap label { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    .login-form-wrap input { width: 100%; height: 46px; min-width: 0; padding: 0 12px; font: inherit; font-size: 16px; color: var(--app-text); background: var(--app-surface-elevated); border: 1px solid var(--app-border-strong); border-radius: 4px; }
    #login-username { margin-bottom: 24px; }
    .login-password-field { position: relative; margin-bottom: 28px; }
    .login-password-field input { padding-right: 48px; }
    .login-page button { font: inherit; cursor: pointer; }
    .login-icon-button { width: 40px; height: 40px; flex: 0 0 40px; display: inline-grid; place-items: center; padding: 0; color: var(--app-text-muted); background: transparent; border: 1px solid transparent; border-radius: 4px; }
    .login-icon-button:hover { background: var(--app-surface-subtle); color: var(--app-accent); }
    .login-visibility { position: absolute; right: 3px; top: 3px; }
    .login-submit { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 46px; padding: 10px 16px; border: 1px solid var(--app-accent); border-radius: 4px; color: white; background: var(--app-accent); font-weight: 600 !important; }
    .login-submit:hover:not(:disabled) { background: var(--app-accent-hover); }
    .login-page :disabled { cursor: wait; opacity: .65; }
    .login-page :focus-visible, .auth-account button:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 3px; }
    .login-page input[aria-invalid="true"] { border-color: var(--app-danger); }
    .login-status { min-height: 44px; margin: 16px 0 0; font-size: 13px; line-height: 1.6; color: var(--app-text-muted); overflow-wrap: anywhere; }
    .login-status.is-error { color: var(--app-danger); }
    .login-footer { flex-wrap: wrap; border-top: 1px solid var(--app-border); font-size: 12px; color: var(--app-text-muted); }
    .login-demo { color: var(--app-warning-text); }
    .auth-account { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex: 0 1 auto; min-width: 32px; margin-left: 8px; }
    .auth-account-name { min-width: 0; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--app-text); }
    #appToolbar .auth-account button { display: inline-grid; place-items: center; flex: 0 0 32px; width: 32px; height: 32px; min-width: 32px; padding: 0; border: 1px solid var(--app-border); border-radius: 4px; background: var(--app-surface-elevated); color: var(--app-text); cursor: pointer; }
    #appToolbar .auth-account button:hover { color: var(--app-danger); border-color: var(--app-danger); }
    #appToolbar .auth-account button:disabled { opacity: .5; cursor: wait; }
    @media (max-width: 760px) {
      .login-page { grid-template-columns: minmax(0, 1fr); grid-template-rows: 200px minmax(min-content, 1fr); }
      .login-media { min-height: 200px; }
      .login-photo { object-position: center 45%; }
      .login-panel { min-height: 0; }
      .login-header { padding: 20px 24px; }
      .login-content { padding: 16px 24px; }
      .login-form-wrap { padding: 12px 0; }
    }
    @media (max-width: 600px) {
      .login-header, .login-footer { padding: 16px 20px; }
      .login-content { padding: 24px; }
      .login-brand { font-size: 14px; }
      .auth-account { flex: 0 0 auto; margin-left: 0; }
      .auth-account-name { display: none; }
    }
  `
  document.head.append(style)
}