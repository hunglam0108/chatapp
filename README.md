# chatapp

Realtime chat app: direct and group conversations, friends, file attachments, voice messages, 1-1 voice/video calls (WebRTC) and an AI chatbot assistant.

## Features

- Sign up / sign in with JWT access token + refresh token session
- Friends: search users, send / accept / decline friend requests
- Direct and group conversations; former group members keep read access to history up to the time they left
- Realtime messages, online status and seen state over Socket.IO
- Attachments and voice messages, stored on Cloudinary (10 MB per file)
- Reactions, custom emojis, per-conversation theme and quick emoji
- 1-1 voice/video calls (WebRTC, the backend only relays signaling)
- Mascot chatbot backed by any OpenAI-compatible chat completions API (Groq by default), with tools to read the user's own account, friends and conversations

## Tech stack

| Package     | Stack                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `backend/`  | Node.js (runs TypeScript directly, ESM), Express 5, Socket.IO, Mongoose (MongoDB), multer, JWT  |
| `frontend/` | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn / base-ui, zustand, TanStack Query, axios, socket.io-client |

The two packages are independent npm projects (no root `package.json`); run commands inside each directory.

## Getting started

Requirements: a Node.js version that can run `.ts` files directly (Node 22.18+ or 23.6+), a MongoDB instance, and a Cloudinary account for uploads.

### Backend

```bash
cd backend
npm install
npm run dev        # nodemon src/server.ts, default port 5001
```

`backend/.env`:

| Variable                                                              | Description                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `PORT`                                                                | HTTP + Socket.IO port (default `5001`)                         |
| `CLIENT_URL`                                                          | Frontend origin allowed by CORS (REST and Socket.IO)           |
| `MONGO_CONNECTION_STRING`                                             | MongoDB connection string                                      |
| `ACCESS_TOKEN`                                                        | JWT secret                                                     |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary credentials for attachments                         |
| `LLM_API_KEY`                                                         | Chatbot API key (chatbot returns 503 when missing)             |
| `LLM_API_URL`                                                         | Optional, default `https://api.groq.com/openai/v1`             |
| `LLM_MODEL`                                                           | Optional, default `openai/gpt-oss-120b`                        |

### Frontend

```bash
cd frontend
npm install
npm run dev        # loads .env via dotenv-cli, port 3005
```

`frontend/.env`:

| Variable                                                                        | Description                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                                                           | Backend REST URL, must end in `/api`               |
| `NEXT_PUBLIC_SOCKET_URL`                                                        | Backend Socket.IO URL                              |
| `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL` | Optional TURN server for calls behind strict NATs |

Example local setup: `CLIENT_URL=http://localhost:3005`, `NEXT_PUBLIC_API_URL=http://localhost:5001/api`, `NEXT_PUBLIC_SOCKET_URL=http://localhost:5001`.

## Scripts

Both packages: `npm run lint`, `npm run lint:fix`, `npm run format`. Frontend also has `npm run build` / `npm start`; backend `npm start` runs `node src/server.ts`. No test runner is configured.

## Project structure

```
backend/src/
  server.ts       Express app, route mounting, Socket.IO bootstrap
  routes/         /api/auth, /api/upload (public) · /api/user, friends, conversations, messages, emojis, chatbot (JWT)
  controllers/    Request handlers
  middlewares/    JWT auth, friendship / group membership checks, socket auth
  models/         User, Session, Friend, FriendRequest, Conversation, Message, CustomEmoji
  socket/         Socket.IO setup and WebRTC call signaling
  utils/          Cloudinary upload, message / emoji helpers

frontend/
  app/            Routes: (auth)/signin, (auth)/signup, dashboard
  server/         API modules (shared axios ApiClient with token refresh)
  hooks/          React Query and socket hooks
  store/          zustand stores (auth, chat, friend, socket)
  components/     features/{auth,mainChat} and shadcn ui
  types/          Domain and socket event types
```
