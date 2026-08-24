import {
  PhasePresentationController,
  type PresentationMaterial
} from '../src/presentation/PhasePresentationController'

describe('PhasePresentationController', () => {
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