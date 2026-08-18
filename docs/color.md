# P&ID 高亮颜色与线宽可配置实施计划

## 1. 目标

为 P&ID Viewer 提供统一的高亮样式配置界面，使用户能够配置并保存以下对象的高亮颜色、线宽和可见性：

- 流路。
- 阀门及其 OPEN、CLOSED、PULSE 状态。
- 泵、电机及其 START、STOP 状态。
- Utility 及其默认样式。
- 其他工艺设备和无法识别的设备。

配置需要同时作用于 Viewer 和 PDF，支持 Phase 保存、继承、复制及刷新恢复。

当前客户图纸标准尚未冻结，因此本阶段不负责从 DWG 自动判断阀门、泵或 Utility。用户可对人工选择的实体指定类别；标准图纸到达后，再由 `DrawingSemanticAdapter` 自动提供类别和 tag。

## 2. 当前实现与主要差距

当前高亮实现具有以下特点：

1. `packages/cad-simple-viewer-example/src/main.ts` 使用单一硬编码 `OPEN_HIGHLIGHT_COLOR`。
2. Viewer 通过 `createEntityPreviewRoot()` 创建独立 preview root，并修改其克隆材质，不直接修改 Viewer 共享材质。
3. Phase 目前只保存 `openBoundaryHandleKeys` 和 `deviceStates`，尚未保存流路分组、Utility 和表现样式。
4. PDF 目前只接受一组 `highlightedEntityIds` 和一个 `highlightColor`。
5. Three renderer 已经使用 `LineSegments2` 和 `LineMaterial` 支持宽线，但普通 `LineBasicMaterial` 和现有虚线 shader 不能保证在所有 WebGL 平台上按指定宽度显示。
6. SVG/PDF 目前仅支持按实体覆盖 stroke 颜色，尚未支持线宽和多组样式。

因此不能只增加颜色输入框，需要同时建立样式数据模型、样式解析器、Viewer 表现控制器和 PDF 多样式输出契约。

## 3. 范围与边界

### 3.1 本阶段实施

- 颜色、线宽、透明度和可见性配置。
- 流路级样式覆盖。
- 阀门、泵、电机等设备状态的默认样式。
- Utility 样式维护。
- Viewer 实时预览。
- Process/Phase 持久化、继承和迁移。
- Viewer 与 PDF 样式一致性。
- 人工选择实体并指定对象类别或 Utility。

### 3.2 等待标准图纸

- 从 block、layer、tag 或图元形状自动判断设备类别。
- 自动判断流路所属 Utility。
- 根据客户规范自动填充正式颜色表。
- 自动识别阀门、泵和其他设备的连接关系。

测试 fixture 只能验证界面、存储和渲染能力，不作为真实图纸自动识别完成的证据。

## 4. 用户界面方案

### 4.1 入口

在 Phase 工作区的“当前阶段概览”下增加“高亮样式”区域，显示当前流路数量、Utility 数量和当前默认线宽。

提供调色板图标按钮，点击后打开“高亮样式设置”对话框。图标按钮必须有 tooltip 和 `aria-label`。

### 4.2 对话框结构

使用以下四个 Tab：

#### 流路

每条流路显示：

- 颜色 swatch。
- 流路名称。
- Utility 下拉选择。
- 颜色选择器和 `#RRGGBB` 输入框。
- 线宽滑块和数字输入框。
- 显示/隐藏 toggle。
- “使用 Utility 默认值”开关。
- 恢复默认按钮。

允许增加、删除和重命名流路。删除流路前必须确认，但不删除原始 CAD 实体。

#### 设备

使用紧凑表格显示设备状态和样式：

| 设备 | 状态 | 默认颜色 | 默认线宽 |
| --- | --- | --- | --- |
| 阀门 | OPEN | 可配置 | 可配置 |
| 阀门 | CLOSED | 可配置 | 可配置 |
| 阀门 | PULSE | 可配置 | 可配置 |
| 泵/电机 | START | 可配置 | 可配置 |
| 泵/电机 | STOP | 可配置 | 可配置 |
| 其他设备 | ACTIVE | 可配置 | 可配置 |
| 未知设备 | UNKNOWN | 可配置 | 可配置 |

