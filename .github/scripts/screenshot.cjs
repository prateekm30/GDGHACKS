// Walks the live site like a first-time user and saves screenshots (desktop and phone).
const { chromium } = require('playwright')
const [url, out] = process.argv.slice(2)

// Scroll to the bottom and back so scroll-triggered reveals have played before a full-page shot.
async function settle(p, ms = 900) {
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
    window.scrollTo(0, 0)
  })
  await p.waitForTimeout(ms)
}
;(async () => {
  const b = await chromium.launch()
  // What a judge sees before scrolling, on a small laptop and a phone.
  for (const [name, vp] of [['fold-laptop', { width: 1024, height: 768 }], ['fold-phone', { width: 390, height: 844 }]]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 })
    await p.goto(url)
    await p.waitForTimeout(400)
    await p.screenshot({ path: `${out}/${name}-0400ms.png` })
    await p.close()
  }
  for (const [name, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 })
    await p.goto(url)
    await settle(p, 2600)
    await p.screenshot({ path: `${out}/${name}-0-hero.png` })
    await p.screenshot({ path: `${out}/${name}-1-start.png`, fullPage: true })
    // "How it works" is its own page now.
    await p.goto(url.replace(/\/$/, '') + '/#how')
    await settle(p, 1500)
    await p.screenshot({ path: `${out}/${name}-1b-how.png`, fullPage: true })
    await p.goto(url)
    await settle(p, 1500)
    await p.getByRole('button', { name: /^Search all/ }).first().click()
    await p.getByRole('heading', { level: 1, name: /Check what you may qualify/ }).waitFor()
    await p.locator('input[inputmode=decimal]').fill('52000')
    await p.waitForTimeout(700)
    await p.screenshot({ path: `${out}/${name}-2-basics.png`, fullPage: true })
    await p.getByRole('button', { name: 'Start picking' }).click()
    await p.getByText('Which would you rather live in?').waitFor()
    await p.waitForLoadState('networkidle')
    await settle(p)
    await p.screenshot({ path: `${out}/${name}-3-pick.png`, fullPage: true })
    for (let i = 0; i < 8; i++) {
      if (await p.getByText('Your top matches').count()) break
      await p.getByRole('button', { name: /^Pick / }).first().click()
      await p.waitForTimeout(700)
    }
    await p.getByText('Your top matches').waitFor()
    await p.waitForLoadState('networkidle')
    await settle(p, 3000)
    await p.screenshot({ path: `${out}/${name}-4-results.png`, fullPage: true })
  }
  await b.close()
})()
