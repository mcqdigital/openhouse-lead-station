const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "openhouse.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_slug TEXT NOT NULL DEFAULT 'default-open-house',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  has_agent TEXT,
  buying_timeline TEXT,
  preapproved TEXT,
  price_range TEXT,
  areas_interest_json TEXT,
  notes TEXT,
  consent_property_contact INTEGER DEFAULT 0,
  consent_marketing INTEGER DEFAULT 0,
  lead_score INTEGER DEFAULT 0,
  lead_label TEXT DEFAULT 'Nurture',
  source_status TEXT DEFAULT 'online',
  created_at TEXT DEFAULT (datetime('now'))
);
`);

const upsertSettingStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const insertSettingIfMissingStmt = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`);

function seedDefaults() {
  const defaults = {
    brand_name: "Open House Lead Station",
    agent_name: "Your Name",
    brokerage_name: "Your Brokerage",
    property_address: "123 Apple St, Red Deer, AB",
    welcome_message: "Please sign in for the feature sheet and similar homes.",
    listing_url: "https://example.com/listing",
    feature_sheet_url: "https://example.com/feature-sheet.pdf",
    similar_homes_url: "https://example.com/similar-homes",
    book_showing_url: "https://example.com/book-showing",
    hero_image_url: "",
    agent_photo_url: "",
    brand_color: "#0f172a",
    accent_color: "#2563eb",
    require_consent: "1",
    ask_financing_question: "1",
    areas_options_json: JSON.stringify(["Red Deer", "Blackfalds", "Sylvan Lake", "Lacombe", "Penhold"]),
    price_ranges_json: JSON.stringify([
      { value: "under_400", label: "Under $400k" },
      { value: "400_500", label: "$400k - $500k" },
      { value: "500_600", label: "$500k - $600k" },
      { value: "600_plus", label: "$600k+" }
    ])
  };

  const tx = db.transaction(() => {
    Object.entries(defaults).forEach(([key, value]) => {
      // Important: only seed if missing (do NOT overwrite saved admin settings)
      insertSettingIfMissingStmt.run(key, String(value));
    });
  });

  tx();
}

seedDefaults();

function getAllSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const out = {};
  rows.forEach((r) => {
    out[r.key] = r.value;
  });
  return out;
}

function updateSettings(patch) {
  const tx = db.transaction(() => {
    Object.entries(patch).forEach(([key, value]) => {
      upsertSettingStmt.run(key, String(value ?? ""));
    });
  });
  tx();
}

function insertVisitor(visitor) {
  const stmt = db.prepare(`
    INSERT INTO visitors (
      event_slug, first_name, last_name, email, phone, has_agent, buying_timeline,
      preapproved, price_range, areas_interest_json, notes,
      consent_property_contact, consent_marketing, lead_score, lead_label, source_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    visitor.event_slug || "default-open-house",
    visitor.first_name,
    visitor.last_name,
    visitor.email || null,
    visitor.phone || null,
    visitor.has_agent || null,
    visitor.buying_timeline || null,
    visitor.preapproved || null,
    visitor.price_range || null,
    JSON.stringify(visitor.areas_interest || []),
    visitor.notes || null,
    visitor.consent_property_contact ? 1 : 0,
    visitor.consent_marketing ? 1 : 0,
    visitor.lead_score || 0,
    visitor.lead_label || "Nurture",
    visitor.source_status || "online"
  );

  return Number(info.lastInsertRowid);
}

function listVisitors(limit = 300) {
  const rows = db.prepare(`
    SELECT * FROM visitors
    ORDER BY datetime(created_at) DESC
    LIMIT ?
  `).all(limit);

  return rows.map((r) => {
    let areas = [];
    try {
      areas = JSON.parse(r.areas_interest_json || "[]");
    } catch {
      areas = [];
    }

    return {
      ...r,
      areas_interest: Array.isArray(areas) ? areas : []
    };
  });
}

function getStats() {
  const total = db.prepare(`SELECT COUNT(*) AS c FROM visitors`).get().c;
  const hot = db.prepare(`SELECT COUNT(*) AS c FROM visitors WHERE lead_label = 'Hot'`).get().c;
  const warm = db.prepare(`SELECT COUNT(*) AS c FROM visitors WHERE lead_label = 'Warm'`).get().c;
  const nurture = db.prepare(`SELECT COUNT(*) AS c FROM visitors WHERE lead_label = 'Nurture'`).get().c;
  return { total, hot, warm, nurture };
}

module.exports = {
  db,
  dbPath,
  getAllSettings,
  updateSettings,
  insertVisitor,
  listVisitors,
  getStats
};