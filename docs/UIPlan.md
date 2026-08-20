# PID Viewer 专业 UI/UX 改版计划

## 实施状态（2026-08-20）

本轮已完成：

- P0：建立应用级语义令牌，新增产品身份区和中英文工业工作台副标题。
- P1：将紧凑布局 Phase 区改为可关闭左侧抽屉，支持遮罩、Escape 和关闭回焦；顶栏、抽屉与遮罩共用高度令牌。
- P2：新增统一 Toast、共享 Modal 焦点陷阱与回焦；图纸库和确认 Modal 已接入；命令行关闭控件已改为原生按钮。
- P2 扩展：Project、报告、解析详情和高亮样式已接入共享焦点生命周期；高亮样式已改为独立 body Modal；Escape 只关闭最上层浮层。
- P3：统一 Modal、Phase 树、图纸库、报告、浮动工具栏和命令行的核心视觉令牌，并拆分品牌令牌与组件覆盖。
- P4：完成中英文、375/768/1024/1440、200% 缩放、长文本、对比度、reduced-motion 和状态截图验收。

计划内 P0-P4 已全部完成。后续新增主题或业务界面时继续复用现有令牌、Modal 和 Toast 基础设施。

当前验证结果：10 个 UI 专项测试套件、57 个测试全部通过；Example lint、Viewer build、Example build 和 `git diff --check` 通过。浏览器验证覆盖四个目标视口、200% 缩放、紧凑抽屉、独立 Modal、Escape 层级、关闭回焦、长文本和关键颜色对比度。`docs/ui-baseline/` 保存 18 张中英文视口与状态截图。构建仅保留仓库已有的动态导入与大 chunk 警告。

## 1. 目标与范围

本计划将当前带有 Demo 控制台特征的界面，收敛为高密度、克制、可信赖的工业 CAD 工作台。

“高级、专业”在本项目中定义为：

- CAD 画布始终是主要视觉与交互区域。
- 项目、图纸和 Phase 上下文清晰稳定。
- 颜色、字体、间距、边框和交互状态使用统一语义令牌。
- 高频操作路径短，状态反馈明确，不依赖装饰性动效。
- 中英文、键盘操作、浏览器缩放和窄屏布局均可可靠使用。

本次改版保留现有原生 DOM、TypeScript 和 Three.js 架构，不迁移到 Vue 组件体系，不重写 Phase、图纸库、报告或 CAD 业务逻辑。

以下内容不属于本计划的视觉方向：

- 营销页式 Hero、CTA 或大标题构图。
- 玻璃拟态、渐变装饰、发光光球或大面积氛围背景。
- 大圆角、卡片嵌套和低信息密度布局。
- 弹跳、视差和与任务无关的滚动动画。
- 为追求视觉变化而引入深色主题；深色主题可作为后续独立里程碑。

## 2. 当前基线

### 2.1 技术与界面所有权

| 范围 | 当前实现 |
| --- | --- |
| 应用壳层、顶栏、画布 | `packages/cad-simple-viewer-example/index.html` |
| 顶栏状态、初始化、通知、语言切换 | `packages/cad-simple-viewer-example/src/main.ts` |
| 示例应用品牌主题 | `packages/cad-simple-viewer-example/src/uiReferenceThemeStyles.ts` |
| 紧凑布局 | `packages/cad-simple-viewer-example/src/appShellResponsiveStyles.ts` |
| Phase 工作区 | `packages/cad-simple-viewer-example/src/phase/` |
| 图纸库与业务弹窗 | `packages/cad-simple-viewer-example/src/drawing-library/`、`src/project/`、`src/report/`、`src/ui/` |
| 示例应用中英文 | `packages/cad-simple-viewer-example/src/locale.ts`、`src/uiTranslations.ts` |
| Viewer 基础主题 | `packages/cad-simple-viewer/src/editor/global/AcEdUiTheme.ts` |
| Viewer 命令行 | `packages/cad-simple-viewer/src/editor/input/ui/AcEdCommandLine.ts` |
| 浮动画布工具栏 | `packages/cad-simple-ui-plugin/src/ui/AcExToolbar.ts` |

### 2.2 已有优点

- Phase 侧栏已具备适合流程管理的信息密度、状态表达和排序能力。
- 图纸库已有上传、搜索、解析状态、失败重试和进度反馈。
- 浮动画布工具栏具备真实按钮、禁用状态、折叠和位置约束。
- 图纸加载进度已有 `role="status"` 和 `aria-live` 基础。
- 示例应用已有中英文切换和共享 CAD UI 词典。

