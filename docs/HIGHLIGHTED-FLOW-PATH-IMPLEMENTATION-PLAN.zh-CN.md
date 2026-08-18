# 高亮流路剩余 URS 分阶段实施计划

## 1. 目标与范围

当前客户 P&ID 图纸尚未标准化，无法可靠识别或区分阀门、泵、传感器、容器、管线方向及跨页连接点。因此，本计划将工作拆分为“标准图纸到达前可实施”和“等待标准图纸后实施”两部分，避免根据不稳定的 layer、block name、tag 或图元形状编写一次性识别逻辑。

整体继续沿用当前浏览器端 localStorage 架构，不引入后端。

- 首版只支持 DWG。
- URS-017、URS-020 不在本阶段实施范围内。
- 重新纳入 URS-021，以 `Sequence = Cycle`、`Phase = Step` 实现集成式 P&ID 按 Vessel/Skid 浏览任意步骤。
- URS-015 调整为在 PDF 中标注 Sequence 和 Phase。
- 阀门矩阵首版交付页面预览和 CSV，不交付 XLSX。
- 保留并回归已完成的 URS-008、URS-009、URS-010，不重复实现现有工作流。
- 标准图纸到达前，不承诺完成依赖 CAD 设备语义或连接拓扑的 URS。

## 2. 当前可实施计划

### 2.1 P0：冻结边界并准备标准化检查工具

1. 编写《客户标准 P&ID 图纸输入清单》，要求客户明确：
   - 阀门、泵、电机、传感器、容器和其他工艺设备的 block name、layer、tag 属性及动态块规则。
   - 管线图元类型、连接容差、流向表达方式及阻断元件规则。
   - 跨页连接点的 block、唯一 tag、起点/终点及重复或缺失 tag 的处理方式。
   - Vessel/Skid 的标识和归属规则。
   - Utility 名称及颜色规范。
   - 容器边界和液位填充区域的表达方式。
2. 定义“图纸能力检查结果”数据结构，只报告图纸是否满足上述规则，不在规则确认前实现设备猜测。
3. 准备可替换的 `DrawingSemanticAdapter` 接口，隔离后续设备识别、连接提取和跨页索引逻辑；当前实现返回 `unsupported` 或明确诊断。
4. 使用人工构造 JSON fixture 测试接口和错误处理，但不得将 fixture 规则声明为客户图纸标准。

交付物：输入清单、能力检查模型、适配器接口、错误与诊断 UI。该工作不会宣称完成任何依赖真实图纸语义的 URS。

### 2.2 P1：Phase 状态模型与数据迁移

1. 将 `PhaseSnapshot` 扩展为可演进的 `PhaseStatus`，预留以下独立状态字段：
   - 流路定义和颜色。
   - 设备状态。
   - 人工连接。
   - Vessel/Skid 归属。
   - 人工步骤文本。
   - 步骤条件及阶段转换动作。
2. 提升 localStorage schema version，并实现旧数据迁移，确保现有 `openBoundaryHandleKeys`、`deviceStates`、图纸关联和报告配置不丢失。
3. 所有新增状态使用稳定业务 ID，不直接持有 Three.js 对象或材质。
4. 为保存、加载、深拷贝、刷新恢复及旧 schema 迁移增加单元测试。

这项工作是后续 URS 的基础设施，不依赖客户图纸标准，但仅完成数据承载能力，不代表设备识别已经完成。

### 2.3 P1：任意历史 Phase 继承

1. 扩展 `PhaseWorkspaceStore.createPhase()`，使 history 来源可在当前 Process 的全部 Sequence 中查找，不再局限于当前 Sequence。
2. 继承图纸关联、流路状态、设备状态、人工文本和条件时执行深拷贝。
3. 保持源 Phase 和新 Phase 后续修改互不影响。
4. 覆盖源阶段删除、共享图纸资源、重复编号和失效来源测试。

该项可完整推进 URS-019，并回归 URS-008、URS-009。

### 2.4 P1：Vessel/Skid、Cycle、Step 下拉导航

1. 保留现有 Process/Sequence/Phase 数据层级，不新增独立 Cycle 或 Step 实体：
   - `Sequence = Cycle`。
   - `Phase = Step`。
