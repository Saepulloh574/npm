const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const utils = require('./utils');

module.exports = async (context) => {
    const bot = new TelegramBot(config.MSG_BOT.TOKEN, { polling: true });
    const page = await context.newPage();

    console.log('[MSG-BOT] Initializing Tab...');

    const loopMonitor = async () => {
        try {
            // Pastikan URL benar
            if (page.url() !== config.URL_TARGET_MSG) {
                await page.goto(config.URL_TARGET_MSG, { waitUntil: 'domcontentloaded' });
            }

            // Monitor Logic (Scraping SMS)
            // Selector disesuaikan dengan script python (th:has-text("Number Info"))
            // Kita coba fetch response JSON intercept seperti di python (lebih cepat)
            
            const response = await page.waitForResponse(response => 
                response.url().includes('/getnum/info') && response.status() === 200
            , { timeout: 5000 }).catch(() => null);

            if (response) {
                const json = await response.json();
                const numbers = json.data?.numbers || [];
                const smcData = []; // Data untuk disimpan ke smc.json
                const savedSMC = utils.loadJson(config.FILES.SMC, []);

                for (const item of numbers) {
                    if (item.status === 'success' && item.message) {
                        const rawMsg = item.message;
                        const otpMatch = rawMsg.match(/(\d{4,8})/); // Simple regex otp
                        const otp = otpMatch ? otpMatch[0] : 'N/A';
                        const phone = "+" + item.number;
                        
                        const entry = {
                            otp: otp,
                            phone: phone,
                            service: item.full_number || "Service",
                            full_message: rawMsg,
                            timestamp: Date.now()
                        };

                        smcData.push(entry);

                        // Logic Kirim ke Channel Message jika belum ada di cache
                        // (Implementasi cache sederhana)
                        const cacheKey = `${phone}_${otp}`;
                        // Cek apakah pesan ini baru (logic sederhana, bisa diperbaiki dengan cache file)
                        // Disini kita simpan ke smc.json untuk dibaca GetBot
                    }
                }
                
                // Update smc.json untuk digunakan oleh GET BOT
                // Bandingkan dengan data lama untuk deteksi SMS baru
                if (JSON.stringify(smcData) !== JSON.stringify(savedSMC)) {
                     utils.saveJson(config.FILES.SMC, smcData);
                     // Disini juga bisa pasang logic kirim notif ke Channel Message Bot
                     // jika diinginkan seperti di all.py
                }
            }

            // Klik refresh atau tunggu update
            // Di python dia klik th:has-text("Number Info")
            try {
                await page.click('th:has-text("Number Info")', { timeout: 1000 });
            } catch (e) {
                await page.reload();
            }

        } catch (e) {
            // console.error('[MSG-BOT] Loop Warning:', e.message);
            // Reload page if stuck
            try { await page.reload(); } catch(err) {}
        }
        
        setTimeout(loopMonitor, 2000); // Loop delay
    };

    // Jalankan Loop
    loopMonitor();

    // Listener bot telegram (Command sederhana)
    bot.onText(/\/status/, (msg) => {
        bot.sendMessage(msg.chat.id, "🤖 <b>Message Bot Active</b>", { parse_mode: 'HTML' });
    });
};

