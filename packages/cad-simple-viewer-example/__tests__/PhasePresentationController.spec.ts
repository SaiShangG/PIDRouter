import {
  PhasePresentationController,
  type PresentationMaterial
} from '../src/presentation/PhasePresentationController'
import type { ResolvedEntityPresentation } from '../src/presentation/presentationStyleResolver'

describe('PhasePresentationController', () => {
  const fixture = () => {
    const material: PresentationMaterial = {
      color: { set: jest.fn() }, resolution: { set: jest.fn() },
      uniforms: { opacity: { value: 1 } }, linewidth: 1,
      depthTest: true, depthWrite: true, needsUpdate: false
    }
    const child = { renderOrder: 0, visible: true, material, traverse: jest.fn() }
    const root = {
      renderOrder: 0, visible: true,
      traverse: jest.fn((callback: (object: typeof child) => void) => callback(child))
    }
    const style: ResolvedEntityPresentation = {
      key: 'style', source: 'utility', color: 0x00c853,
      lineWidthPx: 3, opacity: 1, visible: true
    }
    return { controller: new PhasePresentationController(), material, child, root, style }
  }

  it('skips unchanged styles without traversing or updating materials', () => {
    const { controller, material, root, style } = fixture()
    expect(controller.apply(root, style)).toBe(true)
    root.traverse.mockClear()
    material.needsUpdate = false
    expect(controller.apply(root, { ...style, key: 'another-reference' })).toBe(false)
    expect(root.traverse).not.toHaveBeenCalled()
    expect(material.color?.set).toHaveBeenCalledTimes(1)
    expect(material.needsUpdate).toBe(false)
  })

  it('updates order and visibility without reapplying material properties', () => {
    const { controller, material, child, root, style } = fixture()
    controller.apply(root, style)
    material.needsUpdate = false
    expect(controller.apply(root, style, 25000)).toBe(true)
    expect(child.renderOrder).toBe(25000)
    expect(controller.apply(root, { ...style, visible: false }, 25000)).toBe(true)
    expect(root.visible).toBe(false)
    expect(child.visible).toBe(false)
    expect(material.color?.set).toHaveBeenCalledTimes(1)
    expect(material.needsUpdate).toBe(false)
  })

  it('uses actual style values and only flags material state transitions', () => {
    const { controller, material, root, style } = fixture()
    const needsUpdate = jest.fn()
    Object.defineProperty(material, 'needsUpdate', { set: needsUpdate })
    controller.apply(root, style)
    needsUpdate.mockClear()
    controller.apply(root, { ...style, color: 0xff0000, lineWidthPx: 6 })
    expect(material.color?.set).toHaveBeenLastCalledWith(0xff0000)
    expect(material.linewidth).toBe(6)
    expect(needsUpdate).not.toHaveBeenCalled()
    const translucent = { ...style, color: 0xff0000, lineWidthPx: 6, opacity: 0.4 }
    controller.apply(root, translucent)
    expect(material.transparent).toBe(true)
    expect(material.uniforms?.opacity.value).toBe(0.4)
    expect(needsUpdate).toHaveBeenCalledTimes(1)
    controller.apply(root, { ...translucent, opacity: 0.8 })
    expect(needsUpdate).toHaveBeenCalledTimes(1)
    controller.apply(root, style)
    expect(material.transparent).toBe(false)
    expect(needsUpdate).toHaveBeenCalledTimes(2)
  })

  it('updates viewport resolution despite style caching, including newly added roots', () => {
    const { controller, material, root, style } = fixture()
    controller.apply(root, style)
    controller.resize(800, 600)
    expect(controller.apply(root, style)).toBe(false)
    controller.resize(1200, 900)
    expect(material.resolution?.set).toHaveBeenLastCalledWith(1200, 900)
    const later = fixture()
    controller.apply(later.root, later.style)
    expect(later.material.resolution?.set).toHaveBeenLastCalledWith(1200, 900)
  })

  it('forgets cached styles and stops resizing removed roots', () => {
    const { controller, material, root, style } = fixture()
    controller.apply(root, style)
    controller.forget(root)
    controller.resize(800, 600)
    expect(material.resolution?.set).not.toHaveBeenCalled()
    expect(controller.apply(root, style)).toBe(true)
    expect(material.color?.set).toHaveBeenCalledTimes(2)
    controller.clear()
    expect(controller.apply(root, style)).toBe(true)
    expect(material.color?.set).toHaveBeenCalledTimes(3)
  })

  it('styles only the preview clone and updates LineMaterial resolution', () => {
    const shared = {
      color: { set: jest.fn() },
      linewidth: 1,
      depthTest: true,
      depthWrite: true,
      needsUpdate: false
    }
    const resolution = { set: jest.fn() }
    const previewColor = { set: jest.fn() }
    const opacityUniform = { value: 1 }
    const preview: PresentationMaterial = {
      ...shared,
      color: previewColor,
      resolution,
      uniforms: { opacity: opacityUniform }
    }
    const child = { renderOrder: 0, material: preview, traverse: jest.fn() }
    const root = {
      renderOrder: 0,
      visible: true,
      traverse: (callback: (object: typeof child) => void) => callback(child)
    }
    const controller = new PhasePresentationController()

    controller.apply(root, {
      key: 'style',
      source: 'flow',
      color: 0x123456,
      lineWidthPx: 5,
      opacity: 0.4,
      visible: false
    })
    controller.resize(800, 600)

    expect(previewColor.set).toHaveBeenCalledWith(0x123456)
    expect(preview.linewidth).toBe(5)
    expect(preview.opacity).toBe(0.4)
    expect(opacityUniform.value).toBe(0.4)
    expect(preview.transparent).toBe(true)
    expect(resolution.set).toHaveBeenCalledWith(800, 600)
    expect(shared.color.set).not.toHaveBeenCalled()
    expect(shared.linewidth).toBe(1)
  })

  it('applies the requested render order to the root and its children', () => {
    const child = {
      renderOrder: 0,
      material: null,
      traverse: jest.fn()
    }
    const root = {
      renderOrder: 0,
      visible: true,
      traverse: (callback: (object: typeof child) => void) => callback(child)
    }
    const controller = new PhasePresentationController()

    controller.apply(root, {
      key: 'utility-layer',
      source: 'utility',
      color: 0x00c853,
      lineWidthPx: 3,
      opacity: 1,
      visible: true
    }, 10002)

    expect(root.renderOrder).toBe(10002)
    expect(child.renderOrder).toBe(10002)
  })
})