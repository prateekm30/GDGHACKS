// Walks the live site like a first-time user and saves screenshots (desktop and phone).
const { chromium } = require('playwright')
const [url, out] = process.argv.slice(2)
;(async () => {
  const b = await chromium.launch()
  for (const [name, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 })
    await p.goto(url)
    await p.screenshot({ path: `${out}/${name}-1-start.png`, fullPage: true })
    await p.getByRole('button', { name: /^Both/ }).click()
    await p.getByText('First, the basics').waitFor()
    await p.locator('input[inputmode=numeric]').fill('52000')
    await p.screenshot({ path: `${out}/${name}-2-basics.png`, fullPage: true })
    await p.getByRole('button', { name: 'Start picking' }).click()
    await p.getByText('Which would you rather live in?').waitFor()
    await p.waitForLoadState('networkidle')
    await p.screenshot({ path: `${out}/${name}-3-pick.png`, fullPage: true })
    for (let i = 0; i < 8; i++) {
      if (await p.getByText('Your top matches').count()) break
      await p.getByRole('button', { name: /^Pick / }).first().click()
      await p.waitForTimeout(200)
    }
    await p.getByText('Your top matches').waitFor()
    await p.waitForLoadState('networkidle')
    await p.screenshot({ path: `${out}/${name}-4-results.png`, fullPage: true })
  }
  await b.close()
})()
