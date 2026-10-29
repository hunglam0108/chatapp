# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two independent npm packages (no root package.json / workspaces) — run commands inside each directory:

- `backend/` — Express 5 + Socket.IO + Mongoose (MongoDB), TypeScript run directly by Node (ESM, imports use explicit `.ts` extensions, e.g. `import x from "./routes/authRoute.ts"`).
- `frontend/` — Next.js 16 (App Router) + React 19, Tailwind 4, shadcn/base-ui, zustand, TanStack Query, axios, socket.io-client.

`frontend/AGENTS.md` warns this Next.js version has breaking changes: read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next-specific code.

## Commands

Backend (`cd backend`):

- `npm run dev` — nodemon on `src/server.ts` (default port 5001)
- `npm start` — `node src/server.ts`
- `npm run lint` / `lint:fix` / `format`

Frontend (`cd frontend`):

- `npm run dev` (loads `.env` via dotenv-cli, port 3005), `npm run build`, `npm start`
- `npm run lint` / `lint:fix` / `format`

There is no test runner configured in either package.

Env vars (values not committed): backend `PORT`, `CLIENT_URL` (CORS origin, used for both REST and Socket.IO), `MONGODB_*` / `MONGO_CONNECTION_STRING`, `ACCESS_TOKEN` (JWT secret); frontend `NEXT_PUBLIC_API_URL` (must end in `/api`), `NEXT_PUBLIC_SOCKET_URL`.

## Architecture

### Backend

- `src/server.ts` mounts routes: `/api/auth` and `/api/upload|uploads` are public; everything after `protectedRoute` (JWT Bearer middleware) is authenticated (`/api/user`, `/api/friends`, `/api/conversations`, `/api/messages`). Route order matters.
- Socket.IO is attached to the same HTTP server (`src/socket/index.ts`), authenticated by `socketAuthMiddleware` using `handshake.auth.token` (same `ACCESS_TOKEN` secret as REST). On connect a socket joins a room per conversation id plus a room named by its own user id; it also tracks `onlineUsers` and broadcasts `online-users`. Controllers emit events via `getIo()` — `initSocket` must run before use.
- Models: User, Session (refresh tokens), Friend, FriendRequest, Conversation (participants, group info, `formerMembers` who can read history up to `leftAt`, embedded `lastMessage`), Message. Shared message-shaping logic lives in `utils/messageHelper.ts`.
- Attachments are uploaded with multer (`uploadController`, 10 MB cap) via `POST /api/upload/file` to `uploads/` resolved from `process.cwd()` — so the backend must be started from `backend/` — and served back via `/api/uploads/attachments/:name`. JSON body limit is 20mb.

### Frontend

- Data flow: `server/*.ts` (API modules: auth, friend, chat, upload) → `hooks/use-*.ts` (React Query/socket logic) → zustand `store/*` (auth, chat, friend, socket) → components in `components/features/{auth,mainChat}`; `components/ui` is shadcn.
- `server/api.ts` is the shared `ApiClient` (axios): injects the access token from `authStore`, and on a 403 transparently calls `/auth/refresh` once (deduplicated via a shared refresh promise) and retries. Errors are normalized into `ApiError` with `status`/`data`.
- Socket lifecycle is in `store/socketStore.ts` + `hooks/use-socket.ts`; event payload types are in `types/SocketType.ts`. Keep backend emitted event names/payloads and these types in sync.
- Routes: `app/(auth)/{signin,signup}`, `app/dashboard` (main chat shell, `dashboard-shell.tsx`), guarded by `app/ProtectRoute.tsx` / `use-auth-init`.
- UI strings and comments are partly Vietnamese; follow the surrounding language.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for hunglam0108/chatapp, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
