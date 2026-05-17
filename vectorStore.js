/**
 * vectorStore.js
 * NexusNow.ai — Local JSON Vector Store
 *
 * Provides persistent storage and cosine-similarity search
 * over chunk embeddings using a plain JSON file.
 * No external DB required — production-ready for small/medium sites.
 */

const fs   = require('fs');
const path = require('path');

const { cosineSimilarity } = require('./utils/similarity');
const { ensureDir }        = require('./utils/helpers');

/* =========================================================
   PATHS
========================================================= */

const DATA_DIR    = path.join(__dirname, 'data');
const VECTOR_PATH = path.join(DATA_DIR, 'vectors.json');

/* =========================================================
   IN-MEMORY STORE
========================================================= */

let store = [];   // Array of { id, url, title, heading, text, embedding }
let loaded = false;

/* =========================================================
   LOAD / SAVE
========================================================= */

function load() {
    if (loaded) return;

    ensureDir(DATA_DIR);

    if (fs.existsSync(VECTOR_PATH)) {
        try {
            store  = JSON.parse(fs.readFileSync(VECTOR_PATH, 'utf8'));
            loaded = true;
            console.log(`[VectorStore] Loaded ${store.length} vectors from disk.`);
        } catch (err) {
            console.error('[VectorStore] Failed to parse vectors.json:', err.message);
            store  = [];
            loaded = true;
        }
    } else {
        store  = [];
        loaded = true;
        console.log('[VectorStore] No existing vector store found — starting fresh.');
    }
}

function save() {
    ensureDir(DATA_DIR);
    fs.writeFileSync(VECTOR_PATH, JSON.stringify(store, null, 2), 'utf8');
}

/* =========================================================
   UPSERT
========================================================= */

/**
 * Add or update a chunk entry with its embedding.
 * @param {object} chunk   { id, url, title, heading, text }
 * @param {number[]} embedding
 */
function upsert(chunk, embedding) {
    load();

    const idx = store.findIndex(item => item.id === chunk.id);
    const entry = { ...chunk, embedding };

    if (idx >= 0) {
        store[idx] = entry;
    } else {
        store.push(entry);
    }
}

/**
 * Bulk upsert and then persist.
 * @param {Array<{chunk, embedding}>} pairs
 */
function upsertMany(pairs) {
    load();
    pairs.forEach(({ chunk, embedding }) => upsert(chunk, embedding));
    save();
    console.log(`[VectorStore] Saved ${store.length} total vectors.`);
}

/* =========================================================
   SEARCH
========================================================= */

/**
 * Find the top-k most similar chunks to a query embedding.
 *
 * @param {number[]} queryEmbedding
 * @param {number}   topK
 * @returns {Array<{id, url, title, heading, text, score}>}
 */
function search(queryEmbedding, topK = 5) {
    load();

    if (store.length === 0) {
        console.warn('[VectorStore] Vector store is empty. Run: node embedder.js');
        return [];
    }

    const scored = store.map(item => ({
        id:      item.id,
        url:     item.url,
        title:   item.title,
        heading: item.heading,
        text:    item.text,
        score:   cosineSimilarity(queryEmbedding, item.embedding),
    }));

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}

/* =========================================================
   STATS
========================================================= */

function stats() {
    load();
    return {
        count:  store.length,
        urls:   [...new Set(store.map(i => i.url))],
    };
}

function clear() {
    store  = [];
    loaded = true;
    save();
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = { load, save, upsert, upsertMany, search, stats, clear };
