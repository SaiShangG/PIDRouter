# CIP 序列、阶段与 PDF 报告实施方案

## 1. 目标

将当前系统从“工艺 → 阶段”升级为：

```text
工艺 Process
└── 序列 Sequence
    └── 阶段 Phase
        └── 报告页面 Report Page
```

以 CIP 为例：

- 工艺：CIP。
- 序列：一项可独立执行的完整清洗任务或清洗回路，例如“配液罐 CIP”。
- 阶段：序列中的一个具体执行状态，例如“WFI 预冲洗”。
- 报告页面：某个阶段对应的 P&ID 图纸、流路高亮和设备状态。

系统最终需要支持：

1. 按序列和阶段顺序生成从开始到结束的完整流路 PDF 报告。
2. 所有序列和阶段合并为一个 PDF。例如 14 个序列、每个序列 30 个阶段，生成一个 420 页 PDF。
3. 每个序列单独生成一个 PDF。例如生成 14 个 PDF，每个文件 30 页。
4. 从报告中排除指定页面，但不删除对应的业务阶段。
5. 在相同页面位置替换指定页面，例如替换第 390 页，不影响第 391 页及后续页面。

## 2. 核心设计决策

- “工艺”保留为顶层业务类别，新增独立的“序列”实体，不把现有 Process 简单改名为 Sequence。
- 一个阶段默认对应一个报告页。
- 业务阶段与报告页面分离。删除阶段会修改工程数据；排除报告页只影响报告。
- 报告页使用稳定的页面槽位管理。替换页面只改变槽位内容，不删除或插入数组元素。
- 默认页序为序列排序优先、序列内阶段排序其次。
- 业务编号用于显示，稳定 ID 用于引用，显式顺序或数组位置用于排序。
- 保留现有单页 PDF 导出，批量报告作为新功能入口。
- PDF 文字继续通过当前活动 View Renderer 转换为路径，不创建独立 `AcTrMTextRenderer`，不回退到系统字体。
- 首版支持使用阶段快照替换报告页；任意外部 PDF 页面导入可作为后续增量。

## 3. 建议数据结构

```ts
interface ProcessDefinition {
  id: string
  name: string
  sequences: SequenceDefinition[]
  activeSequenceId?: string
  createdAt: string
  updatedAt: string
}

interface SequenceDefinition {
  id: string
  number: number
  name: string
  phases: PhaseSnapshot[]
  activePhaseId?: string
  createdAt: string
  updatedAt: string
}

interface ReportManifest {
  id: string
  processId: string
  pages: ReportPageSlot[]
  createdAt: string
}

interface ReportPageSlot {
  id: string
  sequenceId: string
  phaseId: string
  excluded: boolean
  replacement?: ReportPageSource
}

type ReportPageSource =
  | { kind: 'phase'; sequenceId: string; phaseId: string }
  | { kind: 'external-pdf'; assetId: string; pageIndex: number }
```

`ReportPageSlot.id` 和它在 Manifest 中的位置必须保持稳定。替换第 390 页时，只更新该槽位的 `replacement`，不能先删除再插入。

## 4. 分阶段执行方案

### 阶段一：领域模型与兼容迁移

- [x] 将 `PHASE_WORKSPACE_SCHEMA_VERSION` 升级到 v2。
- [x] 新增 `SequenceDefinition`。
- [x] 将 `ProcessDefinition.phases` 改为 `ProcessDefinition.sequences`。
- [x] 增加 `activeSequenceId`，阶段活动状态移动到所属序列。
- [x] 扩展 Store，支持序列新增、复制、重命名、删除、激活和排序。
- [x] 所有阶段操作增加 `sequenceId`。
- [x] 阶段排序限制在所属序列内。
- [x] 删除图纸资源前检查所有工艺和序列中的引用。
- [x] 实现 v1 → v2 数据迁移。
- [x] 迁移时为每个旧工艺创建一个“默认序列”。
- [x] 保留原有阶段 ID、来源关系、图纸引用、流路和设备状态。
- [x] 增加迁移、序列 CRUD、阶段排序和资源清理测试。