2. 增加可由用户手工维护的 Vessel/Skid 定义及其关联 Sequence ID；当前不从 DWG 自动识别 Vessel/Skid。
3. 增加三级联动选择器：
   - 选择 Vessel/Skid。
   - Cycle 下拉显示该 Vessel/Skid 关联的 Sequence。
   - Step 下拉显示所选 Sequence 的全部 Phase。
4. 选择 Step 时复用现有 Phase 激活路径，加载对应 DWG 和 Phase 状态。
5. 切换 Vessel/Skid 或 Cycle 时清理失效选择，并记住每个 Vessel/Skid 最近访问的 Cycle 和 Step。
6. 提供未关联 Cycle、空 Cycle、Phase 已删除和多个 Step 共用同一 DWG 的空状态或提示。

该项可在“Vessel/Skid 归属由用户配置”的前提下完成 URS-021，不依赖 CAD 设备识别。

### 2.5 P1：人工步骤文本

1. 将人工步骤文本作为 Phase 业务数据保存，而不是只依赖临时 CAD revision 对象。
2. 支持按图纸坐标添加、编辑和删除文本；标准图纸到达前不要求自动绑定设备。
3. Phase 切换、继承和刷新后正确恢复文本。
4. PDF 导出包含人工步骤文本。

该项可完成 URS-023 的人工文本部分；按设备 tag 自动关联可在标准图纸到达后增强。

### 2.6 P1：步骤条件与阶段转换

1. 建立步骤条件和阶段转换的数据模型，支持名称、说明、运算符、期望值、单位及转换动作。
2. 标准图纸到达前允许用户手工填写对象 tag 或显示名称，不提供自动设备列表或类型校验。
3. 增加条件编辑器和 Phase 激活对话框。
4. 程序恢复、报告批量渲染和自动切换时禁止弹出阻塞对话框。
5. 条件随 Phase 保存、继承和刷新恢复。

该项可完成 URS-024 的数据、编辑和展示流程；设备类型自动校验等待标准图纸。

### 2.7 P1：PDF Sequence/Phase 标识

1. 为每个报告页派生 `ReportPageLabel`，包含 Sequence 编号、Sequence 名称、Phase 编号和 Phase 名称。
2. 将标签随 resolved page context 传给 `renderPage()`，在固定页眉区域输出，不改变原 CAD 图形比例或裁剪范围。
3. 页眉文字必须通过活动 view renderer 的 `renderMTextGeometry()` 输出 SVG path。
4. PDF lazy bundle 不得创建独立 `AcTrMTextRenderer`，也不得回退到系统字体、SVG `<text>` 或 `<tspan>`。
5. 保持现有合并 PDF、分 Sequence ZIP、排除、原位替页、失败重试及恢复活动 Phase 行为不变。

该项可完成调整后的 URS-015，并回归 URS-010。

### 2.8 P2：阀门矩阵通用框架

1. 先实现与 CAD 识别解耦的 `ValveMatrixBuilder`、页面预览和 CSV 序列化。
2. 定义稳定列：Sequence、Phase、设备 tag、设备类型、状态、传感器模式、转换条件及动作。
3. CSV 使用标准转义和 UTF-8 BOM。
4. 使用人工构造的 Phase 状态测试排序、空值、特殊字符和导出。
5. 在 UI 中明确标识“数据来源为人工配置或测试数据”，标准图纸到达前不宣称矩阵可由图纸自动生成。

该项只能完成 URS-011 的输出框架。真实阀门、泵和传感器数据接入及正式验收必须等待设备识别规则。

### 2.9 P2：通用表现层骨架

1. 提取 `PhasePresentationController`，负责创建、更新和销毁 Three.js preview roots。
2. 支持调用方传入明确 handle 集合、颜色和透明度后进行高亮或背景弱化。
3. 不在表现层判断某个 handle 是否为阀门、泵、传感器或管线。
4. 保留原图材质，不直接修改共享 viewer 材质。
5. 使用人工选择实体和 fixture handle 验证生命周期、阶段切换、清理及 PDF 表现输入。

该项为 URS-014、URS-016、URS-022 提供技术基础，但正式业务验收仍依赖标准图纸和颜色规范。

## 3. 等待客户标准图纸后实施

以下工作必须能够稳定地从客户标准图纸或配套 sidecar JSON 获得设备类别、tag 和连接关系后才能开始生产实现。