### 2.3 主要问题

1. `#devToolbar` 同时承担开发控制和产品级入口，缺少稳定的产品、Project、图纸及 Phase 身份信息。
2. `--reference-*`、`--ml-ui-*` 与组件硬编码颜色并存，视觉层级和状态语义不一致。
3. 紧凑布局让 Phase 侧栏常驻占用最多 `42vh`，画布在小笔记本和平板横屏中被压缩。
4. Modal 缺少统一焦点陷阱、关闭回焦、滚动锁和生命周期管理。
5. Toast 使用行内样式并覆盖顶部区域，缺少统一 live region 语义。
6. 命令行关闭控件不是原生按钮；部分菜单角色与内部表单控件不匹配。
7. 用户可见文案分布在 HTML、TypeScript 和多套词典中，新增界面容易出现中英文遗漏。

## 3. 设计原则

### 3.1 画布优先

- CAD 画布必须占据扣除必要导航和状态区域后的最大可用空间。
- 侧栏、上下文条、命令行和浮层不得无条件占用大块画布区域。
- 画布尺寸以容器 `clientWidth` 和 `clientHeight` 为准；布局变化后刷新 renderer 和 camera。

### 3.2 工业工作台视觉

- 顶栏使用石墨色，工作面使用浅灰，内容面板使用白色或接近白色。
- 低饱和青绿作为唯一主操作色。
- 蓝色仅表达选择、定位和焦点；琥珀表达警告；红色仅表达故障或破坏性操作。
- 普通区域依靠边框、背景层级和留白区分；阴影仅用于 Modal、菜单和临时浮层。
- 正文优先使用适合中英文工业应用的本地字体回退；坐标、图号、参数和命令使用等宽字体。

### 3.3 高密度但可扫描

- 使用 4px 基础单位和 8px 主间距节奏。
- 工具栏和上下文条高度控制在 40-44px。
- 普通控件圆角控制在 4-6px。
- 状态 badge 保持单行并允许容器换行，不通过缩小字体隐藏溢出问题。
- 不把页面区段包装成浮动卡片，不使用卡片嵌套。

### 3.4 克制动效

- 颜色、边框、透明度和浮层进入使用 150-200ms 过渡。
- 不通过缩放改变交互元素布局边界。
- 支持 `prefers-reduced-motion`，关闭非必要动效后直接渲染最终状态。

## 4. 目标信息架构

```text
┌ 产品 / Project / 当前图纸 ─────── 图纸库 / 项目 / 报告 / 语言 ┐
├ Phase 侧栏 280-360px ┬ 当前 Process / Sequence / Phase ───────┤
│ 可调整、可折叠       ├────────────────────────────────────────┤
│                      │                                        │
│                      │               CAD 主画布                │
│                      │                                        │
├──────────────────────┴────────────────────────────────────────┤
│ 状态栏：坐标、缩放、选择数量、加载状态、命令行                 │
└───────────────────────────────────────────────────────────────┘
```

### 4.1 应用顶栏

- 将 `#devToolbar` 重构为产品级应用顶栏并移除 Demo 命名和可见文案。
- 左侧稳定展示产品名称、当前 Project 和当前图纸。
- Phase 上下文保留在画布上方的紧凑上下文条中。
- 右侧仅保留图纸库、项目、报告、语言等全局命令。
- 开发配置移出默认操作路径，可放入仅开发环境可见的独立入口。
- 图纸、Project 或 Phase 缺失时显示明确空状态，不使用空字符串占位。

### 4.2 Phase 侧栏

- 桌面默认宽度 320px，可调整范围 280-360px；如业务确有需要，可保留现有更宽上限。
- 支持显式折叠，并记住用户最近使用宽度和折叠状态。
- 紧凑布局中改为可关闭抽屉或底部面板，不再常驻占用 `42vh`。
- 打开紧凑面板后，焦点进入面板；关闭后回到触发按钮。

### 4.3 状态与命令区

- 将坐标、缩放、选择数量、加载状态和命令行组织为底部工作区。
- 状态信息不得遮挡画布控制点或键盘焦点。
- 命令行显示状态由现有 `isShowCommandLine` 设置管理，不复制第二套状态。

## 5. 视觉令牌

以 `AcEdUiTheme.ts` 中的 `--ml-ui-*` 为基础契约，示例应用只做品牌语义映射。组件不得新增无语义的散落色值。

建议补齐以下语义层：

