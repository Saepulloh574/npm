const { chromium } = require('playwright');
const config = require('./config');
const utils = require('./utils');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// ================= CONFIG GLOBAL =================
const HEADLESS = false; // true = tanpa GUI, false = tampil browser
const LOGIN_TIMEOUT = 180000; // 3 menit
const MAX_RETRY_LOGIN = 3;

// ================= IMPORT MODULE BOT =================
const startMessageBot = require('./bot_message');
const startGetBot = require('./bot_get');
const startRangeBot = require('./bot_range');

// ================= EXPRESS KEEP ALIVE =================
const app = express();
app.get('/', (req, res) => res.send('Zura Bot Unified Running'));
app.listen(process.env.PORT || 3000, () => console.log('Server running...'));

// ================= MAIN =================
(async () => {
    console.log('[SYSTEM] Starting Browser...');
    utils.ensureDataDir(config.DATA_DIR);

    // Launch Browser
    const browser = await chromium.launch({
        headless: HEADLESS,
        slowMo: HEADLESS ? 0 : 50,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create Context (Shared Session/Cookies)
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        ignoreHTTPSErrors: true
    });

    const sysBot = new TelegramBot(config.MSG_BOT.TOKEN);

    // ================= LOGIN FUNCTION =================
    async function doLogin() {
        const page = await context.newPage();

        try {
            console.log('[LOGIN] Opening login page...');
            await page.goto(config.URL_LOGIN, {
                waitUntil: 'domcontentloaded', // lebih aman dari networkidle
                timeout: LOGIN_TIMEOUT
            });

            // Jika masih di halaman login
            if (page.url().includes('mauth/login')) {
                console.log('[LOGIN] Input credentials...');
                await page.fill('input[type="email"]', config.MNIT_EMAIL);
                await page.fill('input[type="password"]', config.MNIT_PASSWORD);
                await page.click('button[type="submit"]');

                // Tunggu redirect dashboard
                await page.waitForURL(/dashboard|mdashboard/i, {
                    timeout: LOGIN_TIMEOUT
                });
            }

            console.log('[LOGIN] Login Success!');

            // Screenshot bukti login
            const screenshotPath = 'login_success.png';
            await page.screenshot({ path: screenshotPath });

            if (config.MSG_BOT.ADMIN_ID) {
                await sysBot.sendPhoto(config.MSG_BOT.ADMIN_ID, screenshotPath, {
                    caption: `✅ <b>Login Berhasil!</b>\nSystem Started: ${new Date().toLocaleString()}`,
                    parse_mode: 'HTML'
                });
            }

            await page.close();
            return true;
        } catch (err) {
            console.error('[LOGIN ERROR]', err.message);
            await page.close();
            return false;
        }
    }

    // ================= LOGIN RETRY =================
    let success = false;
    for (let i = 1; i <= MAX_RETRY_LOGIN; i++) {
        console.log(`[SYSTEM] Login Attempt ${i}/${MAX_RETRY_LOGIN}`);
        success = await doLogin();
        if (success) break;
        await new Promise(r => setTimeout(r, 5000)); // delay retry
    }

    if (!success) {
        console.error('[FATAL] Login failed after retry.');
        if (config.MSG_BOT.ADMIN_ID) {
            await sysBot.sendMessage(
                config.MSG_BOT.ADMIN_ID,
                `🚨 <b>Login GAGAL setelah ${MAX_RETRY_LOGIN} kali percobaan!</b>`,
                { parse_mode: 'HTML' }
            );
        }
        process.exit(1);
    }

    // ================= START BOT MODULES =================
    console.log('[SYSTEM] Starting Bot Modules...');

    startMessageBot(context);
    startGetBot(context);
    startRangeBot(context);

})();