| URS | 等待实施内容 | 所需客户输入 |
| --- | --- | --- |
| URS-003 | 远程连接续接、断点识别及人工连接范围 | 管线连接、remote connector 和唯一 tag 规则 |
| URS-004 | 阀门 ON/OFF/Pulse、状态颜色和阻断遍历 | 阀门 block/layer/tag 及阻断规则 |
| URS-005 | 泵、搅拌器、混合器等电机设备 START/STOP | 电机类设备分类规则 |
| URS-006 | 过滤器、疏水阀、换热器等设备高亮 | 各类设备 block/layer/tag 规则 |
| URS-007 | 传感器模式及虚线信号线高亮 | 传感器分类及信号线连接规则 |
| URS-011 | 从真实 Phase 状态生成正式阀门矩阵 | 可识别的阀门、电机和传感器数据 |
| URS-012 | 容器液位彩色填充 | 容器边界、填充区域、量程和单位规则 |
| URS-013 | 跨 P&ID 页面流路延续 | 跨页连接点及唯一 tag 规则 |
| URS-014 | 同一管线按方向或用途使用不同颜色 | 管线方向和用途属性 |
| URS-016 | 自动弱化非流路内容 | 可靠的流路计算结果 |
| URS-018 | 手动阀独立标识 | 手动阀分类规则 |
| URS-022 | Utility 自动配色 | Utility 属性和颜色规范 |

标准图纸到达后，先运行能力检查并生成识别报告；只有设备分类、连接拓扑和 tag 唯一性达到验收门槛，才进入 FlowEngine 集成、设备菜单和跨页功能开发。

## 4. 当前建议执行顺序

1. **M1：输入标准与适配器边界**  
   完成客户输入清单、能力检查模型、`DrawingSemanticAdapter` 和诊断 UI。
2. **M2：PhaseStatus 与迁移**  
   完成状态模型、localStorage schema 迁移和深拷贝回归。
3. **M3：业务工作区**  
   完成跨 Sequence 历史 Phase 继承、Vessel/Skid → Cycle → Step 导航、人工文本及步骤条件。
4. **M4：独立输出能力**  
   完成 PDF Sequence/Phase 页眉、阀门矩阵预览/CSV 框架和通用表现层。
5. **M5：等待标准图纸期间的回归与演示**  
   使用人工 fixture 演示数据保存、导航、报告和 CSV；明确标记图纸语义相关功能尚未验收。
6. **M6：客户标准图纸到达后**  
   执行能力检查，冻结识别规则，再实施设备识别、流路计算、跨页连接、容器填充和正式矩阵。

### 4.1 当前阶段完成标准

1. 客户标准 P&ID 输入清单已经形成，可直接用于图纸评审。
2. 应用在缺少设备语义时显示明确诊断，不把未知实体误判为阀门、泵或跨页连接点。
3. 旧 localStorage 数据可无损迁移到新版 `PhaseStatus`。
4. 新 Phase 可继承当前 Process 内任意 Sequence 的历史 Phase，且状态互相隔离。
5. 用户可手工配置 Vessel/Skid 与 Sequence 的关系，并通过 Vessel/Skid → Cycle → Step 下拉激活任意 Phase。
6. 人工步骤文本、步骤条件及转换动作可保存、继承、刷新恢复和展示。
7. PDF 每页显示 Sequence 和 Phase，现有合并、分 Sequence、排除和原位替页能力无回归。
8. 阀门矩阵预览和 CSV 可使用人工配置或 fixture 状态生成，并明确标识数据来源。
9. 通用表现层可根据调用方提供的 handle 集合着色和弱化，但不承担设备识别。
10. 所有自动设备识别、自动流路计算和跨页流路功能在 UI 和文档中保持“等待标准图纸”，不以测试 fixture 作为生产完成证据。

## 5. 标准图纸到达后的详细实施参考

### 5.1 阶段一：冻结契约与测试样本

