// bot_message.js
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const utils = require('./utils');

module.exports = async (context) => {
    const bot = new TelegramBot(config.MSG_BOT.TOKEN, { polling: true });
    const page = await context.newPage();
    console.log('[MSG-BOT] Initializing Tab...');

    // Cache untuk filter OTP baru
    const otpCache = new Set();

    const maskPhone = (phone) => {
        if (!phone || phone === 'N/A') return phone;
        const digits = phone.replace(/\D/g, '');
        return phone.startsWith('+')
            ? `+${digits.slice(0, 5)}***${digits.slice(-4)}`
            : `${digits.slice(0, 5)}***${digits.slice(-4)}`;
    };

    const extractOTP = (text) => {
        if (!text) return null;
        const match = text.match(/(\d{4,8})/);
        return match ? match[0] : null;
    };

    const formatMessage = (otpData) => {
        const phoneMasked = maskPhone(otpData.phone);
        return (
            `💭 <b>New Message Received</b>\n\n` +
            `<b>📱 Number:</b> <code>${phoneMasked}</code>\n` +
            `<b>✅ Service:</b> <b>${otpData.service}</b>\n` +
            `<b>FULL MESSAGE:</b>\n<blockquote>${otpData.full_message}</blockquote>\n` +
            `<b>🔐 OTP:</b> <code>${otpData.otp}</code>`
        );
    };

    const loopMonitor = async () => {
        try {
            if (page.url() !== config.URL_TARGET_MSG) {
                await page.goto(config.URL_TARGET_MSG, { waitUntil: 'domcontentloaded' });
            }

            // --- API Intercept ---
            const response = await page.waitForResponse(
                r => r.url().includes('/getnum/info') && r.status() === 200,
                { timeout: 5000 }
            ).catch(() => null);

            if (response) {
                const json = await response.json();
                const numbers = json.data?.numbers || [];
                const smcData = [];
                const savedSMC = utils.loadJson(config.FILES.SMC, []);

                for (const item of numbers) {
                    if (item.status === 'success' && item.message) {
                        const rawMsg = item.message;
                        const otp = extractOTP(rawMsg) || 'N/A';
                        const phone = "+" + item.number;
                        const entry = {
                            otp,
                            phone,
                            service: item.full_number || 'Service',
                            full_message: rawMsg,
                            timestamp: Date.now()
                        };

                        smcData.push(entry);

                        const cacheKey = `${phone}_${otp}`;
                        if (!otpCache.has(cacheKey)) {
                            otpCache.add(cacheKey);
                            // Kirim notif ke Telegram
                            if (config.MSG_BOT.ADMIN_ID) {
                                bot.sendMessage(
                                    config.MSG_BOT.ADMIN_ID,
                                    formatMessage(entry),
                                    { parse_mode: 'HTML' }
                                );
                            }
                        }
                    }
                }

                // Update smc.json jika ada perubahan
                if (JSON.stringify(smcData) !== JSON.stringify(savedSMC)) {
                    utils.saveJson(config.FILES.SMC, smcData);
                }
            }

            // --- DOM fallback (klik refresh) ---
            try {
                await page.click('th:has-text("Number Info")', { timeout: 1000 });
            } catch (e) {
                await page.reload();
            }
        } catch (e) {
            // Reload page if stuck
            try { await page.reload(); } catch (err) {}
        }

        setTimeout(loopMonitor, 2000); // Loop 2 detik
    };

    // Jalankan loop monitor
    loopMonitor();

    // Telegram command
    bot.onText(/\/status/, (msg) => {
        bot.sendMessage(msg.chat.id, "🤖 <b>Message Bot Active</b>", { parse_mode: 'HTML' });
    });
};
