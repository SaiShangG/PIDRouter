---
name: "PID PDF Text Export Constraints"
description: "Use when editing PID PDF export, SVG text paths, Three.js glyph rendering, SHX/TTF fonts, or AcTrMTextRenderer integration."
applyTo: "packages/{cad-pdf-plugin,cad-svg-plugin,three-renderer}/**"
---

# PDF Text Export Constraints

- Preserve the active view renderer as the single owner of initialized MTEXT state, fonts, fallback chains, workers, and style manager.
- Never directly create, initialize, or call an independent `AcTrMTextRenderer` singleton from `cad-pdf-plugin`.
- In strict PDF consistency mode, obtain glyph geometry through the active view renderer and export only SVG paths; do not silently fall back to SVG `<text>` or system fonts.
- Keep normal SVG text export behavior separate from PDF path mode. Inject the path renderer callback so `cad-svg-plugin` does not eagerly load Three renderer runtime assets.
- Serialize both mesh triangles and SHX line geometry, applying each drawable's `matrixWorld`.
- Resolve text traits against the PDF export background, not necessarily the viewer background.
- Delegate cleanup to the returned renderer object where possible; do not dispose shared viewer materials directly.
- Preserve focused regression coverage for active-view renderer routing and path-only output.
- Consult `docs/troubleshooting/pdf-text-export.md` for the architecture, known failures, and validation commands.
