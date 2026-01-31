const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const utils = require('./utils');

module.exports = async (context) => {
    const bot = new TelegramBot(config.GET_BOT.TOKEN, { polling: true });
    const page = await context.newPage();
    let isProcessing = false;

    console.log('[GET-BOT] Initializing Tab...');
    
    // Pastikan berada di halaman getnum
    await page.goto(config.URL_TARGET_GET, { waitUntil: 'domcontentloaded' });

    // === LOGIC OTP MONITOR (sms.py logic) ===
    setInterval(() => {
        const waitList = utils.loadJson(config.FILES.WAIT, []);
        const smcData = utils.loadJson(config.FILES.SMC, []); // Dibaca dari hasil scrape Message Bot

        if (waitList.length === 0 || smcData.length === 0) return;

        let listUpdated = false;
        const now = Date.now();

        waitList.forEach((waitItem, index) => {
            // Cek timeout
            if (now - waitItem.timestamp > (config.WAIT_TIMEOUT * 1000)) {
                bot.sendMessage(waitItem.user_id, `⚠️ Waktu habis untuk nomor ${waitItem.number}`);
                waitList.splice(index, 1);
                listUpdated = true;
                return;
            }

            // Cari SMS yang cocok
            const match = smcData.find(sms => sms.phone.includes(waitItem.number.replace('+', '')) || waitItem.number.includes(sms.phone));
            
            if (match && !waitItem.otp_received) {
                // SMS DITEMUKAN!
                const msg = `🔔 <b>SMS DITERIMA!</b>\n\n📱 <b>Nomor:</b> <code>${waitItem.number}</code>\n💬 <b>Pesan:</b>\n${match.full_message}\n\n🔐 <b>OTP:</b> <code>${match.otp}</code>`;
                
                bot.sendMessage(waitItem.user_id, msg, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[{ text: `📋 Copy OTP ${match.otp}`, callback_data: 'copy_otp' }]]
                    }
                });

                // Update saldo user (reward logic)
                const profiles = utils.loadJson(config.FILES.PROFILE, {});
                const uid = String(waitItem.user_id);
                if (profiles[uid]) {
                    profiles[uid].balance = (profiles[uid].balance || 0) + config.GET_BOT.PRICE;
                    utils.saveJson(config.FILES.PROFILE, profiles);
                }

                waitItem.otp_received = true;
                listUpdated = true;
            }
        });

        if (listUpdated) {
            utils.saveJson(config.FILES.WAIT, waitList);
        }

    }, 3000); // Cek setiap 3 detik

    // === LOGIC TELEGRAM COMMANDS (get.py logic) ===
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📲 Get Number', callback_data: 'menu_get' }],
                    [{ text: '👤 Profil', callback_data: 'menu_profile' }]
                ]
            }
        };
        bot.sendMessage(chatId, `Halo ${msg.from.first_name}! Selamat datang di Zura Bot Unified.`, opts);
    });

    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = msg.chat.id;
        const userId = callbackQuery.from.id;

        if (data === 'menu_get') {
            bot.sendMessage(chatId, "Kirim format range (Contoh: 23273XXX) atau pilih menu:", {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Input Manual', callback_data: 'input_manual' }]]
                }
            });
        }
        
        // Handle Request Number Logic (Sederhana)
        // ... (Logic lengkap seperti get.py bisa dimasukkan disini)
    });

    // Handle Input Range Text
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const text = msg.text.trim();
        
        // Regex cek range (angka + XXX)
        if (text.match(/^\d+X+$/i)) {
            if (isProcessing) {
                return bot.sendMessage(msg.chat.id, "⏳ Sedang memproses permintaan lain...");
            }
            isProcessing = true;
            
            bot.sendMessage(msg.chat.id, `🔄 Mencari nomor untuk range: ${text}...`);

            try {
                // Pastikan ada di URL target
                if (page.url() !== config.URL_TARGET_GET) {
                    await page.goto(config.URL_TARGET_GET);
                }

                // Automation Playwright: Input Range & Click
                await page.fill("input[name='numberrange']", text);
                await page.click("button:has-text('Get Number')");

                // Tunggu hasil (Polling tabel)
                // Ini simplifikasi, aslinya perlu logic wait loop seperti di python
                await utils.delay(2000); 

                // Scraping hasil (Contoh selector, sesuaikan dengan web asli)
                const rows = await page.$$('tbody tr');
                let foundNumber = null;
                
                for (const row of rows) {
                    const numText = await row.innerText();
                    // Logic parsing number dari row
                    // Anggap kita dapet nomornya:
                    if (numText.includes(text.replace(/X/g, ''))) {
                         // Parse nomor bersih
                         const parts = numText.split(/\s+/);
                         foundNumber = parts[0]; // asumsi kolom pertama
                         break;
                    }
                }

                if (foundNumber) {
                    // Simpan ke wait.json
                    const waitList = utils.loadJson(config.FILES.WAIT, []);
                    waitList.push({
                        number: foundNumber,
                        user_id: msg.from.id,
                        username: msg.from.username,
                        timestamp: Date.now(),
                        otp_received: false
                    });
                    utils.saveJson(config.FILES.WAIT, waitList);

                    bot.sendMessage(msg.chat.id, `✅ <b>Nomor Didapatkan!</b>\n<code>${foundNumber}</code>\n\nMenunggu OTP...`, { parse_mode: 'HTML' });
                } else {
                    bot.sendMessage(msg.chat.id, "❌ Nomor tidak ditemukan, coba lagi.");
                }

            } catch (error) {
                console.error('[GET-BOT] Error:', error);
                bot.sendMessage(msg.chat.id, "❌ Terjadi kesalahan pada sistem.");
            } finally {
                isProcessing = false;
            }
        }
    });
};

