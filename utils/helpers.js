/**
 * utils/helpers.js
 * NexusNow.ai — Shared Utilities
 */

const fs = require('fs');

/**
 * Batch an array into chunks of `size`.
 * @param {any[]} arr
 * @param {number} size
 * @returns {any[][]}
 */
function batchArray(arr, size) {
    const batches = [];
    for (let i = 0; i < arr.length; i += size) {
        batches.push(arr.slice(i, i + size));
    }
    return batches;
}

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ensure a directory exists, creating it if needed.
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Safe JSON file read — returns null if file missing or invalid.
 * @param {string} filePath
 * @returns {any|null}
 */
function safeReadJson(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

/**
 * Format timezone label for emails and display.
 * @param {string} time   e.g. "10:00 AM"
 * @param {string} tz     IANA or abbr string e.g. "IST (UTC+05:30)"
 * @returns {string}
 */
function formatTimezoneLabel(time, tz) {
    return `${time} ${tz}`.trim();
}

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

module.exports = { batchArray, sleep, ensureDir, safeReadJson, formatTimezoneLabel, escapeHtml };
