require('dotenv').config();
const path = require('path');

module.exports = {
    // General
    WAIT_TIMEOUT: parseInt(process.env.WAIT_TIMEOUT_SECONDS || 1800),
    
    // Credentials
    MNIT_EMAIL: process.env.MNIT_EMAIL,
    MNIT_PASSWORD: process.env.MNIT_PASSWORD,
    
    // URLs
    URL_LOGIN: "https://x.mnitnetwork.com/mauth/login",
    URL_TARGET_MSG: "https://x.mnitnetwork.com/mdashboard/getnum",
    URL_TARGET_GET: "https://x.mnitnetwork.com/mdashboard/getnum",
    URL_TARGET_RANGE: "https://x.mnitnetwork.com/mdashboard/console",

    // Message Bot Config
    MSG_BOT: {
        TOKEN: process.env.TELEGRAM_BOT_TOKEN_MSG,
        CHAT_ID: process.env.TELEGRAM_CHAT_ID_MSG,
        ADMIN_ID: process.env.TELEGRAM_ADMIN_ID_MSG
    },

    // Get Bot Config
    GET_BOT: {
        TOKEN: process.env.BOT_TOKEN_GET,
        GROUP_1: process.env.GROUP_ID_1,
        GROUP_2: process.env.GROUP_ID_2,
        ADMIN_ID: process.env.ADMIN_ID_GET,
        PRICE: 0.003500
    },

    // Range Bot Config
    RANGE_BOT: {
        TOKEN: process.env.BOT_TOKEN_RANGE,
        CHAT_ID: process.env.CHAT_ID_RANGE,
        ADMIN_ID: process.env.ADMIN_ID_RANGE
    },

    // Paths
    DATA_DIR: path.join(__dirname, 'data'),
    FILES: {
        OTP: path.join(__dirname, 'data/otp.json'),
        INLINE: path.join(__dirname, 'data/inline.json'),
        USERS: path.join(__dirname, 'data/users.json'),
        PROFILE: path.join(__dirname, 'data/profil.json'),
        SMC: path.join(__dirname, 'data/smc.json'),
        WAIT: path.join(__dirname, 'data/wait.json'),
        CACHE_OTP: path.join(__dirname, 'data/cache_otp.json'),
        RANGE_CACHE: path.join(__dirname, 'data/range_cache.json')
    }
};

