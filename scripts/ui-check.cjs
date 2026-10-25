// Headless checks that unit tests can't cover. Builds must exist (npm run build). Starts its own preview server.
// Fails on: any axe violation on the start, basics, pick, or results screens (normal and reduced motion),
// a headline without word spaces, a missing h1, both pick cards not fitting one phone screen, or sideways scroll.
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')

const PORT = 4321 + Math.floor(Math.random() * 500)
const URL = `http://localhost:${PORT}`
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
  const ctx = await browser.newContext({ viewport, reducedMotion, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  const tag = `${viewport.width}px${reducedMotion === 'reduce' ? ' reduced-motion' : ''}`
  await p.goto(URL)
  await p.waitForTimeout(800)
  const h1 = await p.locator('h1').first().innerText()
  if (!/Find a home you can afford, one pick at a time\./.test(h1.replace(/\s+/g, ' '))) fail(`${tag} start: headline text is "${h1}"`)
  const sw = await p.evaluate(() => document.documentElement.scrollWidth)
  if (sw > viewport.width) fail(`${tag} start: sideways scroll (${sw}px)`)
  await axe(p, `${tag} start`)

  await p.getByRole('button', { name: /^Search all/ }).first().click()
  await p.getByText('First, the basics').waitFor()
  await p.locator('input[inputmode=numeric]').fill('52000')
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
  await ctx.close()
}

;(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  try {
    await waitFor(URL)
    const browser = await chromium.launch()
    await walk(browser, { reducedMotion: 'no-preference', viewport: { width: 1280, height: 900 }, mobile: false })
    await walk(browser, { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 }, mobile: false })
    await walk(browser, { reducedMotion: 'no-preference', viewport: { width: 390, height: 844 }, mobile: true })
    await browser.close()
  } finally {
    server.kill()
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
