# PersonaForge

![Screenshot](./screenshot.png)

PersonaForge is a full-stack AI agent builder for creating, testing, and managing persona-driven agents. It includes a Next.js frontend for authentication, agent management, API keys, settings, and sandbox testing, plus an Express backend that handles agent chat, tool execution, file uploads, and MCP-backed integrations.

## What is implemented

- Agent creation UI at `/create-agent`
- Sandbox chat UI at `/sandbox`
- Dashboard for viewing saved agents
- User authentication with:
  - Email/password credentials
  - Google OAuth
  - GitHub OAuth
- MongoDB-backed storage for:
  - Users
  - Agents
  - API keys
- API key generation and management
- Backend chat API for persona-based responses
- Session chat memory with:
  - Redis when `REDIS_URL` is configured
  - In-memory fallback when Redis is not configured
- Tool-enabled chat support for:
  - Google Search
  - Read File
- File upload endpoint for text-based files used in sandbox chat
- MCP server auto-started by the backend for tool exposure
- Multiple model routes in the backend, with Gemini ADK as the main tool-enabled path

## Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- NextAuth
- MongoDB / Mongoose

### Backend

- Express 5
- Google ADK
- FastMCP
- MCP SDK
- Redis via `ioredis`
- MongoDB / Mongoose

## Project structure

```text
app/                     Next.js app router pages and API routes
components/              Shared UI components
contexts/                React auth context
lib/                     Auth, DB, and utility helpers
models/                  Mongoose models for frontend APIs
personaforge-backend/    Express backend, tool runtime, MCP server
```

## Core flows

### 1. Create an agent

The `/create-agent` page lets a signed-in user define:

- name
- description
- system prompt
- tone
- domain
- response style
- guardrails
- tools
- memory mode
- response length
- safety filters

Saved agents are persisted through the Next.js API layer into MongoDB.

### 2. Test in sandbox

The `/sandbox` page can:

- register a temporary backend agent session
- send chat messages to the Express backend
- upload text-based files for analysis
- switch among supported model labels
- run web search mode
- test memory and jailbreak behavior

### 3. Call agents programmatically

The backend exposes chat endpoints that accept:

- `message`
- `session_id`
- `attached_files`
- `model`

When `Read File` is enabled and the request is file-related, uploaded file content is loaded from the backend safe uploads directory and supplied to the model for analysis.

## Tooling behavior

### Read File

Implemented in:

- [personaforge-backend/services/readFileTool.js](personaforge-backend/services/readFileTool.js)
- [personaforge-backend/routes/files.js](personaforge-backend/routes/files.js)
- [personaforge-backend/routes/chat.js](personaforge-backend/routes/chat.js)

Behavior today:

- Only text-like files are accepted
- Files are uploaded into a safe backend uploads directory
- The backend reads uploaded file content from disk
- File content is passed into the chat flow for file-related prompts
- The MCP server also exposes a `read_file` tool

Supported upload extensions:

- `.txt`
- `.json`
- `.md`
- `.markdown`
- `.csv`
- `.tsv`
- `.log`
- `.yaml`
- `.yml`
- `.xml`
- `.html`
- `.css`
- `.js`
- `.ts`

### Google Search

Implemented in:

- [personaforge-backend/mcp_server.ts](personaforge-backend/mcp_server.ts)
- [personaforge-backend/services/ai.js](personaforge-backend/services/ai.js)
- [personaforge-backend/routes/chat.js](personaforge-backend/routes/chat.js)

Behavior today:

- Available as a tool when enabled for an agent
- Also available through the dedicated backend `/v1/search` route
- Intended for current-information queries

## Authentication

The frontend currently supports:

- Credentials login
- Google OAuth
- GitHub OAuth

Relevant files:

- [lib/auth-config-simple.ts](lib/auth-config-simple.ts)
- [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
- [app/api/auth/signup/route.ts](app/api/auth/signup/route.ts)
- [app/api/auth/[...nextauth]/route.ts](app/api/auth/[...nextauth]/route.ts)

## Data storage

### MongoDB

Used for:

- users
- agents
- API keys
- user SMTP settings

### Redis

Used for chat history only when `REDIS_URL` is configured. If Redis is missing, the backend falls back to an in-memory `Map`, which is suitable for local development but not durable across restarts.

Relevant file:

- [personaforge-backend/services/memory.js](personaforge-backend/services/memory.js)

## Environment variables

These variables are referenced in the current codebase.

### Required for core local development

```bash
MONGODB_URI=
JWT_SECRET=
NEXTAUTH_SECRET=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Required for credentials + NextAuth flows

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### Required for Gemini-backed agent flows

Use one of:

```bash
GEMINI_API_KEY=
GOOGLE_GENAI_API_KEY=
GOOGLE_API_KEY=
```

### Optional

```bash
REDIS_URL=
GROQ_API_KEY=
POLLINATIONS_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
PORT=8000
MCP_SERVER_PORT=3001
MCP_SERVER_URL=http://localhost:3001
PERSONAFORGE_SAFE_FILE_DIR=
PERSONAFORGE_MAX_FILE_SIZE_BYTES=
```

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/BikramMondal5/PersonaForge.git
cd PersonaForge
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd personaforge-backend
npm install
cd ..
```

### 4. Add environment variables

Create your `.env` file at the project root and add the variables you need from the section above.

At minimum for local development, make sure:

- MongoDB is configured
- frontend `NEXTAUTH_SECRET` is configured
- backend/frontend JWT secret is configured
- `NEXT_PUBLIC_API_URL` points to the Express backend
- a Gemini API key is configured if you want persona chat to work through Gemini

## Running locally

### Start frontend only

```bash
npm run dev
```

### Start backend only

```bash
cd personaforge-backend
npm run dev
```

### Start both from the repo root

```bash
npm run dev:all
```

The frontend runs on `http://localhost:3000`.

The backend runs on `http://localhost:8000` by default.

The backend also starts the MCP server automatically.

## Main routes

### Frontend pages

- `/`
- `/login`
- `/sign-up`
- `/dashboard`
- `/create-agent`
- `/sandbox`
- `/api-keys`
- `/settings`

### Next.js API routes

- `/api/auth/...`
- `/api/agents`
- `/api/agents/[id]`
- `/api/api-keys`
- `/api/api-keys/[id]`
- `/api/user/settings`
- `/api/forge-agent`

### Express backend routes

- `GET /health`
- `POST /forge`
- `POST /v1/register`
- `POST /v1/:agentId/chat`
- `POST /v1/search`
- `POST /files/upload`

## Example backend chat request

```bash
curl -X POST http://localhost:8000/v1/<agentId>/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api-key>" \
  -d '{
    "message": "Summarize the uploaded file",
    "session_id": "session-123",
    "attached_files": [],
    "model": "Gemini 2.5 Flash"
  }'
```

## Notes for contributors

- The frontend and backend are separate runtimes
- Some UI options are ahead of the actual backend integration
- The README should be updated against implemented behavior, not planned behavior
- File-reading behavior currently focuses on uploaded text-based files rather than arbitrary filesystem browsing

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).