| 令牌职责 | 建议用途 |
| --- | --- |
| `surface-app` | 应用整体工作面 |
| `surface-panel` | 侧栏和内容面板 |
| `surface-elevated` | Modal、菜单、浮层 |
| `surface-canvas` | CAD 画布外围背景 |
| `text-primary` | 标题、正文和主要数据 |
| `text-secondary` | 辅助说明和次要元数据 |
| `border-default` | 普通区域分隔 |
| `border-strong` | 当前区域和高层级边界 |
| `accent-primary` | 主操作 |
| `accent-selection` | 选择和定位 |
| `status-success` | 成功、可用、在线 |
| `status-warning` | 警告、待处理 |
| `status-danger` | 故障、失败、破坏性操作 |
| `focus-ring` | 全局键盘焦点 |

设计令牌完成后，优先迁移：

1. 应用顶栏与 Phase 上下文条。
2. Phase 侧栏。
3. 图纸库、Project 和报告 Modal。
4. Toast、菜单和状态 badge。
5. 浮动画布工具栏与命令行。

## 6. Modal 架构

所有弹窗必须继续实现为独立 Modal：独立组件、独立遮罩、挂载到 `document.body`，具备 `open/close` 生命周期与状态；不得嵌套到其他 Panel 或 Modal 内。

共享 Modal 行为必须提供：

- `role="dialog"`、`aria-modal="true"` 和标题关联。
- 打开前记录触发元素。
- 打开后将焦点放到首个安全操作或标题容器。
- `Tab` 与 `Shift+Tab` 焦点陷阱。
- `Escape` 关闭；业务忙碌时允许显式禁止关闭。
- 关闭后恢复触发元素焦点。
- 页面滚动锁和重复打开保护。
- 销毁时移除监听器和 DOM。

迁移顺序：

1. `DrawingLibraryModal` 作为首个验证对象。
2. `ConfirmationModal` 与解析详情 Modal。
3. Project 管理 Modal。
4. 报告工作区 Modal。
5. 其余独立业务弹窗。

## 7. Toast 与状态反馈

新增独立 `Toast` 组件和样式模块，替代 `App.showMessage()` 中的行内样式。

要求：

- 支持 `success`、`info`、`warning`、`error` 四类语义状态。
- 普通消息使用 `role="status"` 和 polite live region；阻断错误按需使用 assertive。
- 不覆盖顶栏、菜单、Modal 标题或键盘焦点。
- 成功和普通提示可自动消失；错误应停留更久并提供关闭按钮。
- 明确单消息替换或消息队列策略，不允许无上限堆叠。
- 关闭按钮具备中英文 accessible name。
- 首屏初始化显示明确加载状态，避免隐藏整个应用壳层形成空白页面。

建议新增：

- `packages/cad-simple-viewer-example/src/ui/Toast.ts`
- `packages/cad-simple-viewer-example/src/ui/toastStyles.ts`
- `packages/cad-simple-viewer-example/__tests__/Toast.spec.ts`

## 8. 交互语义与无障碍

### 8.1 命令行

- 将 `.ml-cli-close-btn` 从 `div` 改为 `button type="button"`。
- 补充中英文 `aria-label`、title、disabled 和键盘行为。
- 保持命令历史、输入焦点和显示设置行为不变。

### 8.2 菜单与 Popover

当前包含 `select` 和数值输入的浮层不应声明为标准 `menu`。实现时二选一：

1. 纯命令列表使用完整 menu/menuitem 键盘模型；或
2. 含表单控件的浮层使用普通 popover/dialog 语义。

不得继续混用不完整的菜单角色和普通表单交互。

### 8.3 图标与状态

- 保持 Lucide 图标家族和一致的线性风格。
- 装饰性图标使用 `aria-hidden="true"`。
- 独立图标按钮必须有 accessible name 和 tooltip。
- 切换按钮暴露 `aria-pressed` 或 `aria-expanded`。
- 状态含义不得只依赖颜色。
- 正文文本与背景对比度至少 4.5:1；非文本控件和焦点边界至少 3:1。

## 9. 国际化要求

所有新增或修改的用户可见文本必须同时提供中文和英文，包括：

- 按钮、标题、菜单和空状态。
- ARIA label、title、placeholder。
- Toast、加载状态、错误消息和确认文案。
- Project、图纸和 Phase 缺失状态。

落点规则：

- 示例应用新文案优先进入 `packages/cad-simple-viewer-example/src/locale.ts`。
- 由现有 DOM 本地化路径处理的内容同步更新 `src/uiTranslations.ts`。
- 共享插件文案同时更新 `packages/cad-simple-ui-plugin/src/i18n/en.ts` 与 `zh.ts`。
- Viewer 核心文案使用其现有 i18n namespace，不在组件内硬编码中文或英文。
- 切换语言后，已打开的 Modal、Toast、菜单和工作区无需刷新即可更新。

