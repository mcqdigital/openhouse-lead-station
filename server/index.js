require("dotenv").config();

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const {
  dbPath,
  getAllSettings,
  updateSettings,
  insertVisitor,
  listVisitors,
  getStats,
  clearVisitors
} = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 8787);
function getAdminPin() {
  const s = getAllSettings();
  return String(s.admin_pin || process.env.ADMIN_PIN || "1234");
}

// Lightweight in-memory admin tokens (dev/MVP)
// Tokens reset on server restart.
const adminTokens = new Set();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function parseJSON(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildConfig() {
  const s = getAllSettings();

  return {
    brand_name: s.brand_name,
    agent_name: s.agent_name,
    brokerage_name: s.brokerage_name,
    property_address: s.property_address,
    welcome_message: s.welcome_message,

    listing_url: s.listing_url,
    feature_sheet_url: s.feature_sheet_url,
    similar_homes_url: s.similar_homes_url,
    book_showing_url: s.book_showing_url,

    // QR titles
    qr_listing_title: s.qr_listing_title || "Listing",
    qr_feature_title: s.qr_feature_title || "Feature Sheet",
    qr_similar_title: s.qr_similar_title || "Similar Homes",
    qr_book_showing_title: s.qr_book_showing_title || "Book Showing",

    // Reset timer
    kiosk_reset_seconds: Number(s.kiosk_reset_seconds || 90),

    hero_image_url: s.hero_image_url,
    agent_photo_url: s.agent_photo_url,
    brand_color: s.brand_color,
    accent_color: s.accent_color,

    require_consent: s.require_consent === "1",
    ask_financing_question: s.ask_financing_question === "1",

    areas_options: parseJSON(s.areas_options_json, []),
    price_ranges: parseJSON(s.price_ranges_json, [])
  };
}

function calculateLeadScore(payload) {
  let score = 0;

  if (payload.buying_timeline === "0_3") score += 30;
  else if (payload.buying_timeline === "3_6") score += 20;
  else if (payload.buying_timeline === "6_12") score += 10;

  if (payload.preapproved === "yes") score += 25;
  else if (payload.preapproved === "need_help") score += 10;

  if (payload.has_agent === "no") score += 25;
  if (payload.consent_property_contact) score += 15;
  if ((payload.notes || "").trim()) score += 5;

  return score;
}

function leadLabel(score) {
  if (score >= 80) return "Hot";
  if (score >= 50) return "Warm";
  return "Nurture";
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function digitsOnly(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 10);
}

function formatPhone10(value = "") {
  const d = digitsOnly(value);
  if (d.length !== 10) return String(value || "").trim();
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function validName(value = "") {
  return NAME_REGEX.test(String(value).trim());
}

function validEmail(value = "") {
  return EMAIL_REGEX.test(String(value).trim());
}

function requireAdmin(req, res, next) {
  const headerToken = req.headers["x-admin-token"];
  const queryToken = req.query.token;
  const token = headerToken || queryToken;

  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

// ---------- Health ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ---------- Public kiosk routes ----------
app.get("/api/public/config", (req, res) => {
  res.json(buildConfig());
});

app.post("/api/public/checkin", (req, res) => {
  const payload = req.body || {};

  const firstName = String(payload.first_name || "").trim();
  const lastName = String(payload.last_name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const phoneRaw = String(payload.phone || "").trim();
  const phoneDigits = digitsOnly(phoneRaw);
  const phone = phoneDigits ? formatPhone10(phoneDigits) : "";

  if (!firstName || !lastName) {
    return res.status(400).json({ error: "First and last name are required." });
  }

  if (!validName(firstName) || !validName(lastName)) {
    return res.status(400).json({
      error: "Name fields may only include letters, spaces, hyphens, or apostrophes."
    });
  }

  if (!email && !phoneDigits) {
    return res.status(400).json({ error: "Email or phone is required." });
  }

  if (email && !validEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  if (phoneRaw && phoneDigits.length !== 10) {
    return res.status(400).json({ error: "Please enter a valid 10-digit phone number." });
  }

  const cfg = buildConfig();
  if (cfg.require_consent && !payload.consent_property_contact) {
    return res.status(400).json({ error: "Consent is required to continue." });
  }

  const score = calculateLeadScore(payload);
  const label = leadLabel(score);

  const visitorId = insertVisitor({
    event_slug: "default-open-house",
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    has_agent: payload.has_agent,
    buying_timeline: payload.buying_timeline,
    preapproved: payload.preapproved,
    price_range: payload.price_range,
    areas_interest: Array.isArray(payload.areas_interest) ? payload.areas_interest : [],
    notes: String(payload.notes || "").trim(),
    consent_property_contact: !!payload.consent_property_contact,
    consent_marketing: !!payload.consent_marketing,
    lead_score: score,
    lead_label: label,
    source_status: payload.source_status || "online"
  });

  res.json({
    success: true,
    visitor_id: visitorId,
    lead_score: score,
    lead_label: label
  });
});

// ---------- Admin routes ----------
app.post("/api/admin/login", (req, res) => {
  const pin = String(req.body.pin || "");
if (pin !== getAdminPin()) {
  return res.status(401).json({ error: "Invalid PIN" });
}

  const token = crypto.randomUUID();
  adminTokens.add(token);

  res.json({ success: true, token });
});

app.post("/api/admin/change-pin", requireAdmin, (req, res) => {
  const currentPin = String(req.body.current_pin || "");
  const newPin = String(req.body.new_pin || "");
  const confirmPin = String(req.body.confirm_pin || "");

  const actualPin = getAdminPin();

  if (currentPin !== actualPin) {
    return res.status(400).json({ error: "Current PIN is incorrect." });
  }

  if (!/^\d{4,8}$/.test(newPin)) {
    return res.status(400).json({ error: "New PIN must be 4 to 8 digits." });
  }

  if (newPin !== confirmPin) {
    return res.status(400).json({ error: "New PIN and confirmation do not match." });
  }

  updateSettings({ admin_pin: newPin });

  res.json({ success: true, message: "PIN updated successfully." });
});

app.get("/api/admin/status", requireAdmin, (req, res) => {
  const stats = getStats();
  res.json({
    ...stats,
    now: new Date().toISOString()
  });
});

app.get("/api/admin/settings", requireAdmin, (req, res) => {
  res.json(buildConfig());
});

app.post("/api/admin/settings", requireAdmin, (req, res) => {
  const body = req.body || {};

  let resetSeconds = Number(body.kiosk_reset_seconds || 90);
  if (!Number.isFinite(resetSeconds)) resetSeconds = 90;
  resetSeconds = Math.max(15, Math.min(300, Math.round(resetSeconds)));

  const patch = {
    brand_name: body.brand_name ?? "",
    agent_name: body.agent_name ?? "",
    brokerage_name: body.brokerage_name ?? "",
    property_address: body.property_address ?? "",
    welcome_message: body.welcome_message ?? "",

    listing_url: body.listing_url ?? "",
    feature_sheet_url: body.feature_sheet_url ?? "",
    similar_homes_url: body.similar_homes_url ?? "",
    book_showing_url: body.book_showing_url ?? "",

    hero_image_url: body.hero_image_url ?? "",
    agent_photo_url: body.agent_photo_url ?? "",

    brand_color: body.brand_color ?? "#0f172a",
    accent_color: body.accent_color ?? "#2563eb",

    require_consent: body.require_consent ? "1" : "0",
    ask_financing_question: body.ask_financing_question ? "1" : "0",

    // New fields
    qr_listing_title: String(body.qr_listing_title ?? "Listing").trim() || "Listing",
    qr_feature_title: String(body.qr_feature_title ?? "Feature Sheet").trim() || "Feature Sheet",
    qr_similar_title: String(body.qr_similar_title ?? "Similar Homes").trim() || "Similar Homes",
    qr_book_showing_title: String(body.qr_book_showing_title ?? "Book Showing").trim() || "Book Showing",
    kiosk_reset_seconds: String(resetSeconds),

    areas_options_json: JSON.stringify(Array.isArray(body.areas_options) ? body.areas_options : []),
    price_ranges_json: JSON.stringify(Array.isArray(body.price_ranges) ? body.price_ranges : [])
  };

  updateSettings(patch);
  res.json({ success: true });
});

app.get("/api/admin/visitors", requireAdmin, (req, res) => {
  const rows = listVisitors(500);
  res.json(rows);
});

app.post("/api/admin/clear-leads", requireAdmin, (req, res) => {
  const body = req.body || {};
  const confirmText = String(body.confirm_text || "").trim();

  if (confirmText !== "CLEAR") {
    return res.status(400).json({
      error: 'Confirmation failed. Type "CLEAR" to delete all leads.'
    });
  }

  const result = clearVisitors();

  res.json({
    success: true,
    deleted: result.deleted,
    message: `Deleted ${result.deleted} lead(s).`
  });
});

app.get("/api/admin/export.csv", requireAdmin, (req, res) => {
  const rows = listVisitors(5000);

  const headers = [
    "id",
    "created_at",
    "first_name",
    "last_name",
    "email",
    "phone",
    "has_agent",
    "buying_timeline",
    "preapproved",
    "price_range",
    "areas_interest",
    "notes",
    "consent_property_contact",
    "consent_marketing",
    "lead_score",
    "lead_label",
    "source_status"
  ];

  const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];

  rows.forEach((r) => {
    const row = [
      r.id,
      r.created_at,
      r.first_name,
      r.last_name,
      r.email,
      r.phone,
      r.has_agent,
      r.buying_timeline,
      r.preapproved,
      r.price_range,
      (r.areas_interest || []).join(" | "),
      r.notes,
      r.consent_property_contact,
      r.consent_marketing,
      r.lead_score,
      r.lead_label,
      r.source_status
    ];

    lines.push(row.map(csvEscape).join(","));
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=openhouse-leads.csv");
  res.send(lines.join("\n"));
});

// Optional production static serving
const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));

  app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Open House Lead Station API running on http://0.0.0.0:${PORT}`);
  console.log(`SQLite DB: ${dbPath}`);
});