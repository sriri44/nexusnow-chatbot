/**
 * embedder.js
 * NexusNow.ai — OpenAI Embedding Pipeline
 *
 * Reads chunks from data/chunks.json, generates embeddings
 * using text-embedding-3-small, and persists to vectorStore.
 *
 * Usage: node embedder.js
 */

require('dotenv').config();

const OpenAI = require('openai');
const fs     = require('fs');
const path   = require('path');

const { crawlAll }   = require('./crawler');
const { chunkAll }   = require('./chunker');
const vectorStore    = require('./vectorStore');
const { batchArray, sleep } = require('./utils/helpers');

/* =========================================================
   CONFIG
========================================================= */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE      = 20;     // OpenAI allows up to 2048 inputs per call
const RETRY_DELAY_MS  = 2000;
const MAX_RETRIES     = 3;

const CHUNKS_PATH = path.join(__dirname, 'data', 'chunks.json');

/* =========================================================
   OPENAI CLIENT
========================================================= */

function getOpenAI() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set in .env');
    }
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/* =========================================================
   EMBED BATCH
========================================================= */

/**
 * Call OpenAI embeddings API for a batch of texts.
 * Returns array of float arrays matching input order.
 *
 * @param {OpenAI} client
 * @param {string[]} texts
 * @param {number} attempt
 * @returns {Promise<number[][]>}
 */
async function embedBatch(client, texts, attempt = 1) {
    try {
        const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: texts,
        });

        // Sort by index to guarantee order
        return response.data
            .sort((a, b) => a.index - b.index)
            .map(item => item.embedding);

    } catch (err) {
        if (attempt < MAX_RETRIES) {
            const wait = RETRY_DELAY_MS * attempt;
            console.warn(`  ⚠ Embedding error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${wait}ms...`);
            await sleep(wait);
            return embedBatch(client, texts, attempt + 1);
        }
        throw err;
    }
}

/* =========================================================
   MAIN
========================================================= */

async function embedAll({ forceRecrawl = false } = {}) {
    console.log('\n╔══════════════════════════════════╗');
    console.log('║  NexusNow.ai Embedder            ║');
    console.log('╚══════════════════════════════════╝\n');

    const openai = getOpenAI();

    /* ─── Step 1: Crawl if needed ─── */
    const crawlPath = path.join(__dirname, 'data', 'crawledData.json');
    let crawledData;

    if (forceRecrawl || !fs.existsSync(crawlPath)) {
        console.log('Step 1/3: Crawling website...');
        crawledData = await crawlAll();
    } else {
        console.log('Step 1/3: Using existing crawled data (skip with --force to re-crawl)');
        crawledData = JSON.parse(fs.readFileSync(crawlPath, 'utf8'));
    }

    /* ─── Step 2: Chunk ─── */
    console.log('\nStep 2/3: Chunking content...');
    const chunks = chunkAll(crawledData);

    /* ─── Step 3: Embed ─── */
    console.log('\nStep 3/3: Generating embeddings...');
    console.log(`  Model: ${EMBEDDING_MODEL}`);
    console.log(`  Chunks: ${chunks.length} | Batch size: ${BATCH_SIZE}`);
    console.log('─'.repeat(50));

    const batches     = batchArray(chunks, BATCH_SIZE);
    const allPairs    = [];
    let   processed   = 0;

    for (let i = 0; i < batches.length; i++) {
        const batch  = batches[i];
        const texts  = batch.map(c => c.text);

        process.stdout.write(`  Batch ${i + 1}/${batches.length} (${processed} → ${processed + batch.length})... `);

        const embeddings = await embedBatch(openai, texts);

        batch.forEach((chunk, idx) => {
            allPairs.push({ chunk, embedding: embeddings[idx] });
        });

        processed += batch.length;
        console.log('✓');

        // Polite rate-limit pause
        if (i < batches.length - 1) {
            await sleep(300);
        }
    }

    /* ─── Persist ─── */
    vectorStore.upsertMany(allPairs);

    const s = vectorStore.stats();
    console.log('\n─'.repeat(50));
    console.log('✅ Embedding complete!');
    console.log(`   Vectors stored: ${s.count}`);
    console.log(`   Sources indexed: ${s.urls.length}`);
    s.urls.forEach(u => console.log(`     • ${u}`));
    console.log('\nYour RAG system is ready. Start the server: npm start\n');
}

/* =========================================================
   SINGLE QUERY EMBEDDING (used by retriever)
========================================================= */

let _openai;

/**
 * Embed a single query string for retrieval.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedQuery(text) {
    if (!_openai) _openai = getOpenAI();

    const response = await _openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
    });

    return response.data[0].embedding;
}

/* =========================================================
   ENTRY POINT
========================================================= */

if (require.main === module) {
    const forceRecrawl = process.argv.includes('--force');
    embedAll({ forceRecrawl }).catch(err => {
        console.error('\n❌ Embedder failed:', err.message);
        if (err.message.includes('API key')) {
            console.error('   Set OPENAI_API_KEY in your .env file.');
        }
        process.exit(1);
    });
}

module.exports = { embedAll, embedQuery };
