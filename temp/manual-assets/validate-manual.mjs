import { chromium } from '../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const root = process.cwd()
const output = resolve(root, 'docs/manual-assets')
const content = JSON.parse(await readFile(resolve(output, 'manual-content.json'), 'utf8'))
const manifest = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'))
for (const section of content.sections) {
  if (section.image && !manifest.some(screen => screen.name === section.image && screen.boxes.length)) throw new Error(`Missing annotated image: ${section.image}`)
}
if (process.argv.includes('--inputs-only')) {
  console.log(`Validated ${content.sections.length} sections and ${manifest.length} screenshots`)
  process.exit(0)
}
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.end('<!doctype html><html><body style="margin:0;background:#ccc"><div id="pages" style="display:grid;grid-template-columns:repeat(4,210px);gap:10px;padding:10px"></div></body></html>')
      return
    }
    const file = resolve(root, `.${pathname}`)
    if (!file.startsWith(`${root}\\`) && !file.startsWith(`${root}/`)) throw new Error('Invalid path')
    response.setHeader('Content-Type', extname(file) === '.mjs' ? 'text/javascript' : extname(file) === '.pdf' ? 'application/pdf' : 'application/octet-stream')
    response.end(await readFile(file))
  } catch {
    response.statusCode = 404
    response.end('Not found')
  }
})
await new Promise(resolveStarted => server.listen(0, '127.0.0.1', resolveStarted))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  await mkdir(resolve(output, 'validation'), { recursive: true })
  const page = await browser.newPage({ viewport: { width: 890, height: 1000 } })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const result = await page.evaluate(async title => {
    const pdfjs = await import('/node_modules/.pnpm/pdfjs-dist@5.7.284/node_modules/pdfjs-dist/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/.pnpm/pdfjs-dist@5.7.284/node_modules/pdfjs-dist/build/pdf.worker.mjs'
    const pdf = await pdfjs.getDocument(`/docs/${encodeURIComponent(title)}.pdf`).promise
    const pages = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const pdfPage = await pdf.getPage(pageNumber)
      const text = await pdfPage.getTextContent()
      const strings = text.items.filter(item => item.str).map(item => item.str)
      const viewport = pdfPage.getViewport({ scale: 0.35 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      canvas.dataset.page = String(pageNumber)
      await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      const wrapper = document.createElement('div')
      wrapper.append(canvas, document.createTextNode(`Page ${pageNumber}`))
      document.querySelector('#pages').append(wrapper)
      pages.push({ page: pageNumber, characters: strings.join('').length, text: strings.join(' ') })
    }
    window.manualPdf = pdf
    return { pageCount: pdf.numPages, pages }
  }, process.env.PID_MANUAL_OUTPUT_NAME || content.title)
  await page.screenshot({ path: resolve(output, 'validation/contact-sheet.png'), fullPage: true })
  for (const pageNumber of [1, 2, 5, 12, result.pageCount - 3, result.pageCount]) {
    const dataUrl = await page.evaluate(async selectedPage => {
      const pdfPage = await window.manualPdf.getPage(selectedPage)
      const viewport = pdfPage.getViewport({ scale: 1.4 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      return canvas.toDataURL('image/png').split(',')[1]
    }, pageNumber)
    await writeFile(resolve(output, `validation/page-${String(pageNumber).padStart(2, '0')}.png`), Buffer.from(dataUrl, 'base64'))
  }
  const allText = result.pages.map(pageInfo => pageInfo.text).join('')
  result.missingHeadings = content.sections.filter(section => !allText.replace(/\s/g, '').includes(section.title.replace(/\s/g, ''))).map(section => section.title)
  result.sparsePages = result.pages.filter(pageInfo => pageInfo.characters < 35).map(pageInfo => pageInfo.page)
  result.outdatedBrushText = allText.includes('Escape 或右键')
  await writeFile(resolve(output, 'validation/pdf-report.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ pages: result.pageCount, missingHeadings: result.missingHeadings, sparsePages: result.sparsePages, outdatedBrushText: result.outdatedBrushText }, null, 2))
  if (result.missingHeadings.length || result.sparsePages.length || result.outdatedBrushText) throw new Error('PDF content validation failed')
} finally {
  await browser.close()
  await new Promise(resolveClosed => server.close(resolveClosed))
}