1. 定义前端 Connection Artifact v2 契约，明确每个 DWG 图元的稳定 handle、tag、设备类别、流体边、信号边、方向、远程连接 tag、utility、容器填充锚点或边界及手动连接。
2. 保留对现有 `FlowConnection/1.json` 的兼容适配。
3. 准备至少两张可跨页连接的 DWG/JSON fixture，覆盖阀门、电机、传感器、工艺设备、容器和断点。
4. 建立纯 TypeScript 领域类型，按 kind 区分 valve、motor、sensor、process-equipment、manual-valve、container。
5. 定义以下业务状态：
   - 阀门：OPEN、CLOSED、PULSE。
   - 电机：START、STOP。
   - 传感器：CONTROL、MONITOR、MONITOR_CONTROL。
   - 流路颜色和 utility。
   - 人工连接、注释、步骤条件及阶段转换。
6. 为 Vessel/Skid 定义稳定 ID、显示名及关联 Sequence ID。Sequence 作为 Cycle，Phase 作为 Step，不新增第四层级。
7. 禁止继续从 layer 名或 label 临时猜测设备类别；旧数据允许迁移为 unknown。

该阶段是 URS-003、URS-004、URS-007、URS-012、URS-013、URS-018、URS-022 的共同前置依赖。

### 5.2 阶段二：流路引擎与阶段状态

1. 新建纯 `FlowEngine`，从 `main.ts` 提取现有邻接索引和 DFS。
2. 实现以下能力：
   - 有向遍历。
   - 阀门阻断。
   - 从指定阀门开始高亮。
   - 多个独立颜色流路。
   - Utility 默认配色。
   - 手动断点边。
   - 按唯一 remote tag 产生跨图 continuation。
3. 先通过 fixture 单元测试覆盖 URS-003、URS-004、URS-013、URS-014、URS-022，再接入 UI。
4. 将 `PhaseSnapshot` 升级为完整 `PhaseStatus`，持久化：
   - 多条流路。
   - 设备状态和传感器模式。
   - 工艺设备高亮。
   - 容器液位。
   - 手动连接。
   - 人工步骤文本。
   - 条件及转换动作。
5. 提升 schema version，并提供 v3 数据迁移，确保已有 `openBoundaryHandleKeys` 和 `deviceStates` 不丢失。
6. 扩展 `PhaseWorkspaceStore.createPhase()`：
   - 保持上一阶段继承逻辑不变。
   - 将 history 来源改为在当前 Process 的全部 Sequence 中查找，完成 URS-019 的“任意历史阶段”。
   - 深拷贝所有新增状态。
   - 覆盖源阶段删除、共享图纸资源及旧 schema 迁移测试。

### 5.3 阶段三：设备交互与统一画面表现

1. 将当前通用 Open/Close 菜单改为由设备 kind 驱动的上下文菜单：
   - 阀门显示 OPEN、CLOSED、PULSE。
   - 电机显示 START、STOP。
   - 传感器显示 CONTROL、MONITOR、MONITOR & CONTROL。
   - 指定工艺设备提供高亮开关。
   - 手动阀使用独立动作和视觉标识。
2. 每次操作原子更新活动 Phase 状态并重新计算流路，覆盖 URS-004、URS-005、URS-006、URS-007、URS-018。
3. 新建 `PhasePresentationController`，统一将阶段状态映射到 Three.js preview roots：
   - 按流路和 utility 分组着色。
   - 高亮传感器虚线信号线及关联设备。
   - 使用专用样式标识手动阀。
   - 为工艺设备应用按需高亮。
   - 将非高亮基础图元弱化为灰色或黑色，完成 URS-016。
4. 保留原图材质，不直接修改共享 viewer 材质。
5. 实现容器液位 overlay：
   - 根据 artifact 中的容器边界或填充锚点绘制彩色填充。
   - 将经过量程校验的 0–100% 数值转换为裁剪填充比例。
   - 在 Phase 面板提供数值、单位和颜色编辑。
   - 处理空值、越界值及无有效边界状态。
   - 完成 URS-012。
6. 将通用 MTEXT/annotation 能力接入 Phase 业务状态：
   - 支持按图纸坐标或目标 handle 添加、编辑、删除人工操作文本。
   - 阶段切换和继承时正确恢复。
   - PDF 导出时包含标注。
   - 完成 URS-023。
7. 增加步骤条件编辑器与阶段激活对话框：
   - 条件可关联 PT、TT、控制阀、混合器等 artifact 对象。
   - 记录运算符、期望值或动作及说明。
   - 进入 Phase 时展示，并允许确认或取消进入。
   - 程序恢复和报告批量渲染时禁止弹出交互对话框。
   - 完成 URS-024。

