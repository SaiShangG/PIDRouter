import type { ResolvedEntityPresentation } from './presentationStyleResolver'

type WritableColor = { set(value: number): void }
type WritableResolution = { set(width: number, height: number): void }
type PresentationUniformValue = WritableColor | WritableResolution | number

export interface PresentationMaterial {
  color?: WritableColor
  emissive?: WritableColor
  uniforms?: Record<string, { value?: PresentationUniformValue }>
  linewidth?: number
  resolution?: WritableResolution
  opacity?: number
  transparent?: boolean
  depthTest: boolean
  depthWrite: boolean
  needsUpdate: boolean
}

export interface PresentationObject {
  renderOrder: number
  visible?: boolean
  material?: PresentationMaterial | PresentationMaterial[] | null
  traverse(callback: (object: PresentationObject) => void): void
}

export class PhasePresentationController {
  private readonly roots = new Set<PresentationObject>()
  private applied = new WeakMap<PresentationObject, ResolvedEntityPresentation & { renderOrder: number }>()
  private viewportWidth?: number
  private viewportHeight?: number

  apply(
    root: PresentationObject,
    style: ResolvedEntityPresentation,
    renderOrder = 10000
  ) {
    const previous = this.applied.get(root)
    const materialChanged = !previous || previous.color !== style.color ||
      previous.lineWidthPx !== style.lineWidthPx || previous.opacity !== style.opacity
    const visibilityChanged = !previous || previous.visible !== style.visible
    const orderChanged = !previous || previous.renderOrder !== renderOrder
    if (!materialChanged && !visibilityChanged && !orderChanged) return false

    this.roots.add(root)
    root.renderOrder = renderOrder
    root.visible = style.visible
    root.traverse(object => {
      if (orderChanged) object.renderOrder = renderOrder
      if (visibilityChanged) object.visible = style.visible
      if (!materialChanged) return
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : []
      materials.forEach(material => this.applyMaterial(material, style, previous))
    })
    this.applied.set(root, { ...style, renderOrder })
    return true
  }

  forget(root: PresentationObject) {
    this.roots.delete(root)
    this.applied.delete(root)
  }

  resize(width: number, height: number) {
    this.viewportWidth = Math.max(1, width)
    this.viewportHeight = Math.max(1, height)
    this.roots.forEach(root => {
      root.traverse(object => {
        const materials = Array.isArray(object.material)
          ? object.material
          : object.material
            ? [object.material]
            : []
        materials.forEach(material => this.applyResolution(material))
      })
    })
  }

  clear() {
    this.roots.clear()
    this.applied = new WeakMap()
  }

  private applyResolution(material: PresentationMaterial) {
    if (this.viewportWidth === undefined || this.viewportHeight === undefined) return
    material.resolution?.set(this.viewportWidth, this.viewportHeight)
    const resolution = material.uniforms?.resolution?.value
    if (resolution && typeof resolution !== 'number' && 'set' in resolution) {
      resolution.set(this.viewportWidth, this.viewportHeight)
    }
  }

  private applyMaterial(
    material: PresentationMaterial,
    style: ResolvedEntityPresentation,
    previous?: ResolvedEntityPresentation
  ) {
    if (!previous || previous.color !== style.color) {
      material.color?.set(style.color)
      material.emissive?.set(style.color)
      for (const name of ['u_color', 'u_startColor', 'u_endColor']) {
        const value = material.uniforms?.[name]?.value
        if (value && typeof value !== 'number' && 'set' in value) {
          ; (value as WritableColor).set(style.color)
        }
      }
    }
    if ((!previous || previous.lineWidthPx !== style.lineWidthPx) && 'linewidth' in material) {
      material.linewidth = style.lineWidthPx
    }
    if (!previous || previous.opacity !== style.opacity) {
      material.opacity = style.opacity
      if (material.uniforms?.opacity) material.uniforms.opacity.value = style.opacity
    }
    const transparent = style.opacity < 1
    const needsUpdate = material.transparent !== transparent || material.depthTest || material.depthWrite
    if (material.transparent !== transparent) material.transparent = transparent
    if (material.depthTest) material.depthTest = false
    if (material.depthWrite) material.depthWrite = false
    if (needsUpdate) material.needsUpdate = true
    if (!previous) this.applyResolution(material)
  }

}
