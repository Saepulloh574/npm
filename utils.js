const fs = require('fs');
const path = require('path');

// Pastikan folder data ada
const ensureDataDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const loadJson = (filePath, defaultValue = []) => {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e.message);
    }
    return defaultValue;
};

const saveJson = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error(`Error writing ${filePath}:`, e.message);
    }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const COUNTRY_EMOJI = {
    "INDONESIA": "🇮🇩", "MALAYSIA": "🇲🇾", "VIETNAM": "🇻🇳", "THAILAND": "🇹🇭",
    "PHILIPPINES": "🇵🇭", "CAMBODIA": "🇰🇭", "LAOS": "🇱🇦", "MYANMAR": "🇲🇲",
    "SINGAPORE": "🇸🇬", "USA": "🇺🇸", "UNITED STATES": "🇺🇸", "UK": "🇬🇧",
    "UNITED KINGDOM": "🇬🇧", "RUSSIA": "🇷🇺", "CHINA": "🇨🇳", "BRAZIL": "🇧🇷",
    // Tambahkan bendera lain sesuai kebutuhan script python sebelumnya
    "UNKNOWN": "🗺️"
};

const getEmoji = (country) => {
    return COUNTRY_EMOJI[country.toUpperCase()] || COUNTRY_EMOJI["UNKNOWN"];
};

module.exports = { ensureDataDir, loadJson, saveJson, delay, getEmoji };

