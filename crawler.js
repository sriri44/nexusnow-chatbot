require('dotenv').config();

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

/* =========================
   CONFIG
========================= */

const SEED_URLS = (
    process.env.CRAWL_URLS ||
    'https://nexusnow.ai'
)
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);

const OUTPUT_PATH = path.join(
    __dirname,
    'data',
    'crawledData.json'
);

const REQUEST_TIMEOUT = 60000;
const MAX_PAGES = 50;
const CRAWL_DELAY = 1000;

/* =========================
   URL TRACKING
========================= */

const visitedUrls = new Set();
const discoveredUrls = new Set(SEED_URLS);

/* =========================
   HELPERS
========================= */

function normalizeUrl(url) {
    try {
        const parsed = new URL(url);

        parsed.protocol = 'https:';
        parsed.hostname = 'www.nexusnow.ai';

        parsed.hash = '';

        let normalized = parsed.toString();

        normalized = normalized.replace(/\/$/, '');

        return normalized;

    } catch {
        return null;
    }
}

function isInternalUrl(url) {
    return url.includes('nexusnow.ai');
}

function isValidPage(url) {
    const blocked = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.svg',
        '.pdf',
        '.zip',
        '.mp4',
        '.mp3',
        'mailto:',
        'tel:',
        'javascript:'
    ];

    return !blocked.some(ext =>
        url.toLowerCase().includes(ext)
    );
}

/* =========================
   NOISE SELECTORS
========================= */

const NOISE_SELECTORS = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'canvas',

    '.cookie-banner',
    '.cookie-consent',
    '.popup',
    '.modal',
    '.overlay',

    '.ads',
    '.advertisement',

    '[aria-hidden="true"]'
];

/* =========================
   CLEAN TEXT
========================= */

function cleanText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n{2,}/g, '\n\n')
        .trim();
}

/* =========================
   STRUCTURED CONTENT
========================= */

function extractStructuredContent($) {

    const sections = [];

    $('h1, h2, h3, h4').each((i, el) => {

        const heading =
            cleanText($(el).text());

        if (!heading) return;

        const bodyParts = [];

        let next = $(el).next();

        while (
            next.length &&
            !next.is('h1, h2, h3, h4')
        ) {

            const text =
                cleanText(next.text());

            if (text.length > 20) {
                bodyParts.push(text);
            }

            next = next.next();
        }

        sections.push({
            heading,
            body: bodyParts.join(' ')
        });
    });

    return sections;
}

/* =========================
   DISCOVER INTERNAL LINKS
========================= */

async function discoverInternalLinks(page) {

    try {

        const links = await page.$$eval(
            'a[href]',
            anchors =>
                anchors.map(a => a.href)
        );

        for (const link of links) {

            const normalized =
                normalizeUrl(link);

            if (!normalized) continue;

            if (!isInternalUrl(normalized))
                continue;

            if (!isValidPage(normalized))
                continue;

            if (
                discoveredUrls.size >=
                MAX_PAGES
            ) break;

            discoveredUrls.add(normalized);
        }

    } catch (err) {

        console.log(
            'Link discovery failed'
        );
    }
}

/* =========================
   CRAWL PAGE
========================= */

async function crawlPage(browser, url) {

    console.log(`Crawling: ${url}`);

    const page =
        await browser.newPage();

    try {

        await page.setUserAgent(
            'Mozilla/5.0'
        );

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: REQUEST_TIMEOUT
        });

        await new Promise(resolve =>
            setTimeout(resolve, 2500)
        );

        await discoverInternalLinks(page);

        const html =
            await page.content();

        const $ = cheerio.load(html);

        NOISE_SELECTORS.forEach(sel => {
            $(sel).remove();
        });

        const title =
            $('title').text().trim() ||
            $('h1').first().text().trim() ||
            url;

        const metaDescription =
            $('meta[name="description"]')
                .attr('content') || '';

        const sections =
            extractStructuredContent($);

        const rawText = cleanText(
            $('body').text()
        );

        let cleanContent = '';

        if (metaDescription) {

            cleanContent +=
                `Page Summary: ${metaDescription}\n\n`;
        }

        sections.forEach(section => {

            cleanContent +=
                `## ${section.heading}\n`;

            cleanContent +=
                `${section.body}\n\n`;
        });

        if (cleanContent.length < 300) {
            cleanContent = rawText;
        }

        if (cleanContent.length < 100) {

            console.log(
                'Skipped - insufficient content'
            );

            return null;
        }

        console.log(
            `Done - ${cleanContent.length} chars`
        );

        return {
            url,
            title,
            metaDescription,
            content: cleanContent,
            sections: sections.length,
            crawledAt: new Date().toISOString()
        };

    } catch (err) {

        console.log(
            `Failed: ${err.message}`
        );

        return null;

    } finally {

        await page.close();
    }
}

/* =========================
   MAIN CRAWLER
========================= */

async function crawlAll() {

    console.log('\nNexusNow Auto Crawler\n');

    const dataDir =
        path.join(__dirname, 'data');

    if (!fs.existsSync(dataDir)) {

        fs.mkdirSync(dataDir, {
            recursive: true
        });
    }

    const browser =
        await puppeteer.launch({

            headless: true,

            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

    const results = [];

    try {

        while (
            discoveredUrls.size >
            visitedUrls.size
        ) {

            const pending =
                [...discoveredUrls].filter(
                    url =>
                        !visitedUrls.has(url)
                );

            if (!pending.length) break;

            const url = pending[0];

            visitedUrls.add(url);

            console.log(
                `\n[${visitedUrls.size}/${MAX_PAGES}]`
            );

            const result =
                await crawlPage(browser, url);

            if (result) {
                results.push(result);
            }

            await new Promise(resolve =>
                setTimeout(resolve, CRAWL_DELAY)
            );

            if (
                visitedUrls.size >=
                MAX_PAGES
            ) {
                break;
            }
        }

    } finally {

        await browser.close();
    }

    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify(results, null, 2),
        'utf8'
    );

    console.log('\nCrawling complete');

    console.log(
        `Pages crawled: ${results.length}`
    );

    console.log(
        `URLs discovered: ${discoveredUrls.size}`
    );

    return results;
}

/* =========================
   ENTRY
========================= */

if (require.main === module) {

    crawlAll().catch(err => {

        console.error(err);

        process.exit(1);
    });
}

module.exports = {
    crawlAll,
    crawlPage
};