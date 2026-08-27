import type { AppLocale } from './locale'

type TranslationPair = readonly [zh: string, en: string]

const pairs: TranslationPair[] = [
  ['PID Optimizer', 'PID Optimizer'],
  ['工艺与阶段', 'Processes & Phases'], ['调整工艺侧栏宽度', 'Resize process sidebar'],
  ['高亮样式', 'Highlight styles'],
  ['当前工艺、序列与阶段', 'Current process, sequence, and Phase'], ['工艺', 'PROCESS'],
  ['序列', 'SEQUENCE'], ['快速选择工艺', 'Select process'], ['快速选择序列', 'Select sequence'],
  ['快速选择阶段', 'Select Phase'], ['尚未创建工艺', 'No process created'], ['等待创建工艺', 'Waiting for a process'],
  ['Viewer demo controls', '查看器演示控件'], ['New', '新建'], ['New drawing', '新建图纸'],
  ['Open', '打开'], ['Open DXF or DWG file', '打开 DXF 或 DWG 文件'], ['Export', '导出'],
  ['Export controls', '导出控件'], ['Dock', '停靠面板'], ['Dock panel controls', '停靠面板控件'],
  ['Open Dock', '打开停靠面板'], ['Close Dock', '关闭停靠面板'], ['Add Dock Tab', '添加停靠页签'],
  ['Width (px)', '宽度（像素）'], ['Height (px)', '高度（像素）'], ['Toolbar', '工具栏'],
  ['Toolbar controls', '工具栏控件'], ['Items layout', '项目布局'], ['Toolbar items layout', '工具栏项目布局'],
  ['Built-in default', '内置默认'], ['Minimal view tools', '最简视图工具'], ['Draw tools', '绘图工具'],
  ['Custom actions demo', '自定义操作演示'], ['Position', '位置'], ['Toolbar position', '工具栏位置'],
  ['Top', '顶部'], ['Bottom', '底部'], ['Left', '左侧'], ['Right', '右侧'],
  ['Edge inset (px)', '边缘间距（像素）'], ['Hide Toolbar', '隐藏工具栏'], ['Show Toolbar', '显示工具栏'],
  ['Collapse Toolbar', '折叠工具栏'], ['Expand Toolbar', '展开工具栏'], ['Display', '显示'],
  ['Display controls', '显示控件'], ['Line weight', '线宽'], ['Command line', '命令行'],
  ['White background', '白色背景'], ['Sidebar', '侧栏'], ['Open File', '打开文件'],
  ['Close', '关闭'], ['切换为英文', 'Switch to English'],
  ['切换为中文', 'Switch to Chinese'],
  ['报告', 'Report'], ['独立报告工作区', 'Independent report workspace'],
  ['PDF 报告页面', 'PDF report pages'], ['关闭报告工作区', 'Close report workspace'],
  ['搜索页码、序列或 Phase', 'Search page, sequence, or Phase'],
  ['搜索报告页面', 'Search report pages'], ['页码', 'Page'], ['跳转到页码', 'Go to page'],
  ['报告页面列表', 'Report page list'], ['已排除', 'Excluded'], ['已替换', 'Replaced'],
  ['问题', 'Issues'], ['正常', 'Ready'], ['来源缺失', 'Missing source'],
  ['尚无报告页面', 'No report pages'], ['页面属性', 'Page properties'],
  ['原始来源', 'Original source'], ['页面状态', 'Page status'], ['预检问题', 'Preflight issues'],
  ['恢复到报告', 'Restore to report'], ['从报告排除', 'Exclude from report'],
  ['替换来源', 'Replacement source'], ['替换页面来源', 'Replacement page source'],
  ['选择另一个 Phase', 'Select another Phase'], ['确认替换', 'Replace page'],
  ['恢复原始页面', 'Restore original page'], ['预览此页', 'Preview page'],
  ['生成 PDF 报告', 'Generate PDF report'], ['合并为一个 PDF', 'Merge into one PDF'],
  ['每个序列一个 PDF（ZIP）', 'One PDF per sequence (ZIP)'],
  ['取消生成', 'Cancel generation'], ['报告已通过预检', 'Report passed preflight'],
  ['报告生成完成', 'Report generation completed'], ['报告生成已取消', 'Report generation canceled'],
  ['报告生成失败', 'Report generation failed'],
  ['预计页数', 'Estimated pages'], ['排除页面', 'Excluded pages'],
  ['替换页面', 'Replaced pages'], ['合并输出', 'Merged output'],
  ['分序列输出', 'Per-sequence output'],
  ['PDF 正在生成中，请不要操作 Viewer', 'Generating PDF. Please do not operate the Viewer.'],
  ['正在取消 PDF 生成，请稍候', 'Canceling PDF generation. Please wait.'],
  ['正在取消…', 'Canceling…'],
  ['忽略警告并继续', 'Continue despite warnings'], ['返回检查', 'Review issues'],
  ['问题详情', 'Issue details'], ['错误', 'Error'], ['警告', 'Warning'],
  ['序列中没有 Phase，请先添加 Phase。', 'The sequence has no Phase. Add a Phase first.'],
  ['Phase 未关联图纸，请先关联图纸。', 'The Phase has no drawing. Assign a drawing first.'],
  ['Phase 编号重复，请修改编号。', 'The Phase number is duplicated. Change the number.'],
  ['替换来源不存在或已移动，请重新选择。', 'The replacement source is missing or moved. Select it again.'],
  ['关联的图纸资源不存在，请重新关联图纸。', 'The assigned drawing resource is missing. Assign the drawing again.'],
  ['图纸加载失败，请检查文件或 URL 后重试。', 'The drawing failed to load. Check the file or URL and retry.'],
  ['在 CAD Viewer 中打开此页面以查看完整 P&ID、高亮和设备状态。', 'Open this page in CAD Viewer to inspect the complete P&ID, highlights, and device states.'],
  ['从第一个工艺开始', 'Start with your first process'],
  ['工作区当前为空。创建一个工艺，例如 CIP，然后添加第一个 Phase。', 'The workspace is empty. Create a process such as CIP, then add the first Phase.'],
  ['工艺名称，例如 CIP', 'Process name, e.g. CIP'], ['工艺名称', 'Process name'], ['创建工艺', 'Create process'],
  ['当前工艺', 'Current process'], ['新增工艺', 'Add process'], ['输入新工艺名称', 'Enter process name'],
  ['删除当前工艺', 'Delete current process'], ['删除工艺？', 'Delete process?'], ['新工艺名称', 'New process name'], ['创建', 'Create'], ['取消新增工艺', 'Cancel adding process'],
  ['工艺结构', 'PROCESS STRUCTURE'], ['新增序列', 'Add sequence'], ['序列编号', 'Sequence number'],
  ['序列名称', 'Sequence name'], ['创建序列', 'Create sequence'], ['删除序列？', 'Delete sequence?'], ['取消', 'Cancel'],
  ['此工艺尚无序列。请先创建序列。', 'This process has no sequence. Create one first.'],
  ['活动', 'Active'], ['完整', 'Complete'], ['待完善', 'Incomplete'], ['复制序列', 'Copy sequence'],
  ['重命名序列', 'Rename sequence'], ['上移序列', 'Move sequence up'], ['下移序列', 'Move sequence down'],
  ['删除序列', 'Delete sequence'], ['此工艺尚无阶段。请从一张新图纸创建首个 Phase。', 'This process has no Phase. Create the first Phase from a drawing.'],
  ['此序列尚无阶段。', 'This sequence has no Phase.'], ['未关联图纸', 'No drawing assigned'],
  ['拖动调整顺序', 'Drag to reorder'], ['图纸已关联', 'Drawing assigned'], ['图纸缺失', 'Drawing missing'],
  ['上移', 'Move up'], ['下移', 'Move down'], ['新序列编号', 'New sequence number'],
  ['新序列名称', 'New sequence name'], ['当前阶段概览', 'Current Phase'], ['复制 Phase', 'Copy Phase'],
  ['来源 Phase', 'Source Phase'], ['目标序列', 'Target sequence'], ['新 Phase 编号', 'New Phase number'],
  ['新 Phase 名称', 'New Phase name'], ['复制', 'Copy'], ['删除 Phase', 'Delete Phase'],
  ['修改阶段名称', 'Rename Phase'], ['重命名图纸', 'Rename drawing'], ['更换图纸', 'Replace drawing'],
  ['关联图纸', 'Assign drawing'], ['图纸', 'Drawing'], ['来源', 'Source'], ['新图纸', 'New drawing'],
  ['状态', 'Status'], ['图纸显示名', 'Drawing display name'], ['保存', 'Save'], ['阶段名称', 'Phase name'],
  ['删除 Phase？', 'Delete Phase?'], ['关闭对话框', 'Close dialog'], ['关闭删除确认对话框', 'Close delete confirmation'],
  ['此操作将永久删除该 Phase 及其已保存状态，无法撤销。', 'This permanently deletes the Phase and its saved state. This action cannot be undone.'],
  ['确认删除', 'Delete'], ['更换关联图纸', 'Replace assigned drawing'],
  ['关闭关联图纸对话框', 'Close drawing dialog'], ['图纸关联方式', 'Drawing source'],
  ['使用 Project PID', 'Use Project PID'], ['请选择 Project PID', 'Select a Project PID'],
  ['使用任意已标记 Phase 的图纸', 'Use any marked Phase drawing'], ['使用本地图纸', 'Use local drawing'],
  ['使用图纸 URL', 'Use drawing URL'], ['使用空白图纸', 'Use blank drawing'],
  ['关联本地图纸', 'Local drawing'], ['关联图纸 URL', 'Drawing URL'], ['关联图纸显示名', 'Drawing display name'],
  ['已标记 Phase', 'Marked Phase'], ['关联方式', 'Drawing source'], ['本地图纸', 'Local drawing'],
  ['图纸 URL', 'Drawing URL'], ['确认更换', 'Replace'], ['确认关联', 'Assign'], ['创建阶段', 'Create Phase'],
  ['可先创建 Phase，之后再关联图纸，也可复制历史状态或直接使用图纸。', 'Create a Phase now and assign a drawing later, or copy marked state and use a drawing immediately.'],
  ['创建 Phase', 'Create Phase'], ['关闭创建 Phase 对话框', 'Close Create Phase dialog'],
  ['阶段编号', 'Phase number'], ['阶段创建方式', 'Phase source'],
  ['使用上一阶段的已标记图纸', 'Use marked drawing from previous Phase'],
  ['使用任意历史阶段的已标记图纸', 'Use marked drawing from Phase history'],
  ['稍后关联图纸', 'Assign drawing later'], ['历史阶段', 'Historical Phase'],
  ['新图纸显示名', 'New drawing display name'], ['创建方式', 'Source'],
  ['Open a drawing first to export PDF', '请先打开图纸再导出 PDF'],
  ['PDF export plugin is not available', 'PDF 导出插件不可用'], ['Failed to export PDF', 'PDF 导出失败'],
  ['Open a drawing first to toggle line weight', '请先打开图纸再切换线宽'],
  ['Line weight display enabled', '已启用线宽显示'], ['Line weight display disabled', '已禁用线宽显示'],
  ['Command line shown', '已显示命令行'], ['Command line hidden', '已隐藏命令行'],
  ['Background changed to white', '背景已切换为白色'], ['Background changed to black', '背景已切换为黑色'],
  ['Sidebar shown', '已显示侧栏'], ['Sidebar hidden', '已隐藏侧栏'],
  ['Simple UI plugin is not loaded', 'Simple UI 插件未加载'], ['Dock panel is not available', '停靠面板不可用'],
  ['Dock panel opened', '已打开停靠面板'], ['Dock panel closed', '已关闭停靠面板'],
  ['Failed to add dock tab', '添加停靠页签失败'], ['Dock size must be at least 120px', '停靠面板尺寸至少为 120 像素'],
  ['Viewer toolbar is not available', '查看器工具栏不可用'], ['Viewer toolbar collapse is not available', '查看器工具栏无法折叠'],
  ['Viewer toolbar shown', '已显示查看器工具栏'], ['Viewer toolbar hidden', '已隐藏查看器工具栏'],
  ['Viewer toolbar collapsed', '已折叠查看器工具栏'], ['Viewer toolbar expanded', '已展开查看器工具栏'],
  ['Edge inset must be a non-negative number', '边缘间距必须为非负数'],
  ['Failed to initialize CAD viewer', 'CAD 查看器初始化失败'],
  ['阶段图纸不可用，请重新关联图纸', 'The Phase drawing is unavailable. Assign it again.'],
  ['阶段图纸已关联', 'Phase drawing assigned'], ['New drawing created', '已创建新图纸'],
  ['Please select a DXF or DWG file', '请选择 DXF 或 DWG 文件'], ['CAD Viewer', 'CAD 查看器'],
  ['Tap to browse sample files', '点击浏览示例文件'],
  ['Process name is required', '必须填写工艺名称'], ['Sequence number must be a positive integer', '序列编号必须为正整数'],
  ['Sequence name is required', '必须填写序列名称'], ['Sequence was not found', '未找到序列'],
  ['Sequence target index is out of range', '序列目标位置超出范围'], ['Phase number must be a positive integer', 'Phase 编号必须为正整数'],
  ['Phase name is required', '必须填写 Phase 名称'], ['Drawing display name is required', '必须填写图纸显示名'],
  ['Source phase was not found', '未找到来源 Phase'], ['Phase has no drawing association', 'Phase 未关联图纸'],
  ['Source phase has no drawing association', '来源 Phase 未关联图纸'], ['Phase was not found', '未找到 Phase'],
  ['Phase target index is out of range', 'Phase 目标位置超出范围'], ['Sequence is required to activate a phase', '激活 Phase 时必须指定序列'],
  ['Process was not found', '未找到工艺'], ['Drawing asset was not found', '未找到图纸资源'],
  ['请选择历史阶段', 'Select a historical Phase'], ['请选择 DWG 或 DXF 图纸', 'Select a DWG or DXF drawing'],
  ['请输入图纸 URL', 'Enter a drawing URL'], ['请选择已标记 Phase', 'Select a marked Phase'],
  ['Demo Panel', '演示面板'], ['Example controls you can copy when building your own dock tab content.', '可复制这些示例控件来构建自己的停靠页签。'],
  ['Name', '名称'], ['Enter a label', '输入标签'], ['Enabled', '启用'], ['Inspect', '检查'], ['Edit', '编辑'],
  ['选择画笔样式', 'Select brush style'], ['选择连通流路样式', 'Select connected flow style'],
  ['关闭样式选择对话框', 'Close style selection dialog'], ['样式来源', 'Style source'],
  ['Utility 预设', 'Utility preset'], ['设备样式预设', 'Device style preset'], ['自定义', 'Custom'],
  ['Utility 样式', 'Utility style'], ['默认流路样式', 'Default flow style'], ['设备样式', 'Device style'], ['设备状态', 'Device state'],
  ['颜色', 'Color'], ['透明度', 'Opacity'], ['线宽', 'Line width'],
  ['十六进制', 'Hex'], ['线宽 (px)', 'Line width (px)'], ['透明度 (%)', 'Opacity (%)'],
  ['状态 key', 'State key'], ['右键名称', 'Context menu name'], ['Utility 名称', 'Utility name'],
  ['自动高亮流路', 'Automatically highlight flow path'], ['选择此状态时自动高亮流路', 'Automatically highlight flow path for this state'],
  ['流路行为', 'Flow behavior'], ['允许继续', 'Conducting'], ['停止', 'Blocking'], ['不参与', 'Not involved'],
  ['状态 key 不能为空，且同一设备内不能重复', 'State key is required and must be unique per device'],
  ['自定义颜色', 'Custom color'], ['自定义十六进制颜色', 'Custom hexadecimal color'],
  ['自定义透明度', 'Custom opacity'], ['自定义线宽', 'Custom line width'], ['预览', 'Preview'],
  ['高亮透明度', 'Highlight opacity'], ['应用并关闭', 'Apply and close'],
  ['请先激活一个 Phase', 'Activate a Phase first'], ['连通流路', 'Connected flow'],
  ['高亮样式已保存', 'Highlight styles saved'], ['高亮样式保存失败', 'Failed to save highlight styles'],
  ['Measure', '测量'], ['Mode', '模式'], ['Opacity', '不透明度'], ['Optional notes for this panel…', '此面板的可选备注…'],
  ['Replace this block with your own form or tool UI.', '用您自己的表单或工具界面替换此区域。'],
  ['Notes', '备注'], ['Apply', '应用'], ['Reset', '重置'], ['Change controls above, then click Apply.', '更改上方控件，然后点击“应用”。'],
  ['Panel values reset.', '面板值已重置。'], ['Line', '直线'], ['Circle', '圆'], ['Demo Info', '演示信息'],
  ['Demo Zoom', '演示缩放'], ['Zoom All', '缩放全部'], ['Zoom Window', '窗口缩放'], ['Demo Tools', '演示工具'],
  ['Hide Demo Tools', '隐藏演示工具'], ['Show Demo Tools', '显示演示工具'], ['Layer Count', '图层数量'], ['Agent', '智能助手']
  , ['Custom toolbar action works.\nThis layout fully replaces toolbar items.', '自定义工具栏操作正常。\n此布局将完全替换工具栏项目。']
]