完成条件：旧 localStorage 数据能够无损加载，并能通过三级标识定位阶段。

实施状态（2026-08-12）：已完成。现有 UI 暂时显示活动序列的阶段列表，三级序列树属于阶段二。

验证结果：

- Store 与 Panel 聚焦测试：13 项通过。
- `cad-simple-viewer-example` 生产构建通过。
- 阶段一涉及的 TypeScript 文件 ESLint 通过。

### 阶段二：左侧栏三级导航

左侧栏仅负责工艺、序列和阶段，不承载报告页面。报告页面在阶段三通过顶部工具栏的独立入口打开，避免用户误认为 Report Page 是 Phase 的业务子节点。

工艺结构页：

```text
工艺：CIP

▾ 序列 01  配液罐清洗       30
   01  清洗准备
   02  WFI 预冲洗
   ...
   30  清洗完成

▸ 序列 02  乳化罐清洗       30
```

- [x] 序列支持展开和折叠。
- [x] 序列行显示编号、名称、阶段数量和完整性状态。
- [x] 阶段行显示编号、名称、图纸状态和当前选中态。
- [x] 增加序列新增、复制、重命名、删除和排序。
- [x] 阶段新增表单必须明确所属序列。
- [x] 阶段默认编号取当前序列末尾编号。
- [x] 阶段拖动和上下移动只在当前序列内生效。
- [x] 首版不支持跨序列拖动阶段。
- [x] 创建阶段时，历史来源默认仅显示当前序列的阶段。
- [x] 顶部上下文栏改为“工艺 / 序列 / 阶段”三级选择器。
- [x] 切换阶段前保存当前快照，切换后恢复目标阶段状态。
- [x] 左侧栏支持拖动调整宽度，并设置最小和最大宽度。
- [x] 长名称使用省略显示并提供 tooltip。

完成条件：用户可以通过三级树创建和管理多个 CIP 序列及其阶段。

实施状态（2026-08-12）：已完成。报告页面不与左侧工艺结构连接，由阶段三的独立报告工作区承载。

验证结果：

- Store、Panel 与侧栏 resize 聚焦测试：18 项通过。
- `cad-simple-viewer-example` 生产构建通过。
- 阶段二涉及的 TypeScript 文件 ESLint 通过。
- 紧凑布局下三级上下文栏支持横向滚动，侧栏 resize 自动禁用。

### 阶段二增量：Phase 图纸延后关联

- [x] 将工作区 schema 升级到 v3，以 `assigned | unassigned` 显式表示图纸关联状态。
- [x] 支持 v1/v2 数据迁移；引用缺失资源的旧 Phase 迁移为未关联状态。
- [x] 创建 Phase 时支持“稍后关联图纸”，不创建占位资源。
- [x] 未关联 Phase 可正常激活、保存流路与设备状态，并显示“未关联图纸”。
- [x] Phase 概览支持通过应用内弹窗关联或更换本地、URL、空白图纸。
- [x] 后续关联支持选择工作区内任意已关联 Phase，并复制其图纸、流路高亮和设备状态。
- [x] 更换图纸时，仅在旧资源不再被任何 Phase 引用后清理该资源。

实施状态（2026-08-12）：已完成。

验证结果：Store、Panel 与侧栏聚焦测试 24 项通过，生产构建和涉及文件的 ESLint 通过。

### 阶段二增量：单图纸 Phase 热切换

POC 环节仅使用一张 P&ID 图纸，各 Phase 只保存不同的流路高亮和设备状态。因此图纸首次加载后常驻 Viewer，同一 `assetId` 的 Phase 切换不再重新读取或解析图纸。

