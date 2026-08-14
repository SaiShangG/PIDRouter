import type { IconNode } from 'lucide'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

export function createPhaseIcon(iconNode: IconNode, className?: string): SVGElement {
  const [tag, attributes, children = []] = iconNode
  const icon = document.createElementNS(SVG_NAMESPACE, tag)

  for (const [name, value] of Object.entries(attributes)) {
    icon.setAttribute(name, String(value))
  }
  for (const [childTag, childAttributes] of children) {
    const child = document.createElementNS(SVG_NAMESPACE, childTag)
    for (const [name, value] of Object.entries(childAttributes)) {
      child.setAttribute(name, String(value))
    }
    icon.append(child)
  }

  icon.classList.add('phase-ui-icon')
  if (className) icon.classList.add(className)
  icon.setAttribute('width', '16')
  icon.setAttribute('height', '16')
  icon.setAttribute('stroke-width', '1.75')
  icon.setAttribute('aria-hidden', 'true')
  icon.setAttribute('focusable', 'false')
  return icon
}