## 10. 分阶段实施计划

### 10.1 P0：基线与统一令牌

- [x] 在 1440px、1024px、768px 和 375px 下保存当前中英文基线截图。
- [x] 清点 `--reference-*`、`--ml-ui-*` 和主要组件硬编码色值。
- [x] 定义语义颜色、间距、圆角、字体、阴影、焦点和动效令牌。
- [x] 将品牌令牌映射与 `uiReferenceThemeStyles.ts` 组件覆盖拆分。
- [x] 迁移顶栏和 Phase 上下文条到统一令牌。
- [x] 保持当前图纸加载、Phase 激活和报告流程不变。

完成标准：顶栏和上下文条不再依赖散落硬编码色值，键盘焦点清晰可见，中英文均无文本裁切。

### 10.2 P1：产品顶栏与画布优先布局

- [x] 将 `#devToolbar` 改名并重构为产品级顶栏。
- [x] 展示产品、Project、图纸和全局命令。
- [x] 移除默认界面中的 Demo 控制语义。
- [x] 将紧凑布局 Phase 区改为抽屉或可关闭底部面板。
- [x] 确保画布根据容器尺寸刷新。
- [x] 回归侧栏拖拽、折叠和状态记忆。

完成标准：1024px 及更小视口中画布仍是主区域；Phase 面板可显式打开、操作和关闭。

### 10.3 P2：Modal、Toast 与键盘语义

- [x] 抽取共享 Modal 生命周期和焦点管理。
- [x] 迁移图纸库、确认、Project 和报告 Modal。
- [x] 新增统一 Toast 组件和 live region。
- [x] 修正命令行关闭按钮。
- [x] 修正顶栏菜单与表单控件角色。
- [x] 覆盖 Modal 焦点、关闭回焦和 Toast 宣布测试。

完成标准：仅使用键盘即可完成顶栏、菜单、Modal 和命令行操作；Modal 打开时焦点不可逃逸。

### 10.4 P3：核心工作区视觉收敛

- [x] 统一 Phase 树标题、行高、状态、操作按钮和空状态。
- [x] 统一图纸库上传、搜索、进度、列表和错误状态。
- [x] 统一画布工具栏、命令行和状态区。
- [x] 清除本次审查范围内遗留的大圆角、重复阴影和高风险无语义色值。
- [x] 验证长图纸名、长 Project 名和中英文混排。

完成标准：同屏所有区域使用一致的按钮层级、边框、状态颜色和焦点样式，没有卡片嵌套或明显的组件来源割裂。

### 10.5 P4：国际化、无障碍与视觉验收

- [x] 补齐所有新增文案的中文和英文。
- [x] 检查 200% 浏览器缩放和键盘焦点可见性。
- [x] 检查 reduced-motion。
- [x] 验证正文、图标、边框和焦点对比度。
- [x] 保存无图纸、已加载、Phase 激活、Modal、错误 Toast 五类中英文截图。
- [x] 执行完整构建、lint 和相关测试。

完成标准：测试矩阵全部通过，无关键业务流程和可访问性回归。

## 11. 文件落点

| 文件 | 计划变更 |
| --- | --- |
| `packages/cad-simple-viewer-example/index.html` | 应用壳层、顶栏、上下文条和浮层语义 |
| `packages/cad-simple-viewer-example/src/main.ts` | 顶栏状态、语言更新、Toast 委托和初始化状态 |
| `packages/cad-simple-viewer-example/src/uiReferenceThemeStyles.ts` | 品牌映射与统一语义令牌 |
| `packages/cad-simple-viewer-example/src/appShellResponsiveStyles.ts` | Phase 紧凑面板与画布优先响应式 |
| `packages/cad-simple-viewer-example/src/phaseSidebarResize.ts` | 桌面尺寸和紧凑模式状态切换 |
| `packages/cad-simple-viewer-example/src/ui/ConfirmationModal.ts` | 共享 Modal 行为参考或接入点 |
| `packages/cad-simple-viewer-example/src/drawing-library/DrawingLibraryModal.ts` | 首个 Modal 迁移对象 |
| `packages/cad-simple-viewer-example/src/ui/Toast.ts` | 新增统一 Toast 组件 |
| `packages/cad-simple-viewer-example/src/ui/toastStyles.ts` | 新增 Toast 样式 |
| `packages/cad-simple-viewer-example/src/locale.ts` | 类型安全的新 UI 中英文消息 |
| `packages/cad-simple-viewer-example/src/uiTranslations.ts` | 旧 DOM 路径的中英文映射 |
| `packages/cad-simple-viewer/src/editor/global/AcEdUiTheme.ts` | 共享基础主题契约，确有跨包需求时修改 |
| `packages/cad-simple-viewer/src/editor/input/ui/AcEdCommandLine.ts` | 命令行按钮语义与可访问性 |
| `packages/cad-simple-ui-plugin/src/i18n/en.ts` | 共享插件英文文案 |
| `packages/cad-simple-ui-plugin/src/i18n/zh.ts` | 共享插件中文文案 |

