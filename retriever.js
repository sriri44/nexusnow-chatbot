/**
 * retriever.js
 * NexusNow.ai — Semantic Retriever
 *
 * Converts a user query into an embedding,
 * searches the vector store, and returns
 * formatted context for GPT injection.
 */

require('dotenv').config();

const { embedQuery } = require('./embedder');
const vectorStore    = require('./vectorStore');

/* =========================================================
   CONFIG
========================================================= */

const TOP_K          = parseInt(process.env.TOP_K_RESULTS || '5', 10);
const MIN_SCORE      = 0.25;   // Minimum similarity to include a chunk
const MAX_CTX_CHARS  = 4000;   // Maximum total context characters sent to GPT

/* =========================================================
   RETRIEVE
========================================================= */

/**
 * Retrieve the most relevant chunks for a user query.
 *
 * @param {string} query        The user's question
 * @param {number} [topK]       Number of results (default TOP_K)
 * @returns {Promise<{
 *   context: string,
 *   sources: string[],
 *   chunks:  object[],
 *   hasResults: boolean
 * }>}
 */
async function retrieve(query, topK = TOP_K) {
    /* ─── Embed the query ─── */
    let queryEmbedding;
    try {
        queryEmbedding = await embedQuery(query);
    } catch (err) {
        console.error('[Retriever] Embedding error:', err.message);
        return { context: '', sources: [], chunks: [], hasResults: false };
    }

    /* ─── Search vector store ─── */
    const results = vectorStore.search(queryEmbedding, topK);

    /* ─── Filter by minimum relevance score ─── */
    const relevant = results.filter(r => r.score >= MIN_SCORE);

    if (relevant.length === 0) {
        console.log(`[Retriever] No relevant chunks found for: "${query.slice(0, 60)}"`);
        return { context: '', sources: [], chunks: [], hasResults: false };
    }

    /* ─── Log top results ─── */
    console.log(`[Retriever] Top ${relevant.length} results for: "${query.slice(0, 60)}"`);
    relevant.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.score.toFixed(3)}] ${r.title} — ${r.heading}`);
    });

    /* ─── Build context string ─── */
    let context    = '';
    const sources  = [];

    for (const chunk of relevant) {
        const section = `[Source: ${chunk.title}${chunk.heading !== chunk.title ? ' › ' + chunk.heading : ''}]\n${chunk.text}\n\n`;

        if ((context + section).length > MAX_CTX_CHARS) break;

        context += section;

        if (chunk.url && !sources.includes(chunk.url)) {
            sources.push(chunk.url);
        }
    }

    return {
        context:    context.trim(),
        sources,
        chunks:     relevant,
        hasResults: true,
    };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = { retrieve };