### 5.4 阶段四：跨页流路与 Vessel/Skid 导航

1. 在 Process 范围建立已关联图纸的 remote-tag 索引。
2. 活动流路命中 continuation 时，在 Phase 状态中保留目标 drawing 和 handle，并提供上一页、下一页导航。
3. 切页通过现有 `activateWorkspacePhase()` 加载目标 DWG，恢复相同 flow id、颜色和上下文。
4. 对重复、缺失、悬空 remote tag 显示可诊断错误，并防止无限循环，完成 URS-013。
5. 保留现有 Process/Sequence/Phase 导航，不新增独立 Cycle 层级。
6. 新增 Vessel/Skid 归属配置和三级联动选择器：
   - 首先选择 Vessel/Skid。
   - 列出该 Vessel/Skid 关联的 Sequence，界面文案显示为 Cycle。
   - Step 下拉列出所选 Sequence 的全部 Phase。
7. 用户选择任意 Step 后，调用现有阶段激活路径加载对应 DWG 和完整阶段状态。
8. 切换 Vessel/Skid 或 Cycle 时清理无效选择，并记住每个 Vessel/Skid 最近访问的 Cycle 和 Step。
9. 为以下情况提供明确空状态：
   - Vessel/Skid 未关联 Cycle。
   - Cycle 中没有 Step。
   - 已选择的 Phase 被删除。
   - 多个 Step 共用同一张集成式 P&ID。
10. 完成 URS-021：用户可在集成式 P&ID 中，根据步骤下拉选项浏览指定 Vessel/Skid 所属任意 Cycle 的任意 Step。
11. 跨 Sequence 历史 Phase 来源和跨页流路应显示来源名称、图纸名称及返回入口。
12. 本阶段不实现 URS-020 的 Cycle 开始页。

### 5.5 阶段五：阀门矩阵与报告

1. 新建 `ValveMatrixBuilder`，从冻结的 Process/Sequence/Phase 状态派生矩阵行。
2. 矩阵至少包含：
   - Sequence。
   - Phase。
   - OPEN 和 PULSE 阀门。
   - 处于运行状态的电机。
   - 传感器模式。
   - 转入下一阶段的条件或动作。
3. 不得从视觉颜色反推业务状态。
4. 增加矩阵页面预览、字段级空状态和 CSV 导出。
5. CSV 使用标准字段转义和 UTF-8 BOM，完成 URS-011。
6. 为每个报告页派生 `ReportPageLabel`，包含 Sequence 编号、Sequence 名称、Phase 编号和 Phase 名称。
7. 将 label 随 resolved page context 传给 `renderPage()`，在固定页眉区域生成标识，并保持原 CAD 裁剪比例，完成调整后的 URS-015。
8. 页眉文字必须通过活动 view renderer 的 `renderMTextGeometry()` 输出 SVG path。PDF bundle 不得新建 `AcTrMTextRenderer`，也不得回退到系统字体或 SVG text。
9. 扩展 PDF 单页表现输入，使导出复用 Viewer 的：
   - 流路分组颜色。
   - 非路径弱化。
   - 设备状态。
   - 容器填充。
   - 人工步骤文本。
10. 保持现有合并 PDF、分 Sequence ZIP、排除、原位替页、失败重试及恢复活动阶段行为不变。

### 5.6 阶段六：集成与验收

1. 执行端到端手工验收：
   - 导入两张 DWG。
   - 配置跨页远程连接和手工断点。
   - 操作阀门、电机、传感器、手动阀和工艺设备。
   - 设置 utility 颜色、容器液位、人工文本和条件。
   - 从任意历史阶段继承。
   - 在集成式 P&ID 中依次选择 Vessel/Skid、Cycle 和任意 Step，验证正确图纸及阶段状态。
   - 验证 Viewer、CSV 矩阵及 PDF 输出一致。
2. 分阶段运行单元测试、示例应用测试、PDF/SVG 回归、lint 和受影响包构建。
3. 使用真实 DWG fixture 在浏览器验证：
   - 菜单定位和设备分类。
   - 材质弱化和多色高亮。
   - 跨页上下文。
   - Vessel/Skid、Cycle、Step 联动导航。
   - 阶段切换及 localStorage 迁移。
   - PDF 下载和文字 path-only 输出。
