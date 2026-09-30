/* =====================================================================
   FROG EMPIRE: IDLE KINGDOM — Idle-First RPG Edition
   With Login System
   ===================================================================== */

let heartbeatInterval = null;
let playersRefreshInterval = null;

const $ = (id) => document.getElementById(id);
const fmt = (n) => {
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0);
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) {
    n /= 1000;
    u++;
  }
  return n.toFixed(2) + units[u];
};
const now = () => Date.now();
const rand = (a, b) => a + Math.random() * (b - a);
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

// =====================================================================
// AUTH SYSTEM (server-backed)
// =====================================================================
const API_BASE = ""; // same origin; set to 'http://localhost:3000' if hosting frontend separately
const TOKEN_KEY = "frog_empire_token";
const USERNAME_KEY = "frog_empire_username";

let currentUser = null;
let authToken = null;
let authMode = "login";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + authToken,
  };
}

function showAuthError(msg) {
  $("auth-error").textContent = msg || "";
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".auth-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.auth === mode);
  });
  if (mode === "login") {
    $("auth-submit").textContent = "LOGIN";
    $("auth-switch-text").textContent = "No account?";
    $("auth-switch-link").textContent = "Register";
  } else {
    $("auth-submit").textContent = "CREATE ACCOUNT";
    $("auth-switch-text").textContent = "Already have an account?";
    $("auth-switch-link").textContent = "Login";
  }
  showAuthError("");
}

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.onclick = () => setAuthMode(tab.dataset.auth);
});

$("auth-switch-link").onclick = (e) => {
  e.preventDefault();
  setAuthMode(authMode === "login" ? "register" : "login");
};

async function doAuth() {
  const username = $("username").value.trim();
  const password = $("password").value;

  if (!username || username.length < 3) {
    showAuthError("Username must be at least 3 characters");
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showAuthError("Only letters, numbers, and _ allowed");
    return;
  }
  if (!password || password.length < 4) {
    showAuthError("Password must be at least 4 characters");
    return;
  }

  const endpoint = authMode === "register" ? "/api/register" : "/api/login";
  $("auth-submit").disabled = true;
  $("auth-submit").textContent =
    authMode === "register" ? "CREATING…" : "LOGGING IN…";
  showAuthError("");

  try {
    const res = await fetch(API_BASE + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showAuthError(data.error || "Something went wrong");
      return;
    }

    authToken = data.token;
    currentUser = data.username;
    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USERNAME_KEY, currentUser);

    $("auth-screen").style.display = "none";
    $("game").style.display = "grid";
    $("username-display").textContent = currentUser;
    startPresence();

    await bootGame();
  } catch (err) {
    showAuthError("Cannot reach server. Is it running?");
    console.error(err);
  } finally {
    $("auth-submit").disabled = false;
    setAuthMode(authMode);
  }
}

$("auth-submit").onclick = doAuth;
$("password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doAuth();
});
$("username").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("password").focus();
});

function logout() {
  if (!confirm("Logout? Your progress is saved on the server.")) return;
  save().finally(() => {
    stopPresence();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    authToken = null;
    currentUser = null;
    $("auth-screen").style.display = "flex";
    $("game").style.display = "none";
    $("username").value = "";
    $("password").value = "";
    showAuthError("");
    setAuthMode("login");
  });
}

$("logoutBtn").onclick = logout;

// =====================================================================
// HERO CLASS DATA
// =====================================================================
const HERO_CLASSES = {
  novice: {
    name: "Novice",
    icon: "🗡️",
    desc: "Balanced beginner.",
    baseCost: 25,
    costMult: 1.15,
    hp: 40,
    atk: 5,
    atkSpeed: 1.0,
    range: 60,
    color: "#8fc47a",
    accent: "#5a9a5a",
    weapon: "sword",
    idleCPS: 0.5,
  },
  swordsman: {
    name: "Swordsman",
    icon: "⚔️",
    desc: "Tanky melee bruiser.",
    baseCost: 250,
    costMult: 1.16,
    hp: 90,
    atk: 11,
    atkSpeed: 1.0,
    range: 65,
    color: "#c4a04a",
    accent: "#8a6a2a",
    weapon: "sword",
    idleCPS: 4,
  },
  mage: {
    name: "Mage",
    icon: "🔮",
    desc: "Ranged AoE caster.",
    baseCost: 2500,
    costMult: 1.17,
    hp: 45,
    atk: 26,
    atkSpeed: 0.6,
    range: 180,
    color: "#6a8ac4",
    accent: "#4a5a9a",
    weapon: "staff",
    idleCPS: 32,
  },
  archer: {
    name: "Archer",
    icon: "🏹",
    desc: "Fast ranged attacker.",
    baseCost: 25000,
    costMult: 1.17,
    hp: 55,
    atk: 16,
    atkSpeed: 1.8,
    range: 200,
    color: "#8ac46a",
    accent: "#5a8a3a",
    weapon: "bow",
    idleCPS: 240,
  },
  priest: {
    name: "Priest",
    icon: "✨",
    desc: "Heals allies, smites foes.",
    baseCost: 250000,
    costMult: 1.18,
    hp: 70,
    atk: 22,
    atkSpeed: 0.9,
    range: 150,
    color: "#e8e8a0",
    accent: "#aaba6a",
    weapon: "staff",
    idleCPS: 1800,
  },
  knight: {
    name: "Knight",
    icon: "🛡️",
    desc: "Heavy armor, heavy swings.",
    baseCost: 2500000,
    costMult: 1.18,
    hp: 220,
    atk: 48,
    atkSpeed: 0.8,
    range: 70,
    color: "#c46a4a",
    accent: "#8a3a2a",
    weapon: "sword",
    idleCPS: 14000,
  },
  assassin: {
    name: "Assassin",
    icon: "🗡️",
    desc: "Extreme single-target DPS.",
    baseCost: 25000000,
    costMult: 1.19,
    hp: 110,
    atk: 62,
    atkSpeed: 2.2,
    range: 90,
    color: "#8a4a8a",
    accent: "#4a2a4a",
    weapon: "dagger",
    idleCPS: 110000,
  },
  lordknight: {
    name: "Lord Knight",
    icon: "👑",
    desc: "Legendary frontliner.",
    baseCost: 250000000,
    costMult: 1.2,
    hp: 500,
    atk: 125,
    atkSpeed: 0.9,
    range: 80,
    color: "#ffd24a",
    accent: "#aaba2a",
    weapon: "sword",
    idleCPS: 900000,
  },
  highwizard: {
    name: "High Wizard",
    icon: "🌌",
    desc: "Cataclysmic magic.",
    baseCost: 5000000000,
    costMult: 1.22,
    hp: 160,
    atk: 360,
    atkSpeed: 0.7,
    range: 220,
    color: "#6a4ac4",
    accent: "#3a2a8a",
    weapon: "staff",
    idleCPS: 8000000,
  },
};

