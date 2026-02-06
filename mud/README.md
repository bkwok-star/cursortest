# MUD

A modern Multi-User Dungeon project using Node.js, TypeScript, and Socket.io.

## Structure

```
mud/
├── server/           # TypeScript server source
│   └── index.ts      # Express + Socket.io server
├── public/           # Static files served to clients
│   ├── index.html
│   ├── client.js
├── dist/             # Compiled output (after build)
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

```bash
npm install
```

## Scripts

- **`npm run dev`** – Run server with hot reload (ts-node-dev)
- **`npm run build`** – Compile TypeScript to `dist/`
- **`npm start`** – Run compiled server (run `npm run build` first)
- **`npm run clean`** – Remove `dist/`

## Run

```bash
npm run dev
```

Then open http://localhost:3000

## Tech

- **Express** – HTTP server, static file serving
- **Socket.io** – Real-time client-server communication
- **TypeScript** – Typed server code