- [x] 记录 Viewer 当前已成功加载的图纸 `assetId`。
- [x] 仅在图纸相同、无加载任务且无待处理激活时启用热切换。
- [x] 同图切换跳过 IndexedDB、网络、`openDocument()` 和 `openUrl()`。
- [x] 切换前保存当前 Phase，清除旧选择、高亮和设备运行态，再直接恢复目标 Phase 快照。
- [x] 不同图纸、未关联图纸、加载中和状态不确定时继续使用完整加载路径。
- [x] 新建、外部打开、删除、重新关联或加载失败时清除已加载图纸绑定。
- [x] 增加热切换边界判定测试，覆盖同图、异图、未关联、加载中和待激活状态。

完成条件：一张图纸首次解析后，同图纸 Phase 切换只更新高亮和设备状态，不再次解析 DWG/DXF。

实施状态（2026-08-12）：已完成。多图纸解析结果 LRU、多 Document/Context 和 Worker 预解析不属于当前 POC 范围。

验证结果：Phase workspace 与热切换聚焦测试共 29 项通过，生产构建和涉及文件的 ESLint 通过。浏览器性能验收应使用至少 10 个 Phase 连续切换 100 次，并确认首次之后图纸打开、IndexedDB 读取和网络加载计数均为 0。

### 阶段三：报告清单与页面编辑

- [x] 新增 `ReportManifest` 和稳定的 `ReportPageSlot`。
- [x] Manifest 归属当前 Process，并按“序列顺序 → 阶段顺序”生成页面。
- [x] 每个阶段默认产生一个页面槽位。
- [x] “从报告排除”只设置 `excluded`，不调用 `deletePhase`。
- [x] 支持恢复被排除页面。
- [x] “替换页面”只更新同一个页面槽位的来源。
- [x] 替换操作保持页面槽位 ID、数组位置和后续页面不变。
- [x] 提供 Manifest 冻结快照，避免导出期间编辑改变当前任务。
- [x] 增加报告预检：空序列、缺失图纸、重复阶段编号、无效替换来源、缺失资源和已记录的加载失败。
- [x] 增加 Manifest 排序、排除、恢复和原位替换测试。
- [x] 验证替换第 390 页后总页数及第 391 页以后槽位 ID 不变。

报告页面通过顶部工具栏“报告”按钮打开独立的全尺寸 Modal 工作区，不与左侧“工艺与阶段”连接。工作区提供：

- 全局页码。
- 序列和阶段来源。
- 页码跳转和搜索。
- 页面预览。
- 排除、恢复和替换操作。
- 排除和替换状态标记。
- 420 页虚拟列表或窗口化渲染。

实施状态（2026-08-12）：已完成。Manifest 独立持久化，不提升 Phase workspace schema；页面预览复用现有 Phase 激活和同图热切换路径。

验证结果：

- Manifest 与报告 Modal 聚焦测试：8 项通过。
- 覆盖 14 × 30 共 420 页、排除与恢复、第 390 页原位替换、冻结快照、排序协调和预检。
- 报告列表采用固定行高窗口化渲染，仅创建可视范围及 overscan 行。

完成条件：报告编辑不会破坏工艺、序列和阶段业务数据。

### 阶段四：多页 PDF 管线

将 PDF 功能拆分为：

```text
阶段快照
  ↓
单页渲染器 AcApPdfPageRenderer
  ↓
报告协调器 PhaseReportExporter
  ↓
多页组合器 AcApPdfReportComposer
  ↓
单一 PDF 或分序列 ZIP
```

