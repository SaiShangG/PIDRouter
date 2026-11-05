import type { AcDbObjectId } from '@mlightcad/data-model'

import type { AppLocale } from '../locale'
import { translateUiText } from '../uiTranslations'
import type { BrushOperation } from './BrushHighlightFeature'

export interface BrushDebugEntity {
  objectId: AcDbObjectId
  handleKey?: string
  entityType?: string
  layer?: string
}

interface BrushDebugEntry extends BrushDebugEntity {
  operation: BrushOperation
}

export class BrushDebugPanel {
  readonly element = document.createElement('section')
  private readonly summary = document.createElement('span')
  private readonly clearButton = document.createElement('button')
  private readonly hint = document.createElement('p')
  private readonly empty = document.createElement('div')
  private readonly list = document.createElement('ol')
  private readonly entries = new Map<AcDbObjectId, BrushDebugEntry>()
  private readonly buttons = new Map<AcDbObjectId, HTMLButtonElement>()
  private readonly unavailableIds = new Set<AcDbObjectId>()
  private selectedId?: AcDbObjectId

  constructor(
    private locale: AppLocale,
    private readonly callbacks: {
      onEntityClick(objectId: AcDbObjectId): boolean
      onClear(): void
    }
  ) {
    this.element.className = 'brush-debug-panel'
    const toolbar = document.createElement('div')
    toolbar.className = 'brush-debug-toolbar'
    this.clearButton.type = 'button'
    this.clearButton.dataset.brushDebugClear = 'true'
    this.clearButton.addEventListener('click', () => this.clear())
    toolbar.append(this.summary, this.clearButton)
    this.hint.className = 'brush-debug-hint'
    this.empty.className = 'valve-debug-panel-empty'
    this.list.className = 'valve-debug-panel-tree brush-debug-list'
    this.element.append(toolbar, this.hint, this.empty, this.list)
    this.setLocale(locale)
  }

  record(operation: BrushOperation, entities: readonly BrushDebugEntity[]) {
    for (const entity of entities) {
      const entry = { ...entity, operation }
      this.entries.set(entity.objectId, entry)
      this.unavailableIds.delete(entity.objectId)
      let button = this.buttons.get(entity.objectId)
      if (!button) {
        const item = document.createElement('li')
        button = document.createElement('button')
        button.type = 'button'
        button.className = 'brush-debug-entity'
        button.dataset.entityId = String(entity.objectId)
        button.addEventListener('click', () => this.locate(entity.objectId))
        item.append(button)
        this.list.append(item)
        this.buttons.set(entity.objectId, button)
      }
      this.renderEntry(button, entry)
    }
    this.renderSummary()
  }

  setLocale(locale: AppLocale) {
    this.locale = locale
    this.clearButton.textContent = this.text('清空列表')
    this.hint.textContent = this.text(
      '画笔和橡皮命中的实体在此去重累积，自动模式跳过设备。点击实体可闪烁定位，不改变高亮或设备状态。'
    )
    this.empty.textContent = this.text(
      '启用画笔后在图纸上涂画，查看命中的实体。未拾取到的对象不会出现在列表中。'
    )
    this.entries.forEach((entry, id) =>
      this.renderEntry(this.buttons.get(id)!, entry)
    )
    this.renderSummary()
  }

  clear() {
    this.callbacks.onClear()
    this.entries.clear()
    this.buttons.clear()
    this.unavailableIds.clear()
    this.selectedId = undefined
    this.list.replaceChildren()
    this.renderSummary()
  }

  private locate(objectId: AcDbObjectId) {
    if (this.selectedId !== undefined) {
      this.buttons.get(this.selectedId)?.setAttribute('aria-pressed', 'false')
    }
    this.selectedId = objectId
    if (this.callbacks.onEntityClick(objectId))
      this.unavailableIds.delete(objectId)
    else this.unavailableIds.add(objectId)
    const entry = this.entries.get(objectId)
    const button = this.buttons.get(objectId)
    if (entry && button) this.renderEntry(button, entry)
  }

  private renderEntry(button: HTMLButtonElement, entry: BrushDebugEntry) {
    const label = document.createElement('strong')
    label.textContent = `${entry.entityType ?? 'Entity'} · ${entry.objectId}`
    const meta = document.createElement('span')
    meta.className = 'valve-debug-tree-meta'
    meta.textContent = [
      `Entity ID: ${entry.objectId}`,
      `Handle: ${entry.handleKey ?? this.text('无持久化句柄')}`,
      ...(entry.layer === undefined
        ? []
        : [`${this.text('图层')}: ${entry.layer}`])
    ].join('\n')
    const status = document.createElement('span')
    status.className = 'brush-debug-status'
    status.textContent = this.unavailableIds.has(entry.objectId)
      ? this.text('无法定位：实体不存在或无法生成预览')
      : this.text(entry.operation === 'paint' ? '画笔命中' : '橡皮命中')
    button.title = `${label.textContent}\n${meta.textContent}\n${status.textContent}`
    button.setAttribute(
      'aria-pressed',
      String(entry.objectId === this.selectedId)
    )
    button.replaceChildren(label, meta, status)
  }

  private renderSummary() {
    this.summary.textContent = `${this.text('实体数量')}: ${this.entries.size}`
    this.empty.hidden = this.entries.size > 0
    this.clearButton.disabled = this.entries.size === 0
  }

  private text(value: string) {
    return translateUiText(this.locale, value)
  }
}
