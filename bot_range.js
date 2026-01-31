const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const utils = require('./utils');

module.exports = async (context) => {
    const bot = new TelegramBot(config.RANGE_BOT.TOKEN, { polling: true });
    const page = await context.newPage();
    
    // Cache untuk menghindari spam pesan yang sama
    let sentCache = {};

    console.log('[RANGE-BOT] Initializing Tab...');

    const monitorRange = async () => {
        try {
             if (page.url() !== config.URL_TARGET_RANGE) {
                await page.goto(config.URL_TARGET_RANGE, { waitUntil: 'domcontentloaded' });
            }

            // Selector console logs (sesuai range.py)
            const selector = ".group.flex.flex-col.sm\\:flex-row";
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
            } catch(e) { /* ignore timeout */ }

            const elements = await page.$$(selector);
            
            for (const el of elements) {
                const text = await el.innerText();
                // Parsing logic (perlu disesuaikan regex dengan struktur HTML aktual)
                // Contoh: "INDONESIA • WhatsApp • +628123XXX -> Message"
                
                if (text.includes('XXX')) {
                    // Ini range baru muncul
                    const rangeMatch = text.match(/\+\d+X+/);
                    const range = rangeMatch ? rangeMatch[0] : 'Unknown';
                    const country = "UNKNOWN"; // Logic ambil negara dari text
                    const service = "WhatsApp"; // Logic ambil service
                    
                    const cacheKey = `${range}_${text.length}`; // Simple hash

                    if (!sentCache[cacheKey]) {
                        const msg = `🔥 <b>Live Range Detected!</b>\n\n📱 <b>Range:</b> <code>${range}</code>\n🌍 <b>Country:</b> ${country}\n⚙️ <b>Service:</b> ${service}\n\n<blockquote>${text}</blockquote>`;
                        
                        await bot.sendMessage(config.RANGE_BOT.CHAT_ID, msg, { parse_mode: 'HTML' });
                        
                        // Add to cache & cleanup old cache
                        sentCache[cacheKey] = Date.now();
                    }
                }
            }
            
            // Clean cache (hapus yang lebih dari 10 menit)
            const now = Date.now();
            for (const k in sentCache) {
                if (now - sentCache[k] > 600000) delete sentCache[k];
            }

        } catch (e) {
            // console.error('[RANGE-BOT] Error:', e.message);
        }
        
        setTimeout(monitorRange, 2000);
    };

    monitorRange();
};