线宽只作用于可描边图元；实体填充继续使用颜色和透明度。

#### Utility

支持维护 Utility 列表：

- 稳定 ID。
- 显示名称。
- 默认颜色。
- 默认线宽。
- 是否启用。
- 排序。

预置项只能作为初始演示配置，并显示“客户颜色标准尚未确认”。用户可修改或删除预置项。

#### 默认值

配置以下兜底样式：

- 未指定 Utility 的流路。
- 未识别设备。
- 非高亮内容弱化颜色。
- 非高亮内容透明度。
- 系统默认线宽。

提供“恢复系统默认值”，操作前显示确认对话框。

### 4.3 编辑行为

1. 打开对话框时创建配置草稿，不立即修改持久化状态。
2. 修改草稿后实时更新 Viewer 预览。
3. 点击“取消”恢复打开对话框前的样式。
4. 点击“应用”校验并写入 localStorage。
5. 点击“应用并关闭”保存后关闭对话框。
6. 切换 Phase 时，若存在未保存修改，提示保存、放弃或取消切换。

### 4.4 输入约束

- 颜色格式为 `#RRGGBB`，内部保存为 `0xRRGGBB` 数值。
- Viewer 线宽范围建议为 `1–12 px`，步长 `0.5 px`。
- 透明度范围为 `0–1`，步长 `0.05`。
- Utility 名称在同一 Process 内不允许重复，ID 不随重命名改变。
- 对比度过低或多个关键状态使用相同颜色时显示警告，但不禁止保存。
- 最终限制值由领域校验函数统一执行，不能只依赖 HTML input 属性。

## 5. 数据模型

### 5.1 基础样式

```ts
export interface HighlightStyle {
  color: number
  lineWidthPx: number
  opacity: number
  visible: boolean
}
```

所有字段保存解析后的完整值，UI 草稿可以使用字符串颜色，但写入 store 前必须标准化。

### 5.2 设备样式

```ts
export interface DeviceHighlightStyles {
  valve: {
    open: HighlightStyle
    closed: HighlightStyle
    pulse: HighlightStyle
  }
  motor: {
    start: HighlightStyle
    stop: HighlightStyle
  }
  processEquipment: {
    active: HighlightStyle
  }
}
```

设备状态仍作为业务状态保存，颜色不能反向推导 OPEN、CLOSED、START 或 STOP。

### 5.3 Utility 配置

```ts
export interface UtilityStyleDefinition {
  id: string
  name: string
  style: HighlightStyle
  enabled: boolean
  order: number
}
```

### 5.4 Process 表现配置

```ts
export interface PresentationProfile {
  defaultFlowStyle: HighlightStyle
  unknownDeviceStyle: HighlightStyle
  dimmedBaseStyle: {
    color: number
    opacity: number
  }
  deviceStyles: DeviceHighlightStyles
  utilities: UtilityStyleDefinition[]
}
```

`PresentationProfile` 保存到 Process，而不是复制到每个 Phase。这样同一 Process 的全部 Sequence/Phase 共用正式颜色规范。

### 5.5 Phase 流路状态

```ts
export interface FlowPathStatus {
  id: string
  name: string
  handleKeys: string[]
  utilityId?: string
  styleOverride?: Partial<HighlightStyle>
}

export interface FlowStateSnapshot {
  flowPaths: FlowPathStatus[]
}
```

`styleOverride` 只保存与默认值不同的字段。运行时必须通过样式解析器生成完整样式，渲染层不得直接读取可选字段。

### 5.6 分层原则

- Process 保存 Utility 和设备状态的默认样式。
- Phase 保存流路、实体 handle、Utility 归属和流路样式覆盖。
- 用户界面保存草稿状态。
- Three.js 对象和材质只存在于运行时，不进入 localStorage。

## 6. 样式解析规则

