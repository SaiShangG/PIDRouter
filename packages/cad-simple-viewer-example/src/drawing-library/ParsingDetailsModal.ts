import { FileJson, X } from 'lucide'

import { createPhaseIcon } from '../phase/phaseIcons'
import type { DrawingRecord } from './types'

export class ParsingDetailsModal {
  readonly element = document.createElement('div')

  constructor() {
    this.element.className = 'parsing-details-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'parsingDetailsTitle')
    this.element.addEventListener('pointerdown', event => {
      if (event.target === this.element) this.close()
    })
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.close()
    })
    document.body.append(this.element)
  }

  open(record: DrawingRecord) {
    const artifact = record.connectionArtifact
    if (!artifact) return
    this.element.replaceChildren()

    const shell = document.createElement('section')
    shell.className = 'parsing-details-shell'
    const header = document.createElement('header')
    const symbol = document.createElement('span')
    symbol.append(createPhaseIcon(FileJson))
    const identity = document.createElement('div')
    const eyebrow = document.createElement('span')
    eyebrow.textContent = record.drawingNumber ?? record.originalFileName
    const title = document.createElement('h2')
    title.id = 'parsingDetailsTitle'
    title.textContent = '解析结果摘要'
    identity.append(eyebrow, title)
    const close = document.createElement('button')
    close.type = 'button'
    close.title = '关闭解析详情'
    close.setAttribute('aria-label', '关闭解析详情')
    close.append(createPhaseIcon(X))
    close.addEventListener('click', () => this.close())
    header.append(symbol, identity, close)

    const body = document.createElement('div')
    body.className = 'parsing-details-body'
    const summary = document.createElement('dl')
    const fields: Array<[string, string]> = [
      ['图纸', record.name],
      ['状态', '解析完成'],
      ['Artifact ID', artifact.id],
      ['Schema 版本', String(artifact.schemaVersion)],
      ['解析器版本', artifact.parserVersion],
      ['完成时间', new Date(artifact.completedAt).toLocaleString()],
      ['实体数量', artifact.entityCount.toLocaleString()],
      ['连接数量', artifact.edgeCount.toLocaleString()],
      ['告警数量', artifact.warningCount.toLocaleString()]
    ]
    fields.forEach(([label, value]) => {
      const term = document.createElement('dt')
      term.textContent = label
      const description = document.createElement('dd')
      description.textContent = value
      summary.append(term, description)
    })
    body.append(summary)

    const warningSection = document.createElement('section')
    const warningTitle = document.createElement('h3')
    warningTitle.textContent = '解析告警'
    warningSection.append(warningTitle)
    if (artifact.warnings.length === 0) {
      const empty = document.createElement('p')
      empty.textContent = '未发现解析告警。'
      warningSection.append(empty)
    } else {
      const list = document.createElement('ul')
      artifact.warnings.forEach(warning => {
        const item = document.createElement('li')
        item.textContent = warning
        list.append(item)
      })
      warningSection.append(list)
    }
    body.append(warningSection)
    shell.append(header, body)
    this.element.append(shell)
    this.element.hidden = false
    document.body.classList.add('parsing-details-open')
    close.focus()
  }

  close() {
    this.element.hidden = true
    document.body.classList.remove('parsing-details-open')
  }
}