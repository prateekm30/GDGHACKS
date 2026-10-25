// Snap a form, client side: get text out of a PDF or photo ON THE DEVICE, then check AI items
// against that text. Only text the user has reviewed is ever sent to the server.

export type ItemType = 'document' | 'deadline' | 'fee' | 'contact'
export interface ChecklistItem {
  type: ItemType
  label: string
  /** Exact words copied from the form. Items whose quote is not in the text are dropped. */
  quote: string
}

export async function extractText(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const text = await pdfText(file)
    if (text.trim().length > 40) return text
    // Scanned PDF: no text layer, so draw each page and read it with OCR, still on the device.
    return ocrPdfPages(file, onProgress)
  }
  return ocrImage(await normalizeImage(file), onProgress)
}

const MAX_SIDE = 2200

/**
 * Decode the photo in the browser and redraw it as a PNG no wider than 2200px. This handles iPhone HEIC on
 * Safari (which can decode it), shrinks 12MP photos so OCR takes seconds not minutes, and fixes orientation.
 */
async function normalizeImage(file: File): Promise<Blob> {
  const heic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(
      heic
        ? 'This browser cannot open HEIC photos. On iPhone, share the photo as JPEG, take a screenshot of the form, or set Settings > Camera > Formats to Most Compatible.'
        : 'We could not open that image. Try a JPG, PNG, or PDF.',
    )
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Could not read the photo'))), 'image/png'))
}

async function pdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '))
  }
  return pages.join('\n\n')
}

const OCR_PAGES = 3

async function ocrPdfPages(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = Math.min(doc.numPages, OCR_PAGES)
  const out: string[] = []
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, viewport }).promise
    const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Could not draw page'))), 'image/png'))
    out.push(await ocrImage(blob, (p) => onProgress?.(Math.round(((i - 1) * 100 + p) / pages))))
  }
  if (!out.join('').trim()) throw new Error('We could not find any text. Try a clearer photo of the page.')
  return out.join('\n\n')
}

async function ocrImage(file: Blob, onProgress?: (pct: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  // Everything OCR needs is served from this site (copied from node_modules at build time by
  // scripts/copy-tesseract.mjs), so no file, and no request, goes to a CDN.
  const worker = await createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/',
    langPath: '/tesseract/',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100))
    },
  })
  const { data } = await worker.recognize(file)
  await worker.terminate()
  return data.text
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Keep only items whose quote really appears in the extracted text. */
export function verifyItems(items: ChecklistItem[], text: string): ChecklistItem[] {
  const hay = norm(text)
  return items.filter((it) => it.quote.trim().length >= 4 && hay.includes(norm(it.quote)))
}

/** Non-AI fallback: lines that mention documents, dates, or money. */
const KEYWORDS = /\b(deadline|due|by|before|fee|\$\s?\d|pay stub|paystub|tax return|w-2|id|identification|social security|birth certificate|bank statement|lease|signature|sign)\b/i
export function highlightLines(text: string): { line: string; hit: boolean }[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ line, hit: KEYWORDS.test(line) }))
}

/** The API takes 20 KB per call. Long forms are split at paragraph or line breaks and sent one piece at a time. */
export const CHUNK_BYTES = 16_000
export function splitText(text: string, maxBytes = CHUNK_BYTES): string[] {
  const size = (s: string) => new TextEncoder().encode(s).length
  if (size(text) <= maxBytes) return [text]
  const out: string[] = []
  let cur = ''
  for (const para of text.split(/\n{2,}|\n(?=\S)/)) {
    const piece = para.trim()
    if (!piece) continue
    if (cur && size(cur + '\n\n' + piece) > maxBytes) {
      out.push(cur)
      cur = ''
    }
    if (size(piece) > maxBytes) {
      // One giant paragraph: hard-split by characters.
      for (let i = 0; i < piece.length; i += maxBytes / 4) out.push(piece.slice(i, i + maxBytes / 4))
      continue
    }
    cur = cur ? cur + '\n\n' + piece : piece
  }
  if (cur) out.push(cur)
  return out
}

async function requestOne(text: string): Promise<ChecklistItem[]> {
  const res = await fetch('/api/snap-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'The AI service is unavailable.')
  const body = (await res.json()) as { items: ChecklistItem[]; cached?: boolean }
  return verifyItems(body.items, text)
}

export async function requestChecklist(text: string, onProgress?: (done: number, total: number) => void): Promise<ChecklistItem[]> {
  const parts = splitText(text)
  const items: ChecklistItem[] = []
  const seen = new Set<string>()
  for (const [i, part] of parts.entries()) {
    onProgress?.(i, parts.length)
    for (const it of await requestOne(part)) {
      const key = norm(it.quote)
      if (!seen.has(key)) {
        seen.add(key)
        items.push(it)
      }
    }
  }
  onProgress?.(parts.length, parts.length)
  return items
}