- [x] 保留 `AcApPdfConvertor.convert()` 现有单页下载入口。
- [x] 提供不触发下载的单页 SVG 或 PDF 数据接口。
- [x] 报告协调器按 Manifest 顺序逐页处理。
- [x] 每页执行“加载图纸 → 应用阶段快照 → 等待渲染 → 生成页面”。
- [x] 采用顺序或低并发处理，避免 420 份 SVG 同时驻留内存。
- [x] 单页失败必须记录页码、序列和阶段，不能静默生成空白页。
- [x] 增加 PDF 多页组合器。
- [ ] 用代表性 P&ID 比较 `jsPDF.addPage + svg2pdf` 和“单页 PDF + pdf-lib 合并”。
- [x] 默认优先考虑 `pdf-lib`，便于页面复制、隔离单页失败和后续外部 PDF 替换。
- [x] 支持所有序列合并为一个 PDF。
- [x] 支持每个序列单独生成 PDF。
- [x] 多文件输出打包为 ZIP，避免浏览器阻止连续 14 次下载。
- [x] 导出完成、取消或失败后恢复原来激活的工艺、序列、阶段和视图。

实施状态（2026-08-12）：代码与自动化验证已完成。单页由现有严格 SVG 文字路径生成独立 PDF，再由 `pdf-lib` 按 Manifest 顺序复制页面；分序列输出由 JSZip 打包。报告 Modal 支持合并 PDF、分序列 ZIP、进度显示和取消。

验证结果：

- PDF 严格文字路径、无下载字节接口、多页组合、顺序协调、失败隔离、取消恢复和 Modal 操作共 13 项聚焦测试通过。
- `@mlightcad/cad-pdf-plugin` 与 `@mlightcad/cad-simple-viewer-example` 生产构建通过。
- 14 × 30 Manifest 已由阶段三测试覆盖；真实代表性 P&ID 的 420 页浏览器下载、文件打开和视觉比对仍需人工验收。

完成条件：能够正确生成一个 420 页 PDF，以及一个包含 14 个 PDF 的 ZIP。

### 阶段五：导出 UI

导出对话框建议结构：

```text
PDF 报告

输出方式
(●) 所有序列合并为一个 PDF     420 页
( ) 每个序列一个 PDF           14 个文件

包含范围
(●) 全部序列
( ) 当前序列

报告状态
排除页面：2
替换页面：1
预检问题：0

[检查报告] [生成 PDF]
```

- [x] 显示预计页数和输出文件数。
- [x] 显示排除页和替换页统计。
- [x] 导出前执行预检。
- [x] 严重错误阻断导出，普通警告允许确认后继续。
- [x] 显示当前序列、阶段、已完成页数和总页数。
- [x] 支持取消。
- [x] 支持失败页重试。
- [x] 导出期间锁定会改变阶段状态的操作。

实施状态（2026-08-13）：已完成。报告工作区显示预计页数、排除页、替换页及两种输出模式的文件数；严重错误直接禁用导出，普通警告通过二次确认后允许继续。导出进度显示当前 Sequence、Phase、已完成页数和总页数。

导出期间禁止关闭报告工作区、预览页面、排除/恢复页面和替换来源，避免用户操作与协调器内部 Phase 激活冲突。运行时失败会列出具体页码和错误，协调器按稳定页面槽位缓存已成功生成的页面；“重试失败页面”只重新激活和渲染失败页，成功后再按 Manifest 原顺序组合并下载，不重复渲染成功页。

验证结果：

- 报告 UI 覆盖输出估算、警告确认、运行锁、失败详情、中英文和失败页重试，共 8 项测试通过。
- 报告协调器覆盖顺序导出、ZIP、失败隔离、仅重试失败页、取消及渲染中取消，共 6 项测试通过。
- Manifest、报告 UI、协调器、PDF 组合与严格单页转换联合回归共 23 项测试通过。
- `@mlightcad/cad-simple-viewer-example` 生产构建通过。

### 阶段六：测试、压测与文档

自动测试：

- [ ] v1 → v2 数据迁移。
- [ ] 序列 CRUD、排序和激活回退。
- [ ] 序列内阶段编号唯一性和排序。
- [ ] 图纸资产跨序列引用清理。
- [x] 14 × 30 Manifest 生成 420 个页面槽位。
- [x] 页面排除和恢复。
- [x] 第 390 页原位替换。
- [ ] 单文件和分序列输出。
- [ ] 单页失败、取消和恢复原工作区状态。
- [ ] PDF 严格文字路径回归。