新增纯 TypeScript `PresentationStyleResolver`，统一为 Viewer、PDF 和界面预览解析样式。

同一实体的样式优先级由高到低为：

1. 临时选择、错误和诊断提示。
2. 设备当前业务状态样式。
3. 流路显式 `styleOverride`。
4. 流路所选 Utility 的默认样式。
5. Process 默认流路样式。
6. 原始 CAD 样式。

例如一条蓝色 Utility 流路上的阀门处于 CLOSED 状态，阀门使用 CLOSED 样式，其他管线继续使用蓝色 Utility 样式。

解析结果使用完整、不可变的数据结构：

```ts
export interface ResolvedEntityPresentation {
  key: string
  color: number
  lineWidthPx: number
  opacity: number
  visible: boolean
  source: 'diagnostic' | 'device' | 'flow' | 'utility' | 'default'
}
```

`key` 由颜色、线宽、透明度和可见性稳定生成，用于合并渲染组和避免重复创建材质。

## 7. Viewer 渲染方案

### 7.1 表现控制器

新增 `PhasePresentationController`，从 `main.ts` 提取以下职责：

- 接收 Phase 状态和 Process 表现配置。
- 调用样式解析器。
- 按 resolved style 对 object ID 分组。
- 创建、更新和销毁 preview roots。
- 维护线宽材质的 viewport resolution。
- 清理失效实体和已删除流路。

建议运行时结构：

```ts
interface PresentationGroupRuntime {
  objectIds: Set<AcDbObjectId>
  root: PreviewRoot
  style: ResolvedEntityPresentation
}

type PresentationGroupMap = Map<string, PresentationGroupRuntime>
```

### 7.2 增量更新

每次配置变化不应重建全部高亮：

1. 解析新的样式组。
2. 复用 object ID 集合和 style key 均未变化的 root。
3. 只重建实体集合变化的组。
4. 只更新样式变化但实体集合未变化的克隆材质。
5. 对移除的组调用统一 dispose。

Phase 切换、图纸切换和应用关闭时必须清理 preview root、克隆材质和归控制器所有的几何。

### 7.3 颜色和透明度

继续覆盖以下材质字段：

- `material.color`。
- `material.emissive`。
- `uniforms.u_color`。
- `uniforms.u_startColor`。
- `uniforms.u_endColor`。
- `material.opacity` 和 `material.transparent`。

高亮 overlay 保持高 `renderOrder`。是否关闭 `depthTest` 和 `depthWrite` 由统一策略决定，不允许各设备类型自行设置。

### 7.4 线宽

按材质类型处理：

1. `LineMaterial`：直接设置像素单位的 `linewidth`。
2. `LineSegments2`：保持并更新其 resolution，窗口尺寸或 DPR 变化时同步。
3. `LineBasicMaterial`：不依赖浏览器原生 WebGL line width；需要加粗时转换或创建 `LineSegments2` overlay。
4. 虚线 shader：第一阶段保持原虚线宽度并显示能力提示；第二阶段迁移到支持宽线和 pattern 的 `LineSegments2` shader。
5. Mesh、hatch 和文字：颜色可覆盖，线宽字段不适用。

宽线 fallback 不能修改原 CAD 几何和共享材质。

### 7.5 非高亮内容弱化

非高亮弱化不直接遍历和修改原始 Viewer 材质。优先采用以下方案之一：

- Viewer 提供可恢复的基础层表现覆盖 API。
- 创建受控的背景表现层，并由控制器统一恢复。

若现有 preview-root API 无法安全承载弱化，先交付多色和线宽，高亮之外的背景弱化作为独立迭代，不以全局修改共享材质作为临时方案。

## 8. PDF/SVG 输出方案

### 8.1 PDF 输入契约

将单一颜色参数升级为多组样式：

```ts
export interface PdfEntityStyleOverride {
  entityIds: ReadonlySet<string>
  strokeColor: number
  strokeWidthPx: number
  opacity: number
}

export interface AcApPdfConvertOptions {
  entityStyleOverrides?: readonly PdfEntityStyleOverride[]
}
```

