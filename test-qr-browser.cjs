// Optional browser QA. Set PLAYWRIGHT_MODULE to an installed Playwright package.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true, args:['--disable-gpu']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1050}, deviceScaleFactor:1});
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {if (/^https?:/.test(request.url())) requests.push(request.url());});
    const base = process.env.QR_TEST_URL || pathToFileURL(path.join(__dirname, 'index.html')).href;
    const output = path.join(__dirname, '.qa', process.env.QR_TEST_URL ? 'qr-hosted' : 'qr-local');
    fs.mkdirSync(output, {recursive:true});
    const response = await page.goto(base.replace(/#.*$/, '') + '#qr');
    if (process.env.QR_TEST_URL) assert.equal(response.status(), 200);
    await page.locator('#qrArchitecture').waitFor({state:'visible'});
    assert.equal(await page.title(), 'QR-PointNet — Multipath Atelier');
    assert.equal(await page.locator('[data-lesson="qr"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('.workspace').isVisible(), false);
    assert.equal(await page.locator('#export').isVisible(), false);
    assert.match(await page.locator('.teaching-tag').innerText(), /NO LIVE NEURAL INFERENCE/);
    assert.equal(await page.locator('#qrGlobalCount').innerText(), '32');
    assert.equal(await page.locator('.qr-block').count(), 4);
    assert.match(await page.locator('#qrArchitecture').innerText(), /The deployed mean can fall between lobes/);
    await page.screenshot({path:path.join(output,'desktop.png'), fullPage:true});
    await page.locator('.qr-figure').screenshot({path:path.join(output,'diagram.png')});

    await page.locator('.qr-switch label').filter({has:page.locator('input[value="d"]')}).click();
    assert.equal(await page.locator('#qrGlobalCount').innerText(), '1');
    assert.equal(await page.locator('#qrVoteCount').innerText(), 'M × 1');
    assert.match(await page.locator('#qrLatentTitle').innerText(), /zero code/);
    assert.match(await page.locator('#qrReadoutText').innerText(), /no averaging across latent draws/);
    await page.locator('input[name="qrVariant"][value="d"]').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#qrGlobalCount').innerText(), '32');
    await page.locator('.qr-details summary').click();
    assert.equal(await page.locator('.qr-details-content').isVisible(), true);
    assert.match(await page.locator('.qr-details-content').innerText(), /survey-fitted range surfaces/);
    await page.locator('.qr-details summary').click();
    await page.locator('#aboutFooter').click();
    assert.match(await page.locator('#modalContent').innerText(), /switch changes the explanation only/);
    await page.locator('#closeModal').click();

    // Global playback shortcuts must not try to run a nonexistent QR trace.
    await page.locator('body').click({position:{x:270,y:1}});
    for (const key of ['Space','ArrowRight','ArrowLeft','r']) await page.keyboard.press(key);
    assert.equal(await page.locator('.workspace').isVisible(), false);

    for (const lesson of ['mpurge','map','smart','sapp']) {
      await page.locator(`[data-lesson="${lesson}"]`).click();
      await page.locator('.workspace').waitFor({state:'visible'});
      assert.equal(await page.locator('#qrArchitecture').isVisible(), false);
      assert.equal(await page.locator('#export').isVisible(), true);
      await page.locator('#timeline').fill(await page.locator('#timeline').getAttribute('max'));
      const explanation = await page.locator('#explanationContent').innerText();
      assert.ok(explanation.length > 80 && !explanation.includes('NaN'));
    }
    await page.locator('#play').click();
    await page.locator('[data-lesson="qr"]').click();
    assert.equal(await page.locator('#play').getAttribute('aria-label'), 'Play animation');
    for (const viewport of [{width:1366,height:768},{width:1100,height:800},{width:820,height:1180},{width:390,height:844},{width:320,height:740}]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => scrollTo(0,0));
      const overflow = await page.evaluate(() => ({body:document.documentElement.scrollWidth > innerWidth + 1,
        cards:[...document.querySelectorAll('.qr-operation,.qr-inputs > div,.qr-equation,.qr-latent,.qr-readout,.qr-switch')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el=>el.className)}));
      assert.equal(overflow.body, false, `Page overflow at ${viewport.width}px`);
      assert.deepEqual(overflow.cards, [], `Card content overflow at ${viewport.width}px: ${JSON.stringify(overflow.cards)}`);
      if (viewport.width === 1366 || viewport.width === 390) {
        await page.screenshot({path:path.join(output,`${viewport.width}px.png`), fullPage:true});
        if (viewport.width === 390) await page.locator('.qr-encode').screenshot({path:path.join(output,'mobile-card.png')});
      }
      await page.locator('.qr-details summary').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.locator('.qr-details summary').click();
    }
    // A direct QR reload works without first computing one of the other lessons.
    await page.reload();
    await page.locator('#qrArchitecture').waitFor({state:'visible'});
    assert.deepEqual(errors, []);
    if (!process.env.QR_TEST_URL) assert.deepEqual(requests, []);
    console.log('PASS: QR direct link, S/D controls and keyboard access, training details, all four existing lessons, paused playback, 320–1440px layouts, no page errors' + (process.env.QR_TEST_URL ? '; hosted HTTP 200.' : ' or network requests.'));
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
