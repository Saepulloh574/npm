const { chromium } = require('playwright');
const config = require('./config');
const utils = require('./utils');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Import Logics
const startMessageBot = require('./bot_message');
const startGetBot = require('./bot_get');
const startRangeBot = require('./bot_range');

// Init Express untuk Keep-Alive (biar bisa jalan di Replit/Serverless)
const app = express();
app.get('/', (req, res) => res.send('Zura Bot Unified Running'));
app.listen(process.env.PORT || 3000, () => console.log('Server running...'));

(async () => {
    console.log('[SYSTEM] Starting Browser...');
    utils.ensureDataDir(config.DATA_DIR);

    // Launch Browser
    const browser = await chromium.launch({ 
        headless: true, // Ubah ke false jika ingin melihat browser muncul
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create Context (Shared Session/Cookies)
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });

    // === PROSES LOGIN UTAMA ===
    const loginPage = await context.newPage();
    try {
        console.log('[LOGIN] Navigating to login page...');
        await loginPage.goto(config.URL_LOGIN, { waitUntil: 'networkidle', timeout: 60000 });

        // Cek apakah sudah login (redirect) atau perlu input
        if (loginPage.url().includes('mauth/login')) {
            console.log('[LOGIN] Inputting credentials...');
            await loginPage.fill('input[type="email"]', config.MNIT_EMAIL);
            await loginPage.fill('input[type="password"]', config.MNIT_PASSWORD);
            await loginPage.click('button[type="submit"]'); // Sesuaikan selector tombol submit jika beda
            
            // Tunggu redirect
            await loginPage.waitForURL('**/mdashboard/**', { timeout: 60000 });
        }

        console.log('[LOGIN] Login Success!');
        
        // Screenshot Login Success
        const screenshotPath = 'login_success.png';
        await loginPage.screenshot({ path: screenshotPath });
        
        // Kirim SS ke Admin (pakai bot message sebagai sender notif sistem)
        const sysBot = new TelegramBot(config.MSG_BOT.TOKEN);
        if (config.MSG_BOT.ADMIN_ID) {
            await sysBot.sendPhoto(config.MSG_BOT.ADMIN_ID, screenshotPath, {
                caption: `✅ <b>Login Berhasil!</b>\nSystem Started at: ${new Date().toLocaleString()}`,
                parse_mode: 'HTML'
            });
        }

        // Close login page (kita pakai tab baru untuk tiap bot)
        await loginPage.close();

        // === START MODULES ===
        console.log('[SYSTEM] Starting Bot Modules...');

        // 1. Message Bot (Tab 1)
        startMessageBot(context);

        // 2. Get Bot (Tab 2)
        startGetBot(context);

        // 3. Range Bot (Tab 3)
        startRangeBot(context);

    } catch (error) {
        console.error('[FATAL] Login Failed:', error);
        const sysBot = new TelegramBot(config.MSG_BOT.TOKEN);
        if (config.MSG_BOT.ADMIN_ID) {
            await sysBot.sendMessage(config.MSG_BOT.ADMIN_ID, `🚨 <b>Login GAGAL!</b>\nError: ${error.message}`, { parse_mode: 'HTML' });
        }
        process.exit(1);
    }
})();