为兼容现有调用方，可暂时保留 `highlightedEntityIds` 和 `highlightColor`，内部转换为一个 override；新代码只使用 `entityStyleOverrides`。

### 8.2 SVG 样式覆盖

将 `AcSvgRenderer.overrideEntityStrokeColors()` 扩展为结构化的 `overrideEntityStyles()`，按 object ID 设置：

- `stroke`。
- `stroke-width`。
- `stroke-opacity`。
- 需要时设置 `fill` 或 `fill-opacity`。

覆盖必须递归应用到匹配组的子图元，但不能影响未匹配实体。

### 8.3 Viewer/PDF 一致性

Viewer 和 PDF 必须使用相同的 `PresentationStyleResolver` 输出。PDF 不得根据 Viewer 材质颜色反推业务状态。

Viewer 线宽使用像素。PDF/SVG 应定义明确换算，并通过视觉回归固定结果。建议初始换算为：

$$
\text{PDF width pt} = \text{Viewer width px} \times 0.75
$$

最终系数需使用目标页面尺寸和真实 PDF 样张确认，不能散落在调用方中。

### 8.4 PDF 文字约束

- 继续通过活动 view renderer 的 `renderMTextGeometry()` 获取字形几何。
- PDF lazy bundle 不创建独立 `AcTrMTextRenderer`。
- 严格模式不回退到 SVG `<text>`、`<tspan>` 或系统字体。
- 颜色和线宽扩展不得改变现有 path-only 文字输出。

## 9. localStorage Schema 迁移

将 `PHASE_WORKSPACE_SCHEMA_VERSION` 从 v3 提升到 v4。

### 9.1 v3 到 v4

对每个 Process：

- 增加默认 `presentationProfile`。
- 默认流路颜色使用当前绿色 `#00C853`，保证升级后视觉行为不突变。
- 增加空的或演示用 Utility 配置，并明确其不是客户标准。

对每个 Phase：

- 将 `openBoundaryHandleKeys` 转换为一条稳定 ID 的默认流路。
- 保留全部 handle key。
- 保留全部 `deviceStates`。
- 默认流路不设置 `styleOverride`，继承 Process 默认样式。

### 9.2 深拷贝要求

以下操作必须深拷贝流路数组、handle 数组和样式覆盖：

- 新 Phase 从上一 Phase 继承。
- 从历史 Phase 创建。
- 跨 Sequence 复制 Phase。
- 关联已标记 Phase。
- Store snapshot。

源 Phase、目标 Phase 和 UI 草稿后续修改必须互不影响。

### 9.3 异常数据

- 缺失颜色：使用默认颜色并记录迁移诊断。
- 非法线宽：限制到允许范围。
- Utility ID 不存在：保留流路，移除失效 Utility 关联并使用默认流路样式。
- 重复 Utility ID：保留第一个，后续项生成新 ID并记录诊断。
- 未解析 handle：保留业务数据，Viewer 显示无法恢复数量。

## 10. 代码组织

| 文件 | 计划修改 |
| --- | --- |
| `packages/cad-simple-viewer-example/src/phase/types.ts` | 增加表现配置、Utility、流路状态及 schema v4 类型 |
| `packages/cad-simple-viewer-example/src/phase/phaseWorkspaceStore.ts` | v3 到 v4 迁移、保存、继承和深拷贝 |
| `packages/cad-simple-viewer-example/src/phase/PhaseWorkspacePanel.ts` | 增加高亮样式入口和状态摘要 |
| `packages/cad-simple-viewer-example/src/presentation/HighlightStyleDialog.ts` | 新增完整样式配置对话框 |
| `packages/cad-simple-viewer-example/src/presentation/presentationStyleResolver.ts` | 新增纯样式解析器和校验函数 |
| `packages/cad-simple-viewer-example/src/presentation/PhasePresentationController.ts` | 新增 Viewer overlay 分组、更新和销毁控制 |
| `packages/cad-simple-viewer-example/src/main.ts` | 接线并移除业务代码对硬编码高亮颜色的依赖 |
| `packages/cad-simple-viewer-example/src/report/PhaseReportExporter.ts` | 将 resolved presentation context 传给单页渲染 |
| `packages/cad-pdf-plugin/src/AcApPdfConvertor.ts` | 支持多组实体颜色、线宽和透明度 |
| `packages/cad-svg-plugin/src/AcSvgRenderer.ts` | 支持结构化实体 stroke/fill 样式覆盖 |

