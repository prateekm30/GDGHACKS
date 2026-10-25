// Walks the live site through the intro, landing, basics, picker, spotlight, and results on desktop and phone.
// node polish-shots.cjs <url> <outDir>
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const OUT = (process.argv[3] || 'shots/polish') + '/'; require('node:fs').mkdirSync(OUT, { recursive: true })
const PORT = 4700 + Math.floor(Math.random() * 100)
const URL = process.argv[2] || `http://localhost:${PORT}`
async function waitFor(url, ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if ((await fetch(url)).ok) return } catch {} await new Promise(r => setTimeout(r, 300)) } throw new Error('no preview') }
;(async () => {
  const server = process.argv[2] ? null : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  if (server) await waitFor(URL)
  const browser = await chromium.launch()
  const errors = []
  for (const [w, h, tag] of [[1440, 900, 'desktop'], [375, 740, 'phone']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, bypassCSP: !!process.argv[2] })
    const p = await ctx.newPage()
    p.on('pageerror', e => errors.push(`${tag} ${e}`))
    p.on('console', m => { if (m.type() === 'error' && !/favicon|googleapis|arcgis|net::|ERR_/.test(m.text())) errors.push(`${tag} console ${m.text().slice(0, 160)}`) })
    await p.goto(URL); await p.waitForTimeout(350)
    await p.screenshot({ path: `${OUT}${tag}-1-intro.png` })
    await p.waitForTimeout(2200)
    await p.screenshot({ path: `${OUT}${tag}-2-landing.png` })
    const sw = await p.evaluate(() => document.documentElement.scrollWidth); if (sw > w) errors.push(`${tag} landing sideways ${sw}`)
    await p.getByRole('button', { name: /^Search all/ }).first().click(); await p.getByRole('heading', { level: 1, name: /Check what you may qualify/ }).waitFor()
    await p.locator('input[inputmode=decimal]').fill('52000'); await p.waitForTimeout(600)
    await p.screenshot({ path: `${OUT}${tag}-3-basics.png` })
    await p.getByRole('button', { name: 'Start picking' }).click()
    await p.getByRole('heading', { level: 1, name: /Which would you rather/ }).waitFor(); await p.waitForTimeout(700)
    await p.screenshot({ path: `${OUT}${tag}-4-pick.png` })
    for (let i = 0; i < 10; i++) { if (!(await p.getByRole('button', { name: /^Pick / }).count())) break; await p.getByRole('button', { name: /^Pick / }).first().click(); await p.waitForTimeout(700) }
    await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}${tag}-5-spotlight-a.png` })
    await p.waitForTimeout(1900); await p.screenshot({ path: `${OUT}${tag}-6-spotlight-b.png` })
    await p.waitForTimeout(2800)
    const dlg = await p.getByRole('dialog').count(); if (dlg) errors.push(`${tag} spotlight did not auto-close`)
    await p.getByRole('heading', { level: 1, name: 'Your top matches' }).waitFor(); await p.waitForTimeout(1200)
    await p.screenshot({ path: `${OUT}${tag}-7-results.png` })
    const el = await p.locator('#matches').boundingBox(); await p.evaluate(y => window.scrollTo(0, y), (el?.y ?? 0) + window_scroll_fix(0))
    function window_scroll_fix(n) { return n }
    await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}${tag}-8-matches.png` })
    const sw2 = await p.evaluate(() => document.documentElement.scrollWidth); if (sw2 > w) errors.push(`${tag} results sideways ${sw2}`)
    await ctx.close()
  }
  await browser.close(); server?.kill()
  console.log('errors', errors)
})()
