import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { apiGet, apiPost, clearAdminToken, setAdminToken, getAdminToken } from "./api";
import { enqueueCheckin, flushQueue, getQueueCount } from "./offlineQueue";

const defaultForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  has_agent: "prefer_not",
  buying_timeline: "browsing",
  preapproved: "no",
  price_range: "",
  areas_interest: [],
  notes: "",
  consent_property_contact: false,
  consent_marketing: false
};

const AUTO_RESET_SECONDS = 45; // was 20 — more time to scan QR codes

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 10);
}

function formatPhone(value = "") {
  const digits = onlyDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function isValidName(value = "") {
  return NAME_REGEX.test(String(value).trim());
}

function isValidEmail(value = "") {
  return EMAIL_REGEX.test(String(value).trim());
}

function ChipGroup({ choices, value, onChange, multi = false }) {
  return (
    <div className={`chip-row ${multi ? "multi" : ""}`}>
      {choices.map((choice) => {
        const active = multi ? (value || []).includes(choice.value) : value === choice.value;

        return (
          <button
            type="button"
            key={choice.value}
            className={`chip ${active ? "active" : ""} ${multi ? "multi" : ""}`}
            onClick={() => {
              if (!multi) {
                onChange(choice.value);
                return;
              }

              const current = Array.isArray(value) ? value : [];
              if (current.includes(choice.value)) {
                onChange(current.filter((v) => v !== choice.value));
              } else {
                onChange([...current, choice.value]);
              }
            }}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

function StatBadge({ label, value }) {
  return (
    <div className="stat-badge">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("kiosk"); // kiosk | admin
  const [cfg, setCfg] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(defaultForm);
  const [err, setErr] = useState("");
  const [submitResult, setSubmitResult] = useState(null);
  const [qrs, setQrs] = useState({ listing: "", feature: "", similar: "", bookShowing: "" });
  const [queueCount, setQueueCount] = useState(0);
  const [syncBanner, setSyncBanner] = useState("");

  // admin state
  const [pin, setPin] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [adminVisitors, setAdminVisitors] = useState([]);
  const [adminSettings, setAdminSettings] = useState(null);
  const [adminMsg, setAdminMsg] = useState("");

  // hidden hotspot + auto-reset timers
  const adminTapCount = useRef(0);
  const adminTapTimer = useRef(null);
  const resetTimeoutRef = useRef(null);
  const resetIntervalRef = useRef(null);
  const [autoResetCountdown, setAutoResetCountdown] = useState(AUTO_RESET_SECONDS);

  const progressPercent = step <= 4 ? `${step * 25}%` : "100%";

  const areaChoices = useMemo(
    () => (cfg?.areas_options || []).map((a) => ({ value: a, label: a })),
    [cfg]
  );

  const priceChoices = useMemo(
    () => (cfg?.price_ranges || []).map((p) => ({ value: p.value, label: p.label })),
    [cfg]
  );

  const agentInitials = useMemo(() => {
    const name = (cfg?.agent_name || "Agent").trim();
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "AG"
    );
  }, [cfg]);

    const contactStepHasMinimumInput = Boolean(
        form.first_name.trim() &&
        form.last_name.trim() &&
        (form.email.trim() || onlyDigits(form.phone).length > 0)
    );

  async function refreshQueueCount() {
    setQueueCount(await getQueueCount());
  }

  async function loadConfig() {
    const data = await apiGet("/api/public/config");
    setCfg(data);
    setForm((prev) => ({
      ...prev,
      price_range: prev.price_range || data.price_ranges?.[0]?.value || ""
    }));

    document.documentElement.style.setProperty("--brand", data.brand_color || "#0f172a");
    document.documentElement.style.setProperty("--accent", data.accent_color || "#2563eb");
  }

  async function tryFlushQueue() {
    try {
      const result = await flushQueue((payload) =>
        apiPost("/api/public/checkin", { ...payload, source_status: "offline_queued" })
      );

      if (result.flushed > 0) {
        setSyncBanner(`Synced ${result.flushed} offline sign-in(s).`);
        setTimeout(() => setSyncBanner(""), 3000);
      }

      await refreshQueueCount();
    } catch {
      // leave queue as-is
    }
  }

  function resetKiosk() {
    setStep(1);
    setErr("");
    setSubmitResult(null);
    setQrs({ listing: "", feature: "", similar: "", bookShowing: "" });
    setForm({
      ...defaultForm,
      price_range: cfg?.price_ranges?.[0]?.value || ""
    });
  }

  function openAdminFromHotspot() {
    adminTapCount.current += 1;
    clearTimeout(adminTapTimer.current);

    adminTapTimer.current = setTimeout(() => {
      adminTapCount.current = 0;
    }, 1200);

    if (adminTapCount.current >= 4) {
      setMode("admin");
      adminTapCount.current = 0;
    }
  }

  useEffect(() => {
    (async () => {
      await loadConfig();
      await refreshQueueCount();
      await tryFlushQueue();
    })();

    const onOnline = () => {
      tryFlushQueue();
    };

    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("online", onOnline);
      clearTimeout(adminTapTimer.current);
      clearTimeout(resetTimeoutRef.current);
      clearInterval(resetIntervalRef.current);
    };
  }, []);

  useEffect(() => {
  if (!submitResult || !cfg) return;

  (async () => {
    const [listing, feature, similar, bookShowing] = await Promise.all([
      cfg.listing_url ? QRCode.toDataURL(cfg.listing_url, { width: 200, margin: 1 }) : "",
      cfg.feature_sheet_url ? QRCode.toDataURL(cfg.feature_sheet_url, { width: 200, margin: 1 }) : "",
      cfg.similar_homes_url ? QRCode.toDataURL(cfg.similar_homes_url, { width: 200, margin: 1 }) : "",
      cfg.book_showing_url ? QRCode.toDataURL(cfg.book_showing_url, { width: 200, margin: 1 }) : ""
    ]);

    setQrs({ listing, feature, similar, bookShowing });
  })();
}, [submitResult, cfg]);

  // Auto-reset thank-you screen after configured delay
    useEffect(() => {
        clearTimeout(resetTimeoutRef.current);
        clearInterval(resetIntervalRef.current);

        if (step !== 5) return;

        const resetSeconds = Number(cfg?.kiosk_reset_seconds || AUTO_RESET_SECONDS);

        setAutoResetCountdown(resetSeconds);

        resetIntervalRef.current = setInterval(() => {
            setAutoResetCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        resetTimeoutRef.current = setTimeout(() => {
            resetKiosk();
        }, resetSeconds * 1000);

        return () => {
            clearTimeout(resetTimeoutRef.current);
            clearInterval(resetIntervalRef.current);
        };
        }, [step, cfg]);

  function validateContactStep() {
    const first = form.first_name.trim();
    const last = form.last_name.trim();
    const email = form.email.trim();
    const phoneDigits = onlyDigits(form.phone);

    if (!first || !last) {
      setErr("Please enter your first and last name.");
      return false;
    }

    if (!isValidName(first) || !isValidName(last)) {
      setErr("Name fields should only contain letters, spaces, hyphens, or apostrophes.");
      return false;
    }

    if (!email && !phoneDigits) {
      setErr("Please enter an email or a 10-digit phone number.");
      return false;
    }

    if (email && !isValidEmail(email)) {
      setErr("Please enter a valid email address (example: name@example.com).");
      return false;
    }

    if (phoneDigits && phoneDigits.length !== 10) {
      setErr("Please enter a valid 10-digit phone number.");
      return false;
    }

    setErr("");
    return true;
  }

  async function submitCheckin() {
    setErr("");

    if (!validateContactStep()) {
      setStep(2);
      return;
    }

    if (cfg.require_consent && !form.consent_property_contact) {
      setErr("Please check the property contact consent box.");
      return;
    }

    const payload = {
      ...form,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: formatPhone(form.phone), // stores a clean formatted phone
      notes: form.notes.trim()
    };

    try {
      const result = await apiPost("/api/public/checkin", payload);
      setSubmitResult({ ...result, queued: false });
      setStep(5);
      await tryFlushQueue();
    } catch (e) {
      // Validation/client errors: show them
      if (e?.status && e.status < 500) {
        setErr(e.message || "There was a problem submitting.");
        return;
      }

      // Server/network issue: queue locally
      await enqueueCheckin(payload);
      await refreshQueueCount();

      setSubmitResult({
        lead_label: "Saved Offline",
        lead_score: "--",
        queued: true
      });
      setStep(5);
    }
  }

  // -------- Admin helpers --------
  async function adminLogin() {
    try {
      const result = await apiPost("/api/admin/login", { pin });
      setAdminToken(result.token);
      setAdminAuthed(true);
      await loadAdminData();
      setAdminMsg("");
    } catch (e) {
      setAdminMsg(e?.message || "Invalid PIN");
    }
  }

  async function loadAdminData() {
    const [stats, settings, visitors] = await Promise.all([
      apiGet("/api/admin/status", { admin: true }),
      apiGet("/api/admin/settings", { admin: true }),
      apiGet("/api/admin/visitors", { admin: true })
    ]);

    setAdminStats(stats);

    setAdminSettings({
      ...settings,
      areas_options_text: (settings.areas_options || []).join(", "),
      price_ranges_text: (settings.price_ranges || [])
        .map((p) => `${p.value}|${p.label}`)
        .join(", ")
    });

    setAdminVisitors(visitors);
  }

  useEffect(() => {
    if (mode !== "admin") return;

    const token = getAdminToken();
    if (!token) return;

    setAdminAuthed(true);

    loadAdminData().catch(() => {
      clearAdminToken();
      setAdminAuthed(false);
    });
  }, [mode]);

  async function saveAdminSettings() {
    if (!adminSettings) return;

    const payload = {
      ...adminSettings,
      areas_options: String(adminSettings.areas_options_text || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    qr_listing_title: String(adminSettings.qr_listing_title || "Listing").trim() || "Listing",
    qr_feature_title: String(adminSettings.qr_feature_title || "Feature Sheet").trim() || "Feature Sheet",
    qr_similar_title: String(adminSettings.qr_similar_title || "Similar Homes").trim() || "Similar Homes",
    qr_book_showing_title: String(adminSettings.qr_book_showing_title || "Book Showing").trim() || "Book Showing",
    kiosk_reset_seconds: Number(adminSettings.kiosk_reset_seconds || 90),
      price_ranges: String(adminSettings.price_ranges_text || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((pair) => {
          const [value, label] = pair.split("|");
          return {
            value: (value || "").trim(),
            label: (label || value || "").trim()
          };
        })
        .filter((p) => p.value),
      require_consent: !!adminSettings.require_consent,
      ask_financing_question: !!adminSettings.ask_financing_question
    };

    await apiPost("/api/admin/settings", payload, { admin: true });

    setAdminMsg("Settings saved.");
    setTimeout(() => setAdminMsg(""), 2000);

    await loadConfig();
    await loadAdminData();
  }

  async function runRefreshAndSyncQueue() {
    await loadAdminData();
    await tryFlushQueue();
  }

  // -------- UI --------
  if (!cfg) {
    return <div className="loading">Loading kiosk…</div>;
  }

  if (mode === "admin") {
    return (
      <div className="admin-shell">
        <div className="admin-header">
          <div>
            <h1>Open House Lead Station Admin</h1>
            <p>Manage the event, branding, and leads.</p>
          </div>

          <button
            className="btn"
            onClick={() => {
              setMode("kiosk");
              setPin("");
              setAdminMsg("");
            }}
          >
            Back to Kiosk
          </button>
        </div>

        {!adminAuthed ? (
          <div className="panel admin-login">
            <h3>Enter Admin PIN</h3>

            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              onKeyDown={(e) => {
                if (e.key === "Enter") adminLogin();
              }}
            />

            {adminMsg ? <div className="error">{adminMsg}</div> : null}

            <div className="actions">
              <button className="btn btn-primary" onClick={adminLogin}>
                Unlock
              </button>
            </div>
          </div>
        ) : (
          <div className="admin-grid">
            <div className="panel">
              <h3>Event & Branding</h3>

              <label>Brand Name</label>
              <input
                value={adminSettings?.brand_name || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, brand_name: e.target.value })}
              />

              <label>Agent Name</label>
              <input
                value={adminSettings?.agent_name || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, agent_name: e.target.value })}
              />

              <label>Brokerage Name</label>
              <input
                value={adminSettings?.brokerage_name || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, brokerage_name: e.target.value })}
              />

              <label>Property Address</label>
              <input
                value={adminSettings?.property_address || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, property_address: e.target.value })}
              />

              <label>Hero Image URL</label>
              <input
                value={adminSettings?.hero_image_url || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, hero_image_url: e.target.value })}
                placeholder="https://..."
              />

              <label>Agent Headshot / Logo URL</label>
              <input
                value={adminSettings?.agent_photo_url || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, agent_photo_url: e.target.value })}
                placeholder="https://..."
              />

              <label>Welcome Message</label>
              <textarea
                rows={2}
                value={adminSettings?.welcome_message || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, welcome_message: e.target.value })}
              />

              <label>QR Title: Listing</label>
                <input
                value={adminSettings?.qr_listing_title || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, qr_listing_title: e.target.value })}
                />

                <label>QR Title: Feature Sheet</label>
                <input
                value={adminSettings?.qr_feature_title || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, qr_feature_title: e.target.value })}
                />

                <label>QR Title: Similar Homes</label>
                <input
                value={adminSettings?.qr_similar_title || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, qr_similar_title: e.target.value })}
                />

                <label>QR Title: Book Showing</label>
                <input
                value={adminSettings?.qr_book_showing_title || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, qr_book_showing_title: e.target.value })}
                />

                <label>Auto Reset Time (seconds)</label>
                <input
                type="number"
                min="15"
                max="300"
                value={adminSettings?.kiosk_reset_seconds ?? 90}
                onChange={(e) =>
                    setAdminSettings({
                    ...adminSettings,
                    kiosk_reset_seconds: e.target.value
                    })
                }
                />
                <div className="small muted" style={{ marginTop: 4 }}>
                Recommended: 90 seconds
                </div>

              <label>Listing URL</label>
              <input
                value={adminSettings?.listing_url || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, listing_url: e.target.value })}
              />

              <label>Feature Sheet URL</label>
              <input
                value={adminSettings?.feature_sheet_url || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, feature_sheet_url: e.target.value })}
              />

              <label>Similar Homes URL</label>
              <input
                value={adminSettings?.similar_homes_url || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, similar_homes_url: e.target.value })}
              />

              <label>Book Showing URL</label>
              <input
                value={adminSettings?.book_showing_url || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, book_showing_url: e.target.value })}
              />

              <div className="grid two">
                <div>
                  <label>Brand Color</label>
                  <input
                    type="color"
                    value={adminSettings?.brand_color || "#0f172a"}
                    onChange={(e) => setAdminSettings({ ...adminSettings, brand_color: e.target.value })}
                  />
                </div>

                <div>
                  <label>Accent Color</label>
                  <input
                    type="color"
                    value={adminSettings?.accent_color || "#2563eb"}
                    onChange={(e) => setAdminSettings({ ...adminSettings, accent_color: e.target.value })}
                  />
                </div>
              </div>

              <label>Areas (comma-separated)</label>
              <input
                value={adminSettings?.areas_options_text || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, areas_options_text: e.target.value })}
              />

              <label>Price Ranges (value|Label, comma-separated)</label>
              <input
                value={adminSettings?.price_ranges_text || ""}
                onChange={(e) => setAdminSettings({ ...adminSettings, price_ranges_text: e.target.value })}
              />

              <label className="check">
                <input
                  type="checkbox"
                  checked={!!adminSettings?.require_consent}
                  onChange={(e) => setAdminSettings({ ...adminSettings, require_consent: e.target.checked })}
                />
                <span>Require consent</span>
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={!!adminSettings?.ask_financing_question}
                  onChange={(e) => setAdminSettings({ ...adminSettings, ask_financing_question: e.target.checked })}
                />
                <span>Show pre-approval question</span>
              </label>

              <div className="actions">
                <button className="btn btn-primary" onClick={saveAdminSettings}>
                  Save
                </button>
                <span className="small">{adminMsg}</span>
              </div>
            </div>

            <div className="panel">
              <h3>Live Summary</h3>

              <div className="stats-row">
                <StatBadge label="Total" value={adminStats?.total ?? 0} />
                <StatBadge label="Hot" value={adminStats?.hot ?? 0} />
                <StatBadge label="Warm" value={adminStats?.warm ?? 0} />
                <StatBadge label="Nurture" value={adminStats?.nurture ?? 0} />
              </div>

              <div className="small" style={{ marginBottom: 8 }}>
                Pending offline queue on this device: {queueCount}
              </div>

              <div className="actions">
                <button className="btn" onClick={runRefreshAndSyncQueue}>
                  Refresh
                </button>

                <a
                  className="btn"
                  href={`/api/admin/export.csv?token=${encodeURIComponent(getAdminToken() || "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Export CSV
                </a>
              </div>

              <h3 style={{ marginTop: 18 }}>Recent Visitors</h3>

              <div className="visitor-list">
                {adminVisitors.length === 0 && <div className="visitor-row">No visitors yet.</div>}

                {adminVisitors.map((v) => (
                  <div key={v.id} className="visitor-row">
                    <div className="visitor-head">
                      <strong>
                        {v.first_name} {v.last_name}
                      </strong>
                      <span className={`badge ${String(v.lead_label).toLowerCase()}`}>
                        {v.lead_label} ({v.lead_score})
                      </span>
                    </div>

                    <div className="small">
                      {[v.email, v.phone].filter(Boolean).join(" • ") || "No contact value"}
                    </div>

                    <div className="small">
                      Timeline: {v.buying_timeline || "-"} • Price: {v.price_range || "-"} • Agent: {v.has_agent || "-"}
                    </div>

                    <div className="small">
                      Areas: {(v.areas_interest || []).join(", ") || "-"}
                    </div>

                    <div className="small">
                      {new Date(`${v.created_at}Z`).toLocaleString()} • {v.source_status}
                    </div>
                  </div>
                ))}
              </div>

              <div className="actions" style={{ marginTop: 12 }}>
                <button
                  className="btn"
                  onClick={() => {
                    clearAdminToken();
                    setAdminAuthed(false);
                    setPin("");
                    setAdminMsg("");
                  }}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Kiosk mode UI
  return (
    <div className="kiosk-shell">
      <button className="admin-hotspot" onClick={openAdminFromHotspot} aria-label="Admin hotspot" />

      {/* Optional dev helper: visible on localhost only */}
      {window.location.hostname === "localhost" && (
        <button className="dev-admin-btn" onClick={() => setMode("admin")}>
          Admin
        </button>
      )}

      <div className="kiosk-shell-inner">
        <header className="topbar">
          <div>
            <div className="brand-sub">{cfg.brand_name}</div>
            <div className="address">{cfg.property_address}</div>
          </div>

          <div className="agent-block">
            {cfg.agent_photo_url ? (
              <img className="agent-photo" src={cfg.agent_photo_url} alt={cfg.agent_name || "Agent"} />
            ) : (
              <div className="agent-fallback">{agentInitials}</div>
            )}

            <div className="agent-meta">
              <div className="agent-name">{cfg.agent_name}</div>
              <div className="small-light">{cfg.brokerage_name}</div>
            </div>
          </div>
        </header>

        {syncBanner && <div className="sync-banner">{syncBanner}</div>}
        {queueCount > 0 && (
          <div className="offline-banner">Offline queue: {queueCount} sign-in(s) pending sync</div>
        )}

        <section
          className="hero-card"
          style={cfg.hero_image_url ? { backgroundImage: `url(${cfg.hero_image_url})` } : undefined}
        >
          <div className="hero-overlay">
            <div className="hero-content">
              <div className="hero-kicker">Open House</div>
              <div className="hero-title">{cfg.property_address}</div>
              <div className="hero-text">{cfg.welcome_message}</div>

              <div className="hero-pills">
                <span className="hero-pill">{cfg.agent_name}</span>
                <span className="hero-pill">{cfg.brokerage_name}</span>
              </div>
            </div>
          </div>
        </section>

        <main className="panel kiosk-panel">
          {step <= 4 && (
            <div className="progress">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: progressPercent }} />
              </div>
              <div className="small">Step {step} of 4</div>
            </div>
          )}

          {step === 1 && (
            <section>
              <h1>Welcome</h1>
              <p className="muted">{cfg.welcome_message}</p>

              <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                Start Sign-In
              </button>
            </section>
          )}

{step === 2 && (
  <section>
    <div className="section-head">
      <h2>Quick Sign-In</h2>
      <p className="muted">
        Please enter your contact info so we can send the feature sheet and follow up on this property.
      </p>
    </div>

    <div className="form-card">
      <div className="grid two">
        <div>
          <label>
            First Name <span className="req">*</span>
          </label>
          <input
            value={form.first_name}
            onChange={(e) => {
              setErr("");
              setForm({ ...form, first_name: e.target.value });
            }}
            placeholder=""
            autoComplete="given-name"
          />
        </div>

        <div>
          <label>
            Last Name <span className="req">*</span>
          </label>
          <input
            value={form.last_name}
            onChange={(e) => {
              setErr("");
              setForm({ ...form, last_name: e.target.value });
            }}
            placeholder=""
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="grid two">
        <div>
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => {
              setErr("");
              setForm({ ...form, email: e.target.value });
            }}
            placeholder="name@example.com"
            autoComplete="email"
            inputMode="email"
          />
          <div className="field-help">Example: name@example.com</div>
        </div>

        <div>
          <label>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => {
              setErr("");
              setForm({ ...form, phone: formatPhone(e.target.value) });
            }}
            placeholder="403-555-1234"
            autoComplete="tel"
            inputMode="numeric"
            maxLength={14}
          />
          <div className="field-help">Example: 403-555-1234 (10 digits)</div>
        </div>
      </div>

      <div className="contact-note">
        <span className="req">*</span> First and last name are required. You must also provide an email or phone number.
      </div>

      {err && <div className="error">{err}</div>}

      <div className="actions">
        <button className="btn" onClick={() => setStep(1)}>
          Back
        </button>

        <button
          className="btn btn-primary"
          disabled={!contactStepHasMinimumInput}
          onClick={() => {
            if (!validateContactStep()) return;
            setStep(3);
          }}
        >
          Next
        </button>
      </div>
    </div>
  </section>
)}

          {step === 3 && (
            <section>
              <h2>Buyer Profile</h2>
              <p className="muted">A few quick questions so we can help better.</p>

              <label>Are you working with an agent?</label>
              <ChipGroup
                choices={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "prefer_not", label: "Prefer not to say" }
                ]}
                value={form.has_agent}
                onChange={(value) => setForm({ ...form, has_agent: value })}
              />

              <label>When are you planning to buy?</label>
              <ChipGroup
                choices={[
                  { value: "0_3", label: "0–3 months" },
                  { value: "3_6", label: "3–6 months" },
                  { value: "6_12", label: "6–12 months" },
                  { value: "browsing", label: "Just browsing" }
                ]}
                value={form.buying_timeline}
                onChange={(value) => setForm({ ...form, buying_timeline: value })}
              />

              {cfg.ask_financing_question && (
                <>
                  <label>Are you pre-approved?</label>
                  <ChipGroup
                    choices={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                      { value: "need_help", label: "Need help" }
                    ]}
                    value={form.preapproved}
                    onChange={(value) => setForm({ ...form, preapproved: value })}
                  />
                </>
              )}

              <label>Preferred price range</label>
              <ChipGroup
                choices={priceChoices}
                value={form.price_range}
                onChange={(value) => setForm({ ...form, price_range: value })}
              />

              <label>Areas of interest</label>
              <ChipGroup
                choices={areaChoices}
                value={form.areas_interest}
                onChange={(value) => setForm({ ...form, areas_interest: value })}
                multi
              />

              <label>Anything specific you’re looking for? (optional)</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Garage, suite, fenced yard, etc."
              />

              <div className="actions">
                <button className="btn" onClick={() => setStep(2)}>
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setErr("");
                    setStep(4);
                  }}
                >
                  Next
                </button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <h2>Consent & Submit</h2>

              <div className="check-wrap">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.consent_property_contact}
                    onChange={(e) => setForm({ ...form, consent_property_contact: e.target.checked })}
                  />
                  <span>I consent to being contacted about this property.</span>
                </label>

                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.consent_marketing}
                    onChange={(e) => setForm({ ...form, consent_marketing: e.target.checked })}
                  />
                  <span>I’d like updates on similar homes and market updates.</span>
                </label>
              </div>

              {err && <div className="error">{err}</div>}

              <div className="actions">
                <button className="btn" onClick={() => setStep(3)}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={submitCheckin}>
                  Submit
                </button>
              </div>
            </section>
          )}

          {step === 5 && (
            <section>
              <h2>Thank you{form.first_name ? `, ${form.first_name}` : ""}!</h2>

              <p className="muted">
                {submitResult?.queued
                  ? "Saved on this device. It will sync automatically when internet is available."
                  : "Your sign-in is complete. Scan any code below."}
              </p>

              <div className="score-card success-only">
                <div className="small">Sign-in complete</div>
                <div className="score-value">
                  {submitResult?.queued
                    ? "Thanks! Your info is safely saved on this device."
                    : "Thanks! Scan a code below for listing details."}
                </div>
              </div>

              {(() => {
                const qrCards = [
                    {
                    key: "listing",
                    title: cfg.qr_listing_title || "Listing",
                    img: qrs.listing
                    },
                    {
                    key: "feature",
                    title: cfg.qr_feature_title || "Feature Sheet",
                    img: qrs.feature
                    },
                    {
                    key: "similar",
                    title: cfg.qr_similar_title || "Similar Homes",
                    img: qrs.similar
                    },
                    {
                    key: "bookShowing",
                    title: cfg.qr_book_showing_title || "Book Showing",
                    img: qrs.bookShowing
                    }
                ].filter((card) => !!card.img);

                return qrCards.length > 0 ? (
                    <div className="qr-grid">
                    {qrCards.map((card) => (
                        <div className="qr-card" key={card.key}>
                        <div className="qr-title">{card.title}</div>
                        <img src={card.img} alt={`${card.title} QR`} />
                        </div>
                    ))}
                    </div>
                ) : (
                    <div className="small">No QR links are configured yet.</div>
                );
                })()}

              <div className="countdown-note">This screen will reset in {autoResetCountdown}s</div>

              <div className="actions center">
                <button className="btn btn-primary btn-lg" onClick={resetKiosk}>
                  Done
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}