// =====================================================================
// MONSTERS
// =====================================================================
const MONSTERS = {
  slime: {
    name: "Slime",
    hp: 25,
    atk: 3,
    atkSpeed: 0.8,
    color: "#5aaa5a",
    accent: "#2a6a2a",
    size: 22,
    reward: 10,
    shape: "blob",
  },
  bat: {
    name: "Bat",
    hp: 18,
    atk: 4,
    atkSpeed: 1.4,
    color: "#4a3a5a",
    accent: "#2a1a3a",
    size: 20,
    reward: 15,
    shape: "bat",
    flying: true,
  },
  goblin: {
    name: "Goblin",
    hp: 55,
    atk: 7,
    atkSpeed: 1.0,
    color: "#6a8a3a",
    accent: "#3a5a1a",
    size: 24,
    reward: 30,
    shape: "humanoid",
  },
  skeleton: {
    name: "Skeleton",
    hp: 90,
    atk: 11,
    atkSpeed: 1.0,
    color: "#e8e8d0",
    accent: "#aaba9a",
    size: 26,
    reward: 60,
    shape: "humanoid",
  },
  orc: {
    name: "Orc",
    hp: 180,
    atk: 18,
    atkSpeed: 0.8,
    color: "#4a6a2a",
    accent: "#2a4a1a",
    size: 30,
    reward: 120,
    shape: "humanoid",
  },
  wolf: {
    name: "Dire Wolf",
    hp: 150,
    atk: 24,
    atkSpeed: 1.6,
    color: "#5a5a6a",
    accent: "#2a2a3a",
    size: 30,
    reward: 180,
    shape: "wolf",
  },
  golem: {
    name: "Stone Golem",
    hp: 500,
    atk: 30,
    atkSpeed: 0.6,
    color: "#7a6a5a",
    accent: "#4a3a2a",
    size: 38,
    reward: 400,
    shape: "golem",
  },
  wraith: {
    name: "Wraith",
    hp: 350,
    atk: 42,
    atkSpeed: 1.2,
    color: "#3a3a5a",
    accent: "#1a1a3a",
    size: 32,
    reward: 550,
    shape: "ghost",
    flying: true,
  },
  ogre: {
    name: "Ogre",
    hp: 900,
    atk: 55,
    atkSpeed: 0.7,
    color: "#8a5a3a",
    accent: "#5a3a1a",
    size: 44,
    reward: 1200,
    shape: "humanoid",
  },
  demon: {
    name: "Demon",
    hp: 1600,
    atk: 80,
    atkSpeed: 1.1,
    color: "#8a2a2a",
    accent: "#4a0a0a",
    size: 42,
    reward: 2400,
    shape: "demon",
  },
  dragonling: {
    name: "Dragonling",
    hp: 3200,
    atk: 120,
    atkSpeed: 0.9,
    color: "#c44a3a",
    accent: "#6a1a1a",
    size: 48,
    reward: 5000,
    shape: "dragon",
  },
  lich: {
    name: "Lich",
    hp: 6000,
    atk: 180,
    atkSpeed: 1.0,
    color: "#4a2a6a",
    accent: "#2a0a4a",
    size: 46,
    reward: 10000,
    shape: "ghost",
  },
  minotaur: {
    name: "Minotaur",
    hp: 12000,
    atk: 280,
    atkSpeed: 0.8,
    color: "#6a4a2a",
    accent: "#3a2a1a",
    size: 52,
    reward: 20000,
    shape: "humanoid",
  },
  reaper: {
    name: "Reaper",
    hp: 25000,
    atk: 480,
    atkSpeed: 1.3,
    color: "#1a1a2a",
    accent: "#0a0a1a",
    size: 50,
    reward: 40000,
    shape: "ghost",
  },
  ragnarok: {
    name: "Ragnarok Beast",
    hp: 60000,
    atk: 900,
    atkSpeed: 1.0,
    color: "#aa2a2a",
    accent: "#5a0a0a",
    size: 64,
    reward: 90000,
    shape: "dragon",
  },
};

// =====================================================================
// STAGES
// =====================================================================
const STAGES = [
  {
    name: "Muddy Marsh",
    icon: "🌾",
    bg: "#1a2a1a",
    ground: "#2a4a2a",
    monsters: ["slime", "bat", "goblin"],
    boss: "golem",
    unlockCost: 0,
    rewardMult: 1,
  },
  {
    name: "Whispering Woods",
    icon: "🌲",
    bg: "#0a1a0a",
    ground: "#1a3a1a",
    monsters: ["goblin", "skeleton", "wolf"],
    boss: "ogre",
    unlockCost: 5000,
    rewardMult: 3,
  },
  {
    name: "Sunken Ruins",
    icon: "🏛️",
    bg: "#0a1a2a",
    ground: "#1a2a4a",
    monsters: ["skeleton", "wraith", "golem"],
    boss: "demon",
    unlockCost: 250000,
    rewardMult: 10,
  },
  {
    name: "Volcanic Bog",
    icon: "🌋",
    bg: "#2a0a0a",
    ground: "#4a1a1a",
    monsters: ["orc", "wraith", "demon"],
    boss: "dragonling",
    unlockCost: 25000000,
    rewardMult: 30,
  },
  {
    name: "Ragnarok Peaks",
    icon: "⛰️",
    bg: "#1a1a2a",
    ground: "#3a3a5a",
    monsters: ["demon", "lich", "minotaur"],
    boss: "ragnarok",
    unlockCost: 5000000000,
    rewardMult: 100,
  },
];

// =====================================================================
// BUILDINGS
// =====================================================================
const BUILDINGS = {
  barracks: {
    name: "Barracks",
    icon: "🏰",
    desc: "+12% hero HP",
    baseCost: 500,
    costMult: 1.5,
    effect: { type: "hp", mult: 0.12 },
  },
  forge: {
    name: "Forge",
    icon: "🔨",
    desc: "+12% hero ATK",
    baseCost: 1000,
    costMult: 1.5,
    effect: { type: "atk", mult: 0.12 },
  },
  archery: {
    name: "Archery Range",
    icon: "🎯",
    desc: "+8% hero attack speed",
    baseCost: 5000,
    costMult: 1.6,
    effect: { type: "speed", mult: 0.08 },
  },
  vault: {
    name: "Coin Vault",
    icon: "🏦",
    desc: "+10% offline earnings",
    baseCost: 10000,
    costMult: 1.5,
    effect: { type: "offline", mult: 0.1 },
  },
  shrine: {
    name: "Ancient Shrine",
    icon: "🗿",
    desc: "+15% battle rewards",
    baseCost: 100000,
    costMult: 1.7,
    effect: { type: "reward", mult: 0.15 },
  },
  market: {
    name: "Grand Market",
    icon: "🏪",
    desc: "+25% idle income",
    baseCost: 25000,
    costMult: 1.6,
    effect: { type: "idle", mult: 0.25 },
  },
  guildhall: {
    name: "Guild Hall",
    icon: "🏛️",
    desc: "+20% all hero stats",
    baseCost: 5000000,
    costMult: 1.8,
    effect: { type: "global", mult: 0.2 },
  },
};

// =====================================================================
// EQUIPMENT
// =====================================================================
const EQUIPMENT = {
  wooden_sword: {
    name: "Wooden Sword",
    icon: "🗡️",
    slot: "weapon",
    cost: 100,
    reqStage: 0,
    atk: 0.1,
    desc: "+10% ATK",
  },
  iron_sword: {
    name: "Iron Sword",
    icon: "⚔️",
    slot: "weapon",
    cost: 5000,
    reqStage: 1,
    atk: 0.25,
    desc: "+25% ATK",
  },
  steel_blade: {
    name: "Steel Blade",
    icon: "🔪",
    slot: "weapon",
    cost: 250000,
    reqStage: 2,
    atk: 0.5,
    desc: "+50% ATK",
  },
  dragon_slayer: {
    name: "Dragon Slayer",
    icon: "🐉",
    slot: "weapon",
    cost: 25000000,
    reqStage: 3,
    atk: 1.0,
    desc: "+100% ATK",
  },
  ragnarok_blade: {
    name: "Ragnarok Blade",
    icon: "🌟",
    slot: "weapon",
    cost: 5000000000,
    reqStage: 4,
    atk: 2.0,
    desc: "+200% ATK",
  },

  cloth_tunic: {
    name: "Cloth Tunic",
    icon: "👕",
    slot: "armor",
    cost: 80,
    reqStage: 0,
    hp: 0.1,
    desc: "+10% HP",
  },
  leather_armor: {
    name: "Leather Armor",
    icon: "🥋",
    slot: "armor",
    cost: 4000,
    reqStage: 1,
    hp: 0.25,
    desc: "+25% HP",
  },
  chainmail: {
    name: "Chainmail",
    icon: "🛡️",
    slot: "armor",
    cost: 200000,
    reqStage: 2,
    hp: 0.5,
    desc: "+50% HP",
  },
  dragon_scale: {
    name: "Dragon Scale",
    icon: "🐲",
    slot: "armor",
    cost: 20000000,
    reqStage: 3,
    hp: 1.0,
    desc: "+100% HP",
  },
  aegis_plate: {
    name: "Aegis Plate",
    icon: "💠",
    slot: "armor",
    cost: 4000000000,
    reqStage: 4,
    hp: 2.0,
    desc: "+200% HP",
  },

  sandals: {
    name: "Leather Sandals",
    icon: "👡",
    slot: "boots",
    cost: 150,
    reqStage: 0,
    speed: 0.05,
    desc: "+5% ATK SPD",
  },
  boots: {
    name: "Swift Boots",
    icon: "👢",
    slot: "boots",
    cost: 8000,
    reqStage: 1,
    speed: 0.15,
    desc: "+15% ATK SPD",
  },
  winged_boots: {
    name: "Winged Boots",
    icon: "🪽",
    slot: "boots",
    cost: 500000,
    reqStage: 2,
    speed: 0.3,
    desc: "+30% ATK SPD",
  },
  hermes_boots: {
    name: "Hermes Boots",
    icon: "⚡",
    slot: "boots",
    cost: 50000000,
    reqStage: 3,
    speed: 0.6,
    desc: "+60% ATK SPD",
  },

  coin_purse: {
    name: "Coin Purse",
    icon: "👛",
    slot: "acc",
    cost: 500,
    reqStage: 0,
    idle: 0.15,
    desc: "+15% idle income",
  },
  merchants_ring: {
    name: "Merchant's Ring",
    icon: "💍",
    slot: "acc",
    cost: 25000,
    reqStage: 1,
    idle: 0.35,
    desc: "+35% idle income",
  },
  gold_amulet: {
    name: "Gold Amulet",
    icon: "📿",
    slot: "acc",
    cost: 1000000,
    reqStage: 2,
    idle: 0.75,
    desc: "+75% idle income",
  },
  midas_crown: {
    name: "Midas Crown",
    icon: "👑",
    slot: "acc",
    cost: 100000000,
    reqStage: 3,
    idle: 1.5,
    desc: "+150% idle income",
  },
};