4. 以 420 个 Phase 报告和大图实体数量作为性能基准。优先缓存 artifact 索引和派生矩阵，不缓存可变 Three.js 材质。

## 6. 相关文件

| 文件 | 计划修改 |
| --- | --- |
| `packages/cad-simple-viewer-example/src/main.ts` | 应用装配、选择菜单、阶段激活、跨页加载、Vessel/Skid 联动选择和报告接线 |
| `packages/cad-simple-viewer-example/src/phase/types.ts` | `PhaseStatus`、Vessel/Skid 归属、设备状态、条件、标注和 schema 版本 |
| `packages/cad-simple-viewer-example/src/phase/phaseWorkspaceStore.ts` | v3 数据迁移、完整状态保存与继承、跨 Sequence 历史 Phase 查找 |
| `packages/cad-simple-viewer-example/src/phase/PhaseWorkspacePanel.ts` | 设备、液位、标注、条件、历史来源、Vessel/Skid 和跨页导航 UI |
| `packages/cad-simple-viewer-example/src/flow/flowTypes.ts` | 新增 artifact、流路、远程 continuation 和人工边类型 |
| `packages/cad-simple-viewer-example/src/flow/FlowEngine.ts` | 新增纯流路计算引擎 |
| `packages/cad-simple-viewer-example/src/flow/connectionArtifact.ts` | 新增 v1/v2 JSON 解析、校验和索引 |
| `packages/cad-simple-viewer-example/src/presentation/PhasePresentationController.ts` | 新增统一 Three.js overlay 与背景弱化控制 |
| `packages/cad-simple-viewer-example/src/presentation/conditionDialog.ts` | 新增条件编辑和阶段激活对话框 |
| `packages/cad-simple-viewer-example/src/matrix/ValveMatrixBuilder.ts` | 新增矩阵派生和 CSV 序列化 |
| `packages/cad-simple-viewer-example/src/report/PhaseReportExporter.ts` | 为 `renderPage()` 传递 Sequence/Phase label 及统一表现上下文 |
| `packages/cad-pdf-plugin/src/AcApPdfConvertor.ts` | 页眉 path 文字、多色高亮、背景弱化及 overlay 输出 |

## 7. 测试文件

| 文件 | 覆盖范围 |
| --- | --- |
| `packages/cad-simple-viewer-example/__tests__/phaseWorkspaceStore.spec.ts` | Schema 迁移、深拷贝、Vessel/Skid 归属及跨 Sequence history |
| `packages/cad-simple-viewer-example/__tests__/PhaseWorkspacePanel.spec.ts` | 上下文菜单、条件、标注、液位及 Vessel/Skid → Cycle → Step 联动 |
| `packages/cad-simple-viewer-example/__tests__/FlowEngine.spec.ts` | 方向、阻断、多色、utility、人工边和远程连接 |
| `packages/cad-simple-viewer-example/__tests__/ValveMatrixBuilder.spec.ts` | 矩阵字段、排序和 CSV 转义 |
| `packages/cad-simple-viewer-example/__tests__/PhaseReportExporter.spec.ts` | 页标签、跨页顺序、失败恢复和现有导出行为回归 |
| `packages/cad-pdf-plugin/__tests__/AcApPdfConvertor.spec.ts` | 多色、弱化、overlay 及活动 renderer path-only 文字 |

## 8. 验证命令

### 8.1 领域与状态测试

```powershell
pnpm exec jest packages/cad-simple-viewer-example/__tests__/FlowEngine.spec.ts packages/cad-simple-viewer-example/__tests__/phaseWorkspaceStore.spec.ts packages/cad-simple-viewer-example/__tests__/ValveMatrixBuilder.spec.ts --runInBand
```

### 8.2 UI 与报告测试

```powershell
pnpm exec jest packages/cad-simple-viewer-example/__tests__/PhaseWorkspacePanel.spec.ts packages/cad-simple-viewer-example/__tests__/phaseActivationUtils.spec.ts packages/cad-simple-viewer-example/__tests__/reportManifest.spec.ts packages/cad-simple-viewer-example/__tests__/PhaseReportExporter.spec.ts packages/cad-simple-viewer-example/__tests__/ReportWorkspaceModal.spec.ts --runInBand
```

