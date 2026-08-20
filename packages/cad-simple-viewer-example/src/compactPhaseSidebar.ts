export function setupCompactPhaseSidebar(
  sidebar: HTMLElement,
  toggleButton: HTMLButtonElement,
  scrim: HTMLElement,
  compactMaxWidth: number
) {
  const compactMediaQuery = `(max-width: ${compactMaxWidth}px)`
  const media = window.matchMedia(compactMediaQuery)
  let open = false

  const sync = () => {
    const compact = media.matches
    sidebar.classList.toggle('is-compact-open', compact && open)
    scrim.hidden = !(compact && open)
    toggleButton.setAttribute('aria-expanded', String(compact && open))
    toggleButton.hidden = !compact
    sidebar.inert = compact && !open
    if (compact) sidebar.setAttribute('aria-hidden', String(!open))
    else sidebar.removeAttribute('aria-hidden')
  }
  const close = (restoreFocus = true) => {
    if (!open) return
    open = false
    sync()
    if (restoreFocus) toggleButton.focus()
  }
  const openSidebar = () => {
    if (!media.matches) return
    open = true
    sync()
    sidebar.querySelector<HTMLElement>('button, select, input, [tabindex="0"]')?.focus()
  }
  const onToggle = () => {
    if (open) close()
    else openSidebar()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && media.matches && open) {
      event.preventDefault()
      close()
    }
  }
  const onMediaChange = () => {
    open = false
    sync()
  }

  toggleButton.addEventListener('click', onToggle)
  scrim.addEventListener('click', () => close())
  document.addEventListener('keydown', onKeyDown)
  media.addEventListener('change', onMediaChange)
  sync()

  return () => {
    toggleButton.removeEventListener('click', onToggle)
    document.removeEventListener('keydown', onKeyDown)
    media.removeEventListener('change', onMediaChange)
  }
}