// =====================================================================
// STATE
// =====================================================================
const state = {
  coins: 0,
  totalEarned: 0,
  gems: 0,
  level: 1,
  xp: 0,
  xpNeeded: 100,
  lastSave: now(),
  stage: 0,
  wave: 1,
  unlockedStages: [0],
  heroes: {},
  buildings: {},
  equipment: {},
  kills: 0,
  startTime: now(),
  battleActive: false,
  version: 3,
};

function resetState() {
  state.coins = 0;
  state.totalEarned = 0;
  state.gems = 0;
  state.level = 1;
  state.xp = 0;
  state.xpNeeded = 100;
  state.lastSave = now();
  state.stage = 0;
  state.wave = 1;
  state.unlockedStages = [0];
  state.heroes = {};
  state.buildings = {};
  state.equipment = {};
  state.kills = 0;
  state.startTime = now();
  state.battleActive = false;

  for (const k in HERO_CLASSES) state.heroes[k] = 0;
  for (const k in BUILDINGS) state.buildings[k] = 0;
  for (const k in EQUIPMENT) state.equipment[k] = false;
}

resetState();

// =====================================================================
// ECONOMY / STATS
// =====================================================================
function heroCost(classId) {
  const c = HERO_CLASSES[classId];
  return Math.floor(c.baseCost * Math.pow(c.costMult, state.heroes[classId]));
}
function buildingCost(id) {
  const b = BUILDINGS[id];
  return Math.floor(b.baseCost * Math.pow(b.costMult, state.buildings[id]));
}
function getBuildingEffect(type) {
  let total = 0;
  for (const id in state.buildings) {
    const lvl = state.buildings[id];
    if (lvl > 0 && BUILDINGS[id].effect.type === type) {
      total += BUILDINGS[id].effect.mult * lvl;
    }
  }
  return total;
}
function getEquipmentEffect(slot, stat) {
  let total = 0;
  for (const id in state.equipment) {
    if (!state.equipment[id]) continue;
    const eq = EQUIPMENT[id];
    if (eq.slot === slot && eq[stat]) total += eq[stat];
  }
  return total;
}
function getHeroStats(classId) {
  const base = HERO_CLASSES[classId];
  const globalMult = 1 + getBuildingEffect("global");

  const hpFromEq = getEquipmentEffect("armor", "hp");
  const atkFromEq = getEquipmentEffect("weapon", "atk");
  const spdFromEq = getEquipmentEffect("boots", "speed");

  const hpMult = (1 + getBuildingEffect("hp")) * globalMult * (1 + hpFromEq);
  const atkMult = (1 + getBuildingEffect("atk")) * globalMult * (1 + atkFromEq);
  const speedMult =
    (1 + getBuildingEffect("speed")) * globalMult * (1 + spdFromEq);

  return {
    maxHp: base.hp * hpMult,
    atk: base.atk * atkMult,
    atkSpeed: base.atkSpeed * speedMult,
    range: base.range,
  };
}
function getRewardMult() {
  return (1 + getBuildingEffect("reward")) * (1 + state.stage * 0.5);
}
function getIdleCPS() {
  let cps = 0;
  for (const id in state.heroes) {
    const n = state.heroes[id];
    if (!n) continue;
    cps += HERO_CLASSES[id].idleCPS * n;
  }
  const mult =
    (1 + getBuildingEffect("idle")) * (1 + getEquipmentEffect("acc", "idle"));
  const levelMult = 1 + (state.level - 1) * 0.02;
  return cps * mult * levelMult;
}

// =====================================================================
// XP / LEVELING
// =====================================================================
function addXP(amount) {
  state.xp += amount;
  while (state.xp >= state.xpNeeded) {
    state.xp -= state.xpNeeded;
    state.level++;
    state.xpNeeded = Math.floor(100 * Math.pow(1.4, state.level - 1));
    notify(`⭐ Kingdom Level ${state.level}!`);
    render();
  }
}

// =====================================================================
// HIRE / BUILD / BUY
// =====================================================================
function hireHero(classId) {
  const cost = heroCost(classId);
  if (state.coins < cost) return;
  state.coins -= cost;
  state.heroes[classId]++;
  addXP(3);
  pulseStat("stat-coins");
  render();
}

function buyBuilding(id) {
  const cost = buildingCost(id);
  if (state.coins < cost) return;
  state.coins -= cost;
  state.buildings[id]++;
  addXP(8);
  pulseStat("stat-coins");
  render();
}

function buyEquipment(id) {
  const eq = EQUIPMENT[id];
  if (state.equipment[id]) return;
  if (state.coins < eq.cost) return;
  if (state.unlockedStages.length <= eq.reqStage) return;
  state.coins -= eq.cost;
  state.equipment[id] = true;
  addXP(15);
  notify(`🛡️ Equipped ${eq.name}!`);
  pulseStat("stat-coins");
  render();
}

function unlockStage(idx) {
  const st = STAGES[idx];
  if (state.unlockedStages.includes(idx)) {
    state.stage = idx;
    state.wave = 1;
    updateStageLabel();
    render();
    return;
  }
  if (state.coins < st.unlockCost) return;
  state.coins -= st.unlockCost;
  state.unlockedStages.push(idx);
  state.stage = idx;
  state.wave = 1;
  updateStageLabel();
  notify(`${st.icon} Unlocked ${st.name}!`);
  pulseStat("stat-coins");
  render();
}

function updateStageLabel() {
  const st = STAGES[state.stage];
  const mode = state.battleActive ? "Battle" : "Idle";
  $("stage-label").textContent = `${st.icon} ${st.name} — ${mode} Mode`;
}

// =====================================================================
// COMBAT
// =====================================================================
const canvas = $("scene");
const ctx = canvas.getContext("2d");
let animTime = 0;
let activeHeroes = [];
let activeMonsters = [];
let waveClearTimer = 0;
let monsterSpawnTimer = 0;

function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width;
  canvas.height = r.height;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resizeCanvas);

function spawnHero(classId) {
  const s = getHeroStats(classId);
  const groundY = canvas.height * 0.78;
  const hero = {
    classId,
    x: rand(60, canvas.width * 0.35),
    y: groundY + rand(-8, 8),
    homeX: 0,
    hp: s.maxHp,
    maxHp: s.maxHp,
    atk: s.atk,
    atkSpeed: s.atkSpeed,
    range: s.range,
    cooldown: rand(0, 1),
    frame: rand(0, 30),
    facing: 1,
    state: "idle",
    bobPhase: rand(0, Math.PI * 2),
  };
  hero.homeX = hero.x;
  activeHeroes.push(hero);
  return hero;
}

function spawnMonster(type) {
  const m = MONSTERS[type];
  const stageMult = 1 + state.stage * 0.6;
  const groundY = canvas.height * 0.78;
  const monster = {
    type,
    x: canvas.width + 40,
    y: groundY + (m.flying ? -30 : rand(-6, 10)),
    hp: m.hp * stageMult,
    maxHp: m.hp * stageMult,
    atk: m.atk * stageMult,
    atkSpeed: m.atkSpeed,
    reward: m.reward * getRewardMult(),
    cooldown: rand(0.3, 1.5),
    frame: 0,
    facing: -1,
    state: "walk",
    hitFlash: 0,
    dead: false,
    deathTimer: 0,
  };
  activeMonsters.push(monster);
  return monster;
}

function startBattle() {
  if (state.battleActive) return;
  state.battleActive = true;
  state.wave = 1;
  state.activeMonsters = [];
  activeMonsters = [];
  waveClearTimer = 0;
  monsterSpawnTimer = 0;

  activeHeroes = [];
  for (const id in state.heroes) {
    for (let i = 0; i < state.heroes[id]; i++) spawnHero(id);
  }

  $("battle-cta").classList.add("hidden");
  $("retreat-btn").style.display = "block";
  updateStageLabel();
  notify("⚔️ Battle started!");
  render();
}

function retreatBattle() {
  if (!state.battleActive) return;
  if (!confirm("Retreat from battle? You will return to idle mode.")) return;
  state.battleActive = false;
  activeMonsters = [];
  state.activeMonsters = [];
  $("battle-cta").classList.remove("hidden");
  $("retreat-btn").style.display = "none";
  $("monster-hp").style.display = "none";
  $("wave-info").style.display = "none";
  updateStageLabel();
  notify("🏳️ Retreated to idle");
  render();
}

