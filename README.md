# Girl Zone Chatbot API

Node.js serverless backend that powers the Girl Zone companion chat experience.  
The service mirrors the original FastAPI behavior but is optimized for deployment on Vercel's Hobby (free) tier.

## Features
- CORS-enabled `POST /chat` endpoint with the original NSFW persona prompt.
- Chat history trimming via `CHAT_HISTORY_LIMIT` (defaults to 12 messages).
- Ready for Vercel serverless deployment with local dev server support.

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment variables**  
   Copy `env.example` to `.env` (not committed) and fill in your OpenAI key.
   ```
   OPENAI_API_KEY=sk-...
   CHAT_HISTORY_LIMIT=12
   PORT=8000
   ```
3. **Run locally**
   ```bash
   npm run dev
   ```
   Send POST requests to `http://localhost:8000/chat` with JSON:
   ```json
   {
     "user_message": "Hi there",
     "companion_name": "Aria",
     "history": []
   }
   ```

## Deploying to Vercel
1. Push this repo to GitHub/GitLab/Bitbucket.
2. Create a new Vercel project from the repo.
3. Add `OPENAI_API_KEY` (and optional `CHAT_HISTORY_LIMIT`) in **Settings → Environment Variables**.
4. Deploy. Vercel exposes:
   - `/api/chat` (default serverless route)
   - `/chat` (via `vercel.json` rewrite to maintain parity with the previous API).

The existing frontend or client apps can now call the Vercel endpoint without any Python dependencies.