## 11. 测试计划

### 11.1 Store 和迁移

在 `phaseWorkspaceStore.spec.ts` 覆盖：

- v3 数据迁移为 v4。
- 原高亮 handle 无损转换为默认流路。
- 默认绿色保持不变。
- Utility 和样式配置保存、加载。
- Phase 继承和复制深拷贝。
- 非法颜色、线宽和失效 Utility ID 修复。

### 11.2 样式解析器

新增 `presentationStyleResolver.spec.ts`，覆盖：

- 设备状态高于流路样式。
- 流路覆盖高于 Utility 默认值。
- Utility 缺失时回退到 Process 默认值。
- visible、opacity 和 lineWidth 边界值。
- 相同 resolved style 生成相同分组 key。
- 输入对象不被修改。

### 11.3 UI

新增或扩展 `PhaseWorkspacePanel.spec.ts` 和 `HighlightStyleDialog.spec.ts`，覆盖：

- 打开和关闭对话框。
- Tab 切换。
- 色板、十六进制颜色和线宽输入。
- Utility 新增、重命名、删除和排序。
- 实时预览回调。
- 取消恢复和应用保存。
- 未保存修改时切换 Phase。
- 键盘操作和基本可访问性属性。

### 11.4 Viewer 表现

新增 `PhasePresentationController.spec.ts`，覆盖：

- 多颜色分组。
- `LineMaterial.linewidth` 更新。
- 相同组复用。
- 样式变化的增量更新。
- Phase 和图纸切换清理。
- 不修改共享 Viewer 材质。
- resize 后宽线 resolution 更新。

### 11.5 SVG/PDF

扩展 PDF/SVG 测试，覆盖：

- 同页多组颜色。
- 不同 stroke width。
- opacity。
- 未匹配实体保持原样。
- 组内子图元递归覆盖。
- 严格模式无 `<text>` 和 `<tspan>`。
- 现有合并、分 Sequence、排除、替页和失败恢复无回归。

## 12. 验证命令

### 12.1 状态、解析器和 UI

```powershell
pnpm exec jest packages/cad-simple-viewer-example/__tests__/phaseWorkspaceStore.spec.ts packages/cad-simple-viewer-example/__tests__/presentationStyleResolver.spec.ts packages/cad-simple-viewer-example/__tests__/HighlightStyleDialog.spec.ts packages/cad-simple-viewer-example/__tests__/PhasePresentationController.spec.ts --runInBand
```

### 12.2 PDF/SVG

```powershell
pnpm exec jest packages/cad-pdf-plugin/__tests__/AcApPdfConvertor.spec.ts packages/cad-svg-plugin/__tests__/AcSvgRenderer.spec.ts packages/cad-svg-plugin/__tests__/AcSvgMTextPathUtil.spec.ts --runInBand
```

### 12.3 构建

```powershell
pnpm --filter @mlightcad/cad-svg-plugin build
pnpm --filter @mlightcad/cad-pdf-plugin build
pnpm --filter @mlightcad/cad-simple-viewer-example build
```

对全部改动文件运行仓库 ESLint。

## 13. 分阶段实施

### M1：模型、默认值和迁移

1. 冻结 `HighlightStyle`、`PresentationProfile` 和 `FlowPathStatus`。
2. 提升 schema v4。
3. 实现 v3 迁移、深拷贝和校验。
4. 完成 store 单元测试。

### M2：配置界面

