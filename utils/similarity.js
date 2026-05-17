/**
 * utils/similarity.js
 * NexusNow.ai — Cosine Similarity
 *
 * Pure-JS cosine similarity between two embedding vectors.
 */

/**
 * Compute cosine similarity between two float arrays.
 * Returns value in [-1, 1] where 1 = identical direction.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
        dot  += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

module.exports = { cosineSimilarity };
