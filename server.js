require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@libsql/client");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

// =====================
// TURSO DATABASE SETUP
// =====================
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_login INTEGER,
      last_seen INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS saves (
      user_id INTEGER PRIMARY KEY,
      save_data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Safe migration: add last_seen if missing (for existing databases)
  try {
    await db.execute(`ALTER TABLE users ADD COLUMN last_seen INTEGER`);
  } catch (e) {
    // Column already exists — ignore
  }

  console.log("Database tables ready");
}

// =====================
// MIDDLEWARE
// =====================
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId = payload.id;
    req.username = payload.username;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function makeToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "30d",
  });
}

// =====================
// AUTH ROUTES
// =====================
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body || {};

  if (
    !username ||
    typeof username !== "string" ||
    username.length < 3 ||
    username.length > 16
  ) {
    return res.status(400).json({ error: "Username must be 3-16 characters" });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res
      .status(400)
      .json({ error: "Only letters, numbers, and _ allowed" });
  }
  if (!password || typeof password !== "string" || password.length < 4) {
    return res
      .status(400)
      .json({ error: "Password must be at least 4 characters" });
  }

  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE username = ?",
    args: [username],
  });

  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "Username already taken" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();

  const result = await db.execute({
    sql: "INSERT INTO users (username, password_hash, created_at, last_login, last_seen) VALUES (?, ?, ?, ?, ?)",
    args: [username, passwordHash, now, now, now],
  });

  const user = { id: Number(result.lastInsertRowid), username };
  const token = makeToken(user);

  res.json({ token, username: user.username });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [username],
  });

  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  await db.execute({
    sql: "UPDATE users SET last_login = ?, last_seen = ? WHERE id = ?",
    args: [Date.now(), Date.now(), user.id],
  });

  const token = makeToken({ id: user.id, username: user.username });
  res.json({ token, username: user.username });
});

// =====================
// PRESENCE ROUTES
// =====================
// Heartbeat — marks the player as online
app.post("/api/heartbeat", authMiddleware, async (req, res) => {
  await db.execute({
    sql: "UPDATE users SET last_seen = ? WHERE id = ?",
    args: [Date.now(), req.userId],
  });
  res.json({ ok: true });
});

// List all players with online/offline status
app.get("/api/players", authMiddleware, async (req, res) => {
  const result = await db.execute({
    sql: `
      SELECT u.id, u.username, u.last_seen, u.created_at,
             s.save_data
      FROM users u
      LEFT JOIN saves s ON s.user_id = u.id
      ORDER BY u.last_seen DESC
      LIMIT 100
    `,
    args: [],
  });

  const ONLINE_WINDOW_MS = 60 * 1000; // 60 seconds = online
  const now = Date.now();

  const players = result.rows.map((row) => {
    let level = 1;
    let coins = 0;
    let stage = 0;
    let battleActive = false;

    if (row.save_data) {
      try {
        const save = JSON.parse(row.save_data);
        level = save.level || 1;
        coins = save.coins || 0;
        stage = save.stage || 0;
        battleActive = !!save.battleActive;
      } catch (e) {
        /* ignore */
      }
    }

    return {
      id: row.id,
      username: row.username,
      level,
      coins,
      stage,
      battleActive,
      lastSeen: row.last_seen || row.created_at,
      online: row.last_seen && now - row.last_seen < ONLINE_WINDOW_MS,
      isMe: row.id === req.userId,
    };
  });

  // Sort: online first, then by last_seen
  players.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return b.lastSeen - a.lastSeen;
  });

  res.json({ players });
});

// =====================
// SAVE ROUTES
// =====================
app.get("/api/save", authMiddleware, async (req, res) => {
  const result = await db.execute({
    sql: "SELECT save_data, updated_at FROM saves WHERE user_id = ?",
    args: [req.userId],
  });

  if (result.rows.length === 0) {
    return res.json({ save: null });
  }

  const row = result.rows[0];
  res.json({ save: JSON.parse(row.save_data), updatedAt: row.updated_at });
});

app.post("/api/save", authMiddleware, async (req, res) => {
  const { save } = req.body || {};
  if (!save || typeof save !== "object") {
    return res.status(400).json({ error: "Invalid save data" });
  }

  const now = Date.now();
  await db.execute({
    sql: `
      INSERT INTO saves (user_id, save_data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        save_data = excluded.save_data,
        updated_at = excluded.updated_at
    `,
    args: [req.userId, JSON.stringify(save), now],
  });

  // Also bump last_seen on save
  await db.execute({
    sql: "UPDATE users SET last_seen = ? WHERE id = ?",
    args: [now, req.userId],
  });

  res.json({ ok: true, updatedAt: now });
});

app.delete("/api/save", authMiddleware, async (req, res) => {
  await db.execute({
    sql: "DELETE FROM saves WHERE user_id = ?",
    args: [req.userId],
  });
  res.json({ ok: true });
});

// =====================
// START
// =====================
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🐸 Frog Empire running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