function updateCombat(dt) {
  if (!state.battleActive) return;

  monsterSpawnTimer += dt;
  const alive = activeMonsters.filter((m) => !m.dead);
  const st = STAGES[state.stage];
  const isBossWave = state.wave === 5;

  if (monsterSpawnTimer >= 2.5 && alive.length < 4) {
    monsterSpawnTimer = 0;
    if (isBossWave && alive.length === 0) {
      spawnMonster(st.boss);
      notify(`⚠️ BOSS: ${MONSTERS[st.boss].name}!`);
    } else if (!isBossWave) {
      spawnMonster(choice(st.monsters));
    }
  }

  for (const h of activeHeroes) {
    if (h.hp <= 0) continue;
    h.cooldown -= dt;
    h.frame++;

    let target = null,
      dist = Infinity;
    for (const m of activeMonsters) {
      if (m.dead) continue;
      const d = m.x - h.x;
      if (d > 0 && d < dist) {
        dist = d;
        target = m;
      }
    }

    if (target) {
      if (dist <= h.range) {
        h.state = "attack";
        h.facing = 1;
        if (h.cooldown <= 0) {
          h.cooldown = 1 / h.atkSpeed;
          const crit = Math.random() < 0.15;
          const dmg = h.atk * (crit ? 2 : 1);
          target.hp -= dmg;
          target.hitFlash = 0.12;
          spawnFloater(
            target.x,
            target.y - 30,
            (crit ? "★" : "") + Math.floor(dmg),
            crit ? "crit" : "dmg",
          );
          if (target.hp <= 0 && !target.dead) {
            target.dead = true;
            target.deathTimer = 0.6;
            const reward = target.reward;
            state.coins += reward;
            state.totalEarned += reward;
            state.kills++;
            addXP(3);
            spawnFloater(target.x, target.y - 45, "+" + fmt(reward), "coin");
            pulseStat("stat-coins");
          }
        }
      } else {
        h.state = "walk";
        h.facing = 1;
        h.x += 45 * dt;
      }
    } else {
      h.state = "idle";
      if (h.x > h.homeX) h.x -= 30 * dt;
      else h.x = h.homeX;
    }
  }

  for (const m of activeMonsters) {
    if (m.dead) {
      m.deathTimer -= dt;
      m.frame++;
      continue;
    }
    m.cooldown -= dt;
    m.frame++;
    if (m.hitFlash > 0) m.hitFlash -= dt;

    let target = null,
      dist = Infinity;
    for (const h of activeHeroes) {
      if (h.hp <= 0) continue;
      const d = h.x - m.x;
      if (d < 0 && Math.abs(d) < dist) {
        dist = Math.abs(d);
        target = h;
      }
    }

    if (target && dist < 55) {
      m.state = "attack";
      if (m.cooldown <= 0) {
        m.cooldown = 1 / m.atkSpeed;
        target.hp -= m.atk;
        spawnFloater(target.x, target.y - 30, "-" + Math.floor(m.atk), "dmg");
        if (target.hp <= 0) {
          target.hp = 0;
          setTimeout(() => {
            const i = activeHeroes.indexOf(target);
            if (i >= 0) activeHeroes.splice(i, 1);
          }, 500);
        }
      }
    } else {
      m.state = "walk";
      m.x -= 35 * dt;
    }
  }

  activeMonsters = activeMonsters.filter((m) => !(m.dead && m.deathTimer <= 0));
  state.activeMonsters = activeMonsters;

  const stillAlive = activeMonsters.filter((m) => !m.dead);
  const heroesLeft = activeHeroes.filter((h) => h.hp > 0);
  if (stillAlive.length === 0 && heroesLeft.length > 0) {
    waveClearTimer += dt;
    if (waveClearTimer > 2.0) {
      waveClearTimer = 0;
      if (state.wave >= 5) {
        const bonus = 200 * STAGES[state.stage].rewardMult * getRewardMult();
        state.coins += bonus;
        state.totalEarned += bonus;
        notify(`🎉 Stage cleared! +${fmt(bonus)}`);
        addXP(150);
        state.wave = 1;
        state.battleActive = false;
        activeMonsters = [];
        $("battle-cta").classList.remove("hidden");
        $("retreat-btn").style.display = "none";
        updateStageLabel();
        render();
      } else {
        state.wave++;
        notify(`Wave ${state.wave}/5`);
      }
    }
  }
}

