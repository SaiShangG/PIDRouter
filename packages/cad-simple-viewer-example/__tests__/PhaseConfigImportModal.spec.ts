/** @jest-environment jsdom */

import {
  type PhaseConfigImportLabels,
  PhaseConfigImportModal
} from '../src/phase/PhaseConfigImportModal'

const labels: PhaseConfigImportLabels = {
  title: 'Import process configuration',
  close: 'Close',
  dropTitle: 'Drop files',
  dropHint: '.xlsx or .xls',
  browse: 'Choose files',
  fileCount: '{count} selected',
  excelOnly: 'Excel only',
  cancel: 'Cancel',
  confirm: 'Confirm',
  uploading: 'Uploading',
  complete: 'Complete',
  uploadFailed: 'Upload failed'
}

const selectFile = (modal: PhaseConfigImportModal) => {
  const input = modal.element.querySelector<HTMLInputElement>('input[type="file"]')
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [new File(['config'], 'process.xlsx')]
  })
  input?.dispatchEvent(new Event('change'))
}

describe('PhaseConfigImportModal', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.body.classList.remove('phase-config-import-modal-open')
  })

  it('submits selected files once and closes after success', async () => {
    const modal = new PhaseConfigImportModal()
    const submit = jest.fn(async () => undefined)
    const result = modal.open(labels, submit)
    selectFile(modal)

    modal.element.querySelector<HTMLButtonElement>(
      '.phase-config-import-confirm'
    )?.click()

    await expect(result).resolves.toEqual([
      expect.objectContaining({ name: 'process.xlsx' })
    ])
    expect(submit).toHaveBeenCalledTimes(1)
    expect(modal.element.hidden).toBe(true)
  })

  it.each([
    ['choose', '\u5de5\u827a\u914d\u7f6e.xlsx'],
    ['choose', '\u9636\u6bb5\u914d\u7f6e.xls'],
    ['choose', 'Phase \u914d\u7f6e\uff08\u6e05\u6d17\uff09.XLSX'],
    ['drop', '\u5de5\u827a\u914d\u7f6e.xlsx'],
    ['drop', '\u9636\u6bb5\u914d\u7f6e.xls'],
    ['drop', 'Phase \u914d\u7f6e\uff08\u6e05\u6d17\uff09.XLSX']
  ])('preserves a Chinese filename on %s: %s', async (method, name) => {
    const modal = new PhaseConfigImportModal()
    const submit = jest.fn(async () => undefined)
    const result = modal.open(labels, submit)
    const file = new File(['config'], name)

    if (method === 'choose') {
      const input = modal.element.querySelector<HTMLInputElement>(
        'input[type="file"]'
      )
      Object.defineProperty(input, 'files', { value: [file] })
      input?.dispatchEvent(new Event('change'))
    } else {
      const drop = new Event('drop', { cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } })
      modal.element
        .querySelector('.phase-config-import-dropzone')
        ?.dispatchEvent(drop)
    }

    expect(
      modal.element.querySelector('.phase-config-import-selection li span')
        ?.textContent
    ).toBe(name)
    expect(
      modal.element.querySelector<HTMLElement>(
        '.phase-config-import-validation'
      )?.hidden
    ).toBe(true)
    const confirm = modal.element.querySelector<HTMLButtonElement>(
      '.phase-config-import-confirm'
    )
    expect(confirm?.disabled).toBe(false)
    confirm?.click()

    const selected = await result
    expect(selected).toEqual([file])
    expect(selected?.[0]).toBe(file)
    expect(submit).toHaveBeenCalledWith([file])
  })

  it('stays open and allows retrying after submission fails', async () => {
    const modal = new PhaseConfigImportModal()
    const submit = jest.fn(async () => {
      throw new Error('Request failed')
    })
    void modal.open(labels, submit)
    selectFile(modal)

    const confirm = modal.element.querySelector<HTMLButtonElement>(
      '.phase-config-import-confirm'
    )
    confirm?.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(submit).toHaveBeenCalledTimes(1)
    expect(modal.element.hidden).toBe(false)
    expect(confirm?.disabled).toBe(false)
    expect(modal.element.textContent).toContain('Upload failed')
  })
})