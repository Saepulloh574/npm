const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const utils = require('./utils');

module.exports = async (context) => {
    const bot = new TelegramBot(config.MSG_BOT.TOKEN, { polling: true });
    const page = await context.newPage();

    console.log('[MSG-BOT] Initializing Tab...');

    // Load cache SMS lama
    let savedSMC = utils.loadJson(config.FILES.SMC, []);

    const loopMonitor = async () => {
        try {
            if (page.url() !== config.URL_TARGET_MSG) {
                await page.goto(config.URL_TARGET_MSG, { waitUntil: 'domcontentloaded', timeout: 60000 });
            }

            // 🔥 SCRAPE DATA SMS DARI HALAMAN
            const numbers = await page.evaluate(() => {
                const rows = document.querySelectorAll('tr'); // sesuaikan selector kalau beda
                const data = [];

                rows.forEach(row => {
                    const text = row.innerText;
                    if (!text) return;

                    const otpMatch = text.match(/(\d{4,8})/);
                    const phoneMatch = text.match(/\+\d+/);

                    if (otpMatch && phoneMatch) {
                        data.push({
                            otp: otpMatch[0],
                            phone: phoneMatch[0],
                            message: text
                        });
                    }
                });

                return data;
            });

            const newData = [];

            for (const item of numbers) {
                const exists = savedSMC.find(x => x.phone === item.phone && x.otp === item.otp);

                if (!exists) {
                    const entry = {
                        otp: item.otp,
                        phone: item.phone,
                        full_message: item.message,
                        timestamp: Date.now()
                    };

                    savedSMC.push(entry);
                    newData.push(entry);
                }
            }

            // 🔥 Kalau ada SMS baru → simpan & kirim ke Telegram
            if (newData.length > 0) {
                utils.saveJson(config.FILES.SMC, savedSMC);

                for (const sms of newData) {
                    const text = `📩 <b>SMS Baru</b>\n\n📞 ${sms.phone}\n🔐 OTP: <code>${sms.otp}</code>`;
                    
                    if (config.MSG_BOT.CHAT_ID) {
                        await bot.sendMessage(config.MSG_BOT.CHAT_ID, text, { parse_mode: 'HTML' });
                    }
                }

                console.log(`[MSG-BOT] ${newData.length} SMS baru dikirim`);
            }

            // refresh halaman
            await page.reload({ waitUntil: 'domcontentloaded' });

        } catch (e) {
            console.log('[MSG-BOT] Warning:', e.message);
            try { await page.reload(); } catch {}
        }

        setTimeout(loopMonitor, 3000);
    };

    loopMonitor();

    bot.onText(/\/status/, (msg) => {
        bot.sendMessage(msg.chat.id, "🤖 <b>Message Bot Active</b>", { parse_mode: 'HTML' });
    });
};
