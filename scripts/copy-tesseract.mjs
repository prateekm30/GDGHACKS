// Copies the OCR engine (worker, WASM core) and English language data from node_modules into public/tesseract,
// so Snap a form loads everything from this site and nothing from a CDN. Runs before every build.
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const out = 'public/tesseract'
mkdirSync(out, { recursive: true })
copyFileSync('node_modules/tesseract.js/dist/worker.min.js', join(out, 'worker.min.js'))
const core = 'node_modules/tesseract.js-core'
for (const f of readdirSync(core)) if (/^tesseract-core(-relaxedsimd|-simd)?-lstm\.wasm\.js$/.test(f)) copyFileSync(join(core, f), join(out, f))
const lang = 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'
if (!existsSync(lang)) throw new Error('English OCR data missing: npm install')
copyFileSync(lang, join(out, 'eng.traineddata.gz'))
console.log('OCR files copied to', out)
