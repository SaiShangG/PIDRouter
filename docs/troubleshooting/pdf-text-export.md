# PID PDF 文字导出问题与解决方案

## 适用范围

本文用于排查以下问题：

- PID 画面与导出的 PDF 字体、字宽或换行不一致。
- SHX、中文、特殊符号、旋转文字在 PDF 中显示异常。
- 点击 `Export > PDF` 没有下载反应。
- 控制台出现 `AcTrMTextRenderer not initialized!`。
- 白色 PDF 背景上的文字颜色错误或不可见。

## 导出链路

```text
CAD entity.worldDraw
  -> AcSvgRenderer
  -> active view renderer.renderMTextGeometry
  -> viewer FontManager / AcTrMTextRenderer
  -> Three.js Mesh or Line glyph geometry
  -> SVG <path>
  -> svg2pdf.js
  -> jsPDF
```

严格一致模式不会生成 SVG `<text>` 或 `<tspan>`，因此 PDF 文字不可搜索和复制。

## 问题一：PID 与 PDF 字体不一致

### 原因

PID 屏幕端通过 `FontManager` 和 `mtext-renderer` 使用已加载的 SHX/TTF 字形。旧 PDF 导出使用 SVG `<text>`、CSS 字体映射和系统字体替代，还使用估算字符宽度进行排版。

即使字体名称相同，字形、字宽、fallback、换行和特殊符号仍可能不同。

### 解决方法

- 使用 PID 已初始化的文字渲染器生成最终字形几何。
- 将 TTF/OTF Mesh 字形序列化为填充 SVG `<path>`。
- 将 SHX Line 字形序列化为描边 SVG `<path>`。
- PDF 不再依赖客户端系统字体，也不静默回退到 SVG `<text>`。

核心实现：

- `packages/three-renderer/src/renderer/AcTrRenderer.ts`
- `packages/cad-svg-plugin/src/AcSvgMTextPathUtil.ts`
- `packages/cad-pdf-plugin/src/AcApPdfConvertor.ts`

## 问题二：点击 Export PDF 没有反应

### 现象

控制台错误：

```text
AcTrMTextRenderer not initialized!
```

### 原因

PDF 插件是懒加载 bundle。若它直接导入并调用 `AcTrMTextRenderer.getInstance()`，打包后可能得到另一份 singleton。Viewer 初始化的是主 bundle 中的实例，而 PDF bundle 中的实例没有 worker、字体和 style manager 配置。

### 解决方法

- 禁止 PDF 插件直接访问 `AcTrMTextRenderer` singleton。
- 从 `context.view.renderer` 获取 active view 已初始化的 renderer。
- 通过 `renderMTextGeometry(mtext, style, traits, backgroundColor)` 生成字形。
- PDF 插件只负责把返回的对象树转换为路径。

这既复用正确的 singleton，也避免 PDF 插件维护第二套字体状态。

## 问题三：导出文字颜色错误

### 原因

ACI 7 等 CAD 颜色依赖背景解析。PID 可能使用黑色背景，而 PDF 固定为白色背景。如果沿用屏幕背景，白色文字可能被导出到白底而不可见。

### 解决方法

调用 `renderMTextGeometry` 时显式传入 PDF 导出背景色。文字颜色、ByLayer 和 ACI 7 都以最终 PDF 背景为准解析。

## 架构约束

- `cad-pdf-plugin` 不得直接创建、初始化或读取独立的 `AcTrMTextRenderer` singleton。
- PDF 严格一致模式必须使用 active view renderer 的最终字形几何。
- 不得在路径生成失败时静默退回系统字体或 SVG `<text>`。
- 普通 SVG 导出仍可保留 `<text>/<tspan>`；PDF 路径模式必须通过显式 renderer 回调开启。
- 文字路径对象的释放应交给 renderer 返回对象的 `dispose()`，避免错误释放 viewer 共享材质。

## 排查步骤

1. 在浏览器控制台确认是否有 `AcTrMTextRenderer not initialized!`。
2. 检查 PDF 插件是否直接导入 `AcTrMTextRenderer`。
3. 检查 `context.view.renderer.renderMTextGeometry` 是否存在并被调用。
4. 确认 PDF 使用的背景色被传入文字颜色解析。
5. 检查生成的 SVG：严格模式下不应包含 `<text>` 或 `<tspan>`。
6. 分别测试 SHX、中文、旋转、多行、宽度因子和特殊符号。
7. 验证点击 Export PDF 后产生浏览器下载事件。

## 验证命令

```powershell
pnpm exec jest packages/cad-svg-plugin/__tests__ --runInBand
pnpm exec jest packages/cad-pdf-plugin/__tests__/AcApPdfConvertor.spec.ts --runInBand
pnpm exec eslint packages/three-renderer/src/renderer/AcTrRenderer.ts packages/cad-svg-plugin/src/AcSvgMTextPathUtil.ts packages/cad-pdf-plugin/src/AcApPdfConvertor.ts
pnpm --filter @mlightcad/three-renderer build
pnpm --filter @mlightcad/cad-svg-plugin build
pnpm --filter @mlightcad/cad-pdf-plugin build
pnpm --filter @mlightcad/cad-simple-viewer-example build
```

## 验收标准

- Export PDF 可以触发下载且控制台无 renderer 初始化错误。
- PDF 中 PID 文字的字形、排版、旋转和颜色与 viewer 一致。
- 严格模式生成的中间 SVG 不包含 `<text>` 或 `<tspan>`。
- SVG 全量测试、PDF renderer 路由回归测试和相关包构建通过。
