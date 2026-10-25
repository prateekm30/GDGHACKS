// Headless checks that unit tests can't cover. Builds must exist (npm run build). Starts its own preview server.
// UI_CHECK_URL=https://... runs the same checks against a deployed site instead. The site's Content-Security-Policy
// forbids injected scripts (which is what axe is), so for that run the test browser bypasses CSP. Only the test
// browser: the site's policy is unchanged.
// Fails on: any axe violation on the start, basics, pick, or results screens (normal and reduced motion),
// a headline without word spaces, a missing h1, both pick cards not fitting one phone screen, or sideways scroll.
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')

const PORT = 4321 + Math.floor(Math.random() * 500)
const LIVE = process.env.UI_CHECK_URL
const URL = LIVE ? LIVE.replace(/\/$/, '') : `http://localhost:${PORT}`
const failures = []
const fail = (msg) => failures.push(msg)

async function waitFor(url, ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('preview did not start')
}

async function axe(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  if (violations.length) fail(`${label}: axe ${violations.map((v) => `${v.id}×${v.nodes.length}`).join(', ')}`)
  else console.log(`${label}: axe clean`)
}

async function walk(browser, { reducedMotion, viewport, mobile }) {
  const ctx = await browser.newContext({ viewport, reducedMotion, isMobile: mobile, hasTouch: mobile, bypassCSP: !!LIVE })
  const p = await ctx.newPage()
  const tag = `${viewport.width}px${reducedMotion === 'reduce' ? ' reduced-motion' : ''}`
  await p.goto(URL)
  await p.waitForTimeout(800)
  const h1 = await p.locator('h1').first().innerText()
  if (!/Income-restricted homes you can actually afford, one pick at a time\./.test(h1.replace(/\s+/g, ' '))) fail(`${tag} start: headline text is "${h1}"`)
  const sw = await p.evaluate(() => document.documentElement.scrollWidth)
  if (sw > viewport.width) fail(`${tag} start: sideways scroll (${sw}px)`)
  await axe(p, `${tag} start`)

  await p.getByRole('button', { name: /^Search all/ }).first().click()
  await p.getByRole('heading', { level: 1, name: /Check what you may qualify/ }).waitFor()
  await p.locator('input[inputmode=decimal]').fill('52000')
  await p.waitForTimeout(900) // let entrance animations finish, or axe reads mid-fade colors
  await axe(p, `${tag} basics`)

  await p.getByRole('button', { name: 'Start picking' }).click()
  await p.getByRole('heading', { level: 1, name: /Which would you rather/ }).waitFor()
  await p.waitForTimeout(700)
  const cards = await p.getByRole('button', { name: /^Pick / }).all()
  if (cards.length !== 2) fail(`${tag} pick: expected 2 pick buttons, found ${cards.length}`)
  const boxes = await Promise.all(cards.map((c) => c.boundingBox()))
  const tops = await p.evaluate(() => [...document.querySelectorAll('article')].map((a) => a.getBoundingClientRect().top + window.scrollY))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  if (mobile && Math.max(...tops) - Math.min(...tops) > 40) fail(`${tag} pick: cards stacked ${Math.round(Math.max(...tops) - Math.min(...tops))}px apart`)
  const focused = await p.evaluate(() => document.activeElement?.getAttribute('role'))
  if (focused !== 'group') fail(`${tag} pick: focus is on ${focused}, not the picker`)
  await axe(p, `${tag} pick`)
  console.log(`${tag} pick: cards side by side, pick buttons end at ${Math.round(bottom)}px`)

  for (let i = 0; i < 8; i++) {
    if (await p.getByText('Your top matches').count()) break
    await p.getByRole('button', { name: /^Pick / }).first().click()
    await p.waitForTimeout(600)
  }
  await p.getByRole('heading', { level: 1, name: 'Your top matches' }).waitFor()
  await p.waitForTimeout(1800)
  const focusedResults = await p.evaluate(() => document.activeElement?.id)
  if (focusedResults !== 'main') fail(`${tag} results: focus is on #${focusedResults}, not main`)
  await axe(p, `${tag} results`)

  // Print my plan: Chrome's print preview restarts CSS animations from frame one, so anything animated in
  // must be static under print media, and the PDF must carry the text.
  await p.emulateMedia({ media: 'print' })
  const print = await p.evaluate(() => {
    const animated = [...document.querySelectorAll('#main *')].filter((el) => getComputedStyle(el).animationName !== 'none').length
    const faint = [...document.querySelectorAll('#matches *')].filter((el) => !el.closest('svg') && el.getBoundingClientRect().height > 20 && parseFloat(getComputedStyle(el).opacity) < 0.9).length
    const h1 = document.querySelector('h1')
    return { animated, faint, h1Shown: !!h1 && h1.getBoundingClientRect().height > 0 && getComputedStyle(h1).opacity === '1' }
  })
  if (print.animated) fail(`${tag} print: ${print.animated} elements still animate under print media`)
  if (print.faint) fail(`${tag} print: ${print.faint} faded elements in the matches`)
  if (!print.h1Shown) fail(`${tag} print: heading not visible`)
  const pdf = await p.pdf({ format: 'Letter', printBackground: false })
  if (pdf.length < 20_000) fail(`${tag} print: PDF is only ${pdf.length} bytes`)
  else console.log(`${tag} print: ${Math.round(pdf.length / 1024)} KB PDF, nothing animating`)
  await p.emulateMedia({ media: 'screen' })
  await ctx.close()
}

;(async () => {
  const server = LIVE ? null : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  try {
    await waitFor(URL)
    const browser = await chromium.launch()
    await walk(browser, { reducedMotion: 'no-preference', viewport: { width: 1280, height: 900 }, mobile: false })
    await walk(browser, { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 }, mobile: false })
    await walk(browser, { reducedMotion: 'no-preference', viewport: { width: 390, height: 844 }, mobile: true })
    await browser.close()
  } finally {
    server?.kill()
  }
  if (failures.length) {
    console.error('\nUI checks failed:\n- ' + failures.join('\n- '))
    process.exit(1)
  }
  console.log('\nUI checks passed')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
