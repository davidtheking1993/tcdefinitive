const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = 3000;

async function findMatchLink(homeTeam, awayTeam) {
  console.log(`🔍 Cerco partita: home="${homeTeam}", away="${awayTeam}"`);
  
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('➡️ Navigo a https://www.totalcorner.com/match/today');
    await page.goto('https://www.totalcorner.com/match/today', { waitUntil: 'domcontentloaded' });

    console.log('📄 Titolo pagina:', await page.title());

    console.log('⏳ Attendo 5 secondi per caricamento dinamico...');
    await page.waitForTimeout(5000);

    console.log('🔍 Cerco righe nella tabella...');
    const rows = await page.$$('#inplay_match_table > tbody.tbody_match > tr');
    console.log(`🔍 Trovate ${rows.length} righe`);

    for (const row of rows) {
      const homeName = await row.$eval('td.text-right.match_home a span', el => el.textContent.trim()).catch(() => null);
      const awayName = await row.$eval('td.text-left.match_away a span', el => el.textContent.trim()).catch(() => null);

      if (!homeName || !awayName) continue;

      console.log(`🏟️ Partita nella riga: casa="${homeName}" vs trasferta="${awayName}"`);

      if (
        homeName.toLowerCase().includes(homeTeam.toLowerCase().trim()) &&
        awayName.toLowerCase().includes(awayTeam.toLowerCase().trim())
      ) {
        console.log(`⚽ Partita trovata: ${homeName} vs ${awayName}`);

        const linkHandles = await row.$$('td.text-center.td_analysis a');
        for (const linkHandle of linkHandles) {
          const text = await linkHandle.textContent();
          if (text.trim().toLowerCase() === 'odds') {
            const href = await linkHandle.getAttribute('href');
            const fullLink = 'https://www.totalcorner.com' + href;
            await browser.close();
            return fullLink;
          }
        }
        console.log('⚠️ Link Odds non trovato in questa riga');
      }
    }

    await browser.close();
    throw new Error('Partita non trovata nella lista di oggi');
  } catch (error) {
    await browser.close();
    throw error;
  }
}

app.get('/get-link', async (req, res) => {
  console.log('🔔 Ricevuta richiesta /get-link', req.query);

  const home = req.query.home;
  const away = req.query.away;

  if (!home || !away) {
    return res.status(400).send('Parametri mancanti: usa ?home=...&away=...');
  }

  try {
    const link = await findMatchLink(home, away);
    res.send({ link });
  } catch (error) {
    console.error('Errore:', error);
    res.status(500).send({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});

/* --- TEST STANDALONE OPZIONALE ---
(async () => {
  try {
    const testLink = await findMatchLink('Patrocinense', 'Caldense');
    console.log('Link trovato (test standalone):', testLink);
  } catch (e) {
    console.error('Errore test standalone:', e);
  }
})();
*/