`PhaseWorkspacePanel.spec.ts` 必须覆盖：

- Vessel/Skid → Cycle → Step 联动。
- 任意 Step 激活。
- 空 Cycle。
- Phase 删除后的失效选择。
- 每个 Vessel/Skid 最近访问 Cycle/Step 的恢复。

### 8.3 PDF 文字和组合回归

```powershell
pnpm exec jest packages/cad-pdf-plugin/__tests__/AcApPdfConvertor.spec.ts packages/cad-pdf-plugin/__tests__/AcApPdfReportComposer.spec.ts packages/cad-svg-plugin/__tests__/AcSvgMTextPathUtil.spec.ts --runInBand
```

严格 PDF 模式生成的 SVG 不得包含 `<text>` 或 `<tspan>`。

### 8.4 构建检查

```powershell
pnpm --filter @mlightcad/cad-pdf-plugin build
pnpm --filter @mlightcad/cad-simple-viewer-example build
```

对全部改动文件运行仓库 ESLint。

## 9. 标准图纸到达后的最终验收标准

1. 可在同一 Phase 中保存和恢复多条不同颜色或 utility 的流路。
2. 阀门、电机、传感器、手动阀及指定工艺设备显示正确菜单和状态颜色。
3. 传感器虚线信号线高亮到关联组件。
4. 非高亮内容弱化，高亮路径保持醒目。
5. 容器按 0–100% 液位显示彩色填充。
6. 人工步骤文本和步骤条件可随 Phase 保存、继承及恢复。
7. 流路可通过唯一 remote tag 跨 DWG 页面继续，并能处理重复、缺失及循环连接。
8. 用户可通过 Vessel/Skid、Cycle、Step 下拉浏览指定 Vessel/Skid 的任意 Cycle 和任意 Step。
9. 历史来源可跨当前 Process 内的 Sequence 选择并完整继承状态。
10. 阀门矩阵页面和 CSV 内容与 Phase 状态一致。
11. PDF 显示 Sequence/Phase 标签，并与 Viewer 的高亮、设备、液位及人工文本一致。
12. 已有阶段复制、图纸重命名、报告合并、分 Sequence、排除及原位替页功能无回归。

## 10. 已确认决策

1. 继续当前纯前端/localStorage 架构，不规划后端、上传服务、权限、审计或服务端持久化。
2. 首版只支持 DWG；URS-002 的 Plant 3D、COMOS 及其他格式支持不在本计划范围。
3. URS-017、URS-020 不实施。
4. URS-021 使用 `Sequence = Cycle`、`Phase = Step`，通过 Vessel/Skid 归属实现集成式 P&ID 的任意步骤下拉浏览。
5. URS-015 调整为 PDF 标注 Sequence 和 Phase。
6. 阀门矩阵交付页面预览和 CSV，不交付 XLSX。
7. Connection Artifact v2 可由仓库内静态 JSON 或导入适配器提供。若 DWG 本身无法提供设备类别、remote tag 或容器边界，验收 fixture 必须附带匹配的 sidecar JSON。
8. 优先在示例应用和 PDF 插件边界内实现业务能力。只有在 preview-root API 无法承载背景弱化、虚线信号或裁剪填充时，才修改 `cad-simple-viewer` 内核。
9. PDF 文本由活动 view renderer 统一提供字形几何；不得从 PDF lazy bundle 创建独立 MTEXT renderer。

## 11. 标准图纸到达后的建议里程碑

1. **M1：Artifact v2 与 fixture 评审**  
   冻结设备分类、remote tag、信号线、utility 和容器边界契约。
2. **M2：领域引擎与数据迁移**  
   完成 FlowEngine、PhaseStatus、schema 迁移和跨 Sequence 继承。
3. **M3：单页设备交互**  
   完成设备菜单、多色流路、背景弱化、液位、标注和条件。
4. **M4：跨页及 Vessel/Skid 导航**  
   完成 remote tag 跨页与 Vessel/Skid → Cycle → Step 浏览。
5. **M5：矩阵与 PDF**  
   完成 CSV 矩阵、报告标签和统一表现导出。
6. **M6：真实 DWG 集成验收**  
   完成浏览器手工验收、性能基准和全部回归验证。
