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
  if (file.type === 'application/pdf') {
    const text = await pdfText(file)
    // Scanned PDFs have no text layer; those need OCR on a rendered page (TODO for C).
    if (text.trim().length > 40) return text
    throw new Error('This PDF looks scanned. Take a photo of the page instead.')
  }
  return ocrImage(file, onProgress)
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

async function ocrImage(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  // TODO(C): self-host language data (langPath: '/tesseract') so nothing loads from a CDN.
  const worker = await createWorker('eng', 1, {
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

export async function requestChecklist(text: string): Promise<ChecklistItem[]> {
  const res = await fetch('/api/snap-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'The AI service is unavailable.')
  const body = (await res.json()) as { items: ChecklistItem[]; cached?: boolean }
  return verifyItems(body.items, text)
}
