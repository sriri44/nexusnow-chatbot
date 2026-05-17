# NexusNow.ai — Enterprise RAG AI Chatbot v2.0

A production-ready AI assistant that crawls your website, builds a vector database of your content, and answers user questions using semantic retrieval — preventing hallucinations by grounding all responses in your actual website data.

## Architecture

```
User Question
    ↓
Embedding (text-embedding-3-small)
    ↓
Vector Search (cosine similarity)
    ↓
Top-K Relevant Chunks Retrieved
    ↓
Context Injected into GPT Prompt
    ↓
gpt-4o-mini Generates Grounded Answer
    ↓
Response to User
```

## Folder Structure

```
nexusnow/
├── server.js          ← Main Express server (RAG-powered)
├── crawler.js         ← Website crawler
├── chunker.js         ← Intelligent text chunker
├── embedder.js        ← OpenAI embedding pipeline
├── retriever.js       ← Semantic retrieval module
├── vectorStore.js     ← Local JSON vector database
├── package.json
├── .env               ← Your environment variables (git-ignored)
├── .env.example       ← Template
├── leads.json         ← Auto-created: captured leads
│
├── public/
│   └── index.html     ← Complete chatbot frontend (all UI preserved)
│
├── data/              ← Auto-created by crawler/embedder
│   ├── crawledData.json
│   ├── chunks.json
│   └── vectors.json   ← Vector store (persisted)
│
└── utils/
    ├── similarity.js  ← Cosine similarity
    └── helpers.js     ← Shared utilities
```

---

## Installation

### 1. Clone / Copy the project

```bash
cd nexusnow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
OPENAI_API_KEY=sk-proj-your-key-here
GMAIL_USER=nexusnow2026@gmail.com
GMAIL_PASS=your-gmail-app-password
ADMIN_EMAIL=nexusnow2026@gmail.com
CRAWL_URLS=https://nexusnow.ai,https://nexusnow.ai/about,https://nexusnow.ai/services
```

> **Gmail App Password**: Google Account → Security → 2-Step Verification → App Passwords → Generate one for "Mail"

---

## Quick Start

### Step 1 — Index your website (one-time setup)

```bash
npm run setup
```

This runs:
1. `crawler.js` → crawls all CRAWL_URLS, saves to `data/crawledData.json`
2. `chunker.js` → splits content into chunks, saves to `data/chunks.json`
3. `embedder.js` → generates OpenAI embeddings, saves to `data/vectors.json`

### Step 2 — Start the server

```bash
npm start
```

### Step 3 — Open the chatbot

Visit: http://localhost:3000

---

## Individual Commands

```bash
# Just crawl (re-crawl website)
npm run crawl

# Just embed (uses existing crawled data)
npm run embed

# Force re-crawl + re-embed everything
npm run reset

# Development mode with auto-restart
npm run dev

# Full setup from scratch
npm run setup
```

---

## Re-indexing When Website Changes

Run anytime your website content changes:

```bash
npm run reset
```

Or for a partial update:

```bash
node crawler.js && node embedder.js
```

---

## API Endpoints

| Method | Endpoint        | Description                        |
|--------|-----------------|------------------------------------|
| POST   | `/chat`         | RAG-powered chat (main endpoint)   |
| POST   | `/schedule-demo`| Direct demo scheduling with emails |
| GET    | `/leads`        | View all captured leads            |
| GET    | `/rag-stats`    | Vector store status and stats      |
| GET    | `/health`       | Server health check                |

---

## RAG Configuration

Tunable in `.env`:

| Variable        | Default | Description                              |
|-----------------|---------|------------------------------------------|
| `CHUNK_SIZE`    | 800     | Characters per chunk                     |
| `CHUNK_OVERLAP` | 150     | Overlap between adjacent chunks          |
| `TOP_K_RESULTS` | 5       | Number of chunks retrieved per query     |

---

## Features

- **RAG-grounded responses** — AI only answers from crawled website content
- **Hallucination prevention** — if no relevant context found, AI says so
- **Demo scheduling** — full form with validation + email confirmation
- **Lead capture** — stored to `leads.json`
- **Professional emails** — HTML confirmation to customer + admin
- **Timezone selector** — 20+ timezones with search
- **Country code picker** — 20 countries with flag + dial code
- **Markdown rendering** — bold, italics, lists, code, links
- **Mobile responsive** — full-screen on mobile
- **RAG status badge** — live indicator in chat header
- **Source attribution** — shows source URL below AI responses

---

## Troubleshooting

**"Vector store is empty"**
→ Run `npm run setup`

**"OPENAI_API_KEY is not set"**
→ Add your key to `.env`

**Emails not sending**
→ Use a Gmail App Password, not your real Gmail password
→ Ensure 2-Step Verification is enabled on the Gmail account

**Crawler returns no content**
→ Check `CRAWL_URLS` in `.env`
→ Some sites block crawlers; add `User-Agent` exceptions on your site

**Poor answer quality**
→ Reduce `CHUNK_SIZE` to 500 for more precise retrieval
→ Increase `TOP_K_RESULTS` to 7-8 for broader context
→ Re-crawl if website content has changed
