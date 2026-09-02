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