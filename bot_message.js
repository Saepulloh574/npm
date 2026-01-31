const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const html = require('html-entities').AllHtmlEntities;
const config = require('./config');
const utils = require('./utils');

class OTPFilter {
    constructor(file = path.join(__dirname, 'otp_cache.json')) {
        this.file = file;
        this.cache = this._load();
    }
    _load() {
        if (fs.existsSync(this.file)) {
            try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } 
            catch { return {}; }
        }
        return {};
    }
    _save() { fs.writeFileSync(this.file, JSON.stringify(this.cache, null, 2)); }
    filter(list) {
        const out = [];
        for (const d of list) {
            const key = `${d.otp}_${d.phone}`;
            if (d.otp && !this.cache[key]) {
                this.cache[key] = { t: Date.now() };
                out.push(d);
            }
        }
        this._save();
        return out;
    }
}

const otpFilter = new OTPFilter();

function maskPhone(phone) {
    if (!phone || phone === 'N/A') return phone;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return phone;
    const prefix = phone.startsWith('+') ? '+' : '';
    return `${prefix}${digits.slice(0, 5)}***${digits.slice(-4)}`;
}

function formatOTPMessage(data) {
    const userTag = data.username ? `@${data.username}` : 'unknown';
    const rawMsg = html.encode(data.raw_message || '');
    return `💭 <b>New Message Received</b>\n\n` +
           `<b>👤 User:</b> ${userTag}\n` +
           `<b>📱 Number:</b> <code>${maskPhone(data.phone)}</code>\n` +
           `<b>🌍 Country:</b> ${data.range || 'N/A'}\n` +
           `<b>✅ Service:</b> ${data.service}\n\n` +
           `🔐 OTP: <code>${data.otp}</code>\n\n` +
           `<b>FULL MESSAGE:</b>\n<blockquote>${rawMsg}</blockquote>`;
}

function extractOTP(text) {
    if (!text) return null;
    const patterns = [
        /(\d{3}[\s-]\d{3})/, 
        /(?:code|otp|kode)[:\s]*([\d\s-]+)/i, 
        /\b(\d{4,8})\b/
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1] ? m[1].replace(/\D/g, '') : m[0].replace(/\D/g, '');
    }
    return null;
}

function saveOTPToJSON(data) {
    const folder = path.join(__dirname, '../get');
    const file = path.join(folder, 'smc.json');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const toSave = {
        service: data.service || 'Unknown',
        number: data.phone || 'N/A',
        otp: data.otp || 'N/A',
        full_message: data.raw_message || ''
    };
    let existing = [];
    if (fs.existsSync(file)) {
        try { existing = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    }
    existing.push(toSave);
    fs.writeFileSync(file, JSON.stringify(existing, null, 2));
}

function createInlineKeyboard(otp) {
    return JSON.stringify({
        inline_keyboard: [
            [{ text: otp, callback_data: otp }, { text: "🎭 Owner", url: config.MSG_BOT.ADMIN_LINK }],
            [{ text: "📞 Get Number", url: config.MSG_BOT.BOT_LINK }]
        ]
    });
}

async function sendTelegram(text, otp) {
    if (!config.MSG_BOT.TOKEN || !config.MSG_BOT.CHAT_ID) return;
    const payload = {
        chat_id: config.MSG_BOT.CHAT_ID,
        text,
        parse_mode: 'HTML',
        reply_markup: otp ? createInlineKeyboard(otp) : undefined
    };
    try {
        const res = await fetch(`https://api.telegram.org/bot${config.MSG_BOT.TOKEN}/sendMessage`, {
            method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) console.log('❌ Telegram send failed:', await res.text());
    } catch (e) { console.log('⚠️ Telegram error:', e.message); }
}

module.exports = async (browser) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    console.log('[MSG-BOT] Tab initialized');

    while (true) {
        try {
            // --- Intercept Network API first ---
            const response = await page.waitForResponse(resp => resp.url().includes('/getnum/info') && resp.status() === 200, { timeout: 5000 }).catch(() => null);
            let messages = [];
            if (response) {
                const data = await response.json();
                const numbers = data.data?.numbers || [];
                for (const item of numbers) {
                    if (item.status === 'success' && item.message) {
                        messages.push({
                            otp: extractOTP(item.message),
                            phone: '+' + item.number,
                            service: item.full_number || 'Facebook',
                            range: item.country || 'N/A',
                            raw_message: item.message,
                            username: item.username || null
                        });
                    }
                }
            }

            // --- Fallback Scraper ---
            if (messages.length === 0) {
                try {
                    if (page.url() !== config.URL_TARGET_MSG) await page.goto(config.URL_TARGET_MSG, { waitUntil: 'domcontentloaded' });
                    const scraped = await page.evaluate(() => {
                        const rows = Array.from(document.querySelectorAll('tr'));
                        return rows.map(r => r.innerText.trim()).filter(t => t);
                    });
                    for (const t of scraped) {
                        const otp = extractOTP(t);
                        if (otp) messages.push({ otp, phone: 'N/A', service: 'Unknown', range: 'N/A', raw_message: t, username: null });
                    }
                } catch {}
            }

            // --- Filter & Send New OTP ---
            const newOTPs = otpFilter.filter(messages);
            for (const otpData of newOTPs) {
                saveOTPToJSON(otpData);
                const msgText = formatOTPMessage(otpData);
                await sendTelegram(msgText, otpData.otp);
                console.log('📩 OTP sent:', otpData.otp);
            }
        } catch (e) {
            console.log('⚠️ MSG-BOT loop error:', e.message);
        }
        await new Promise(r => setTimeout(r, 2000)); // loop delay
    }
};