手工验收：

1. 创建 2 个序列，每个序列 3 个阶段。
2. 合并输出应为 6 页。
3. 分序列输出应为 2 个 PDF，每个 3 页。
4. 排除一页后输出应为 5 页，业务阶段仍存在。
5. 恢复后应重新输出 6 页。
6. 替换第 4 页后仍为 6 页，第 5、6 页内容和顺序不变。
7. 使用真实 CIP 数据完成 14 × 30、共 420 页压力测试。
8. 记录生成耗时、峰值内存、文件大小、取消响应和失败恢复。
9. 抽查 SHX、TTF、MTEXT、流路高亮和设备状态。

## 5. 涉及文件

现有文件：

- `packages/cad-simple-viewer-example/src/phase/types.ts`
- `packages/cad-simple-viewer-example/src/phase/phaseWorkspaceStore.ts`
- `packages/cad-simple-viewer-example/src/phase/PhaseWorkspacePanel.ts`
- `packages/cad-simple-viewer-example/src/phase/phaseWorkspaceStyles.ts`
- `packages/cad-simple-viewer-example/src/main.ts`
- `packages/cad-simple-viewer-example/src/uiReferenceThemeStyles.ts`
- `packages/cad-simple-viewer-example/src/report/reportManifest.ts`
- `packages/cad-simple-viewer-example/src/report/ReportWorkspaceModal.ts`
- `packages/cad-simple-viewer-example/src/report/reportWorkspaceStyles.ts`
- `packages/cad-pdf-plugin/src/AcApPdfConvertor.ts`
- `packages/cad-pdf-plugin/__tests__/AcApPdfConvertor.spec.ts`

后续阶段建议新增：

- `packages/cad-simple-viewer-example/src/report/PhaseReportExporter.ts`
- `packages/cad-pdf-plugin/src/AcApPdfReportComposer.ts`
- 对应的 Store、Manifest、协调器和多页 PDF 测试文件。

## 6. 验证命令

```powershell
pnpm exec jest packages/cad-pdf-plugin/__tests__/AcApPdfConvertor.spec.ts --runInBand
pnpm exec jest packages/cad-svg-plugin/__tests__/AcSvgMTextPathUtil.spec.ts --runInBand
pnpm exec eslint <所有修改的 TypeScript 文件>
pnpm --filter @mlightcad/cad-pdf-plugin build
pnpm --filter @mlightcad/cad-simple-viewer-example build
```

新增 Store、Manifest 和报告协调器测试后，应使用具体测试文件路径执行 focused Jest。

## 7. 推荐交付顺序

1. PR 1：v2 数据模型、迁移和 Store 测试。
2. PR 2：左侧栏三级结构和顶部上下文栏。
3. PR 3：Report Manifest、排除、恢复和原位替换。
4. PR 4：单页渲染接口和多页 PDF 组合。
5. PR 5：两种输出模式、ZIP、进度、取消和错误恢复。
6. PR 6：420 页压力测试、性能优化和用户文档。

每个 PR 都应可独立构建和测试，不应在一个提交中同时重写数据模型、UI 和 PDF 管线。

## 8. 范围边界

本方案包含：

- 三级业务模型。
- 旧数据迁移。
- 左侧栏和上下文栏调整。
- 报告页面排除、恢复和同位置替换。
- 一个合并 PDF 和每序列一个 PDF。
- 进度、取消、错误处理和测试。

本方案暂不包含：

- 电子签名。
- 审计追踪。
- 服务端任务队列。
- 多用户协作。
- 任意外部 PDF 的完整编辑能力。

如果系统需要满足 GMP 或 21 CFR Part 11，应另外设计不可篡改报告版本、操作者身份、时间戳、变更原因和审计日志。