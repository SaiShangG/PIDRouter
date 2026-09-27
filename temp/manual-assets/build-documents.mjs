import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs'

const library = pathToFileURL(resolve(process.env.TEMP, 'pid-manual-tools/node_modules/docx/dist/index.mjs')).href
const { Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer, PageNumber, HeadingLevel, AlignmentType, Bookmark, InternalHyperlink } = await import(library)
const root = resolve('docs/manual-assets')
const content = JSON.parse(await readFile(resolve(root, 'manual-content.json'), 'utf8'))
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))
const children = []
const htmlPages = []
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const paragraph = (text, options = {}) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 100 }, ...options })
const htmlParagraph = text => `<p>${escapeHtml(text)}</p>`
const picture = async (name, full = false) => {
  const buffer = await readFile(resolve(root, full ? 'annotated' : 'detail', `${name}.png`))
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  const scale = Math.min(666 / width, 460 / height, 1.5)
  return {
    doc: new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: buffer, type: 'png', transformation: { width: Math.round(width * scale), height: Math.round(height * scale) }, altText: { title: name, description: '真实界面截图，红色框线与数字标记操作位置', name } })] }),
    html: `<img class="screen" src="data:image/png;base64,${buffer.toString('base64')}" alt="${escapeHtml(name)}">`
  }
}
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 650, after: 240 }, children: [new TextRun({ text: content.title, bold: true, size: 48 })] }))
children.push(paragraph('功能说明 | 操作步骤 | 红框截图', { alignment: AlignmentType.CENTER }))
children.push(paragraph(`${content.version}    ${content.date}`, { alignment: AlignmentType.CENTER }))
children.push(paragraph('适用界面：PID Viewer Lite / 中文', { alignment: AlignmentType.CENTER }))
const cover = await picture('01-workspace', true)
children.push(cover.doc, paragraph('依据当前工作区界面编制；正式发布前须完成业务审核。', { alignment: AlignmentType.CENTER }))
htmlPages.push(`<section class="cover"><h1>${escapeHtml(content.title)}</h1><p>功能说明 | 操作步骤 | 红框截图</p><p>${content.version}　${content.date}</p><p>适用界面：PID Viewer Lite / 中文</p>${cover.html}<p>依据当前工作区界面编制；正式发布前须完成业务审核。</p></section>`)
children.push(paragraph('目录', { heading: HeadingLevel.HEADING_1, pageBreakBefore: true }))
const directory = []
content.sections.forEach((section, index) => {
  const anchor = `section_${index + 1}`
  children.push(new Paragraph({ spacing: { after: 70 }, children: [new InternalHyperlink({ anchor, children: [new TextRun({ text: section.title, color: '245952' })] })] }))
  directory.push(`<li><a href="#${anchor}">${escapeHtml(section.title)}</a></li>`)
})
htmlPages.push(`<section class="contents"><h1>目录</h1><ul>${directory.join('')}</ul></section>`)
let figures = 0
for (const [index, section] of content.sections.entries()) {
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 180 }, children: [new Bookmark({ id: `section_${index + 1}`, children: [new TextRun(section.title)] })] }))
  const html = [`<section id="section_${index + 1}"><h1>${escapeHtml(section.title)}</h1>`]
  const addText = text => { children.push(paragraph(text)); html.push(htmlParagraph(text)) }
  if (section.purpose) addText(`操作目的：${section.purpose}`)
  if (section.prerequisite) addText(`前置条件：${section.prerequisite}`)
  for (const text of section.paragraphs ?? []) addText(text)
  for (const [stepIndex, text] of (section.steps ?? []).entries()) addText(`步骤 ${stepIndex + 1}：${text}`)
  if (section.image) {
    figures++
    const image = await picture(section.image, section.full)
    children.push(image.doc)
    const screen = manifest.find(item => item.name === section.image)
    const caption = `图 ${figures}　${screen.boxes.map((box, boxIndex) => `${boxIndex + 1} ${box.label}`).join('；')}`
    children.push(paragraph(caption, { alignment: AlignmentType.CENTER }))
    html.push(`<figure>${image.html}<figcaption>${escapeHtml(caption)}</figcaption></figure>`)
  }
  if (section.result) addText(`预期结果：${section.result}`)
  if (section.note) addText(`注意事项：${section.note}`)
  html.push('</section>')
  htmlPages.push(html.join(''))
}
const document = new Document({
  creator: 'PID Viewer Documentation', title: content.title, subject: '功能与操作手册', description: '当前版本真实截图与红框操作标注',
  styles: {
    default: { document: { run: { font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei', hAnsi: 'Calibri' }, size: 20 }, paragraph: { spacing: { line: 280, after: 100 } } } },
    paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { bold: true, size: 32, color: '245952' }, paragraph: { keepNext: true, spacing: { before: 0, after: 180 }, outlineLevel: 0 } }]
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, bottom: 850, left: 900, right: 900, header: 360, footer: 360 } } },
    headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: `${content.title} | ${content.version}`, size: 16, color: '666666' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页'], size: 16 })] })] }) },
    children
  }]
})
const outputName = process.env.PID_MANUAL_OUTPUT_NAME || content.title
const docx = resolve('docs', `${outputName}.docx`)
const pdf = resolve('docs', `${outputName}.pdf`)
await writeFile(docx, await Packer.toBuffer(document))
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(content.title)}</title><style>
@page{size:A4;margin:15mm 16mm}*{box-sizing:border-box}body{margin:0;color:#202b2a;font-family:"Microsoft YaHei","SimSun",sans-serif;font-size:10pt;line-height:1.48}section{break-before:page}section:first-child{break-before:auto}h1{font-size:17pt;line-height:1.25;color:#245952;margin:0 0 14px;break-after:avoid}p{margin:0 0 8px;orphans:2;widows:2}figure{margin:10px 0 8px;break-inside:avoid}.screen{display:block;margin:0 auto;max-width:100%;max-height:340pt;width:auto;height:auto;object-fit:contain}figcaption{font-size:9pt;color:#454f4e;text-align:center;margin-top:7px}.cover{text-align:center;padding-top:35px}.cover h1{font-size:27pt;margin:0 0 20px}.cover .screen{margin:25px auto;max-height:330pt}.contents ul{list-style:none;padding:0;margin:0}.contents li{margin:0 0 7px}.contents a{color:#245952;text-decoration:none}
</style></head><body>${htmlPages.join('')}</body></html>`
await writeFile(resolve(root, 'manual-preview.html'), html)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(resolve(root, 'manual-preview.html')).href, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8px;color:#666;width:100%;padding:0 16mm">${content.title} | ${content.version}</div>`,
    footerTemplate: '<div style="font-size:9px;color:#666;width:100%;padding:0 16mm;text-align:right"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  })
} finally { await browser.close() }
await writeFile(resolve(root, 'build-report.json'), JSON.stringify({ title: content.title, sections: content.sections.length, screenshots: manifest.length, figures, docx, pdf, generatedAt: new Date().toISOString(), engine: 'docx 9.7.1 / Microsoft Edge PDF', contents: 'clickable bookmarks' }, null, 2))
console.log(`Generated DOCX and PDF: ${content.sections.length} sections, ${figures} figures, ${manifest.length} original screenshots`)