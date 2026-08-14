---
name: pid-pdf-text-export
description: "Use when diagnosing or modifying PID PDF export, mismatched SHX/TTF fonts, text-to-path conversion, Export PDF download failures, duplicate renderer singletons, or AcTrMTextRenderer initialization errors."
argument-hint: "Describe the PDF text or export failure"
user-invocable: true
---

# PID PDF Text Export

Use this workflow to diagnose and modify vector PDF text export without breaking viewer font consistency.

## Required Architecture

- Treat the active view renderer as the owner of initialized text rendering state.
- Generate PDF glyph geometry through `context.view.renderer.renderMTextGeometry(...)`.
- Serialize the returned Mesh/Line geometry to SVG `<path>` before `svg2pdf.js` conversion.
- Never initialize or call a separate `AcTrMTextRenderer` singleton from the lazy PDF bundle.
- Resolve CAD text colors against the PDF export background.
- Do not silently fall back to SVG `<text>` in strict path mode.

Read [the troubleshooting reference](../../../docs/troubleshooting/pdf-text-export.md) before changing the pipeline.

## Procedure

1. Reproduce the behavior and capture the browser console error.
2. Trace the call from `AcApPdfConvertor.buildSvg()` through `AcSvgRenderer.mtext()`.
3. Check whether the PDF bundle directly imports or calls `AcTrMTextRenderer`.
4. Confirm the active view exposes `renderer.renderMTextGeometry`.
5. Confirm the PDF path callback receives MTEXT data, style, traits, and export background.
6. Inspect path serialization for both `THREE.Mesh` and `THREE.Line`/`LineSegments`.
7. Verify object transforms use `matrixWorld` before writing path coordinates.
8. Verify generated strict-mode SVG contains no `<text>` or `<tspan>`.
9. Run focused tests immediately after the first edit.
10. Build all affected packages and verify an actual browser download.

## Focused Validation

```powershell
pnpm exec jest packages/cad-pdf-plugin/__tests__/AcApPdfConvertor.spec.ts --runInBand
pnpm exec jest packages/cad-svg-plugin/__tests__/AcSvgMTextPathUtil.spec.ts --runInBand
```

Then run the broader checks:

```powershell
pnpm exec jest packages/cad-svg-plugin/__tests__ --runInBand
pnpm exec eslint packages/three-renderer/src/renderer/AcTrRenderer.ts packages/cad-svg-plugin/src/AcSvgMTextPathUtil.ts packages/cad-pdf-plugin/src/AcApPdfConvertor.ts
pnpm --filter @mlightcad/three-renderer build
pnpm --filter @mlightcad/cad-svg-plugin build
pnpm --filter @mlightcad/cad-pdf-plugin build
pnpm --filter @mlightcad/cad-simple-viewer-example build
```

## Failure Interpretation

- `AcTrMTextRenderer not initialized!`: suspect a duplicate singleton caused by lazy bundle boundaries.
- Correct glyphs but wrong color: check export background passed to color resolution.
- Correct font but wrong placement: check `matrixWorld`, index buffers, and line/triangle topology.
- Missing SHX strokes: check `Line` versus `LineSegments` serialization.
- Existing SVG tests fail while PDF code changed: check for eager imports of Three renderer or shader assets in `cad-svg-plugin`.

## Completion Criteria

- PDF download succeeds.
- Strict-mode text is path-only.
- Viewer and PDF share glyph fallback and layout behavior.
- Focused tests, SVG suite, lint for touched files, and affected builds pass.
