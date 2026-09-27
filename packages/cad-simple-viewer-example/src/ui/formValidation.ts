export interface FormFieldRule {
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  isValid?: () => boolean
}

export function createFormValidator(
  container: HTMLElement,
  fields: readonly FormFieldRule[]
): () => boolean {
  const isValid = (field: FormFieldRule) =>
    field.isValid?.() ??
    (Boolean(field.element.value.trim()) && field.element.validity.valid)
  const updateErrors = () => {
    fields.forEach(field => {
      if (field.element.getAttribute('aria-invalid') === 'true' && isValid(field)) {
        field.element.removeAttribute('aria-invalid')
      }
    })
  }
  container.addEventListener('input', updateErrors, true)
  container.addEventListener('change', updateErrors, true)
  return () => {
    const invalid = fields.filter(field => !isValid(field))
    fields.forEach(field => {
      if (invalid.includes(field)) field.element.setAttribute('aria-invalid', 'true')
      else field.element.removeAttribute('aria-invalid')
    })
    invalid[0]?.element.focus()
    return invalid.length === 0
  }
}