1. 增加 Phase 工作区入口。
2. 完成流路、设备、Utility 和默认值四个 Tab。
3. 完成草稿、实时预览、取消恢复和应用保存。
4. 完成 UI 测试。

### M3：Viewer 多样式表现

1. 提取 `PhasePresentationController`。
2. 实现按 resolved style 分组。
3. 支持多颜色、透明度和 `LineMaterial` 宽线。
4. 实现普通线宽 fallback 或明确能力诊断。
5. 完成生命周期和资源释放测试。

### M4：PDF/SVG 一致输出

1. 增加结构化实体样式覆盖契约。
2. 支持 SVG stroke 颜色、线宽和透明度。
3. 报告导出传递 resolved presentation context。
4. 保持活动 renderer 和 path-only 文字约束。
5. 完成 PDF/SVG 回归。

### M5：标准图纸接入

1. 由 `DrawingSemanticAdapter` 输出设备类别、tag 和 Utility。
2. 将识别结果映射到现有表现配置，不修改表现层协议。
3. 导入并冻结客户 Utility 颜色规范。
4. 使用真实 DWG 完成业务验收。

## 14. 验收标准

1. 用户可以配置流路、阀门、泵、电机和 Utility 的颜色与线宽。
2. 配置修改可在 Viewer 中实时预览，取消后完整恢复。
3. Process 默认样式和 Phase 流路覆盖可以保存、刷新恢复、继承和复制。
4. 同一 Phase 可显示多条不同颜色和线宽的流路。
5. 设备状态样式与流路样式冲突时按统一优先级解析。
6. `LineMaterial` 宽线在不同缩放和窗口尺寸下保持稳定像素宽度。
7. 不修改或释放 Viewer 共享材质。
8. PDF 与 Viewer 使用相同的 resolved style，颜色和相对线宽一致。
9. PDF 严格模式不出现 `<text>` 或 `<tspan>`，不创建独立 MTEXT renderer。
10. v3 localStorage 数据升级后，原有高亮 handle、设备状态、图纸关联和报告工作流无损。
11. 无法识别设备或 Utility 时显示明确诊断，不进行类别猜测。
12. 标准图纸到达前，UI 和文档明确标注自动设备识别尚未验收。

## 15. 风险与控制

| 风险 | 控制措施 |
| --- | --- |
| 普通 WebGL 线宽在不同浏览器不一致 | 对高亮宽线使用 `LineSegments2/LineMaterial`，不依赖原生 line width |
| 虚线 shader 不支持可配置宽度 | 先保持原宽度并诊断，后续迁移到宽线 pattern shader |
| 配置数量增加导致频繁重建 overlay | 使用 resolved style key 分组并执行增量更新 |
| Phase 内重复保存完整配置导致 localStorage 膨胀 | Process 保存默认配置，Phase 只保存流路和覆盖字段 |
| Viewer 与 PDF 颜色规则分叉 | 两者复用纯 `PresentationStyleResolver` 输出 |
| PDF 线宽与屏幕视觉不一致 | 集中定义 px 到 pt 换算，并使用固定样张回归 |
| 未标准化图纸造成错误分类 | 当前只接受人工分类；自动分类必须经过能力检查和客户规则冻结 |
| 高亮代码误改共享材质 | 只修改 preview root 克隆材质，并集中管理 dispose |

## 16. 建议首版默认值

以下值仅用于保持现有行为和演示，不代表客户正式规范：

| 对象 | 颜色 | 线宽 |
| --- | --- | --- |
| 默认流路 | `#00C853` | `3 px` |
| 阀门 OPEN | `#00C853` | `3 px` |
| 阀门 CLOSED | `#D32F2F` | `3 px` |
| 阀门 PULSE | `#F9A825` | `3 px` |
| 泵/电机 START | `#00796B` | `3 px` |
| 泵/电机 STOP | `#616161` | `2 px` |
| 未知设备 | `#546E7A` | `2 px` |

正式 Utility 名称、颜色和线宽必须由客户标准图纸及配套规范确认后替换。