// =====================================================================
// FLOATING TEXT
// =====================================================================
function spawnFloater(x, y, text, type) {
  const k = $("battle");
  const el = document.createElement("div");
  el.className = "floater " + (type || "dmg");
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  k.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// =====================================================================
// NOTIFY
// =====================================================================
let notifyTimer;
function notify(msg) {
  const el = $("notify");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function pulseStat(id) {
  const el = $(id);
  el.classList.add("pulse");
  setTimeout(() => el.classList.remove("pulse"), 150);
}

// =====================================================================
// PIXEL DRAWING
// =====================================================================
function drawPixelHero(c, classId, x, y, size, facing, frame, hstate) {
  const cls = HERO_CLASSES[classId];
  const p = size / 16;
  const bob = hstate === "walk" ? Math.sin(frame * 0.3) * p : 0;
  const lunge = hstate === "attack" && frame % 20 < 10 ? p * 2 : 0;

  c.save();
  c.translate(Math.floor(x + lunge * facing), Math.floor(y + bob));
  if (facing === -1) c.scale(-1, 1);

  c.fillStyle = "rgba(0,0,0,0.4)";
  c.beginPath();
  c.ellipse(0, 0, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = cls.color;
  c.fillRect(-3 * p, -8 * p, 6 * p, 8 * p);
  c.fillStyle = "#f0d0a8";
  c.fillRect(-3 * p, -13 * p, 6 * p, 5 * p);
  c.fillStyle = cls.accent;
  c.fillRect(-3 * p, -14 * p, 6 * p, 2 * p);
  c.fillStyle = "#000";
  c.fillRect(-2 * p, -11 * p, 1 * p, 2 * p);
  c.fillRect(1 * p, -11 * p, 1 * p, 2 * p);
  c.fillStyle = cls.accent;
  c.fillRect(-3 * p, 0, 2 * p, 3 * p);
  c.fillRect(1 * p, 0, 2 * p, 3 * p);
  c.fillStyle = cls.color;
  c.fillRect(-5 * p, -7 * p, 2 * p, 5 * p);
  c.fillRect(3 * p, -7 * p, 2 * p, 5 * p);

  drawHeroEquipment(c, classId, p, frame, hstate);
  c.restore();
}

function drawHeroEquipment(c, classId, p, frame, hstate) {
  const cls = HERO_CLASSES[classId];
  switch (classId) {
    case "novice":
      c.fillStyle = "#c0c0c0";
      c.fillRect(4 * p, -10 * p, 1 * p, 6 * p);
      c.fillStyle = "#8a6a2a";
      c.fillRect(3.5 * p, -4 * p, 2 * p, 1 * p);
      break;
    case "swordsman":
      c.fillStyle = "#c0c0c0";
      c.fillRect(4 * p, -12 * p, 2 * p, 9 * p);
      c.fillStyle = "#8a6a2a";
      c.fillRect(3 * p, -4 * p, 4 * p, 1 * p);
      c.fillStyle = "#a0a0a0";
      c.fillRect(-4 * p, -15 * p, 8 * p, 2 * p);
      break;
    case "mage":
      c.fillStyle = cls.accent;
      c.beginPath();
      c.moveTo(-4 * p, -13 * p);
      c.lineTo(0, -20 * p);
      c.lineTo(4 * p, -13 * p);
      c.closePath();
      c.fill();
      c.fillStyle = "#8a6a2a";
      c.fillRect(4 * p, -14 * p, 1 * p, 12 * p);
      c.fillStyle = "#7abaff";
      c.fillRect(3 * p, -16 * p, 3 * p, 3 * p);
      break;
    case "archer":
      c.strokeStyle = "#8a6a2a";
      c.lineWidth = 1 * p;
      c.beginPath();
      c.arc(5 * p, -8 * p, 4 * p, -Math.PI / 2, Math.PI / 2);
      c.stroke();
      c.fillStyle = cls.accent;
      c.fillRect(-4 * p, -15 * p, 8 * p, 3 * p);
      break;
    case "priest":
      c.strokeStyle = "#ffd24a";
      c.lineWidth = 1 * p;
      c.beginPath();
      c.arc(0, -17 * p, 3 * p, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = "#8a6a2a";
      c.fillRect(4 * p, -14 * p, 1 * p, 12 * p);
      c.fillStyle = "#ffd24a";
      c.fillRect(3 * p, -16 * p, 3 * p, 3 * p);
      break;
    case "knight":
      c.fillStyle = "#a0a0a0";
      c.fillRect(-4 * p, -16 * p, 8 * p, 4 * p);
      c.fillStyle = "#000";
      c.fillRect(-2 * p, -14 * p, 1 * p, 2 * p);
      c.fillRect(1 * p, -14 * p, 1 * p, 2 * p);
      c.fillStyle = "#d0d0d0";
      c.fillRect(4 * p, -14 * p, 2 * p, 11 * p);
      c.fillStyle = "#8a6a2a";
      c.fillRect(3 * p, -4 * p, 4 * p, 1 * p);
      c.fillStyle = "#6a4a2a";
      c.fillRect(-6 * p, -8 * p, 3 * p, 6 * p);
      break;
    case "assassin":
      c.fillStyle = "#2a1a2a";
      c.fillRect(-4 * p, -16 * p, 8 * p, 5 * p);
      c.fillStyle = "#000";
      c.fillRect(-2 * p, -13 * p, 1 * p, 2 * p);
      c.fillRect(1 * p, -13 * p, 1 * p, 2 * p);
      c.fillStyle = "#c0c0c0";
      c.fillRect(4 * p, -10 * p, 1 * p, 4 * p);
      break;
    case "lordknight":
      c.fillStyle = "#ffd24a";
      c.fillRect(-4 * p, -17 * p, 8 * p, 3 * p);
      c.fillStyle = "#c4a04a";
      c.fillRect(-5 * p, -14 * p, 10 * p, 3 * p);
      c.fillStyle = "#d0d0d0";
      c.fillRect(4 * p, -15 * p, 2 * p, 12 * p);
      c.fillStyle = "#8a6a2a";
      c.fillRect(3 * p, -4 * p, 4 * p, 1 * p);
      break;
    case "highwizard":
      c.fillStyle = cls.accent;
      c.beginPath();
      c.moveTo(-5 * p, -13 * p);
      c.lineTo(0, -22 * p);
      c.lineTo(5 * p, -13 * p);
      c.closePath();
      c.fill();
      c.fillStyle = "#fff";
      c.fillRect(-1 * p, -19 * p, 2 * p, 2 * p);
      c.fillStyle = "#8a6a2a";
      c.fillRect(4 * p, -15 * p, 1 * p, 13 * p);
      c.fillStyle = "#aa6aff";
      c.fillRect(3 * p, -18 * p, 3 * p, 3 * p);
      c.fillStyle = cls.accent;
      c.fillRect(-5 * p, -7 * p, 2 * p, 8 * p);
      c.fillRect(3 * p, -7 * p, 2 * p, 8 * p);
      break;
  }
}

function drawPixelMonster(c, m, size, facing, frame) {
  const data = MONSTERS[m.type];
  const p = size / 16;
  const bob = m.state === "walk" ? Math.sin(frame * 0.2) * p : 0;
  const lunge = m.state === "attack" && frame % 20 < 10 ? -p * 2 : 0;
  const flash = m.hitFlash > 0;

  c.save();
  c.translate(Math.floor(m.x + lunge), Math.floor(m.y + bob));
  if (facing === 1) c.scale(-1, 1);

  c.fillStyle = "rgba(0,0,0,0.4)";
  c.beginPath();
  c.ellipse(0, 0, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
  c.fill();

  if (m.dead) {
    c.globalAlpha = Math.max(0, m.deathTimer / 0.6);
    c.translate(0, (1 - m.deathTimer / 0.6) * 20);
  }

  const main = flash ? "#fff" : data.color;
  const accent = flash ? "#fff" : data.accent;

  switch (data.shape) {
    case "blob":
      c.fillStyle = main;
      c.beginPath();
      c.ellipse(0, -size * 0.35, size * 0.55, size * 0.45, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = accent;
      c.fillRect(-size * 0.2, -size * 0.5, size * 0.15, size * 0.15);
      c.fillRect(size * 0.05, -size * 0.5, size * 0.15, size * 0.15);
      break;
    case "bat":
      c.fillStyle = main;
      c.beginPath();
      c.moveTo(0, -size * 0.4);
      c.lineTo(-size * 0.7, -size * 0.7);
      c.lineTo(-size * 0.4, -size * 0.3);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(0, -size * 0.4);
      c.lineTo(size * 0.7, -size * 0.7);
      c.lineTo(size * 0.4, -size * 0.3);
      c.closePath();
      c.fill();
      c.beginPath();
      c.ellipse(0, -size * 0.35, size * 0.25, size * 0.3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ff3a3a";
      c.fillRect(-size * 0.1, -size * 0.4, size * 0.08, size * 0.08);
      c.fillRect(size * 0.03, -size * 0.4, size * 0.08, size * 0.08);
      break;
    case "humanoid":
      c.fillStyle = main;
      c.fillRect(-3 * p, -10 * p, 6 * p, 10 * p);
      c.fillStyle = accent;
      c.fillRect(-3 * p, -15 * p, 6 * p, 5 * p);
      c.fillStyle = "#ff3a3a";
      c.fillRect(-2 * p, -13 * p, 1 * p, 1.5 * p);
      c.fillRect(1 * p, -13 * p, 1 * p, 1.5 * p);
      c.fillStyle = main;
      c.fillRect(-5 * p, -8 * p, 2 * p, 5 * p);
      c.fillRect(3 * p, -8 * p, 2 * p, 5 * p);
      c.fillRect(-3 * p, 0, 2 * p, 3 * p);
      c.fillRect(1 * p, 0, 2 * p, 3 * p);
      break;
    case "wolf":
      c.fillStyle = main;
      c.fillRect(-5 * p, -7 * p, 10 * p, 6 * p);
      c.fillRect(-7 * p, -10 * p, 5 * p, 5 * p);
      c.fillRect(-5 * p, -1 * p, 2 * p, 3 * p);
      c.fillRect(3 * p, -1 * p, 2 * p, 3 * p);
      c.fillRect(5 * p, -10 * p, 2 * p, 3 * p);
      c.fillStyle = "#ffd24a";
      c.fillRect(-6 * p, -8 * p, 1 * p, 1 * p);
      break;
    case "golem":
      c.fillStyle = main;
      c.fillRect(-5 * p, -12 * p, 10 * p, 12 * p);
      c.fillStyle = accent;
      c.fillRect(-4 * p, -16 * p, 8 * p, 5 * p);
      c.fillStyle = "#000";
      c.fillRect(-3 * p, -10 * p, 1 * p, 3 * p);
      c.fillRect(2 * p, -7 * p, 1 * p, 4 * p);
      c.fillStyle = "#ffd24a";
      c.fillRect(-2 * p, -14 * p, 1.5 * p, 1.5 * p);
      c.fillRect(0.5 * p, -14 * p, 1.5 * p, 1.5 * p);
      break;
    case "ghost":
      c.globalAlpha *= 0.75;
      c.fillStyle = main;
      c.beginPath();
      c.moveTo(-4 * p, -14 * p);
      c.lineTo(4 * p, -14 * p);
      c.lineTo(4 * p, -2 * p);
      c.lineTo(3 * p, -4 * p);
      c.lineTo(2 * p, -2 * p);
      c.lineTo(1 * p, -4 * p);
      c.lineTo(0, -2 * p);
      c.lineTo(-1 * p, -4 * p);
      c.lineTo(-2 * p, -2 * p);
      c.lineTo(-3 * p, -4 * p);
      c.lineTo(-4 * p, -2 * p);
      c.closePath();
      c.fill();
      c.fillStyle = "#fff";
      c.fillRect(-2 * p, -11 * p, 1.5 * p, 2 * p);
      c.fillRect(0.5 * p, -11 * p, 1.5 * p, 2 * p);
      break;
    case "demon":
      c.fillStyle = main;
      c.fillRect(-4 * p, -10 * p, 8 * p, 10 * p);
      c.fillRect(-4 * p, -15 * p, 8 * p, 5 * p);
      c.fillStyle = accent;
      c.beginPath();
      c.moveTo(-4 * p, -15 * p);
      c.lineTo(-6 * p, -20 * p);
      c.lineTo(-3 * p, -15 * p);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(4 * p, -15 * p);
      c.lineTo(6 * p, -20 * p);
      c.lineTo(3 * p, -15 * p);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(-4 * p, -8 * p);
      c.lineTo(-9 * p, -12 * p);
      c.lineTo(-5 * p, -4 * p);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(4 * p, -8 * p);
      c.lineTo(9 * p, -12 * p);
      c.lineTo(5 * p, -4 * p);
      c.closePath();
      c.fill();
      c.fillStyle = "#ffd24a";
      c.fillRect(-2 * p, -13 * p, 1.5 * p, 1.5 * p);
      c.fillRect(0.5 * p, -13 * p, 1.5 * p, 1.5 * p);
      break;
    case "dragon":
      c.fillStyle = main;
      c.fillRect(-6 * p, -9 * p, 12 * p, 9 * p);
      c.fillRect(-8 * p, -13 * p, 7 * p, 5 * p);
      c.fillStyle = accent;
      c.beginPath();
      c.moveTo(0, -9 * p);
      c.lineTo(-8 * p, -18 * p);
      c.lineTo(-2 * p, -8 * p);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(0, -9 * p);
      c.lineTo(8 * p, -18 * p);
      c.lineTo(2 * p, -8 * p);
      c.closePath();
      c.fill();
      c.fillStyle = "#ffd24a";
      c.fillRect(-7 * p, -11 * p, 1.5 * p, 1.5 * p);
      if (m.state === "attack" && frame % 20 < 10) {
        c.fillStyle = "#ff6a2a";
        c.fillRect(-11 * p, -11 * p, 3 * p, 2 * p);
        c.fillStyle = "#ffd24a";
        c.fillRect(-13 * p, -11 * p, 2 * p, 2 * p);
      }
      break;
  }
  c.restore();
}

// =====================================================================
// SCENE
// =====================================================================
function drawScene(dt) {
  const st = STAGES[state.stage];
  const W = canvas.width,
    H = canvas.height;

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, st.bg);
  grad.addColorStop(1, "#000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (let i = 0; i < 25; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % (H * 0.5);
    if ((animTime + i) % 3 < 2) ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = st.ground;
  ctx.fillRect(0, H * 0.75, W, H * 0.25);

  for (let y = H * 0.75; y < H; y += 20) {
    for (let x = 0; x < W; x += 20) {
      if ((x / 20 + y / 20) % 2 === 0) {
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(x, y, 20, 20);
      }
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  for (let i = 0; i < 6; i++) {
    const x = (i * 173 + 40) % W;
    const h = 40 + ((i * 37) % 60);
    ctx.beginPath();
    ctx.moveTo(x, H * 0.75);
    ctx.lineTo(x + 20, H * 0.75 - h);
    ctx.lineTo(x + 40, H * 0.75);
    ctx.closePath();
    ctx.fill();
  }

  if (!state.battleActive) {
    for (let i = 0; i < activeHeroes.length; i++) {
      const h = activeHeroes[i];
      if (h.hp <= 0) continue;
      const idleBob = Math.sin(animTime * 2 + h.bobPhase) * 2;
      const size = 48;
      const barW = 36,
        barX = h.x - barW / 2,
        barY = h.y - 60 + idleBob;
      ctx.fillStyle = "#2a0a0a";
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = "#6aaa5a";
      ctx.fillRect(barX, barY, barW * (h.hp / h.maxHp), 4);
      drawPixelHero(
        ctx,
        h.classId,
        h.x,
        h.y + idleBob,
        size,
        h.facing,
        h.frame,
        "idle",
      );
      h.frame++;
    }
  } else {
    for (const h of activeHeroes) {
      if (h.hp <= 0) continue;
      const size = 48;
      const barW = 40,
        barX = h.x - barW / 2,
        barY = h.y - 60;
      ctx.fillStyle = "#2a0a0a";
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = "#6aaa5a";
      ctx.fillRect(barX, barY, barW * (h.hp / h.maxHp), 4);
      drawPixelHero(ctx, h.classId, h.x, h.y, size, h.facing, h.frame, h.state);
    }
    for (const m of activeMonsters) {
      const md = MONSTERS[m.type];
      drawPixelMonster(ctx, m, md.size * 1.6, m.facing, m.frame);
    }
    const alive = activeMonsters.filter((m) => !m.dead);
    if (alive.length > 0) {
      const front = alive.reduce((a, b) => (a.x < b.x ? a : b));
      const hpEl = $("monster-hp");
      hpEl.style.display = "block";
      hpEl.querySelector(".fill").style.width =
        (front.hp / front.maxHp) * 100 + "%";
      hpEl.querySelector(".text").textContent =
        `${MONSTERS[front.type].name} — ${Math.ceil(front.hp)}/${Math.ceil(front.maxHp)}`;
      $("wave-info").style.display = "block";
      $("wave-info").textContent = `Wave ${state.wave}/5`;
    } else {
      $("monster-hp").style.display = "none";
      $("wave-info").style.display = "none";
    }
  }

  updateHeroStrip();
}

function updateHeroStrip() {
  const strip = $("hero-strip");
  strip.innerHTML = "";
  const unique = {};
  for (const h of activeHeroes) {
    if (h.hp <= 0) continue;
    if (!unique[h.classId]) unique[h.classId] = { count: 0, hp: 0, maxHp: 0 };
    unique[h.classId].count++;
    unique[h.classId].hp += h.hp;
    unique[h.classId].maxHp += h.maxHp;
  }
  for (const id in unique) {
    const u = unique[id];
    const cls = HERO_CLASSES[id];
    const div = document.createElement("div");
    div.className = "hero-slot";
    div.innerHTML = `
      <div class="nm">${cls.icon} ${cls.name.slice(0, 7)} x${u.count}</div>
      <div class="bar"><div class="fill" style="width:${(u.hp / u.maxHp) * 100}%"></div></div>
    `;
    strip.appendChild(div);
  }
}

// =====================================================================
// UI
// =====================================================================
function render() {
  $("coins").textContent = fmt(state.coins);
  $("cps").textContent = fmt(getIdleCPS());
  $("idle-rate").textContent = fmt(getIdleCPS());
  $("level").textContent = state.level;
  $("gems").textContent = state.gems;

  const activeTab =
    document.querySelector(".tab.active")?.dataset.tab || "heroes";
  renderTab(activeTab);

  const prestigeTab = document.querySelector('.tab[data-tab="prestige"]');
  if (state.totalEarned >= 1e9 && state.level >= 25)
    prestigeTab.classList.remove("locked");
  else prestigeTab.classList.add("locked");

  updateTabBadges();
}

function updateTabBadges() {
  document.querySelectorAll(".tab .notif-badge").forEach((b) => b.remove());

  const gearTab = document.querySelector('.tab[data-tab="equip"]');
  if (gearTab) {
    let hasNew = false;
    for (const id in EQUIPMENT) {
      const eq = EQUIPMENT[id];
      if (state.equipment[id]) continue;
      if (state.unlockedStages.length <= eq.reqStage) continue;
      if (state.coins >= eq.cost) {
        hasNew = true;
        break;
      }
    }
    if (hasNew && !gearTab.classList.contains("active")) {
      const b = document.createElement("span");
      b.className = "notif-badge";
      gearTab.appendChild(b);
    }
  }

  const heroTab = document.querySelector('.tab[data-tab="heroes"]');
  if (heroTab) {
    let hasNew = false;
    for (const id in HERO_CLASSES) {
      if (state.coins >= heroCost(id)) {
        hasNew = true;
        break;
      }
    }
    if (hasNew && !heroTab.classList.contains("active")) {
      const b = document.createElement("span");
      b.className = "notif-badge";
      heroTab.appendChild(b);
    }
  }
}

function renderTab(tab) {
  const el = $("tab-content");
  el.innerHTML = "";

  if (tab === "heroes") {
    el.innerHTML =
      '<div class="section-header">HIRE HEROES<span class="hint">Earn idle income</span></div>';
    for (const id in HERO_CLASSES) el.appendChild(makeHeroCard(id));
  } else if (tab === "equip") {
    el.innerHTML =
      '<div class="section-header">EQUIPMENT<span class="hint">Permanent boosts</span></div>';
    const slots = {
      weapon: "⚔️ Weapons",
      armor: "🛡️ Armor",
      boots: "👢 Boots",
      acc: "💍 Accessories",
    };
    for (const slot in slots) {
      const header = document.createElement("div");
      header.style.cssText =
        "font-size:10px;color:#8fc47a;padding:10px 4px 4px;letter-spacing:1px;";
      header.textContent = slots[slot];
      el.appendChild(header);
      for (const id in EQUIPMENT) {
        if (EQUIPMENT[id].slot === slot) el.appendChild(makeEquipCard(id));
      }
    }
  } else if (tab === "buildings") {
    el.innerHTML =
      '<div class="section-header">GUILD UPGRADES<span class="hint">Multipliers</span></div>';
    for (const id in BUILDINGS) el.appendChild(makeBuildingCard(id));
  } else if (tab === "stages") {
    el.innerHTML =
      '<div class="section-header">STAGES<span class="hint">Unlock new lands</span></div>';
    for (let i = 0; i < STAGES.length; i++) el.appendChild(makeStageCard(i));
  } else if (tab === "prestige") {
    const canPrest = state.totalEarned >= 1e9 && state.level >= 25;
    el.innerHTML = `
      <div class="section-header">PRESTIGE</div>
      <div style="padding:10px;color:#aab;font-size:12px;line-height:1.6;">
        <p style="margin-bottom:8px;">Earn <b style="color:#ffd24a">Lily Gems 💎</b> by resetting.</p>
        <p style="margin-bottom:8px;">Each gem: <b style="color:#8fc47a">+5% permanent CPS</b>.</p>
        <p style="margin-bottom:12px;">Requires: 1B coins & Level 25.</p>
        <p style="margin-bottom:12px;">Next reset: <b style="color:#ffd24a">${canPrest ? Math.floor(Math.sqrt(state.totalEarned / 1e9) * 10) : 0} 💎</b></p>
      </div>
    `;
    const btn = document.createElement("button");
    btn.className = "btn danger";
    btn.style.cssText = "width:100%;padding:14px;";
    btn.textContent = canPrest ? "💎 PRESTIGE NOW" : "🔒 LOCKED";
    btn.disabled = !canPrest;
    btn.onclick = doPrestige;
    el.appendChild(btn);
  }
}

function makeHeroCard(id) {
  const c = HERO_CLASSES[id];
  const count = state.heroes[id];
  const cost = heroCost(id);
  const canAfford = state.coins >= cost;

  const card = document.createElement("div");
  card.className = "card" + (canAfford ? " buyable" : " disabled");

  const portrait = document.createElement("canvas");
  portrait.className = "sprite";
  portrait.width = 52;
  portrait.height = 52;
  const pc = portrait.getContext("2d");
  pc.imageSmoothingEnabled = false;
  pc.fillStyle = "#0d1420";
  pc.fillRect(0, 0, 52, 52);
  drawPixelHero(pc, id, 26, 46, 36, 1, animTime * 20, "idle");
  card.appendChild(portrait);

  const info = document.createElement("div");
  info.className = "info";
  const stats = getHeroStats(id);
  info.innerHTML = `
    <div class="name">${c.name}</div>
    <div class="desc">❤️ ${Math.floor(stats.maxHp)} · ⚔️ ${Math.floor(stats.atk)} · +${fmt(c.idleCPS)}/s</div>
  `;
  card.appendChild(info);

  const owned = document.createElement("div");
  owned.className = "owned";
  owned.textContent = "x" + count;
  card.appendChild(owned);

  const costEl = document.createElement("div");
  costEl.className = "cost " + (canAfford ? "affordable" : "unaffordable");
  costEl.textContent = `🪙 ${fmt(cost)}`;
  card.appendChild(costEl);

  if (canAfford) card.onclick = () => hireHero(id);
  return card;
}

function makePlayerCard(p) {
  const card = document.createElement("div");
  card.className =
    "player-card" + (p.online ? " online" : "") + (p.isMe ? " me" : "");

  const avatar = document.createElement("div");
  avatar.className = "player-avatar";
  avatar.textContent = p.online ? "🐸" : "💤";
  const dot = document.createElement("span");
  dot.className = "player-status-dot " + (p.online ? "online" : "offline");
  avatar.appendChild(dot);
  card.appendChild(avatar);

  const info = document.createElement("div");
  info.className = "player-info";

  const nameLine = document.createElement("div");
  nameLine.className = "player-name";
  nameLine.textContent = p.username;
  if (p.isMe) {
    const tag = document.createElement("span");
    tag.className = "you-tag";
    tag.textContent = "YOU";
    nameLine.appendChild(tag);
  }
  info.appendChild(nameLine);

  const meta = document.createElement("div");
  meta.className = "player-meta";
  const stageName =
    typeof STAGES !== "undefined" && STAGES[p.stage]
      ? STAGES[p.stage].name
      : "Unknown";
  meta.innerHTML = `
    <span class="stat-item">⭐ Lv.<b>${p.level}</b></span>
    <span class="stat-item">🪙 <b>${fmt(p.coins)}</b></span>
    <span class="stat-item">🗺️ <b>${stageName}</b></span>
  `;
  info.appendChild(meta);

  card.appendChild(info);

  const right = document.createElement("div");
  right.className = "player-right";
  const statusText = document.createElement("div");
  statusText.className = "status-text " + (p.online ? "online" : "offline");
  statusText.textContent = p.online
    ? p.battleActive
      ? "⚔️ IN BATTLE"
      : "● ONLINE"
    : "○ OFFLINE";
  right.appendChild(statusText);

  const lastSeen = document.createElement("div");
  lastSeen.className = "last-seen";
  lastSeen.textContent = p.online ? "now" : timeAgo(p.lastSeen);
  right.appendChild(lastSeen);

  card.appendChild(right);

  return card;
}

function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return sec + "s ago";
  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  const day = Math.floor(hr / 24);
  return day + "d ago";
}

function makeEquipCard(id) {
  const eq = EQUIPMENT[id];
  const owned = state.equipment[id];
  const reqMet = state.unlockedStages.length > eq.reqStage;
  const canAfford = state.coins >= eq.cost;

  const card = document.createElement("div");
  card.className =
    "card" +
    (owned ? " locked" : canAfford && reqMet ? " buyable" : " disabled");
  if (owned) card.style.borderColor = "#4a8a4a";

  const icon = document.createElement("div");
  icon.className = "sprite";
  icon.style.cssText =
    "display:flex;align-items:center;justify-content:center;font-size:24px;";
  icon.textContent = eq.icon;
  if (owned) icon.style.background = "#1a3a1a";
  card.appendChild(icon);

  const info = document.createElement("div");
  info.className = "info";
  info.innerHTML = `
    <div class="name">${eq.name} ${owned ? "✓" : ""}</div>
    <div class="desc">${eq.desc}${!reqMet ? ` · <b style="color:#e05a5a">Requires Stage ${eq.reqStage + 1}</b>` : ""}</div>
  `;
  card.appendChild(info);

  const costEl = document.createElement("div");
  if (owned) {
    costEl.className = "cost affordable";
    costEl.textContent = "OWNED";
  } else if (!reqMet) {
    costEl.className = "cost unaffordable";
    costEl.textContent = "🔒";
  } else {
    costEl.className = "cost " + (canAfford ? "affordable" : "unaffordable");
    costEl.textContent = `🪙 ${fmt(eq.cost)}`;
  }
  card.appendChild(costEl);

  if (!owned && canAfford && reqMet) card.onclick = () => buyEquipment(id);
  return card;
}

function makeBuildingCard(id) {
  const b = BUILDINGS[id];
  const lvl = state.buildings[id];
  const cost = buildingCost(id);
  const canAfford = state.coins >= cost;

  const card = document.createElement("div");
  card.className = "card" + (canAfford ? " buyable" : " disabled");

  const icon = document.createElement("div");
  icon.className = "sprite";
  icon.style.cssText =
    "display:flex;align-items:center;justify-content:center;font-size:26px;";
  icon.textContent = b.icon;
  card.appendChild(icon);

  const info = document.createElement("div");
  info.className = "info";
  info.innerHTML = `
    <div class="name">${b.name}</div>
    <div class="desc">${b.desc} · Lv.${lvl}</div>
  `;
  card.appendChild(info);

  const owned = document.createElement("div");
  owned.className = "owned";
  owned.textContent = lvl;
  card.appendChild(owned);

  const costEl = document.createElement("div");
  costEl.className = "cost " + (canAfford ? "affordable" : "unaffordable");
  costEl.textContent = `🪙 ${fmt(cost)}`;
  card.appendChild(costEl);

  if (canAfford) card.onclick = () => buyBuilding(id);
  return card;
}

function makeStageCard(idx) {
  const st = STAGES[idx];
  const unlocked = state.unlockedStages.includes(idx);
  const active = state.stage === idx;
  const canAfford = state.coins >= st.unlockCost;

  const card = document.createElement("div");
  card.className =
    "card" +
    (unlocked
      ? active
        ? ""
        : " buyable"
      : canAfford
        ? " buyable"
        : " disabled");
  if (active) card.style.borderColor = "#ffd24a";

  const icon = document.createElement("div");
  icon.className = "sprite";
  icon.style.cssText = `display:flex;align-items:center;justify-content:center;font-size:26px;background:${st.bg};`;
  icon.textContent = st.icon;
  card.appendChild(icon);

  const info = document.createElement("div");
  info.className = "info";
  info.innerHTML = `
    <div class="name">${st.name} ${active ? "★" : ""}</div>
    <div class="desc">${unlocked ? (active ? "Current stage" : "Click to travel") : "Locked"} · Rewards x${st.rewardMult}</div>
  `;
  card.appendChild(info);

  const costEl = document.createElement("div");
  if (!unlocked) {
    costEl.className = "cost " + (canAfford ? "affordable" : "unaffordable");
    costEl.textContent = `🪙 ${fmt(st.unlockCost)}`;
  } else {
    costEl.className = "cost " + (active ? "affordable" : "");
    costEl.textContent = active ? "★" : "→";
  }
  card.appendChild(costEl);

  if (!unlocked && canAfford) card.onclick = () => unlockStage(idx);
  else if (unlocked && !active) card.onclick = () => unlockStage(idx);
  return card;
}

// =====================================================================
// TABS
// =====================================================================
document.querySelectorAll(".tab").forEach((tab) => {
  tab.onclick = () => {
    if (tab.classList.contains("locked")) {
      notify("🔒 Locked — progress more to unlock");
      return;
    }
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    renderTab(tab.dataset.tab);
    updateTabBadges();
  };
});

// =====================================================================
// BATTLE BUTTONS
// =====================================================================
$("battle-cta").onclick = startBattle;
$("retreat-btn").onclick = retreatBattle;

// =====================================================================
// PRESTIGE
// =====================================================================
function doPrestige() {
  if (state.totalEarned < 1e9 || state.level < 25) return;
  if (!confirm("Prestige? You will reset your kingdom for Lily Gems.")) return;
  const gems = Math.floor(Math.sqrt(state.totalEarned / 1e9) * 10);
  const keptGems = state.gems + gems;
  const keptStart = state.startTime;
  resetState();
  state.gems = keptGems;
  state.startTime = keptStart;
  activeHeroes = [];
  activeMonsters = [];
  $("battle-cta").classList.remove("hidden");
  $("retreat-btn").style.display = "none";
  notify(`💎 Prestige! +${gems} Lily Gems`);
  render();
}

// =====================================================================
// SAVE / LOAD (server-backed)
// =====================================================================
let saveInFlight = false;

async function save() {
  if (!authToken || !currentUser || saveInFlight) return;
  saveInFlight = true;
  try {
    const res = await fetch(API_BASE + "/api/save", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ save: state }),
    });
    if (res.ok) {
      const data = await res.json();
      $("savetime").textContent = new Date(data.updatedAt).toLocaleTimeString();
    } else if (res.status === 401) {
      notify("⚠️ Session expired. Please log in again.");
      logout();
    }
  } catch (err) {
    console.warn("Save failed:", err);
  } finally {
    saveInFlight = false;
  }
}

async function load() {
  if (!authToken) return false;
  try {
    const res = await fetch(API_BASE + "/api/save", {
      headers: authHeaders(),
    });
    if (res.status === 401) return false;
    const data = await res.json();
    if (!data.save) return false;

    resetState();
    Object.assign(state, data.save);
    if (!state.equipment) {
      state.equipment = {};
      for (const k in EQUIPMENT) state.equipment[k] = false;
    }
    if (!state.unlockedStages) state.unlockedStages = [0];
    for (const k in HERO_CLASSES)
      if (typeof state.heroes[k] !== "number") state.heroes[k] = 0;
    for (const k in BUILDINGS)
      if (typeof state.buildings[k] !== "number") state.buildings[k] = 0;
    for (const k in EQUIPMENT)
      if (typeof state.equipment[k] !== "boolean") state.equipment[k] = false;
    return true;
  } catch (err) {
    console.warn("Load failed:", err);
    return false;
  }
}

async function hardReset() {
  if (!confirm("Erase ALL progress for this account? This cannot be undone."))
    return;
  try {
    await fetch(API_BASE + "/api/save", {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch (err) {
    /* ignore */
  }

  resetState();
  activeHeroes = [];
  activeMonsters = [];
  $("battle-cta").classList.remove("hidden");
  $("retreat-btn").style.display = "none";
  updateStageLabel();
  render();
  notify("🗑️ Progress reset");
}

function applyOffline() {
  const elapsed = (now() - state.lastSave) / 1000;
  if (elapsed < 30) return;
  const cps = getIdleCPS();
  const earned = cps * elapsed * (0.5 + getBuildingEffect("offline"));
  if (earned > 0) {
    state.coins += earned;
    state.totalEarned += earned;
    notify(`💤 Welcome back! +${fmt(earned)} coins`);
  }
}

// =====================================================================
// MAIN LOOP
// =====================================================================
let lastFrame = performance.now();
let gameLoopStarted = false;
function loop(t) {
  const dt = Math.min((t - lastFrame) / 1000, 0.1);
  lastFrame = t;
  animTime += dt;

  const cps = getIdleCPS();
  if (cps > 0) {
    const gain = cps * dt;
    state.coins += gain;
    state.totalEarned += gain;
  }

  addXP(dt * 0.3);
  updateCombat(dt);
  drawScene(dt);

  if (!loop.uiTimer || t - loop.uiTimer > 250) {
    loop.uiTimer = t;
    render();
  }

  requestAnimationFrame(loop);
}

// =====================================================================
// BOOT
// =====================================================================
$("saveBtn").onclick = () => {
  save();
  notify("💾 Saved!");
};
$("resetBtn").onclick = hardReset;
setInterval(() => {
  if (currentUser) save();
}, 15000);
window.addEventListener("beforeunload", () => {
  if (currentUser) save();
});

function bootGame() {
  resizeCanvas();
  const hadSave = load();
  if (hadSave) {
    applyOffline();
    notify("💤 Progress loaded");
  } else {
    resetState();
    state.coins = 100;
    state.heroes.novice = 1;
    notify("⚔️ Welcome, Commander!");
  }

  if (Object.values(state.heroes).every((n) => n === 0)) {
    state.heroes.novice = 1;
  }

  activeHeroes = [];
  for (const id in state.heroes) {
    for (let i = 0; i < state.heroes[id]; i++) {
      const s = getHeroStats(id);
      const groundY = canvas.height * 0.78;
      const hero = {
        classId: id,
        x: rand(60, canvas.width * 0.35),
        y: groundY + rand(-8, 8),
        homeX: 0,
        hp: s.maxHp,
        maxHp: s.maxHp,
        atk: s.atk,
        atkSpeed: s.atkSpeed,
        range: s.range,
        cooldown: rand(0, 1),
        frame: rand(0, 30),
        facing: 1,
        state: "idle",
        bobPhase: rand(0, Math.PI * 2),
      };
      hero.homeX = hero.x;
      activeHeroes.push(hero);
    }
  }

  updateStageLabel();
  render();

  if (!gameLoopStarted) {
    gameLoopStarted = true;
    requestAnimationFrame((t) => {
      lastFrame = t;
      loop(t);
    });
  }
}

// =====================================================================
// INIT — check for existing session
// =====================================================================
function init() {
  resizeCanvas();
  setAuthMode("login");

  const session = localStorage.getItem(SESSION_KEY);
  if (session) {
    const users = loadUsers();
    if (users[session.toLowerCase()]) {
      startSession(users[session.toLowerCase()].username);
      return;
    }
  }

  $("auth-screen").style.display = "flex";
  $("game").style.display = "none";
  $("username").focus();
}

init();
startPresence();

// =====================================================================
// PRESENCE (heartbeat + player list)
// =====================================================================
async function sendHeartbeat() {
  if (!authToken) return;
  try {
    await fetch(API_BASE + "/api/heartbeat", {
      method: "POST",
      headers: authHeaders(),
    });
  } catch (e) {
    /* ignore */
  }
}

async function fetchPlayers() {
  if (!authToken) return null;
  try {
    const res = await fetch(API_BASE + "/api/players", {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.players || [];
  } catch (e) {
    return null;
  }
}

function startPresence() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (playersRefreshInterval) clearInterval(playersRefreshInterval);

  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, 30000); // every 30s
  playersRefreshInterval = setInterval(() => {
    if (document.querySelector(".tab.active")?.dataset.tab === "players") {
      renderTab("players");
    } else if (tab === "players") {
      el.innerHTML =
        '<div class="section-header">PLAYERS ONLINE<span class="hint">Auto-refreshing…</span></div>';
      const loading = document.createElement("div");
      loading.style.cssText =
        "text-align:center;color:#7a8aa8;font-size:11px;padding:20px;";
      loading.textContent = "Loading players…";
      el.appendChild(loading);

      fetchPlayers().then((players) => {
        el.innerHTML =
          '<div class="section-header">PLAYERS ONLINE<span class="hint">Auto-refreshing…</span></div>';
        if (!players || players.length === 0) {
          const empty = document.createElement("div");
          empty.style.cssText =
            "text-align:center;color:#7a8aa8;font-size:11px;padding:20px;";
          empty.textContent = "No players found.";
          el.appendChild(empty);
          return;
        }

        const onlineCount = players.filter((p) => p.online).length;
        const summary = document.createElement("div");
        summary.style.cssText =
          "font-size:10px;color:#7a8aa8;padding:0 4px 8px;";
        summary.textContent = `${onlineCount} online · ${players.length} total`;
        el.appendChild(summary);

        for (const p of players) {
          el.appendChild(makePlayerCard(p));
        }
      });
    }
  }, 10000); // refresh player list every 10s while viewing
}

function stopPresence() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (playersRefreshInterval) clearInterval(playersRefreshInterval);
  heartbeatInterval = null;
  playersRefreshInterval = null;
}