## 12. 测试矩阵

### 12.1 自动化测试

```powershell
pnpm test -- packages/cad-simple-viewer-example/__tests__/locale.spec.ts
pnpm test -- packages/cad-simple-viewer-example/__tests__/phaseSidebarResize.spec.ts
pnpm --filter @mlightcad/cad-simple-viewer-example lint
pnpm --filter @mlightcad/cad-simple-viewer-example build
```

实施时增加或扩展：

- Modal 初始焦点、焦点陷阱、Escape 和关闭回焦测试。
- Toast live region、关闭和超时测试。
- 顶栏中英文切换测试。
- compact Phase 面板打开、关闭和焦点恢复测试。
- 命令行关闭按钮语义与行为测试。

修改共享 Viewer 或 UI Plugin 时额外运行：

```powershell
pnpm --filter @mlightcad/cad-simple-viewer lint
pnpm --filter @mlightcad/cad-simple-viewer build
pnpm --filter @mlightcad/cad-simple-ui-plugin lint
pnpm --filter @mlightcad/cad-simple-ui-plugin build
```

### 12.2 手工视口验收

| 视口 | 重点 |
| --- | --- |
| 1440px | 完整工作台、侧栏调整、Modal 和报告流程 |
| 1024px | 小笔记本画布占比、顶栏溢出和侧栏状态 |
| 768px | 紧凑 Phase 面板、横屏和触控操作 |
| 375px | 文本回流、控件可操作性和画布最小可用区域 |
| 200% 缩放 | 焦点不被固定区域遮挡，内容不裁切 |

每个视口至少验证：

1. 无图纸空状态。
2. 打开 DWG/DXF 并完成加载。
3. 切换 Process、Sequence 和 Phase。
4. 打开并关闭图纸库、Project 和报告 Modal。
5. 执行选择操作和命令行输入。
6. 显示成功与错误 Toast。
7. 中文与英文切换。

## 13. 总体验收标准

1. 界面不再出现面向用户的 Demo 命名或开发控制语义。
2. 产品、Project、当前图纸和 Phase 上下文始终可识别。
3. CAD 画布在桌面和紧凑布局中保持主要工作区域。
4. 颜色、字体、间距、圆角、边框、焦点和状态使用统一语义令牌。
5. 所有 Modal 均独立挂载到 `document.body`，焦点受控且关闭后回到触发元素。
6. Toast 可被辅助技术正确宣布，并且不遮挡顶栏、菜单或键盘焦点。
7. 命令行和菜单使用正确的原生交互语义。
8. 所有新增或修改文案具备同步的中文和英文版本。
9. 375、768、1024、1440px 和 200% 缩放下无关键文本裁切或控件重叠。
10. DWG/DXF 加载、Phase 激活、图纸库、报告、选择和命令行无行为回归。

## 14. 风险与控制

| 风险 | 控制措施 |
| --- | --- |
| 主题重构影响共享包 | 先在示例应用做品牌映射，只在确有跨包需求时扩展基础契约 |
| 响应式改造触发 Three.js 尺寸错误 | 以画布容器尺寸更新 renderer/camera，并增加 resize 回归 |
| Modal 抽象改变业务关闭条件 | 保留各 Modal 的 busy guard，只共享生命周期和焦点行为 |
| 文案分散导致翻译遗漏 | 每个阶段将中英文测试和 UI 截图作为完成条件 |
| 视觉调整影响高密度操作 | 不降低列表信息量，以层级、对齐和语义色提升扫描效率 |
| 全量改造风险过高 | 按 P0-P4 分阶段交付，每阶段执行构建和关键业务回归 |

## 15. 非目标

- 不重构 CAD 渲染、实体选择、Phase 数据模型或报告生成算法。
- 不更换现有 Lucide 图标库。
- 不迁移到新的前端框架或 CSS 框架。
- 不在首轮交付中实现深色主题。
- 不新增营销首页、品牌宣传区或与工业工作流无关的装饰内容。
