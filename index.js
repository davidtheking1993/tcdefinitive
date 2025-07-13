const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = 3000;

// Cache in-memory per ridurre chiamate duplicate
const cache = new Map();

function getCacheKey(home, away) {
  return `${home.toLowerCase().trim()}_${away.toLowerCase().trim()}`;
}

// Singleton per il browser
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
    console.log('🚀 Browser Playwright avviato');
  }
  return browserInstance;
}

// Funzione principale di scraping
async function findMatchLink(homeTeam, awayTeam) {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://www.totalcorner.com/match/today', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#inplay_match_table > tbody.tbody_match > tr', { timeout: 10000 });

    const rows = await page.$$('#inplay_match_table > tbody.tbody_match > tr');
    for (const row of rows) {
      const homeName = await row.$eval('td.text-right.match_home a span', el => el.textContent.trim()).catch(() => null);
      const awayName = await row.$eval('td.text-left.match_away a span', el => el.textContent.trim()).catch(() => null);

      if (!homeName || !awayName) continue;

      if (
        homeName.toLowerCase().includes(homeTeam.toLowerCase().trim()) &&
        awayName.toLowerCase().includes(awayTeam.toLowerCase().trim())
      ) {
        const linkHandles = await row.$$('td.text-center.td_analysis a');
        for (const linkHandle of linkHandles) {
          const text = await linkHandle.textContent();
          if (text.trim().toLowerCase() === 'odds') {
            const href = await linkHandle.getAttribute('href');
            const fullLink = 'https://www.totalcorner.com' + href;
            await page.close();
            await context.close();
            return fullLink;
          }
        }
      }
    }

    await page.close();
    await context.close();
    throw new Error('Partita non trovata nella lista di oggi');
  } catch (error) {
    await page.close();
    await context.close();
    throw error;
  }
}

// API endpoint
app.get('/get-link', async (req, res) => {
  const home = req.query.home;
  const away = req.query.away;

  if (!home || !away) {
    return res.status(400).send('Parametri mancanti: usa ?home=...&away=...');
  }

  const key = getCacheKey(home, away);

  if (cache.has(key)) {
    const cached = cache.get(key);
    if (Date.now() - cached.timestamp < 2 * 60 * 1000) {
      return res.send({ link: cached.link });
    }
    cache.delete(key);
  }

  try {
    const link = await findMatchLink(home, away);
    cache.set(key, { link, timestamp: Date.now() });
    res.send({ link });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Avvio server
app.listen(PORT, () => {
  console.log(`✅ Server avviato su http://localhost:${PORT}`);
});

// Cleanup su SIGTERM (es. restart container Render)
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM ricevuto, chiusura browser...');
  if (browserInstance) {
    await browserInstance.close();
    console.log('✅ Browser chiuso correttamente');
  }
  process.exit(0);
});