const containsHan = (value: string) => /[\u3400-\u9fff]/u.test(value)
const normalizedPairs = pairs.map(([first, second]) =>
  !containsHan(first) && containsHan(second)
    ? ([second, first] as TranslationPair)
    : ([first, second] as TranslationPair)
)

const indexes = {
  zh: new Map(normalizedPairs.flatMap(([zh, en]) => [[zh, zh], [en, zh]])),
  en: new Map(normalizedPairs.flatMap(([zh, en]) => [[zh, en], [en, en]]))
}

export const translateUiText = (locale: AppLocale, text: string): string => {
  const exact = indexes[locale].get(text)
  if (exact) return exact
  const dynamic: Array<[RegExp, (match: RegExpMatchArray) => string]> = locale === 'en'
    ? [
      [/^序列 (\d+)/, m => `Sequence ${m[1]}`],
      [/^确认删除工艺“(.+)”？将同时删除 (\d+) 个序列和 (\d+) 个 Phase，此操作无法撤销。$/, m => `Delete process “${m[1]}”? This also deletes ${m[2]} sequences and ${m[3]} Phases. This action cannot be undone.`],
      [/^将同时删除 (\d+) 个序列和 (\d+) 个 Phase，此操作无法撤销。$/, m => `This also deletes ${m[1]} sequences and ${m[2]} Phases. This action cannot be undone.`],
      [/^此操作将永久删除该序列及其 (\d+) 个 Phase，无法撤销。$/, m => `This permanently deletes the sequence and its ${m[1]} Phases. This action cannot be undone.`],
      [/^(\d+) 个阶段$/, m => `${m[1]} Phases`],
      [/^(\d+) 个高亮边界$/, m => `${m[1]} highlighted boundaries`],
      [/^(\d+) 个设备$/, m => `${m[1]} devices`],
      [/^展开序列 (\d+)$/, m => `Expand sequence ${m[1]}`],
      [/^折叠序列 (\d+)$/, m => `Collapse sequence ${m[1]}`],
      [/^上移 Phase (.+)$/, m => `Move Phase ${m[1]} up`],
      [/^下移 Phase (.+)$/, m => `Move Phase ${m[1]} down`],
      [/^报告页 (\d+)$/, m => `Report page ${m[1]}`],
      [/^(\d+) \/ (\d+) 页$/, m => `${m[1]} / ${m[2]} pages`],
      [/^全部 (\d+)$/, m => `All ${m[1]}`],
      [/^已排除 (\d+)$/, m => `Excluded ${m[1]}`],
      [/^已替换 (\d+)$/, m => `Replaced ${m[1]}`],
      [/^问题 (\d+)$/, m => `Issues ${m[1]}`],
      [/^第 (\d+) 页 · 序列 (\d+) · Phase (\d+)$/, m => `Page ${m[1]} · Sequence ${m[2]} · Phase ${m[3]}`],
      [/^正在生成第 (\d+) \/ (\d+) 页$/, m => `Generating page ${m[1]} / ${m[2]}`],
      [/^预检发现 (\d+) 个严重问题$/, m => `Preflight found ${m[1]} critical issues`],
      [/^预检发现 (\d+) 个警告$/, m => `Preflight found ${m[1]} warnings`],
      [/^预检发现 (\d+) 个警告，是否继续生成？$/, m => `Preflight found ${m[1]} warnings. Continue generation?`],
      [/^(\d+) 个 PDF$/, m => `${m[1]} PDF files`],
      [/^(\d+) 个 PDF（ZIP）$/, m => `${m[1]} PDF files (ZIP)`],
      [/^重试失败页面（(\d+)）$/, m => `Retry failed pages (${m[1]})`],
      [/^第 (\d+) 页：(.+)$/, m => `Page ${m[1]}: ${m[2]}`],
      [/^正在生成第 (\d+) \/ (\d+) 页 · 序列 (\d+) (.*?) · Phase (\d+) (.*)$/, m => `Generating page ${m[1]} / ${m[2]} · Sequence ${m[3]} ${m[4]} · Phase ${m[5]} ${m[6]}`],
      [/^报告生成失败：(\d+) 页$/, m => `Report generation failed: ${m[1]} pages`],
      [/^(.+) 的序列与阶段$/, m => `${m[1]} sequences and Phases`],
      [/^(.+) 的阶段$/, m => `${m[1]} Phases`],
      [/^确认删除序列 (.+)？$/, m => `Delete sequence ${m[1]}?`],
      [/^Phase (\d+) created$/, m => `Phase ${m[1]} created`],
      [/^Phase (\d+) copied$/, m => `Phase ${m[1]} copied`],
      [/^Phase (\d+) deleted$/, m => `Phase ${m[1]} deleted`],
      [/^Successfully loaded: (.+)$/, m => `Loaded: ${m[1]}`],
      [/^Failed to load: (.+)$/, m => `Failed to load: ${m[1]}`],
      [/^Error loading file: (.+)$/, m => `Error loading file: ${m[1]}`]
      , [/^(.+) 副本$/, m => `${m[1]} Copy`]
      , [/^(.+) \/ 序列 (\d+) (.+) \/ Phase (\d+) (.+) \/ (.+)$/, m => `${m[1]} / Sequence ${m[2]} ${m[3]} / Phase ${m[4]} ${m[5]} / ${m[6]}`]
    ]
    : [
      [/^Sequence (\d+)/, m => `序列 ${m[1]}`],
      [/^(\d+) Phases$/, m => `${m[1]} 个阶段`],
      [/^Phase (\d+) created$/, m => `Phase ${m[1]} 已创建`],
      [/^Phase (\d+) copied$/, m => `Phase ${m[1]} 已复制`],
      [/^Phase (\d+) deleted$/, m => `Phase ${m[1]} 已删除`],
      [/^Successfully loaded: (.+)$/, m => `加载成功：${m[1]}`],
      [/^Failed to load: (.+)$/, m => `加载失败：${m[1]}`],
      [/^Error loading file: (.+)$/, m => `加载文件出错：${m[1]}`],
      [/^Added dock tab: Demo (\d+)$/, m => `已添加停靠页签：演示 ${m[1]}`],
      [/^Toolbar layout: (.+)$/, m => `工具栏布局：${translateUiText('zh', m[1])}`],
      [/^Demo Panel (\d+)$/, m => `演示面板 ${m[1]}`],
      [/^Widget (\d+)$/, m => `控件 ${m[1]}`],
      [/^Layer count: (\d+)$/, m => `图层数量：${m[1]}`],
      [/^Added dock tab: Demo (\d+)$/, m => `已添加停靠页签：演示 ${m[1]}`],
      [/^Dock (height|width): (\d+)px$/, m => `停靠面板${m[1] === 'height' ? '高度' : '宽度'}：${m[2]} 像素`],
      [/^Viewer toolbar position: (.+)$/, m => `查看器工具栏位置：${translateUiText('zh', m[1])}`],
      [/^Toolbar edge inset: (\d+)px$/, m => `工具栏边缘间距：${m[1]} 像素`],
      [/^Error creating new drawing: (.+)$/, m => `创建新图纸出错：${m[1]}`],
      [/^Unable to open (.+)$/, m => `无法打开 ${m[1]}`],
      [/^Sequence (\d+) already exists$/, m => `序列 ${m[1]} 已存在`],
      [/^Phase (\d+) already exists$/, m => `Phase ${m[1]} 已存在`],
      [/^Applied: name="(.*)", enabled=(true|false), mode="(.*)", opacity=(\d+)%\.$/, m => `已应用：名称="${m[1]}"，启用=${m[2] === 'true' ? '是' : '否'}，模式="${translateUiText('zh', m[3])}"，不透明度=${m[4]}%。`]
    ]
  for (const [pattern, formatter] of dynamic) {
    const match = text.match(pattern)
    if (match) return formatter(match)
  }
  return text
}

export const localizeDom = (root: ParentNode, locale: AppLocale) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const raw = node.textContent ?? ''
    const trimmed = raw.trim()
    if (trimmed) {
      const translated = translateUiText(locale, trimmed)
      if (translated !== trimmed) node.textContent = raw.replace(trimmed, translated)
    }
    node = walker.nextNode()
  }
  root.querySelectorAll<HTMLElement>('*').forEach(element => {
    for (const attribute of ['aria-label', 'title', 'placeholder']) {
      const value = element.getAttribute(attribute)
      if (value) element.setAttribute(attribute, translateUiText(locale, value))
    }
  })
}
