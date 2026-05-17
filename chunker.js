/**
 * chunker.js
 * NexusNow.ai — Intelligent Text Chunker
 *
 * Splits crawled pages into overlapping chunks suitable
 * for embedding and semantic retrieval.
 *
 * Usage: node chunker.js  (standalone)
 *        require('./chunker') (as module)
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

/* =========================================================
   CONFIG
========================================================= */

const CHUNK_SIZE    = parseInt(process.env.CHUNK_SIZE    || '800',  10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '150',  10);

const INPUT_PATH  = path.join(__dirname, 'data', 'crawledData.json');
const OUTPUT_PATH = path.join(__dirname, 'data', 'chunks.json');

/* =========================================================
   HELPERS
========================================================= */

/**
 * Split text into sentences (approx). Handles . ! ? :\n
 */
function splitIntoSentences(text) {
    return text
        .replace(/([.!?:])\s+/g, '$1\n')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * Sliding-window chunker with overlap.
 * Prefers sentence boundaries over hard character cuts.
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const sentences  = splitIntoSentences(text);
    const chunks     = [];
    let   current    = '';
    let   chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];

        if ((current + ' ' + sentence).trim().length <= chunkSize) {
            current = (current + ' ' + sentence).trim();
        } else {
            // Save current chunk if it has content
            if (current.length > 50) {
                chunks.push({ index: chunkIndex++, text: current });
            }

            // Overlap: carry back last `overlap` characters
            if (overlap > 0 && current.length > overlap) {
                current = current.slice(-overlap) + ' ' + sentence;
            } else {
                current = sentence;
            }
        }
    }

    // Push final remaining chunk
    if (current.length > 50) {
        chunks.push({ index: chunkIndex++, text: current });
    }

    return chunks;
}

/* =========================================================
   SECTION-AWARE CHUNKER
========================================================= */

/**
 * For pages with ## heading markers, chunk per section
 * then apply sliding window within large sections.
 */
function chunkPage(page) {
    const { url, title, content } = page;
    const allChunks = [];

    // Split on markdown-style headers
    const sections = content.split(/\n## /);

    sections.forEach((section, sIdx) => {
        const lines      = section.split('\n');
        const heading    = sIdx === 0 ? '' : lines[0].trim();
        const body       = sIdx === 0 ? section : lines.slice(1).join('\n');

        const contextPrefix = [title, heading].filter(Boolean).join(' › ');
        const fullText      = contextPrefix
            ? `${contextPrefix}: ${body.trim()}`
            : body.trim();

        if (fullText.length < 30) return;

        const subChunks = chunkText(fullText);
        subChunks.forEach(({ index, text }) => {
            allChunks.push({
                id:        `${encodeURIComponent(url)}_s${sIdx}_c${index}`,
                url,
                title,
                heading:   heading || title,
                text,
                charCount: text.length,
            });
        });
    });

    // If no section structure, chunk the full content
    if (allChunks.length === 0) {
        const subChunks = chunkText(content);
        subChunks.forEach(({ index, text }) => {
            allChunks.push({
                id:        `${encodeURIComponent(url)}_c${index}`,
                url,
                title,
                heading:   title,
                text,
                charCount: text.length,
            });
        });
    }

    return allChunks;
}

/* =========================================================
   MAIN
========================================================= */

function chunkAll(crawledData = null) {
    console.log('\n╔══════════════════════════════════╗');
    console.log('║  NexusNow.ai Chunker             ║');
    console.log('╚══════════════════════════════════╝\n');

    /* ─── Load crawled data ─── */
    if (!crawledData) {
        if (!fs.existsSync(INPUT_PATH)) {
            throw new Error(`Crawled data not found at ${INPUT_PATH}. Run: node crawler.js`);
        }
        crawledData = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    }

    console.log(`Pages to chunk: ${crawledData.length}`);
    console.log(`Chunk size: ${CHUNK_SIZE} chars | Overlap: ${CHUNK_OVERLAP} chars`);
    console.log('─'.repeat(50));

    const allChunks = [];

    for (const page of crawledData) {
        const chunks = chunkPage(page);
        console.log(`  ${page.title} → ${chunks.length} chunks`);
        allChunks.push(...chunks);
    }

    /* ─── Save ─── */
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allChunks, null, 2), 'utf8');

    console.log('\n─'.repeat(50));
    console.log(`✅ Chunking complete!`);
    console.log(`   Total chunks: ${allChunks.length}`);
    console.log(`   Output: ${OUTPUT_PATH}\n`);

    return allChunks;
}

/* =========================================================
   ENTRY POINT
========================================================= */

if (require.main === module) {
    try {
        chunkAll();
    } catch (err) {
        console.error('\n❌ Chunker failed:', err.message);
        process.exit(1);
    }
}

module.exports = { chunkAll, chunkPage, chunkText };
