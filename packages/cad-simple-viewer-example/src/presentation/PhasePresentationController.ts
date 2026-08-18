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
  private viewportWidth = 1
  private viewportHeight = 1

  apply(root: PresentationObject, style: ResolvedEntityPresentation) {
    this.roots.add(root)
    root.renderOrder = 10000
    root.visible = style.visible
    root.traverse(object => {
      object.renderOrder = 10000
      object.visible = style.visible
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : []
      materials.forEach(material => this.applyMaterial(material, style))
    })
  }

  forget(root: PresentationObject) {
    this.roots.delete(root)
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
        materials.forEach(material => {
          material.resolution?.set(this.viewportWidth, this.viewportHeight)
          const resolution = material.uniforms?.resolution?.value
          if (resolution && typeof resolution !== 'number' && 'set' in resolution) {
            resolution.set(this.viewportWidth, this.viewportHeight)
          }
        })
      })
    })
  }

  clear() {
    this.roots.clear()
  }

  private applyMaterial(
    material: PresentationMaterial,
    style: ResolvedEntityPresentation
  ) {
    material.color?.set(style.color)
    material.emissive?.set(style.color)
    for (const name of ['u_color', 'u_startColor', 'u_endColor']) {
      const value = material.uniforms?.[name]?.value
      if (value && typeof value !== 'number' && 'set' in value) {
        (value as WritableColor).set(style.color)
      }
    }
    if ('linewidth' in material) material.linewidth = style.lineWidthPx
    material.opacity = style.opacity
    if (material.uniforms?.opacity) {
      material.uniforms.opacity.value = style.opacity
    }
    material.transparent = style.opacity < 1
    material.depthTest = false
    material.depthWrite = false
    material.needsUpdate = true
  }

}
