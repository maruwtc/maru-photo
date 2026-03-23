# Auth Server

The auth server is the control plane for the whole product.

It should own:

- Firebase token verification and app sessions
- refresh tokens and sessions
- device registration
- upload authorization
- Graph integration
- asset metadata indexing

It should not expose Microsoft identities or tokens to the mobile app.
It should not persist large upload files locally.

## Suggested stack

- Node.js with NestJS or Fastify
- PostgreSQL
- Redis for upload session state and job queues
- background worker for thumbnail generation and metadata extraction
- Firebase Admin SDK for Google/Firebase identity verification

## Local setup

- copy `.env.example` to `.env`
- create PostgreSQL database and apply `db/schema.sql`
- install dependencies with `npm install`
- start the server with `npm run dev`

## Modules

- `auth/firebase`
- `users`
- `devices`
- `uploads`
- `assets`
- `storage/microsoft-graph`

Implemented in `src/`:

- `services/firebase.ts` verifies Firebase ID tokens
- `services/graph.ts` creates Graph upload sessions and forwards chunks
- `routes/uploads.ts` streams binary chunks without writing full files to disk

## Key rule

Treat Microsoft Graph as an internal storage provider, not as the app's user identity provider.
