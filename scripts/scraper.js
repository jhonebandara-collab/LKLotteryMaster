import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function scrapeNLB() {
    try {
        console.log("🔍 NLB ප්‍රතිඵල Scrape කිරීම ආරම්භ වේ...");
        const response = await axios.get('https://www.nlb.lk/English', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        const results = [];

        $('.lottery-result, .res-box, .result-card').each((index, element) => {
            const lotteryName = $(element).find('.name, h4, .lottery-title').text().trim();
            const drawNo = $(element).find('.draw-no, .drawno').text().trim();
            const drawDate = $(element).find('.date, .draw-date').text().trim();
            const letter = $(element).find('.letter, .winning-letter').text().trim();
            
            const numbers = [];
            $(element).find('.num, .number, .ball').each((i, el) => {
                const num = $(el).text().trim();
                if (num) numbers.push(num);
            });

            if (lotteryName) {
                results.push({
                    source: 'NLB',
                    lotteryName,
                    drawNo,
                    drawDate,
                    letter,
                    numbers: numbers.join(',')
                });
            }
        });

        console.log(`✅ NLB වෙතින් Data ${results.length} ක් හමු විය.`);
        return results;
    } catch (error) {
        console.error("❌ NLB Scraping Error:", error.message);
        return [];
    }
}

async function scrapeDLB() {
    try {
        console.log("🔍 DLB ප්‍රතිඵල Scrape කිරීම ආරම්භ වේ...");
        const response = await axios.get('https://www.dlb.lk/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        const results = [];

        $('.res-item, .lottery-box').each((index, element) => {
            const lotteryName = $(element).find('.lotto-name, .title').text().trim();
            const drawNo = $(element).find('.draw-num, .draw-no').text().trim();
            const drawDate = $(element).find('.draw-date, .date').text().trim();
            
            const numbers = [];
            $(element).find('.ball, .number').each((i, el) => {
                const num = $(el).text().trim();
                if (num) numbers.push(num);
            });

            if (lotteryName) {
                results.push({
                    source: 'DLB',
                    lotteryName,
                    drawNo,
                    drawDate,
                    letter: '',
                    numbers: numbers.join(',')
                });
            }
        });

        console.log(`✅ DLB වෙතින් Data ${results.length} ක් හමු විය.`);
        return results;
    } catch (error) {
        console.error("❌ DLB Scraping Error:", error.message);
        return [];
    }
}

async function startScraping() {
    console.log("🚀 Lottery Scraper ආරම්භ කරමින්...");
    
    const nlbData = await scrapeNLB();
    const dlbData = await scrapeDLB();
    const allData = [...nlbData, ...dlbData];

    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, 'lottery_history.json');
    fs.writeFileSync(filePath, JSON.stringify(allData, null, 2), 'utf-8');
    console.log(`🎉 සියලුම Data සාර්ථකව 'data/lottery_history.json' File එකට Save විය! (මුළු Data: ${allData.length})`);
}

startScraping();