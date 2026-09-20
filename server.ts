import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { getSyncStatus, scrapeAndCacheLiveResults, startBiDailyScraperSchedule } from './server/scraperService';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Start bi-daily scraping cron
  startBiDailyScraperSchedule();

  app.use(express.json({ limit: '25mb' }));

  // API endpoints
  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      app: 'LK Lottery Master', 
      version: '2.5.0',
      timestamp: new Date().toISOString() 
    });
  });

  // 2. Gemini AI OCR / Damaged ticket scanner endpoint proxy (keeps GEMINI_API_KEY server-side)
  app.post('/api/ai/scan-ticket', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64 in request body' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ 
          error: 'GEMINI_API_KEY is not configured on server',
          fallback: true
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an expert Sri Lankan Lottery ticket parser for NLB and DLB tickets (Mahajana Sampatha, Govisetha, Mega Power, Ada Kotipathi, Dhananidhanaya, Shanida, Lagna Wasana, Handahana, Kapruka, Supiri Dhana Sampatha, Sasiri, etc.).
Carefully read the ticket image. If this is not a valid lottery ticket or numbers are unreadable, set "success": false.
Extract:
- lotterySlug: (e.g. "mahajana-sampatha", "govisetha", "mega-power", "ada-kotipathi", "dhana-nidhanaya", "handahana", "lagna-wasana", "kapruka", "shanida", "super-ball", "supiri-dhana-sampatha", "nlb-jaya", "jaya-sampatha", "sasiri", "ada-sampatha", "suba-dawasak", "waasi")
- drawNo: draw number printed on the ticket
- date: draw date in YYYY-MM-DD format
- letter: English letter printed on ticket (e.g. "J", "K", "A")
- zodiac: Zodiac astrological sign printed (e.g. "LEO", "ARIES", "VIRGO")
- superNumber: Special bonus / super number if printed
- numbers: Array of winning numbers printed on ticket in order
Return strictly JSON in this schema:
{
  "success": true,
  "lotterySlug": "string or null",
  "drawNo": "string or null",
  "date": "string or null",
  "letter": "string or null",
  "zodiac": "string or null",
  "superNumber": "string or null",
  "numbers": ["number1", "number2", ...]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      const parsed = JSON.parse(responseText);
      return res.json({ success: true, ...parsed });
    } catch (err: any) {
      console.error('AI Ticket scan error:', err);
      return res.status(500).json({ error: err.message || 'Failed to scan ticket with AI' });
    }
  });

  // 3. Official NLB / DLB live sync status and manual refresh trigger
  app.get('/api/lottery/sync-status', (req, res) => {
    res.json(getSyncStatus());
  });

  app.post('/api/lottery/sync-now', async (req, res) => {
    const result = await scrapeAndCacheLiveResults();
    res.json({ message: 'Scrape triggered successfully', ...result });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
