# PID Viewer 操作手册素材

对应交付文件：

- [Word 手册](../PID%20Viewer%20功能与操作手册.docx)
- [PDF 手册](../PID%20Viewer%20功能与操作手册.pdf)

## 素材目录

- `original/`：20 张当前应用的原始截图，1440 × 1000，中文界面。
- `annotated/`：带红色矩形和数字序号的完整截图。
- `detail/`：从标注图裁切的操作局部，保留红框及编号。
- `validation/`：PDF 全页缩略图、抽样页面渲染图和文本检查报告。
- `manifest.json`：截图文件名、DOM 实测标注坐标及界面文案。
- `manual-content.json`：中文正文源数据，可独立修订。
- `build-report.json`：最近一次生成的页数和图数。

## 来源与范围

采集日期：2026-09-24。截图来自本机 `http://localhost:5173` 正在运行的应用，使用现有项目及阶段。使用开发入口提供的演示登录，不含真实密码。没有使用历史 UI 基线图或伪造业务数据。

采集仅查看已有数据、打开/关闭业务窗口。未提交新建、修改、删除、上传、导入或业务报告生成。手册中的提交步骤依据当前界面与前端实现编写，需在正式发布前由业务负责人验证。

图中已有项目名和 PID 内容属于本项目实例。对外发布前请由项目负责人检查数据分享授权，按需要脱敏。红框为后期标注，不是应用界面的一部分。

## 重生成

从仓库根目录运行。需要 Windows、Node.js、当前仓库已安装的 Playwright 1.59.1、PDF.js 5.7.284 以及 Microsoft Edge。DOCX 使用 docx 9.7.1 生成，PDF 使用 Edge 排版，不依赖 Word 自动化。

首次准备独立文档工具（安装到临时目录，不修改项目依赖）：

```powershell
npm install --prefix "$env:TEMP/pid-manual-tools" docx@9.7.1 --no-audit --no-fund
```

只修改正文及重生成，无需重新采集：

```powershell
$script = [IO.File]::ReadAllText((Join-Path $PWD 'docs/manual-assets/build-manual.ps1'), [Text.Encoding]::UTF8)
& ([ScriptBlock]::Create($script)) -ValidateOnly
& ([ScriptBlock]::Create($script))
node docs/manual-assets/validate-manual.mjs
```

重新采集截图（需前端、后台已运行，当前项目中有可用的阶段）：

```powershell
node docs/manual-assets/capture.mjs
```

脚本会更新同名手册和素材；手工编辑 Word 前请保留副本，避免下次生成覆盖修订。截图脚本与当前中文界面及依赖版本绑定，升级后需检查选择器与截图清单。Word 标题使用原生样式，目录使用可点击书签链接，页码为 Word 域，图片嵌入文档。DOCX 与 PDF 使用同一正文与截图来源，但由不同引擎排版，Word 页数可能随字体和软件版本变化。

## Screenshot Assets (English)

`original` contains current application screenshots; `annotated` adds red boxes and numbered markers; `detail` contains cropped operation areas. The Chinese manual is the requested deliverable. No application localization files were modified.

Screens were captured on 2026-09-24 using the application's development demo login. Capture did not submit business data changes. Review project data disclosure and validate write operations before external publication. Run the commands above from the repository root to rebuild both DOCX and PDF.