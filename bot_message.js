const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

const SMC_FILE = path.join(__dirname, 'data', 'smc.json');

// ================= Helper Functions =================
const escapeHTML = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

const maskPhone = (phone) => phone.replace(/(\d{3})\d+(\d{3})/, '$1****$2');

const extractOTP = (text) => {
    if (!text) return null;
    const patterns = [
        /\b\d{3}[\s-]\d{3}\b/,            // Format 123-456 / 123 456
        /(?:code|otp|kode)[:\s]*([\d\s-]+)/i,
        /\b\d{4,8}\b/
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1] ? m[1].replace(/\D/g, '') : m[0].replace(/\D/g, '');
    }
    return null;
};

const formatOTP = (otp) => `<code><#>${otp}<#></code>`;

const formatMessage = (otpData) => {
    const phoneMasked = maskPhone(otpData.number || 'N/A');
    const otpFormatted = formatOTP(otpData.otp || 'N/A');
    return (
        `💭 <b>New Message Received</b>\n\n` +
        `<b>👤 User:</b> ${escapeHTML(otpData.user || 'Unknown')}\n` +
        `<b>📱 Number:</b> <code>${phoneMasked}</code>\n` +
        `<b>✅ Service:</b> <b>${escapeHTML(otpData.service || 'Unknown')}</b>\n\n` +
        `<b>🔐 OTP:</b> ${otpFormatted}\n\n` +
        `<b>FULL MESSAGE:</b>\n<blockquote>${escapeHTML(otpData.full_message || '')}</blockquote>`
    );
};

const saveOTP = (otpData) => {
    let smc = [];
    if (fs.existsSync(SMC_FILE)) {
        smc = JSON.parse(fs.readFileSync(SMC_FILE, 'utf-8'));
    }

    // Cek duplikat sederhana: phone + otp
    const exists = smc.some(e => e.number === otpData.number && e.otp === otpData.otp);
    if (!exists) {
        smc.push(otpData);
        fs.writeFileSync(SMC_FILE, JSON.stringify(smc, null, 2), 'utf-8');
        return true;
    }
    return false;
};

// ================= Bot Module =================
module.exports = async (context) => {
    const bot = new TelegramBot(config.MSG_BOT.TOKEN, { polling: true });
    const page = await context.newPage();

    console.log('[MSG-BOT] Initializing Tab...');

    const loopMonitor = async () => {
        try {
            if (page.url() !== config.URL_TARGET_MSG) {
                await page.goto(config.URL_TARGET_MSG, { waitUntil: 'domcontentloaded' });
            }

            const response = await page.waitForResponse(
                r => r.url().includes('/getnum/info') && r.status() === 200,
                { timeout: 5000 }
            ).catch(() => null);

            if (response) {
                const json = await response.json();
                const numbers = json.data?.numbers || [];

                for (const item of numbers) {
                    if (item.status === 'success' && item.message) {
                        const otp = extractOTP(item.message);
                        if (!otp) continue;

                        const otpData = {
                            otp,
                            number: "+" + item.number,
                            service: item.full_number || "Service",
                            full_message: item.message,
                            timestamp: Date.now(),
                            user: item.username || "Unknown"
                        };

                        // Save ke JSON & cek jika baru
                        const isNew = saveOTP(otpData);
                        if (isNew) {
                            const msg = formatMessage(otpData);
                            try {
                                bot.sendMessage(config.MSG_BOT.CHAT_ID, msg, { parse_mode: 'HTML' });
                                console.log('[MSG-BOT] OTP sent:', otp);
                            } catch (e) {
                                console.error('[MSG-BOT] Telegram send error:', e.message);
                            }
                        }
                    }
                }
            }

            try { 
                await page.click('th:has-text("Number Info")', { timeout: 1000 }); 
            } catch { 
                await page.reload(); 
            }

        } catch (e) {
            console.error('[MSG-BOT] Loop warning:', e.message);
            try { await page.reload(); } catch {}
        }

        setTimeout(loopMonitor, 2000);
    };

    loopMonitor();

    bot.onText(/\/status/, (msg) => {
        bot.sendMessage(msg.chat.id, "🤖 <b>Message Bot Active</b>", { parse_mode: 'HTML' });
    });
};
