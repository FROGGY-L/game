Here's a comprehensive `README.md` for your project. Save it as `C:\Users\KFL IT\game\README.md`.

```markdown
# 🐸 Frog Empire: Idle Kingdom

An idle RPG where players earn coins passively, hire heroes, buy gear, and battle through stages. Features multiplayer presence (see who else is online), database-backed accounts, and cloud saves via Turso.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [How to Play](#-how-to-play)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## ✨ Features

### Core Game
- **Idle income** — Heroes generate coins every second, even while offline
- **9 hero classes** — Novice, Swordsman, Mage, Archer, Priest, Knight, Assassin, Lord Knight, High Wizard
- **15 monster types** across 5 themed stages
- **Equipment system** — Weapons, armor, boots, and accessories with permanent stat boosts
- **Guild buildings** — Multipliers for HP, ATK, speed, idle income, and offline earnings
- **Prestige system** — Reset for permanent Lily Gem bonuses
- **Wave-based combat** — 5 waves per stage, boss on wave 5
- **Offline progress** — Earn coins while away from the game

### Multiplayer & Accounts
- **User registration and login** — Secured with bcrypt-hashed passwords
- **JWT sessions** — 30-day tokens, auto-login on return
- **Cloud saves** — Progress stored in Turso, accessible from any device
- **Player presence** — See who else is online in real-time
- **Live stats** — View other players' level, coins, current stage, and battle status
- **Heartbeat system** — Players are marked online if seen within 60 seconds

---

## 🛠 Tech Stack

### Backend
- **Node.js** (v18+)
- **Express** — HTTP server and routing
- **Turso / libSQL** — Cloud SQLite database
- **bcryptjs** — Password hashing
- **jsonwebtoken** — Session tokens
- **dotenv** — Environment variable management

### Frontend
- **Vanilla JavaScript** — No framework, zero build step
- **HTML5 Canvas** — Pixel-art rendering
- **CSS3** — Responsive layout with mobile support

---

## 📁 Project Structure

```
frog-empire/
├── server.js              # Express server + API routes
├── package.json           # Dependencies and scripts
├── .env                   # Secrets (DO NOT COMMIT)
├── .gitignore             # Excludes .env, node_modules
├── README.md              # This file
└── public/
    ├── index.html         # Game + login screen
    ├── style.css          # All styling
    └── script.js          # Game logic + API calls
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or newer ([download](https://nodejs.org))
- **npm** (bundled with Node.js)
- **Turso CLI** ([install guide](https://docs.turso.tech/cli/installation))
- A free [Turso](https://turso.tech) account

### Installation

**1. Clone or create the project folder**

```powershell
mkdir "C:\Users\KFL IT\game"
cd "C:\Users\KFL IT\game"
```

**2. Initialize `package.json`**

```powershell
npm init -y
```

**3. Install dependencies**

```powershell
npm install express bcryptjs jsonwebtoken @libsql/client dotenv
```

**4. Install Turso CLI** (if not already installed)

Windows PowerShell:
```powershell
irm https://get.turso.tech | iex
```

macOS / Linux:
```bash
curl -sSfL https://get.turso.tech/install.sh | bash
```

**5. Authenticate with Turso**

```powershell
turso auth login
```

**6. Create the database**

```powershell
turso db create frog-empire
```

**7. Get your connection URL and auth token**

```powershell
turso db show frog-empire --url
turso db tokens create frog-empire
```

Copy both values — you'll need them for `.env`.

**8. Create `.env` in the project root**

```ini
TURSO_DATABASE_URL=libsql://frog-empire-yourname.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
JWT_SECRET=change-this-to-a-long-random-string
PORT=3000
```

**9. Run the server**

```powershell
npm start
```

You should see:
```
Database tables ready
🐸 Frog Empire running at http://localhost:3000
```

**10. Open the game**

Visit **http://localhost:3000** in your browser.

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TURSO_DATABASE_URL` | ✅ | Your Turso database URL (starts with `libsql://`) |
| `TURSO_AUTH_TOKEN` | ✅ | Turso authentication token |
| `JWT_SECRET` | ✅ | Secret key for signing session tokens (use a long random string) |
| `PORT` | ❌ | Server port (default: `3000`) |

### Generating a strong `JWT_SECRET`

PowerShell:
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
```

Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 🗄 Database Schema

### `users` table

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment user ID |
| `username` | TEXT UNIQUE | Case-insensitive, 3–16 chars |
| `password_hash` | TEXT | bcrypt hash (10 rounds) |
| `created_at` | INTEGER | Unix ms timestamp |
| `last_login` | INTEGER | Unix ms timestamp |
| `last_seen` | INTEGER | Unix ms timestamp (updated by heartbeat) |

### `saves` table

| Column | Type | Description |
|---|---|---|
| `user_id` | INTEGER PK | Foreign key to `users.id` |
| `save_data` | TEXT | JSON-stringified game state |
| `updated_at` | INTEGER | Unix ms timestamp |

---

## 🔌 API Reference

All endpoints return JSON. Authenticated endpoints require a `Bearer` token in the `Authorization` header.

### Authentication

#### `POST /api/register`

Create a new account.

**Body:**
```json
{ "username": "player1", "password": "secret123" }
```

**Response `200`:**
```json
{ "token": "eyJhbGc...", "username": "player1" }
```

**Errors:**
- `400` — Username/password validation failed
- `409` — Username already taken

#### `POST /api/login`

Log in to an existing account.

**Body:**
```json
{ "username": "player1", "password": "secret123" }
```

**Response `200`:**
```json
{ "token": "eyJhbGc...", "username": "player1" }
```

**Errors:**
- `401` — Invalid credentials

### Save Data

#### `GET /api/save` 🔒

Fetch the current user's save.

**Response `200`:**
```json
{
  "save": { "coins": 1234, "level": 3, ... },
  "updatedAt": 1730000000000
}
```

Or if no save exists:
```json
{ "save": null }
```

#### `POST /api/save` 🔒

Overwrite the current user's save.

**Body:**
```json
{ "save": { "coins": 1234, "level": 3, ... } }
```

**Response `200`:**
```json
{ "ok": true, "updatedAt": 1730000000000 }
```

#### `DELETE /api/save` 🔒

Delete the current user's save (used by "Reset" button).

**Response `200`:**
```json
{ "ok": true }
```

### Presence

#### `POST /api/heartbeat` 🔒

Mark the user as online. Called every 30 seconds.

**Response `200`:**
```json
{ "ok": true }
```

#### `GET /api/players` 🔒

List all players with online status and save stats.

**Response `200`:**
```json
{
  "players": [
    {
      "id": 1,
      "username": "player1",
      "level": 5,
      "coins": 12000,
      "stage": 2,
      "battleActive": false,
      "lastSeen": 1730000000000,
      "online": true,
      "isMe": true
    }
  ]
}
```

🔒 = Requires authentication

---

## 🎮 How to Play

### 1. Register / Log in
Create an account on the login screen. Passwords are hashed — you can log in from any device and get your progress back.

### 2. Earn idle coins
Heroes you hire generate coins every second automatically. Even when your browser is closed, your save keeps earning (up to 50% rate for offline time).

### 3. Hire heroes
Click the **⚔️ HEROES** tab. Each hero class has different stats and idle income. Costs grow exponentially — save up for stronger heroes.

### 4. Buy equipment
The **🛡️ GEAR** tab unlocks items as you progress. Weapons boost ATK, armor boosts HP, boots boost attack speed, and accessories boost idle income.

### 5. Build guild structures
The **🏗️ GUILD** tab has buildings that multiply your entire army's stats or income.

### 6. Battle through stages
Press **⚔️ START BATTLE** to enter combat. Your heroes fight 5 waves of monsters per stage. Wave 5 contains a boss. Clear all 5 waves to earn a completion bonus.

### 7. Unlock new stages
Use the **🗺️ STAGES** tab to spend coins unlocking new areas with better rewards and tougher monsters.

### 8. Prestige
After earning 1B coins and reaching Level 25, unlock the **💎 RESET** tab. Prestiging resets your kingdom for permanent Lily Gems (+5% idle income each).

### 9. See other players
Click the **👥 PLAYERS** tab to see who else is online. Their level, coins, current stage, and battle status are shown live.

---

## ☁️ Deployment

### Deploying to Render (recommended)

**1. Push to GitHub**

```powershell
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourname/frog-empire.git
git push -u origin main
```

⚠️ Make sure `.env` is in `.gitignore` before pushing!

**2. Create a Web Service on Render**

- Go to [render.com](https://render.com) → **New** → **Web Service**
- Connect your GitHub repo
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** Node

**3. Add environment variables**

In Render's dashboard, add:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`

**4. Deploy**

Render will build and give you a public URL like `https://frog-empire.onrender.com`.

### Other platforms

- **Railway** — `railway up`
- **Fly.io** — `fly launch`
- **Heroku** — `git push heroku main`
- **VPS (DigitalOcean, Linode)** — use `pm2` + nginx

---

## 🐛 Troubleshooting

### `Cannot find module 'server.js'`
You're in the wrong folder. Run `cd "C:\Users\KFL IT\game"` first.

### `Cannot find module 'express'`
Dependencies not installed. Run `npm install`.

### `TURSO_DATABASE_URL is not defined`
Your `.env` file is missing or in the wrong folder. It must be in the project root (same folder as `server.js`).

### `Invalid or expired token`
Your JWT expired (30 days) or `JWT_SECRET` changed. Log out and log in again.

### `EADDRINUSE :::3000`
Port 3000 is already in use. Either:
- Kill the other process: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process`
- Or change `PORT` in `.env` to `3001`

### Player list shows no players
- Make sure the server is running and connected to Turso
- Open the game in two browser windows and register two accounts
- Wait up to 60 seconds for a heartbeat to register

### Login screen shows "Cannot reach server"
You're opening `index.html` directly instead of going through the server. Always access the game at `http://localhost:3000` (not `file://...`).

### Turso connection errors
- Verify your `.env` values are correct
- Check that your Turso database exists: `turso db list`
- Regenerate token if needed: `turso db tokens create frog-empire`

---

## 🔒 Security Notes

- **Passwords** are hashed with bcrypt (10 rounds). Never stored in plaintext.
- **JWT tokens** are signed and expire after 30 days.
- **`.env` is never committed** — add it to `.gitignore`:
  ```
  node_modules/
  .env
  *.db
  *.db-wal
  *.db-shm
  ```
- **Production checklist:**
  - Use HTTPS (via Render/Railway or nginx + Let's Encrypt)
  - Set a strong `JWT_SECRET`
  - Add rate limiting (`express-rate-limit`) to `/api/login` and `/api/register`
  - Enable CORS restrictions if hosting frontend separately
  - Monitor Turso usage limits (free tier: 9GB storage, 1B row reads/month)

---

## 🧪 Development Tips

### Auto-restart on file changes

Install nodemon:
```powershell
npm install --save-dev nodemon
```

Update `package.json`:
```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

Run:
```powershell
npm run dev
```

### Reset your database

Delete all users and saves (destructive):
```powershell
turso db shell frog-empire
```
Then in the shell:
```sql
DELETE FROM saves;
DELETE FROM users;
.quit
```

### Inspect data

```powershell
turso db shell frog-empire
```

```sql
SELECT id, username, last_seen FROM users;
SELECT user_id, updated_at FROM saves;
```

---

## 🗺 Roadmap

Possible future features:

- [ ] WebSocket real-time updates (replace polling)
- [ ] Player profiles with click-to-view
- [ ] Global chat
- [ ] Friend system
- [ ] Leaderboards (top by coins, level, stage)
- [ ] PvP battles between players
- [ ] Guild system with shared bonuses
- [ ] Achievements
- [ ] Daily rewards
- [ ] Mobile app (Capacitor / React Native)

---

## 📄 License

MIT License — free to use, modify, and distribute. Attribution appreciated but not required.

```
Copyright (c) 2024 Frog Empire

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Credits

- **Game design & code** — Built as an idle RPG demonstration
- **Pixel art** — Drawn procedurally on HTML5 Canvas
- **Backend** — Express + Turso + JWT
- **Icons** — Unicode emoji (no external assets)

---

**Happy idling! 🐸⚔️💰**
```

## Quick Install Command

If you want to create it quickly via PowerShell, paste this into your project folder:

```powershell
@'
# 🐸 Frog Empire: Idle Kingdom

An idle RPG with multiplayer presence and cloud saves.

## Quick Start

1. Install: `npm install`
2. Create `.env` with Turso credentials
3. Run: `npm start`
4. Open: http://localhost:3000

See full documentation below.
'@ | Out-File -Encoding utf8 README.md
```