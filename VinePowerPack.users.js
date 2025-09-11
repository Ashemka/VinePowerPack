// ==UserScript==
// @name         Vine Power Pack by Ashemka
// @author       Ashemka
// @version      4.1.2.1
// @description  Fusion : Potluck ASIN + Webhook + Auto-refresh + Échanges/Export PDF  •  +  •  Pro “Vine Reviews” (pending CS, modèles email, harvest, stats, ratio, jours restants, dark) (VPP)
// @match        https://www.amazon.fr/vine/*
// @match        https://www.amazon.fr/vine/vine-items?*
// @match        https://www.amazon.fr/vine/orders*
// @match        https://www.amazon.fr/vine/vine-reviews*
// @match        https://www.amazon.fr/vine/account*
// @match        https://www.amazon.fr/gp/legacy/order-history?orderFilter=cancelled*
// @match        https://www.amazon.fr/gp/css/order-history?ref_=nav_orders_first
// @match        https://www.amazon.fr/gp/your-account/order-history/*
// @match        https://www.amazon.fr/your-orders/orders?*
// @match        https://www.amazon.fr/gp/profile/*
// @match        https://www.amazon.fr/gp/css/homepage.html?ref_=nav_youraccount_btn
// @match        https://www.amazon.fr/gp/css/homepage.html?ref_=nav_AccountFlyout_ya
// @match        https://www.amazon.fr/gp/buy/thankyou*
// @match        https://www.amazon.fr/review/create-review*
// @match        https://www.amazon.fr/review/create-review/*
// @updateURL    https://raw.githubusercontent.com/Ashemka/VinePowerPack/main/VinePowerPack.users.js
// @downloadURL  https://raw.githubusercontent.com/Ashemka/VinePowerPack/main/VinePowerPack.users.js
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        window.close
// @grant        GM_xmlhttpRequest
// @connect      amazon.fr
// @connect      *
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// ==/UserScript==

const ENABLE_VPP = !0;
(function () {
    "use strict";
    const HEXFUSE_VERSION = "4.14.0";
    if (window.__HEX_VINE_FUSION_414__) return;
    window.__HEX_VINE_FUSION_414__ = !0;
    const usp = new URLSearchParams(location.search);
    const QUEUE = usp.get("queue");
    const ALLOWED = new Set(["encore", "last_chance", "potluck"]);
    if (!ALLOWED.has(QUEUE)) return;
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const clamp = (n, a, b) => Math.min(Math.max(n, a), b);
    const randInt = (mi, ma) => Math.floor(Math.random() * (ma - mi + 1)) + mi;
    const nowMs = () => Date.now();
    const parseIntSafe = (v, def = 0) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : def;
    };
    const hmToMin = (s) => {
        if (!s || !/:/.test(s)) return 0;
        const [h, m] = s.split(":").map((x) => parseInt(x, 10) || 0);
        return h * 60 + m;
    };
    const localHMS = () => {
        const d = new Date();
        const h = String(d.getHours()).padStart(2, "0"),
            m = String(d.getMinutes()).padStart(2, "0"),
            s = String(d.getSeconds()).padStart(2, "0");
        return { h, m, s, str: `${h}:${m}:${s}` };
    };
    const hashSimple = (obj) => {
        try {
            return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 32);
        } catch {
            return String(Math.random()).slice(2);
        }
    };
    const clip = (s, max = 80) => {
        s = String(s || "");
        return s.length > max ? s.slice(0, max - 1) + "…" : s;
    };
    function buildGet(base, params) {
        const u = new URL(base, location.origin);
        Object.entries(params || {}).forEach(([k, v]) => u.searchParams.append(k, String(v)));
        return u.toString();
    }
    let DEBUG = !!GM_getValue("hexfuse.debug", !1);
    const log = (...a) => {
        if (DEBUG)
            try {
                console.log("[HexVine]", ...a);
            } catch {}
    };
    const warn = (...a) => {
        try {
            console.warn("[HexVine]", ...a);
        } catch {}
    };
    const K_SETTINGS = "hexfuse.settings.v4.14";
    const getSettings = () => GM_getValue(K_SETTINGS, null);
    const setSettings = (s) => GM_setValue(K_SETTINGS, s);
    const kq = (queue, key) => `hexfuse.${queue}.${key}`;
    const getLS = (k, d = null) => {
        try {
            const v = localStorage.getItem(k);
            return v ? JSON.parse(v) : d;
        } catch {
            return d;
        }
    };
    const setLS = (k, v) => {
        try {
            localStorage.setItem(k, JSON.stringify(v));
        } catch {}
    };
    const TAB_ID = (function () {
        try {
            const k = `hexfuse.tabid.${QUEUE}`;
            let id = sessionStorage.getItem(k);
            if (!id) {
                id = `${QUEUE}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
                sessionStorage.setItem(k, id);
            }
            return id;
        } catch {
            return `${QUEUE}-single`;
        }
    })();
    const kt = (key) => `hexfuse.tab.${TAB_ID}.${key}`;
    const ssGet = (k, d = null) => {
        try {
            const v = sessionStorage.getItem(k);
            return v != null ? JSON.parse(v) : d;
        } catch {
            return d;
        }
    };
    const ssSet = (k, v) => {
        try {
            sessionStorage.setItem(k, JSON.stringify(v));
        } catch {}
    };
    const DEF_SCHEDULES = [
        { enabled: !1, start: "00:00", end: "06:00", minMin: 10, maxMin: 30 },
        { enabled: !1, start: "06:00", end: "12:00", minMin: 15, maxMin: 40 },
        { enabled: !1, start: "12:00", end: "18:00", minMin: 20, maxMin: 45 },
        { enabled: !1, start: "18:00", end: "23:59", minMin: 15, maxMin: 40 },
    ];
    const DEFAULTS = {
        theme: "system",
        accent: "bleu",
        showClock: !0,
        showCountdown: !0,
        minuteGate: !0,
        defaultLanding: "potluck",
        queues: {
            potluck: {
                mode: "diff",
                useSchedules: !0,
                minSec: 30,
                maxSec: 120,
                super: { enabled: !0, durationSec: 300, minSec: 2, maxSec: 10 },
                schedules: JSON.parse(JSON.stringify(DEF_SCHEDULES)),
                webhook: { url: "", mode: "json", cooldownSec: 2, threshold: 1 },
            },
            last_chance: {
                mode: "diff",
                useSchedules: !0,
                minSec: 30,
                maxSec: 120,
                super: { enabled: !0, durationSec: 300, minSec: 2, maxSec: 10 },
                schedules: JSON.parse(JSON.stringify(DEF_SCHEDULES)),
                webhook: { url: "", mode: "json", cooldownSec: 2, threshold: 1 },
            },
            encore: {
                mode: "delta",
                useSchedules: !0,
                minSec: 30,
                maxSec: 120,
                super: { enabled: !0, durationSec: 300, minSec: 2, maxSec: 10 },
                schedules: JSON.parse(JSON.stringify(DEF_SCHEDULES)),
                webhook: { url: "", mode: "get", cooldownSec: 2, threshold: 1 },
            },
        },
        diff: { flapTTLms: 4000 },
        folds: {},
        history: { enableReappear: !0, groupView: !1, showImages: !0, maxEvents: 400, maxProducts: 400, filterType: "all", search: "" },
        ui: { activePane: "pane-pot" },
        meta: { version: HEXFUSE_VERSION, schema: 2 },
    };
    let settings = getSettings() || DEFAULTS;
    ["potluck", "last_chance", "encore"].forEach((q) => {
        const ref = DEFAULTS.queues[q];
        const cur = settings.queues?.[q] || {};
        if (cur.webhooks) {
            const { diffPost, deltaGet, cooldownSec, threshold } = cur.webhooks;
            cur.webhook = cur.webhook || { url: diffPost || deltaGet || "", mode: diffPost ? "json" : deltaGet ? "get" : "json", cooldownSec: cooldownSec ?? 2, threshold: threshold ?? 1 };
            delete cur.webhooks;
        }
        if (cur.useSchedules == null) cur.useSchedules = !0;
        if (!cur.schedules) cur.schedules = JSON.parse(JSON.stringify(ref.schedules));
        if (!cur.webhook) cur.webhook = JSON.parse(JSON.stringify(ref.webhook));
        settings.queues[q] = cur;
    });
    settings.history = Object.assign({}, DEFAULTS.history, settings.history || {});
    settings.folds = Object.assign({}, DEFAULTS.folds, settings.folds || {});
    settings.ui = Object.assign({}, DEFAULTS.ui, settings.ui || {});
    if (!settings.accent) settings.accent = "bleu";
    if (!settings.defaultLanding) settings.defaultLanding = "potluck";
    settings.meta = Object.assign({}, DEFAULTS.meta, settings.meta || {});
    setSettings(settings);
    const ACCENTS = {
        bleu: { accent: "#60a5fa", strong: "#3b82f6", grad: "linear-gradient(135deg,#60a5fa,#7c3aed)" },
        indigo: { accent: "#818cf8", strong: "#6366f1", grad: "linear-gradient(135deg,#818cf8,#22d3ee)" },
        cyan: { accent: "#22d3ee", strong: "#06b6d4", grad: "linear-gradient(135deg,#22d3ee,#3b82f6)" },
        ciel: { accent: "#7dd3fc", strong: "#38bdf8", grad: "linear-gradient(135deg,#7dd3fc,#3b82f6)" },
        sarcelle: { accent: "#2dd4bf", strong: "#14b8a6", grad: "linear-gradient(135deg,#2dd4bf,#60a5fa)" },
        vert: { accent: "#34d399", strong: "#10b981", grad: "linear-gradient(135deg,#34d399,#0ea5e9)" },
        emeraude: { accent: "#6ee7b7", strong: "#10b981", grad: "linear-gradient(135deg,#6ee7b7,#16a34a)" },
        citron: { accent: "#a3e635", strong: "#84cc16", grad: "linear-gradient(135deg,#a3e635,#10b981)" },
        ambre: { accent: "#fbbf24", strong: "#f59e0b", grad: "linear-gradient(135deg,#fbbf24,#ef4444)" },
        orange: { accent: "#fb923c", strong: "#f97316", grad: "linear-gradient(135deg,#fb923c,#ef4444)" },
        rouge: { accent: "#f87171", strong: "#ef4444", grad: "linear-gradient(135deg,#f87171,#fb923c)" },
        rose: { accent: "#f472b6", strong: "#ec4899", grad: "linear-gradient(135deg,#f472b6,#8b5cf6)" },
        fuchsia: { accent: "#e879f9", strong: "#d946ef", grad: "linear-gradient(135deg,#e879f9,#8b5cf6)" },
        violet: { accent: "#a78bfa", strong: "#7c3aed", grad: "linear-gradient(135deg,#a78bfa,#3b82f6)" },
        pourpre: { accent: "#c4b5fd", strong: "#8b5cf6", grad: "linear-gradient(135deg,#c4b5fd,#6366f1)" },
        neutre: { accent: "#cbd5e1", strong: "#94a3b8", grad: "linear-gradient(135deg,#cbd5e1,#64748b)" },
    };
    const THEMES = {
        clair: { fg: "#0f172a", bg: "rgba(255,255,255,.96)", muted: "#475569", border: "rgba(0,0,0,.08)", inputBg: "#ffffff", inputBorder: "#e5e7eb", inputFg: "#0f172a", scheme: "light" },
        sombre: { fg: "#f8fafc", bg: "rgba(17,24,39,.92)", muted: "#cbd5e1", border: "rgba(255,255,255,.06)", inputBg: "#0b1220", inputBorder: "#263241", inputFg: "#f8fafc", scheme: "dark" },
        gris: { fg: "#f8fafc", bg: "rgba(31,41,55,.92)", muted: "#cbd5e1", border: "rgba(255,255,255,.06)", inputBg: "#111827", inputBorder: "#263241", inputFg: "#f8fafc", scheme: "dark" },
        system: "system",
    };
    const prefersDark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    function applyTheme() {
        const themeName = settings.theme === "system" ? (prefersDark() ? "sombre" : "clair") : settings.theme;
        const t = themeName === "system" ? THEMES[prefersDark() ? "sombre" : "clair"] : THEMES[themeName] || THEMES.sombre;
        const a = ACCENTS[settings.accent] || ACCENTS.bleu;
        GM_addStyle(`
      :root{
        --hx-fg:${t.fg};--hx-bg:${t.bg};--hx-muted:${t.muted};--hx-border:${t.border};
        --hx-input-bg:${t.inputBg};--hx-input-fg:${t.inputFg};--hx-input-border:${t.inputBorder};
        --hx-accent:${a.accent};--hx-strong:${a.strong};--hx-grad:${a.grad};
        --hx-good:#10b981;--hx-bad:#ef4444;--hx-shadow:0 14px 36px rgba(0,0,0,.35)
      }
      .hx-card,.hx-modal{ color-scheme:${t.scheme}; }
      .hx-input::placeholder{ color: var(--hx-muted); opacity:.8 }
      input[type="time"].hx-input::-webkit-datetime-edit{ color:var(--hx-input-fg) }
      input[type="time"].hx-input::-webkit-calendar-picker-indicator{ filter: invert(1) }
    `);
    }
    applyTheme();
    GM_addStyle(`
    .hx-card{position:fixed;z-index:2147483640;top:20px;right:20px;background:var(--hx-bg);color:var(--hx-fg);backdrop-filter:saturate(1.05) blur(6px);-webkit-backdrop-filter:saturate(1.05) blur(6px);border-radius:16px;box-shadow:var(--hx-shadow);border:1px solid var(--hx-border);min-width:320px;max-width:420px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial}
    .hx-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--hx-grad);color:#fff;border-radius:16px 16px 0 0;user-select:none}
    .hx-left{display:flex;align-items:center;gap:8px}
    .hx-right{display:flex;align-items:center;gap:6px}
    .hx-qshort{padding:2px 6px;border-radius:999px;font-weight:900;font-size:10px;color:#fff;border:1px solid rgba(255,255,255,.25)}
    .hx-q-rec{background:#10b981;border-color:#10b981}
    .hx-q-tous{background:#ef4444;border-color:#ef4444}
    .hx-q-enc{background:#f59e0b;border-color:#f59e0b}
    .hx-pills{display:flex;gap:6px;align-items:center}
    .hx-pill{padding:2px 6px;border-radius:999px;font-weight:800;font-size:10px;letter-spacing:.3px;border:1px solid rgba(255,255,255,.35);background:#0000;color:#fff}
    .hx-pill-auto.on{border-color:var(--hx-good)}
    .hx-pill-auto.off{border-color:var(--hx-bad)}
    .hx-pill-turbo{border-color:#2CD7E6;color:#2CD7E6}
    .hx-clock{font-weight:800;letter-spacing:.3px;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:2px 8px;background:rgba(0,0,0,.2);display:none}
    .hx-ic{width:34px;height:34px;border-radius:10px;border:2px solid #94a3b8;background:#0000;color:#fff;font-size:16px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
    .hx-ic.on{border-color:var(--hx-good);box-shadow:0 0 0 2px rgba(16,185,129,.15) inset}
    .hx-ic.off{border-color:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.12) inset}

    .hx-body{padding:12px 14px 6px}
    .hx-row{display:flex;align-items:center;justify-content:space-between;margin:6px 0}
    .hx-label{font-size:12px;color:var(--hx-muted)} .hx-val{font-size:20px;font-weight:900;letter-spacing:.3px}
    .hx-delta{font-weight:900} .hx-pos{color:var(--hx-good)} .hx-neg{color:var(--hx-bad)} .hx-zero{color:var(--hx-muted)}
    .hx-btns{display:flex;gap:10px;padding:8px 14px 12px;flex-wrap:wrap}
    .hx-btn{border:none;border-radius:12px;padding:8px 12px;font-weight:800;font-size:12px;color:#fff;cursor:pointer}
    .hx-prim{background:var(--hx-strong)} .hx-goodbtn{background:#10b981} .hx-badbtn{background:#ef4444} .hx-super{background:#2CD7E6;color:#062a2f}
    .hx-note{font-size:12px;color:var(--hx-muted);padding:0 14px 12px}

    /* Modale */
    .hx-modal-back{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:1000000;display:none}
    .hx-modal{position:fixed;z-index:1000001;top:50%;left:50%;transform:translate(-50%,-50%);width:min(880px,calc(100vw - 28px));height:min(84vh,820px);display:none;background:var(--hx-bg);color:var(--hx-fg);border:1px solid var(--hx-border);border-radius:16px;box-shadow:var(--hx-shadow)}
    .hx-mhead{padding:12px 14px;background:var(--hx-grad);color:#fff;font-weight:800;border-radius:16px 16px 0 0}
    .hx-mbody{padding:14px;height:calc(100% - 54px);overflow:auto}
    .hx-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;position:sticky;top:0;background:var(--hx-bg);padding-bottom:8px;z-index:2}
    .hx-tab{border:1px solid var(--hx-border);background:#0000;color:var(--hx-fg);padding:8px 10px;border-radius:10px;cursor:pointer;font-weight:700;font-size:12px}
    .hx-tab.active{background:var(--hx-strong);color:#fff;border-color:var(--hx-strong)}
    .hx-pane{display:none} .hx-pane.active{display:block}
    .hx-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}
    .hx-full{grid-column:1/-1}
    .hx-lab2{font-size:12px;color:var(--hx-muted);margin:0 0 4px;display:block}
    .hx-h1{font-size:14px;font-weight:900;margin:14px 0 6px}
    .hx-hr{height:1px;background:var(--hx-border);margin:10px 0}
    .hx-coll{border:1px solid var(--hx-border);border-radius:12px;overflow:hidden;margin:8px 0}
    .hx-coll-h{background:rgba(0,0,0,.05);padding:10px 12px;cursor:pointer;font-weight:800;display:flex;align-items:center;justify-content:space-between}
    .hx-coll-b{padding:12px;display:none}
    .hx-coll.open .hx-coll-b{display:block}
    .hx-input,.hx-select{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--hx-input-border)!important;background-color:var(--hx-input-bg)!important;color:var(--hx-input-fg)!important;outline:none;appearance:none;line-height:1.3;height:40px}
    select.hx-select{ background-image:none }
    .hx-actions{display:flex;justify-content:space-between;gap:10px;margin-top:12px}

    /* Historique REC */
    .hx-hlist{max-height:520px;overflow:auto;border:1px solid var(--hx-border);border-radius:12px;padding:8px}
    .hx-hitem{display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:center;border-bottom:1px dashed var(--hx-border);padding:8px 4px}
    .hx-hitem:last-child{border-bottom:none}
    .hx-thumb{width:48px;height:48px;border-radius:8px;border:1px solid var(--hx-border);background:#0000;object-fit:cover;cursor:pointer}
    .hx-meta{display:flex;flex-direction:column;gap:4px}
    .hx-line{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .hx-titlelink{font-weight:800;text-decoration:none;color:var(--hx-fg)}
    .hx-titlelink:hover{text-decoration:underline}
    .hx-sub{font-size:12px;color:var(--hx-muted);display:flex;gap:8px;flex-wrap:wrap}
    .hx-badge{font-size:10px;font-weight:900;padding:2px 6px;border-radius:999px;border:1px solid var(--hx-border);background:#0000}
    .hx-b-first{border-color:var(--hx-good);color:var(--hx-good)}
    .hx-b-re{border-color:#22d3ee;color:#22d3ee}
    .hx-b-day{border-color:#94a3b8;color:#94a3b8}
    .hx-asin{font-family:ui-monospace, SFMono-Regular, Menlo, monospace;font-size:11px;opacity:.85}
    .hx-controls{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 10px}
    .hx-btn-chip{border:none;border-radius:10px;padding:8px 10px;font-weight:800;font-size:12px;color:#fff;cursor:pointer}
    .hx-btn-blue{background:#3b82f6}.hx-btn-amber{background:#f59e0b}.hx-btn-red{background:#ef4444}.hx-btn-gray{background:#64748b}

    /* Lightbox image */
    .hx-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:2147483646}
    .hx-ov img{max-width:60vw;max-height:80vh;border-radius:12px;border:1px solid #1f2937;background:#fff}
  `);
    const QLABEL_FR = { encore: "Autres articles", last_chance: "Dispo pour tous", potluck: "Recommandations" };
    const QSHORT = { encore: "ENC", last_chance: "TOUS", potluck: "REC" };
    const QCLS = { encore: "hx-q-enc", last_chance: "hx-q-tous", potluck: "hx-q-rec" };
    const card = document.createElement("div");
    card.className = "hx-card";
    card.innerHTML = `
    <div class="hx-head" id="hx-drag">
      <div class="hx-left">
        <span class="hx-qshort ${QCLS[QUEUE]}">${QSHORT[QUEUE] || QUEUE}</span>
      </div>
      <div class="hx-right">
        <div class="hx-pills">
          <span id="hx-pill-auto" class="hx-pill hx-pill-auto off">AUTO OFF</span>
          <span id="hx-pill-turbo" class="hx-pill hx-pill-turbo" style="display:none;">TURBO</span>
        </div>
        <span id="hx-hclock" class="hx-clock">--:--:--</span>
        <button id="hx-ic-gate"  class="hx-ic off" title="Reco horaire">⏰</button>
        <button id="hx-ic-sched" class="hx-ic off" title="Plages horaires">🗓️</button>
        <button id="hx-ic-opt"   class="hx-ic"      title="Options">⚙️</button>
      </div>
    </div>
    <div class="hx-body" aria-live="polite">
      <div class="hx-row"><div class="hx-label">Statut</div><div id="hx-status" class="hx-label">En veille…</div></div>
      <div class="hx-row"><div class="hx-label">Total détecté</div><div id="hx-total" class="hx-val">—</div></div>
      <div class="hx-row"><div class="hx-label">Variation</div><div id="hx-delta" class="hx-delta hx-zero">0</div></div>
      <div class="hx-row"><div class="hx-label">Prochain refresh</div><div id="hx-count" class="hx-val" style="font-size:16px;">—</div></div>
    </div>
    <div class="hx-btns">
      <button id="hx-toggle" class="hx-btn hx-goodbtn">▶️ Activer</button>
      <button id="hx-super"  class="hx-btn hx-super">🚀 Turbo</button>
      <button id="hx-now"    class="hx-btn hx-prim" title="Rafraîchir immédiatement">↻ Maintenant</button>
    </div>
    <div id="hx-note" class="hx-note"></div>
  `;
    document.documentElement.appendChild(card);
    (function () {
        const drag = $("#hx-drag");
        let sx = 0,
            sy = 0,
            sl = 0,
            st = 0,
            dragging = !1;
        const saved = ssGet(kt("pos"), null);
        if (saved) {
            card.style.left = `${saved.x}px`;
            card.style.top = `${saved.y}px`;
            card.style.right = "auto";
        }
        drag.addEventListener("mousedown", (e) => {
            if (e.target.closest(".hx-right")) return;
            dragging = !0;
            sx = e.clientX;
            sy = e.clientY;
            const r = card.getBoundingClientRect();
            sl = r.left;
            st = r.top;
            e.preventDefault();
        });
        document.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            const nl = Math.max(0, sl + (e.clientX - sx));
            const nt = Math.max(0, st + (e.clientY - sy));
            card.style.left = `${nl}px`;
            card.style.top = `${nt}px`;
            card.style.right = "auto";
        });
        document.addEventListener("mouseup", () => {
            if (!dragging) return;
            dragging = !1;
            const r = card.getBoundingClientRect();
            ssSet(kt("pos"), { x: Math.round(r.left), y: Math.round(r.top) });
        });
    })();
    function applyClockVisibility() {
        $("#hx-hclock").style.display = settings.showClock ? "inline-block" : "none";
    }
    function tickClock() {
        if (!settings.showClock) return;
        $("#hx-hclock").textContent = localHMS().str;
    }
    setInterval(tickClock, 1000);
    tickClock();
    applyClockVisibility();
    function extractASINs() {
        const grid = $("#vvp-items-grid");
        if (!grid) return [];
        const items = $$(".vvp-item-tile", grid).filter((el) => !el.matches(".skeleton,.placeholder"));
        const res = [];
        for (const el of items) {
            let a = null;
            const A = el.querySelector('a[href*="/dp/"]');
            if (A) {
                const h = A.getAttribute("href") || A.href || "";
                const m = h.match(/\/dp\/([A-Z0-9]{10})/i);
                if (m) a = m[1].toUpperCase();
            }
            if (!a) {
                const d = el.querySelector("[data-asin]");
                const attr = d?.getAttribute("data-asin");
                if (attr && /^[A-Z0-9]{10}$/i.test(attr)) a = attr.toUpperCase();
            }
            if (!a) {
                const txt = el.textContent || "";
                const m2 = txt.match(/\b(B0[0-9A-Z]{8})\b/i);
                if (m2) a = m2[1].toUpperCase();
            }
            if (a) res.push(a);
        }
        return Array.from(new Set(res));
    }
    function extractTotalEncore() {
        const root = document.querySelector("#vvp-items-grid-container") || document.body;
        const textToInt = (s) => {
            const v = parseInt(String(s || "").replace(/[^0-9]/g, ""), 10);
            return Number.isFinite(v) ? v : null;
        };
        const directSel = ["h1 .a-color-state", ".a-section .a-spacing-top-small", ".s-result-info-bar .a-text-bold"];
        for (const sel of directSel) {
            const el = root.querySelector(sel);
            if (!el) continue;
            const m = (el.textContent || "").match(/(?:sur|of)\s+([\d\s\u00A0\u202F.,]+)\s+(?:r[ée]sultats|results)/i);
            if (m && m[1]) {
                const v = textToInt(m[1]);
                if (v != null) return v;
            }
            const strongs = el.querySelectorAll("strong");
            if (strongs.length >= 2) {
                const v = textToInt(strongs[strongs.length - 1].textContent);
                if (v != null) return v;
            }
            const nums = (el.textContent || "").match(/\d[\d\s\u00A0\u202F.,]*/g) || [];
            if (nums.length) {
                const v = textToInt(nums[nums.length - 1]);
                if (v != null) return v;
            }
        }
        const candidates = Array.from(root.querySelectorAll("p,div,span,h1")).filter((node) => {
            const t = (node.textContent || "").toLowerCase();
            return (t.includes("affichage de") || t.includes("showing")) && (t.includes(" sur ") || t.includes(" of ")) && (t.includes("résultats") || t.includes("results"));
        });
        for (const el of candidates) {
            const strongs = el.querySelectorAll("strong");
            if (strongs.length >= 2) {
                const v = textToInt(strongs[strongs.length - 1].textContent);
                if (v != null) return v;
            }
            const m = (el.textContent || "").match(/(?:sur|of)\s+([\d\s\u00A0\u202F.,]+)\s+(?:r[ée]sultats|results)/i);
            if (m && m[1]) {
                const v = textToInt(m[1]);
                if (v != null) return v;
            }
        }
        const mAll = (root.textContent || "").match(/(?:sur|of)\s+([\d\s\u00A0\u202F.,]+)\s+(?:r[ée]sultats|results)/i);
        if (mAll && mAll[1]) {
            const v = textToInt(mAll[1]);
            if (v != null) return v;
        }
        return extractASINs().length;
    }
    const FLAP_TTL = settings.diff.flapTTLms;
    const K_LAST_ASINS = kq(QUEUE, "lastAsins");
    const K_EVERSEEN = kq(QUEUE, "everSeen");
    const K_FLAPTS = kq(QUEUE, "flapTimes");
    function diffAsins(cur) {
        const prev = getLS(K_LAST_ASINS, []) || [];
        const S = new Set(cur),
            P = new Set(prev);
        const added = cur.filter((a) => !P.has(a));
        const removed = prev.filter((a) => !S.has(a));
        const ever = new Set(getLS(K_EVERSEEN, []) || []);
        const brandNew = added.filter((a) => !ever.has(a));
        const reappeared = added.filter((a) => ever.has(a));
        const now = nowMs();
        const flap = getLS(K_FLAPTS, {}) || {};
        const allow = (a) => {
            const t = flap[a] ? new Date(flap[a]).getTime() : 0;
            return now - t >= FLAP_TTL;
        };
        const bn = brandNew.filter(allow),
            rp = reappeared.filter(allow),
            rm = removed.filter(allow);
        [...bn, ...rp, ...rm].forEach((a) => (flap[a] = new Date(now).toISOString()));
        setLS(K_FLAPTS, flap);
        setLS(K_LAST_ASINS, cur);
        setLS(K_EVERSEEN, Array.from(new Set([...ever, ...cur])));
        return { prevCount: prev.length, curCount: cur.length, brandNew: bn, reappeared: rp, removedFlap: rm };
    }
    async function httpGET(url) {
        if (!url) return !1;
        try {
            if (typeof GM_xmlhttpRequest === "function") {
                return await new Promise((res) => {
                    GM_xmlhttpRequest({ method: "GET", url, onload: () => res(!0), onerror: () => res(!1), ontimeout: () => res(!1) });
                });
            } else {
                await fetch(url, { method: "GET", mode: "no-cors" });
                return !0;
            }
        } catch {
            return !1;
        }
    }
    async function httpPOST(url, data, extraHeaders) {
        if (!url) return !1;
        const body = JSON.stringify(data);
        const headers = Object.assign({ "Content-Type": "application/json" }, extraHeaders || {});
        try {
            if (typeof GM_xmlhttpRequest === "function") {
                return await new Promise((res) => {
                    GM_xmlhttpRequest({ method: "POST", url, headers, data: body, onload: () => res(!0), onerror: () => res(!1), ontimeout: () => res(!1) });
                });
            } else {
                await fetch(url, { method: "POST", headers, body });
                return !0;
            }
        } catch {
            return !1;
        }
    }
    function cooled(kind, cooldownSec) {
        const key = kq(QUEUE, `cool.${kind}.ts`);
        const last = GM_getValue(key, 0);
        const ok = nowMs() - last >= Math.max(2000, (cooldownSec || 0) * 1000);
        if (ok) GM_setValue(key, nowMs());
        return ok;
    }
    function dedup(kind, fp, ttlMs = 10000) {
        const key = kq(QUEUE, `dedup.${kind}`);
        const last = GM_getValue(key, null);
        if (last && last.fp === fp && nowMs() - last.ts < ttlMs) return !1;
        GM_setValue(key, { fp, ts: nowMs() });
        return !0;
    }
    function softHmac(str) {
        try {
            return btoa(unescape(encodeURIComponent(str))).slice(0, 44);
        } catch {
            return String(Math.random()).slice(2);
        }
    }
    function signHeaders(payload) {
        const secret = GM_getValue("hexfuse.webhook_secret", "");
        if (!secret) return {};
        const body = JSON.stringify(payload);
        return { "X-Hex-Signature": softHmac(secret + body) };
    }
    async function withCircuit(kind, fn) {
        const k = kq(QUEUE, `cb.${kind}`);
        const st = GM_getValue(k, { fail: 0, until: 0 });
        if (nowMs() < st.until) return !1;
        const ok = await fn();
        if (ok) {
            GM_setValue(k, { fail: 0, until: 0 });
        } else {
            const fail = (st.fail || 0) + 1;
            const backoff = Math.min(60000, 2000 * Math.pow(2, fail - 1));
            GM_setValue(k, { fail, until: nowMs() + backoff });
        }
        return ok;
    }
    const QT = settings.queues[QUEUE];
    const KT_AUTO = kt("auto"),
        KT_SUPER = kt("super"),
        KT_SUPER_END = kt("superEnd");
    let refreshTimer = null,
        countTimer = null,
        nextAt = 0;
    function isAutoOn() {
        return !!ssGet(KT_AUTO, !1);
    }
    function setAuto(on) {
        ssSet(KT_AUTO, !!on);
        updateUIStates();
        scheduleNext();
    }
    function isSuperOn() {
        return !!ssGet(KT_SUPER, !1) && nowMs() < (ssGet(KT_SUPER_END, 0) || 0);
    }
    function startSuper() {
        if (!isAutoOn()) {
            setStatus("Activez l’auto pour Turbo");
            return;
        }
        ssSet(KT_SUPER, !0);
        ssSet(KT_SUPER_END, nowMs() + QT.super.durationSec * 1000);
        updateUIStates();
        scheduleNext();
    }
    function stopSuper() {
        ssSet(KT_SUPER, !1);
        ssSet(KT_SUPER_END, 0);
        updateUIStates();
        scheduleNext();
    }
    let gateActive = ssGet(kt("gateActive"), !0);
    let useSchedules = !!QT.useSchedules;
    function isInRange(cur, a, b) {
        return a <= b ? cur >= a && cur < b : cur >= a || cur < b;
    }
    function activeSchedule() {
        if (!useSchedules) return null;
        const t = localHMS();
        const cur = hmToMin(`${t.h}:${t.m}`);
        for (const s of QT.schedules) {
            if (!s.enabled) continue;
            const a = hmToMin(s.start),
                b = hmToMin(s.end);
            if (isInRange(cur, a, b)) return s;
        }
        return null;
    }
    function nextActiveWindow() {
        if (!useSchedules) return null;
        const t = localHMS();
        const cur = hmToMin(`${t.h}:${t.m}`);
        const list = QT.schedules.filter((s) => s.enabled).map((s) => ({ s, a: hmToMin(s.start), b: hmToMin(s.end) }));
        const ahead = list.filter((x) => !isInRange(cur, x.a, x.b) && x.a !== cur);
        ahead.sort((x, y) => x.a - y.a);
        return ahead[0]?.s || null;
    }
    function pickDelaySec() {
        if (isSuperOn()) {
            const mi = clamp(QT.super.minSec, 1, 60),
                ma = clamp(QT.super.maxSec, 1, 60);
            return randInt(Math.min(mi, ma), Math.max(mi, ma));
        }
        const sch = activeSchedule();
        if (sch) {
            const mi = clamp(sch.minMin, 1, 60) * 60,
                ma = clamp(sch.maxMin, 1, 60) * 60;
            return randInt(Math.min(mi, ma), Math.max(mi, ma));
        }
        const mi = clamp(QT.minSec, 5, 1800),
            ma = clamp(QT.maxSec, 5, 1800);
        return randInt(Math.min(mi, ma), Math.max(mi, ma));
    }
    function niceTime(ms) {
        if (ms < 0) ms = 0;
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60),
            r = s % 60;
        if (m < 60) return `${m}m ${r}s`;
        const h = Math.floor(m / 60),
            mr = m % 60;
        return `${h}h ${mr}m`;
    }
    function scheduleNext() {
        clearTimeout(refreshTimer);
        clearInterval(countTimer);
        const schNow = activeSchedule();
        const shouldPlan = isAutoOn() || isSuperOn() || !!schNow;
        if (!shouldPlan) {
            $("#hx-count").textContent = "—";
            updateNote();
            return;
        }
        const delay = pickDelaySec();
        const jitter = randInt(0, 800);
        nextAt = nowMs() + delay * 1000 + jitter;
        countTimer = setInterval(() => {
            const left = nextAt - nowMs();
            if (settings.showCountdown) $("#hx-count").textContent = left > 0 ? niceTime(left) : "—";
            else $("#hx-count").textContent = "—";
        }, 250);
        refreshTimer = setTimeout(() => {
            setStatus("↻ Rafraîchissement…");
            safeReload();
        }, delay * 1000 + jitter);
        updateNote();
    }
    function tooManyReloads() {
        try {
            const navs = performance.getEntriesByType("navigation");
            const reloads = navs.filter((n) => n.type === "reload").length;
            return reloads > 3;
        } catch {
            return !1;
        }
    }
    function safeReload() {
        if (tooManyReloads()) {
            clearTimeout(refreshTimer);
            clearInterval(countTimer);
            setStatus("Reload freiné (sécurité)");
            return;
        }
        try {
            location.reload();
        } catch {}
    }
  // ⏰ tick Reco horaire — indépendant + anti-double reload
let lastGateReload = 0;
setInterval(()=>{
  if (!(settings.minuteGate && gateActive)) return;

  const t   = localHMS();
  const now = nowMs();

  // Sécurité : max 1 reload toutes les 20 sec
  if (now - lastGateReload < 20000) return;

  // Déclenche à 59:55 → 59:59 ou pile 00:00
  if ((t.m==='59' && parseInt(t.s,10)>=55) || (t.m==='00' && t.s==='00')) {
    lastGateReload = now;
    setStatus('Reco horaire → reload');
    try { location.reload(); } catch {}
  }
}, 1000);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            clearTimeout(refreshTimer);
            clearInterval(countTimer);
            setStatus("En pause (onglet masqué)");
        } else {
            scheduleNext();
            setStatus("Reprise");
        }
    });
    window.addEventListener("offline", () => {
        clearTimeout(refreshTimer);
        clearInterval(countTimer);
        setStatus("Hors-ligne");
    });
    window.addEventListener("online", () => {
        scheduleNext();
        setStatus("En ligne");
    });
    let obsDeb = null;
    function setupObserver() {
        const c = $("#vvp-items-grid-container") || document.body;
        const deb = () => {
            clearTimeout(obsDeb);
            obsDeb = setTimeout(onScan, 150);
        };
        const mo = new MutationObserver((mlist) => {
            if (!mlist.some((m) => m.addedNodes.length || m.removedNodes.length)) return;
            deb();
        });
        mo.observe(c, { childList: !0, subtree: !0, characterData: !0 });
        deb();
    }
    function setStatus(s) {
        $("#hx-status").textContent = s;
    }
    function updatePills() {
        const pA = $("#hx-pill-auto");
        pA.textContent = isAutoOn() ? "AUTO ON" : "AUTO OFF";
        pA.classList.toggle("on", isAutoOn());
        pA.classList.toggle("off", !isAutoOn());
        const pT = $("#hx-pill-turbo");
        const onT = isSuperOn();
        pT.style.display = onT ? "inline-block" : "none";
    }
    function updateHeaderIcons() {
        const bGate = $("#hx-ic-gate");
        bGate.classList.toggle("on", settings.minuteGate && gateActive);
        bGate.classList.toggle("off", !(settings.minuteGate && gateActive));
        const bSch = $("#hx-ic-sched");
        bSch.classList.toggle("on", useSchedules);
        bSch.classList.toggle("off", !useSchedules);
    }
    function updateMainButtons() {
        const on = isAutoOn();
        const b = $("#hx-toggle");
        b.textContent = on ? "⏸️ Désactiver" : "▶️ Activer";
        b.classList.toggle("hx-goodbtn", !on);
        b.classList.toggle("hx-badbtn", on);
        $("#hx-super").textContent = isSuperOn() ? "🛑 Stop Turbo" : "🚀 Turbo";
    }
    function updateNote() {
        const s = settings.queues[QUEUE];
        const statuses = [`Auto ${isAutoOn() ? "ON" : "OFF"}`, `Plages ${useSchedules ? "ON" : "OFF"}`, `Reco horaire ${settings.minuteGate && gateActive ? "ON" : "OFF"}`, ...(isSuperOn() ? ["Turbo ON"] : [])];
        const sch = activeSchedule();
        const params = sch ? [`${sch.start}-${sch.end}`, `${clamp(sch.minMin, 1, 60)}-${clamp(sch.maxMin, 1, 60)} min`] : [`${s.minSec}-${s.maxSec}s`];
        if (s.webhook?.cooldownSec) params.push(`cooldown ${s.webhook.cooldownSec}s`);
        const up = nextActiveWindow();
        if (up) params.push(`prochaine ${up.start}-${up.end}`);
        $("#hx-note").textContent = statuses.join(" • ") + " — " + params.join(" • ");
    }
    function updateUIStates() {
        updatePills();
        updateHeaderIcons();
        updateMainButtons();
        updateNote();
        applyClockVisibility();
    }
    $("#hx-now").addEventListener("click", () => {
        setStatus("↻ Refresh manuel");
        safeReload();
    });
    const K_H_PROD = "hexfuse.potluck.hist.products.v2";
    const K_H_EVENTS = "hexfuse.potluck.hist.events.v2";
    const KT_H_PREV = kt("hist.prev");
    const REAPPEAR_COOLDOWN_MS = 5 * 60 * 1000;
    const h_getProdMap = () => {
        try {
            const o = GM_getValue(K_H_PROD, {});
            return o && typeof o === "object" ? o : {};
        } catch {
            return {};
        }
    };
    const h_setProdMap = (m) => {
        try {
            GM_setValue(K_H_PROD, m && typeof m === "object" ? m : {});
        } catch {}
    };
    const h_getEvents = () => {
        try {
            const a = GM_getValue(K_H_EVENTS, []);
            return Array.isArray(a) ? a : [];
        } catch {
            return [];
        }
    };
    const h_setEvents = (a) => {
        try {
            GM_setValue(K_H_EVENTS, Array.isArray(a) ? a : []);
        } catch {}
    };
    const h_prevGet = () => {
        try {
            const v = sessionStorage.getItem(KT_H_PREV);
            return v ? JSON.parse(v) : [];
        } catch {
            return [];
        }
    };
    const h_prevSet = (arr) => {
        try {
            sessionStorage.setItem(KT_H_PREV, JSON.stringify(Array.from(new Set(arr || []))));
        } catch {}
    };
    function h_dayShort(d) {
        return ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"][d.getDay()];
    }
    function h_fmtTime(iso) {
        try {
            const d = new Date(iso);
            const H = String(d.getHours()).padStart(2, "0"),
                M = String(d.getMinutes()).padStart(2, "0"),
                S = String(d.getSeconds()).padStart(2, "0");
            return `${h_dayShort(d)} ${H}:${M}:${S}`;
        } catch {
            return "—";
        }
    }
    function h_findTileData(asin) {
        const grid = document.querySelector("#vvp-items-grid");
        let name = "",
            img = "",
            price = "";
        let url = `https://www.amazon.fr/dp/${asin}`;
        if (!grid) return { name: "(Nom indisponible)", url, img: "", price: "" };
        const tiles = Array.from(grid.querySelectorAll(".vvp-item-tile"));
        for (const el of tiles) {
            const a = el.querySelector('a[href*="/dp/"]');
            if (!a) continue;
            const href = a.getAttribute("href") || a.href || "";
            if (!href.toUpperCase().includes(`/DP/${asin}`)) continue;
            url = href.startsWith("http") ? href : new URL(href, location.origin).toString();
            name = (a.textContent || "").trim();
            if (!name) {
                const t = el.querySelector("h2, h3, .a-size-base-plus, .a-size-base, .a-color-base, .a-text-normal");
                name = (t?.textContent || "").trim();
            }
            name = name || "(Nom indisponible)";
            const im = el.querySelector("img");
            if (im) {
                img = im.getAttribute("src") || im.getAttribute("data-src") || "";
                if (!img) {
                    const ss = im.getAttribute("srcset") || "";
                    const first = ss.split(",")[0]?.trim()?.split(" ")[0];
                    if (first) img = first;
                }
                if (img && !/^https?:/i.test(img)) {
                    try {
                        img = new URL(img, location.origin).toString();
                    } catch {}
                }
            }
            const p = el.querySelector(".a-price .a-offscreen, .a-price .a-price-whole, .a-color-price, .a-price");
            if (p) {
                price = (p.textContent || "").replace(/\s+/g, " ").trim();
            }
            break;
        }
        return { name, url, img: img || "", price: price || "" };
    }
    function h_recordPotluck(asins) {
        if (!Array.isArray(asins) || !asins.length) return;
        const prev = new Set(h_prevGet());
        const cur = new Set(asins);
        const added = asins.filter((a) => !prev.has(a));
        const prodMap = h_getProdMap();
        const events = h_getEvents();
        const nowISO = new Date().toISOString();
        const nowT = Date.now();
        for (const asin of added) {
            const known = !!prodMap[asin];
            const info = h_findTileData(asin);
            if (!known) {
                prodMap[asin] = { asin, name: info.name, url: info.url, img: info.img, price: info.price, first_ts: nowISO, last_ts: nowISO, sightings: 1 };
                events.unshift({ asin, type: "first", ts: nowISO, name: info.name, url: info.url, img: info.img, price: info.price });
            } else {
                const lastT = prodMap[asin].last_ts ? new Date(prodMap[asin].last_ts).getTime() : 0;
                prodMap[asin].last_ts = nowISO;
                prodMap[asin].sightings = (prodMap[asin].sightings || 1) + 1;
                if (settings.history.enableReappear && (!lastT || nowT - lastT >= REAPPEAR_COOLDOWN_MS)) {
                    events.unshift({ asin, type: "reappear", ts: nowISO, name: info.name || prodMap[asin].name, url: info.url || prodMap[asin].url, img: info.img || prodMap[asin].img, price: info.price || prodMap[asin].price });
                }
            }
        }
        const pKeys = Object.keys(prodMap);
        if (pKeys.length > settings.history.maxProducts) {
            pKeys.sort((a, b) => new Date(prodMap[b].last_ts) - new Date(prodMap[a].last_ts));
            const keep = new Set(pKeys.slice(0, settings.history.maxProducts));
            for (const k of pKeys) {
                if (!keep.has(k)) delete prodMap[k];
            }
        }
        if (events.length > settings.history.maxEvents) events.length = settings.history.maxEvents;
        h_setProdMap(prodMap);
        h_setEvents(events);
        h_prevSet(Array.from(cur));
    }
    async function onScan() {
        const _histAsins = QUEUE === "potluck" ? extractASINs() : null;
        let total,
            delta = 0;
        if (QT.mode === "diff") {
            const asins = extractASINs();
            const d = diffAsins(asins);
            total = d.curCount;
            delta = total - d.prevCount;
            $("#hx-total").textContent = String(total);
            renderDelta(delta);
            setStatus(isAutoOn() ? "Observation active" : "Observation (auto OFF)");
            const hasSig = d.brandNew.length || d.reappeared.length || d.removedFlap.length;
            const url = QT.webhook.url;
            if (hasSig && url && cooled("diff", QT.webhook.cooldownSec)) {
                const payload = {
                    event: "update",
                    queue: QUEUE,
                    page: location.href,
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    timestamp: new Date().toISOString(),
                    total,
                    diff: delta,
                    brand_new_asins: d.brandNew,
                    reappeared_asins: d.reappeared,
                    removed_asins: d.removedFlap,
                };
                const fp = hashSimple(payload);
                if (dedup("diff", fp, 12000)) {
                    await withCircuit("diff", async () => {
                        if (QT.webhook.mode === "json") {
                            return httpPOST(url, payload, signHeaders(payload));
                        } else {
                            const u = buildGet(url, {
                                event: "update",
                                queue: QUEUE,
                                total: String(total),
                                diff: String(delta),
                                bn: d.brandNew.join(","),
                                rp: d.reappeared.join(","),
                                rm: d.removedFlap.join(","),
                                tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                ts: new Date().toISOString(),
                                page: location.href,
                            });
                            return httpGET(u);
                        }
                    });
                    setStatus("Alerte envoyée");
                }
            }
        } else {
            total = extractTotalEncore();
            const last = ssGet(kt("lastSeen"), null);
            delta = last == null ? 0 : total - Number(last);
            $("#hx-total").textContent = String(total);
            renderDelta(delta);
            setStatus(isAutoOn() ? "Observation active" : "Observation (auto OFF)");
            const thr = QT.webhook.threshold || 1;
            const url = QT.webhook.url;
            if ((isAutoOn() || activeSchedule()) && last != null && delta >= thr && url && cooled("delta", QT.webhook.cooldownSec)) {
                const payload = { event: "update", queue: QUEUE, page: location.href, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, timestamp: new Date().toISOString(), total, diff: delta };
                const fp = `${QUEUE}:${total}`;
                if (dedup("delta", fp, 8000)) {
                    await withCircuit("delta", async () => {
                        if (QT.webhook.mode === "json") {
                            return httpPOST(url, payload, signHeaders(payload));
                        } else {
                            const u = buildGet(url, { event: "update", queue: QUEUE, total: String(total), diff: String(delta), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, ts: new Date().toISOString(), page: location.href });
                            return httpGET(u);
                        }
                    });
                    setStatus("Alerte envoyée");
                }
            }
            ssSet(kt("lastSeen"), total);
            ssSet(kt("lastSeenAt"), nowMs());
        }
        if (QUEUE === "potluck" && _histAsins) h_recordPotluck(_histAsins);
        updateNote();
    }
    function renderDelta(delta) {
        const el = $("#hx-delta");
        el.classList.remove("hx-pos", "hx-neg", "hx-zero");
        if (delta > 0) {
            el.classList.add("hx-pos");
            el.textContent = `+${delta}`;
        } else if (delta < 0) {
            el.classList.add("hx-neg");
            el.textContent = `${delta}`;
        } else {
            el.classList.add("hx-zero");
            el.textContent = "0";
        }
    }
    const back = document.createElement("div");
    back.className = "hx-modal-back";
    const modal = document.createElement("div");
    modal.className = "hx-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
    <div class="hx-mhead">Options</div>
    <div class="hx-mbody">
      <div class="hx-tabs">
        <button class="hx-tab" data-pane="pane-pot">Recommandations</button>
        <button class="hx-tab" data-pane="pane-lc">Dispo pour tous</button>
        <button class="hx-tab" data-pane="pane-enc">Autres articles</button>
        <button class="hx-tab" data-pane="pane-hist">Historique REC</button>
        <button class="hx-tab" data-pane="pane-ui">Options</button>
        <button class="hx-tab" data-pane="pane-help">Aide</button>
      </div>
      <div id="pane-pot"  class="hx-pane"></div>
      <div id="pane-lc"   class="hx-pane"></div>
      <div id="pane-enc"  class="hx-pane"></div>
      <div id="pane-hist" class="hx-pane"></div>
      <div id="pane-ui"   class="hx-pane"></div>
      <div id="pane-help" class="hx-pane"></div>

      <div class="hx-actions">
        <div><button id="hx-resetq" class="hx-btn hx-prim">Réinitialiser compteurs (file active)</button></div>
        <div>
          <button id="hx-close" class="hx-btn hx-badbtn">Fermer</button>
          <button id="hx-save"  class="hx-btn hx-goodbtn">Enregistrer</button>
        </div>
      </div>
    </div>`;
    document.documentElement.appendChild(back);
    document.documentElement.appendChild(modal);
    function collWrap(key, title, innerHTML, defaultOpen = !1) {
        const k = `fold.${key}`;
        const open = settings.folds[k] ?? defaultOpen ? "open" : "";
        return `
      <div class="hx-coll ${open}" data-fold="${k}">
        <div class="hx-coll-h"><span>${title}</span><span>${open ? "▾" : "▸"}</span></div>
        <div class="hx-coll-b">${innerHTML}</div>
      </div>
    `;
    }
    function wireCollapsers(scopeRoot) {
        $$(".hx-coll", scopeRoot).forEach((c) => {
            const k = c.getAttribute("data-fold");
            c.querySelector(".hx-coll-h").addEventListener("click", () => {
                c.classList.toggle("open");
                settings.folds[k] = c.classList.contains("open");
                setSettings(settings);
                const h = c.querySelector(".hx-coll-h span:last-child");
                if (h) h.textContent = c.classList.contains("open") ? "▾" : "▸";
            });
        });
    }
    function paneFor(queue) {
        const q = settings.queues[queue];
        const modeHTML = `
      <div class="hx-grid">
        <div><label class="hx-lab2">Mode</label>
          <select class="hx-select" id="m-${queue}-mode">
            <option value="diff"  ${q.mode === "diff" ? "selected" : ""}>Diff (nouveaux ASIN)</option>
            <option value="delta" ${q.mode === "delta" ? "selected" : ""}>Delta (variation de total)</option>
          </select></div>
        <div><label class="hx-lab2">Seuil alerte (≥ delta)</label><input class="hx-input" id="m-${queue}-thr" type="number" min="1" value="${q.webhook.threshold}"></div>
      </div>
    `;
        const autoHTML = `
      <div class="hx-grid">
        <div><label class="hx-lab2">Intervalle min (s)</label><input class="hx-input" id="m-${queue}-min" type="number" min="5" max="1800" value="${q.minSec}"></div>
        <div><label class="hx-lab2">Intervalle max (s)</label><input class="hx-input" id="m-${queue}-max" type="number" min="5" max="1800" value="${q.maxSec}"></div>
      </div>
    `;
        const hookHTML = `
      <div class="hx-grid">
        <div class="hx-full"><label class="hx-lab2">Webhook (URL unique)</label><input class="hx-input" id="m-${queue}-wh" type="text" value="${q.webhook.url || ""}" placeholder="https://…"></div>
        <div><label class="hx-lab2">Type de webhook</label>
          <select class="hx-select" id="m-${queue}-modehook">
            <option value="json" ${q.webhook.mode === "json" ? "selected" : ""}>POST JSON (avancé)</option>
            <option value="get"  ${q.webhook.mode === "get" ? "selected" : ""}>GET simple (MacroDroid)</option>
          </select></div>
        <div><label class="hx-lab2">Cooldown (s)</label><input class="hx-input" id="m-${queue}-cd" type="number" min="0" value="${q.webhook.cooldownSec}"></div>
        <div class="hx-full">
          <button id="m-${queue}-test" class="hx-btn hx-goodbtn">Tester webhook</button>
          <div class="hx-hr"></div>
          <div class="hx-lab2">
            MacroDroid (GET) : <code>?event=update&queue=...&total=...&diff=...&bn=...&rp=...&rm=...&tz=...&ts=...&page=...</code>
          </div>
        </div>
      </div>
    `;
        const turboHTML = `
      <div class="hx-grid">
        <div><label class="hx-lab2">Turbo activé</label><select class="hx-select" id="m-${queue}-se"><option value="true" ${q.super.enabled ? "selected" : ""}>Oui</option><option value="false" ${
            !q.super.enabled ? "selected" : ""
        }>Non</option></select></div>
        <div><label class="hx-lab2">Turbo: durée (s)</label><input class="hx-input" id="m-${queue}-sdur" type="number" min="10" max="3600" value="${q.super.durationSec}"></div>
        <div><label class="hx-lab2">Turbo: min (s)</label><input class="hx-input" id="m-${queue}-smin" type="number" min="1" max="60" value="${q.super.minSec}"></div>
        <div><label class="hx-lab2">Turbo: max (s)</label><input class="hx-input" id="m-${queue}-smax" type="number" min="1" max="60" value="${q.super.maxSec}"></div>
      </div>
    `;
        const schHTML = `
      ${q.schedules
          .slice(0, 4)
          .map(
              (s, i) =>
                  `<div class="hx-grid" style="grid-template-columns:auto 120px auto 120px auto 100px auto 100px;align-items:center;margin-bottom:6px"><div><label class="hx-lab2">Activer</label><input type="checkbox" id="m-${queue}-sch-en-${i}" ${
                      s.enabled ? "checked" : ""
                  }></div><div><label class="hx-lab2">Début</label><input class="hx-input" id="m-${queue}-sch-start-${i}" type="time" step="900" value="${
                      s.start
                  }"></div><div><label class="hx-lab2">Fin</label><input class="hx-input" id="m-${queue}-sch-end-${i}" type="time" step="900" value="${
                      s.end
                  }"></div><div><label class="hx-lab2">Min(min)</label><input class="hx-input" id="m-${queue}-sch-min-${i}" type="number" min="1" max="60" value="${clamp(
                      s.minMin,
                      1,
                      60
                  )}"></div><div><label class="hx-lab2">Max(min)</label><input class="hx-input" id="m-${queue}-sch-max-${i}" type="number" min="1" max="60" value="${clamp(s.maxMin, 1, 60)}"></div></div>`
          )
          .join("")}
      <div class="hx-lab2">Astuce : active/désactive les plages via l’icône 🗓️ (indépendant du bouton Activer).</div>
    `;
        return `
      <div class="hx-h1">Paramètres ${QLABEL_FR[queue]}</div>
      <div class="hx-hr"></div>
      ${collWrap(`${queue}.mode`, "Mode & seuil d’alerte", modeHTML, false)}
      ${collWrap(`${queue}.auto`, "Intervalle automatique", autoHTML, false)}
      ${collWrap(`${queue}.hook`, "Webhook & Cooldown", hookHTML, false)}
      ${collWrap(`${queue}.turbo`, "Turbo", turboHTML, false)}
      ${collWrap(`${queue}.sch`, "Plages horaires (1–60 min)", schHTML, false)}
    `;
    }
    function paneHisto() {
        const prodMap = h_getProdMap();
        const events = h_getEvents();
        const filter = settings.history.filterType || "all";
        const q = (settings.history.search || "").trim().toLowerCase();
        const showImg = !!settings.history.showImages;
        let list = [];
        if (settings.history.groupView) {
            const arr = Object.values(prodMap).sort((a, b) => new Date(b.last_ts) - new Date(a.last_ts));
            list = arr
                .filter((it) => {
                    if (!q) return !0;
                    return (it.name || "").toLowerCase().includes(q) || String(it.asin).toLowerCase().includes(q);
                })
                .map((it) => {
                    const first = h_fmtTime(it.first_ts);
                    const last = h_fmtTime(it.last_ts);
                    const price = it.price ? '<span class="hx-asin" style="margin-left:8px">' + it.price + "</span>" : "";
                    return (
                        '<div class="hx-hitem">' +
                        (showImg ? '<img class="hx-thumb" data-hx-src="' + (it.img || "") + '" src="' + (it.img || "") + '" alt="">' : "<div></div>") +
                        '<div class="hx-meta">' +
                        '<div class="hx-line">' +
                        '<a class="hx-titlelink" href="' +
                        it.url +
                        '" target="_blank" rel="noreferrer">' +
                        clip(it.name || "(Nom indisponible)") +
                        "</a>" +
                        '<span class="hx-asin">' +
                        first +
                        "</span>" +
                        price +
                        "</div>" +
                        '<div class="hx-sub">' +
                        '<span class="hx-badge hx-b-first">1re vue</span>' +
                        (it.sightings > 1 ? '<span class="hx-badge hx-b-re">' + (it.sightings - 1) + " réapparitions</span>" : "") +
                        '<span class="hx-badge hx-b-day" title="dernière">' +
                        last +
                        "</span>" +
                        "</div>" +
                        "</div>" +
                        "</div>"
                    );
                });
        } else {
            let ev = events.slice();
            if (filter === "first") ev = ev.filter((e) => e.type === "first");
            if (filter === "reappear") ev = ev.filter((e) => e.type === "reappear");
            ev = ev.filter((e) => {
                if (!q) return !0;
                return (e.name || "").toLowerCase().includes(q) || String(e.asin).toLowerCase().includes(q);
            });
            list = ev.map((e) => {
                const p = prodMap[e.asin];
                const first = p ? h_fmtTime(p.first_ts) : h_fmtTime(e.ts);
                const when = h_fmtTime(e.ts);
                const price = e.price ? '<span class="hx-asin" style="margin-left:8px">' + e.price + "</span>" : "";
                const bType = e.type === "first" ? '<span class="hx-badge hx-b-first">nouveau</span>' : '<span class="hx-badge hx-b-re">réapparition</span><span class="hx-badge hx-b-day" title="réapparition">' + when + "</span>";
                return (
                    '<div class="hx-hitem">' +
                    (showImg ? '<img class="hx-thumb" data-hx-src="' + (e.img || "") + '" src="' + (e.img || "") + '" alt="">' : "<div></div>") +
                    '<div class="hx-meta">' +
                    '<div class="hx-line">' +
                    '<a class="hx-titlelink" href="' +
                    e.url +
                    '" target="_blank" rel="noreferrer">' +
                    clip(e.name || "(Nom indisponible)") +
                    "</a>" +
                    '<span class="hx-asin">' +
                    first +
                    "</span>" +
                    price +
                    "</div>" +
                    '<div class="hx-sub">' +
                    bType +
                    "</div>" +
                    "</div>" +
                    "</div>"
                );
            });
        }
        const totalProd = Object.keys(prodMap).length;
        const totalEv = events.length;
        return (
            '<div class="hx-h1">Historique Recommandations (potluck)</div>' +
            '<div class="hx-hr"></div>' +
            '<div class="hx-controls">' +
            '<select id="hx-h-filter" class="hx-input" style="max-width:200px">' +
            '<option value="all" ' +
            (settings.history.filterType === "all" ? "selected" : "") +
            ">Tous les événements</option>" +
            '<option value="first" ' +
            (settings.history.filterType === "first" ? "selected" : "") +
            ">Nouveaux (first)</option>" +
            '<option value="reappear" ' +
            (settings.history.filterType === "reappear" ? "selected" : "") +
            ">Réapparitions</option>" +
            "</select>" +
            '<select id="hx-h-view" class="hx-input" style="max-width:220px">' +
            '<option value="events" ' +
            (!settings.history.groupView ? "selected" : "") +
            ">Vue événements (" +
            totalEv +
            ")</option>" +
            '<option value="group"  ' +
            (settings.history.groupView ? "selected" : "") +
            ">Vue groupée (" +
            totalProd +
            ")</option>" +
            "</select>" +
            '<select id="hx-h-img" class="hx-input" style="max-width:160px">' +
            '<option value="true" ' +
            (settings.history.showImages ? "selected" : "") +
            ">Images ON</option>" +
            '<option value="false" ' +
            (!settings.history.showImages ? "selected" : "") +
            ">Images OFF</option>" +
            "</select>" +
            '<select id="hx-h-re" class="hx-input" style="max-width:190px">' +
            '<option value="true" ' +
            (settings.history.enableReappear ? "selected" : "") +
            ">Réapparitions ON</option>" +
            '<option value="false" ' +
            (!settings.history.enableReappear ? "selected" : "") +
            ">Réapparitions OFF</option>" +
            "</select>" +
            '<input id="hx-h-q" class="hx-input" type="text" placeholder="Rechercher (nom/ASIN)" value="' +
            (settings.history.search || "") +
            '" style="flex:1;min-width:180px">' +
            "</div>" +
            '<div class="hx-controls">' +
            '<button id="hx-h-export" class="hx-btn-chip hx-btn-blue">Exporter CSV</button>' +
            '<button id="hx-h-export-json" class="hx-btn-chip hx-btn-gray">Exporter JSON</button>' +
            '<button id="hx-h-clear"  class="hx-btn-chip hx-btn-red">Vider l’historique</button>' +
            '<button id="hx-hseed"    class="hx-btn-chip hx-btn-amber">Tester détection (ajouter la page)</button>' +
            "</div>" +
            '<div class="hx-hlist">' +
            (list.join("") || '<div class="hx-lab2" style="padding:8px">Aucune entrée à afficher.</div>') +
            "</div>"
        );
    }
    function paneUI() {
        const accentOptions = Object.keys(ACCENTS)
            .map((k) => `<option value="${k}" ${settings.accent === k ? "selected" : ""}>${k[0].toUpperCase() + k.slice(1)}</option>`)
            .join("");
        const uiHTML = `
      <div class="hx-grid">
        <div><label class="hx-lab2">Thème</label>
          <select id="m-ui-theme" class="hx-select">
            <option value="system" ${settings.theme === "system" ? "selected" : ""}>Système</option>
            <option value="clair"  ${settings.theme === "clair" ? "selected" : ""}>Clair</option>
            <option value="sombre" ${settings.theme === "sombre" ? "selected" : ""}>Sombre</option>
            <option value="gris"   ${settings.theme === "gris" ? "selected" : ""}>Gris</option>
          </select></div>
        <div><label class="hx-lab2">Accent</label>
          <select id="m-ui-accent" class="hx-select">${accentOptions}</select></div>
        <div><label class="hx-lab2">Afficher l’horloge (carte)</label><select id="m-ui-clock" class="hx-select"><option value="true" ${settings.showClock ? "selected" : ""}>Oui</option><option value="false" ${
            !settings.showClock ? "selected" : ""
        }>Non</option></select></div>
        <div><label class="hx-lab2">Afficher le décompte</label><select id="m-ui-count" class="hx-select"><option value="true" ${settings.showCountdown ? "selected" : ""}>Oui</option><option value="false" ${
            !settings.showCountdown ? "selected" : ""
        }>Non</option></select></div>
        <div><label class="hx-lab2">“Articles pour les testeurs” →</label>
          <select id="m-ui-landing" class="hx-select">
            <option value="potluck" ${settings.defaultLanding === "potluck" ? "selected" : ""}>Recommandations</option>
            <option value="last_chance" ${settings.defaultLanding === "last_chance" ? "selected" : ""}>Dispo pour tous</option>
            <option value="encore" ${settings.defaultLanding === "encore" ? "selected" : ""}>Autres articles</option>
          </select>
        </div>
      </div>
      <div class="hx-hr"></div>
      <div class="hx-lab2">Note : “Reco horaire” (⏰) et “Plages” (🗓️) se pilotent uniquement via les icônes — pas d’option dans la modale.</div>
    `;
        return `
      <div class="hx-h1">Options globales</div>
      <div class="hx-hr"></div>
      ${collWrap("ui.base", "Affichage & comportement", uiHTML, false)}
    `;
    }
    function paneHelp() {
        const helpIntro =
            "<p>Bienvenue dans <b>Hex Vine Fusion</b>. Script unifié (Diff + Delta) avec UI compact, Turbo, <i>Plages</i> & <i>Reco horaire</i>, webhooks GET/POST, historique REC, et protections (anti-spam, circuit breaker, jitter, pause onglet, etc.).</p>" +
            "<p>Chaque onglet est <b>indépendant</b> et chaque file possède ses réglages.</p>";
        const helpModes =
            '<div class="hx-grid">' +
            '<div class="hx-full"><b>Files et modes</b></div>' +
            '<div class="hx-full"><ul>' +
            "<li><b>Recommandations</b> & <b>Dispo pour tous</b> : mode <i>Diff</i> (nouveaux/retours via ASIN).</li>" +
            "<li><b>Autres articles</b> : mode <i>Delta</i> (variation du total visible).</li>" +
            "</ul></div></div>";
        const helpAutoTurbo =
            '<div class="hx-grid">' +
            '<div class="hx-full"><b>Rafraîchissement</b></div>' +
            "<div><b>Activer</b> → planification aléatoire entre min/max (ou selon la plage active).</div>" +
            "<div><b>Turbo</b> → intervalles courts (2–10 s par ex.) pendant X secondes.</div>" +
            '<div class="hx-full"><b>Plages (🗓️)</b> → 4 créneaux en minutes, actifs même si “Activer” est OFF. Interrupteur global via l’icône.</div>' +
            '<div class="hx-full"><b>Reco horaire (⏰)</b> → reload à HH:59:55 et HH:00:00, anti-double déclenchement.</div>' +
            "</div>";
        const helpWebhooks =
            '<div class="hx-grid"><div class="hx-full"><b>Webhooks</b></div>' +
            '<div class="hx-full"><p>Un webhook par file. Choisir GET (MacroDroid) ou POST JSON.</p>' +
            "<p>GET params : <code>event, queue, total, diff, bn, rp, rm, tz, ts, page</code></p>" +
            "<p>POST JSON (Diff) : <code>{event, queue, timestamp, page, tz, total, diff, brand_new_asins, reappeared_asins, removed_asins}</code></p>" +
            "<p>POST JSON (Delta) : <code>{event, queue, timestamp, page, tz, total, diff}</code></p>" +
            "<p>Cooldown + déduplication + circuit breaker intégrés.</p></div></div>";
        const helpHistory =
            '<div class="hx-grid"><div class="hx-full"><b>Historique REC</b></div>' +
            '<div class="hx-full"><ul>' +
            "<li>Enregistre 1re vue + réapparitions (cooldown 5 min).</li>" +
            "<li>Vues: chronologique ou groupée par produit.</li>" +
            "<li>Recherche, filtres, export CSV/JSON, purge, zoom image.</li>" +
            "</ul></div></div>";
        const helpTroubleshoot =
            '<div class="hx-grid"><div class="hx-full"><b>Dépannage</b></div>' +
            '<div class="hx-full"><ul>' +
            "<li>Console (F12) : logs sous <i>[HexVine]</i>.</li>" +
            "<li>Reset compteurs : bouton en bas de la modale.</li>" +
            "<li>Limiter le bruit : cooldown ↑, plages ↑, reco horaire OFF.</li>" +
            "</ul></div></div>";
        return (
            '<div class="hx-h1">Aide & FAQ</div>' +
            '<div class="hx-hr"></div>' +
            collWrap("help.intro", "Présentation", helpIntro, !0) +
            collWrap("help.modes", "Files, modes et détection", helpModes, !1) +
            collWrap("help.auto", "Activer, Turbo, Plages, Reco horaire", helpAutoTurbo, !1) +
            collWrap("help.hk", "Webhooks (GET / POST JSON)", helpWebhooks, !1) +
            collWrap("help.hist", "Historique REC", helpHistory, !1) +
            collWrap("help.tr", "Dépannage", helpTroubleshoot, !1)
        );
    }
    const ov = document.createElement("div");
    ov.className = "hx-ov";
    ov.innerHTML = `<img alt="">`;
    ov.addEventListener("click", () => {
        ov.style.display = "none";
        ov.querySelector("img").src = "";
    });
    document.documentElement.appendChild(ov);
    function bindThumbZoom(scope) {
        $$(".hx-thumb", scope).forEach((img) => {
            img.addEventListener("click", () => {
                const src = img.getAttribute("data-hx-src") || img.getAttribute("src") || "";
                if (!src) return;
                ov.querySelector("img").src = src;
                ov.style.display = "flex";
            });
        });
    }
    function renderModal() {
        $("#pane-pot").innerHTML = paneFor("potluck");
        $("#pane-lc").innerHTML = paneFor("last_chance");
        $("#pane-enc").innerHTML = paneFor("encore");
        $("#pane-hist").innerHTML = paneHisto();
        $("#pane-ui").innerHTML = paneUI();
        $("#pane-help").innerHTML = paneHelp();
        const tabs = $$(".hx-tab", modal),
            panes = $$(".hx-pane", modal);
        const activate = (id) => {
            tabs.forEach((t) => t.classList.toggle("active", t.dataset.pane === id));
            panes.forEach((p) => p.classList.toggle("active", p.id === id));
            settings.ui.activePane = id;
            setSettings(settings);
            $("#hx-resetq").style.visibility = id === "pane-hist" ? "hidden" : "visible";
        };
        tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.pane)));
        const def = QUEUE === "potluck" ? "pane-pot" : QUEUE === "last_chance" ? "pane-lc" : "pane-enc";
        activate(settings.ui.activePane || def);
        wireCollapsers(modal);
        modal.addEventListener("click", (e) => {
            const t = e.target;
            if (!t) return;
            if (t.id === "hx-save") {
                e.preventDefault();
                e.stopPropagation();
                saveFromModal();
                return;
            }
            if (t.id === "hx-close") {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
                return;
            }
            if (t.id === "hx-resetq") {
                e.preventDefault();
                e.stopPropagation();
                if (settings.ui.activePane !== "pane-hist") resetCounters(activePaneQueue());
                return;
            }
            if (t.id && /^m-(potluck|last_chance|encore)-test$/.test(t.id)) {
                e.preventDefault();
                e.stopPropagation();
                const [, queue] = t.id.match(/^m-(potluck|last_chance|encore)-test$/) || [];
                if (queue) {
                    (async () => {
                        const url = (document.getElementById(`m-${queue}-wh`)?.value || "").trim();
                        if (!url) {
                            alert("Entrez une URL de webhook.");
                            return;
                        }
                        setStatus(`Test ${queue}…`);
                        const mode = String(document.getElementById(`m-${queue}-modehook`)?.value || "get");
                        let ok = !1;
                        if (mode === "json") {
                            ok = await httpPOST(url, { event: "test", queue, ts: new Date().toISOString() }, signHeaders({ event: "test", queue }));
                        } else {
                            ok = await httpGET(buildGet(url, { event: "test", queue, ts: new Date().toISOString() }));
                        }
                        setStatus(ok ? "Webhook OK" : "Webhook KO");
                    })();
                }
                return;
            }
        });
        const keepHist = () => {
            settings.ui.activePane = "pane-hist";
            setSettings(settings);
        };
        $("#hx-h-view")?.addEventListener("change", (e) => {
            settings.history.groupView = e.target.value === "group";
            setSettings(settings);
            keepHist();
            renderModal();
        });
        $("#hx-h-img")?.addEventListener("change", (e) => {
            settings.history.showImages = e.target.value === "true";
            setSettings(settings);
            keepHist();
            renderModal();
        });
        $("#hx-h-re")?.addEventListener("change", (e) => {
            settings.history.enableReappear = e.target.value === "true";
            setSettings(settings);
            keepHist();
            renderModal();
        });
        $("#hx-h-filter")?.addEventListener("change", (e) => {
            settings.history.filterType = e.target.value;
            setSettings(settings);
            keepHist();
            renderModal();
        });
        $("#hx-h-q")?.addEventListener("input", (e) => {
            settings.history.search = String(e.target.value || "");
            setSettings(settings);
            $("#pane-hist").innerHTML = paneHisto();
            bindThumbZoom($("#pane-hist"));
        });
        $("#hx-h-export")?.addEventListener("click", () => {
            const group = !!settings.history.groupView;
            let csv = "";
            if (group) {
                csv += "asin;name;url;first_ts;last_ts;sightings;img;price\n";
                const arr = Object.values(h_getProdMap()).sort((a, b) => new Date(b.last_ts) - new Date(a.last_ts));
                arr.forEach((p) => {
                    csv += [p.asin, p.name, p.url, p.first_ts, p.last_ts, p.sightings, p.img, p.price].map((s) => '"' + String(s || "").replace(/"/g, '""') + '"').join(";") + "\n";
                });
            } else {
                csv += "ts;type;asin;name;url;img;price\n";
                h_getEvents().forEach((ev) => {
                    csv += [ev.ts, ev.type, ev.asin, ev.name, ev.url, ev.img, ev.price].map((s) => '"' + String(s || "").replace(/"/g, '""') + '"').join(";") + "\n";
                });
            }
            const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = group ? "hist_potluck_group.csv" : "hist_potluck_events.csv";
            document.body.appendChild(a);
            a.click();
            a.remove();
        });
        $("#hx-h-export-json")?.addEventListener("click", () => {
            const data = { products: h_getProdMap(), events: h_getEvents() };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "hist_potluck.json";
            document.body.appendChild(a);
            a.click();
            a.remove();
        });
        $("#hx-h-clear")?.addEventListener("click", () => {
            if (!confirm("Vider l’historique potluck (produits + événements) ?")) return;
            h_setProdMap({});
            h_setEvents([]);
            h_prevSet([]);
            keepHist();
            renderModal();
        });
        $("#hx-hseed")?.addEventListener("click", () => {
            if (QUEUE !== "potluck") {
                alert("Ouvre “Recommandations” pour tester.");
                return;
            }
            const cur = extractASINs();
            if (!cur.length) {
                alert("Aucun article détecté sur la page.");
                return;
            }
            h_recordPotluck(cur);
            keepHist();
            renderModal();
        });
        bindThumbZoom(modal);
        $("#hx-close").onclick = closeModal;
        $("#hx-resetq").onclick = () => {
            if (settings.ui.activePane === "pane-hist") return;
            resetCounters(activePaneQueue());
        };
    }
    function openModal() {
        renderModal();
        back.style.display = "block";
        modal.style.display = "block";
        try {
            modal.querySelector(".hx-select, .hx-input")?.focus();
        } catch {}
    }
    function closeModal() {
        modal.style.display = "none";
        back.style.display = "none";
    }
    function activePaneQueue() {
        const id = settings.ui.activePane;
        return id === "pane-pot" ? "potluck" : id === "pane-lc" ? "last_chance" : id === "pane-enc" ? "encore" : QUEUE;
    }
    function resetCounters(queue) {
        if (settings.queues[queue].mode === "diff") {
            setLS(kq(queue, "lastAsins"), []);
            setLS(kq(queue, "flapTimes"), {});
        } else {
            try {
                sessionStorage.removeItem(kt("lastSeen"));
                sessionStorage.removeItem(kt("lastSeenAt"));
            } catch {}
        }
        setStatus(`Compteurs réinitialisés (${QLABEL_FR[queue] || queue})`);
    }
    function saveFromModal() {
        try {
            const Qs = ["potluck", "last_chance", "encore"];
            Qs.forEach((queue) => {
                const q = settings.queues[queue];
                q.mode = String(document.getElementById(`m-${queue}-mode`)?.value || q.mode);
                q.webhook = q.webhook || { url: "", mode: "json", cooldownSec: 2, threshold: 1 };
                q.webhook.threshold = Math.max(1, parseIntSafe(document.getElementById(`m-${queue}-thr`)?.value, q.webhook.threshold));
                q.minSec = clamp(parseIntSafe(document.getElementById(`m-${queue}-min`)?.value, q.minSec), 5, 1800);
                q.maxSec = clamp(parseIntSafe(document.getElementById(`m-${queue}-max`)?.value, q.maxSec), 5, 1800);
                if (q.minSec > q.maxSec) [q.minSec, q.maxSec] = [q.maxSec, q.minSec];
                q.webhook.url = String(document.getElementById(`m-${queue}-wh`)?.value || q.webhook.url).trim();
                q.webhook.mode = String(document.getElementById(`m-${queue}-modehook`)?.value || q.webhook.mode);
                q.webhook.cooldownSec = Math.max(0, parseIntSafe(document.getElementById(`m-${queue}-cd`)?.value, q.webhook.cooldownSec));
                q.super.enabled = String(document.getElementById(`m-${queue}-se`)?.value || String(!!q.super.enabled)) === "true";
                q.super.durationSec = clamp(parseIntSafe(document.getElementById(`m-${queue}-sdur`)?.value, q.super.durationSec), 10, 3600);
                q.super.minSec = clamp(parseIntSafe(document.getElementById(`m-${queue}-smin`)?.value, q.super.minSec), 1, 60);
                q.super.maxSec = clamp(parseIntSafe(document.getElementById(`m-${queue}-smax`)?.value, q.super.maxSec), 1, 60);
                if (q.super.minSec > q.super.maxSec) [q.super.minSec, q.super.maxSec] = [q.super.maxSec, q.super.minSec];
                const sch = q.schedules || [];
                const next = [];
                for (let i = 0; i < 4; i++) {
                    const enEl = document.getElementById(`m-${queue}-sch-en-${i}`);
                    if (!enEl) break;
                    next.push({
                        enabled: !!document.getElementById(`m-${queue}-sch-en-${i}`)?.checked,
                        start: String(document.getElementById(`m-${queue}-sch-start-${i}`)?.value || sch[i]?.start || "00:00"),
                        end: String(document.getElementById(`m-${queue}-sch-end-${i}`)?.value || sch[i]?.end || "23:59"),
                        minMin: clamp(parseIntSafe(document.getElementById(`m-${queue}-sch-min-${i}`)?.value, sch[i]?.minMin ?? 10), 1, 60),
                        maxMin: clamp(parseIntSafe(document.getElementById(`m-${queue}-sch-max-${i}`)?.value, sch[i]?.maxMin ?? 30), 1, 60),
                    });
                }
                if (next.length) q.schedules = next;
            });
            const th = String(document.getElementById("m-ui-theme")?.value || settings.theme);
            const ac = String(document.getElementById("m-ui-accent")?.value || settings.accent);
            const sh = String(document.getElementById("m-ui-clock")?.value || String(!!settings.showClock));
            const sc = String(document.getElementById("m-ui-count")?.value || String(!!settings.showCountdown));
            const dl = String(document.getElementById("m-ui-landing")?.value || settings.defaultLanding);
            settings.theme = th;
            settings.accent = ac;
            settings.showClock = sh === "true";
            settings.showCountdown = sc === "true";
            settings.defaultLanding = dl;
            setSettings(settings);
            applyTheme();
            updateUIStates();
            scheduleNext();
            setStatus("Options enregistrées");
            closeModal();
        } catch (err) {
            console.error("[HexVine] Save error", err);
            alert("Erreur pendant la sauvegarde. Voir console pour les détails.");
        }
    }
    function mountNavToggleTab() {
        const ul = document.querySelector('ul.a-tabs.a-declarative[data-action="a-tabs"][data-a-tabs*="vine-voice-tabs"]');
        if (!ul) return !1;
        if (ul.querySelector("#hx-nav-toggle-tab")) return !0;
        const li = document.createElement("li");
        li.id = "hx-nav-toggle-tab";
        li.className = "a-tab-heading";
        li.setAttribute("role", "presentation");
        const a = document.createElement("a");
        a.setAttribute("role", "tab");
        a.setAttribute("aria-selected", "false");
        a.setAttribute("tabindex", "-1");
        a.textContent = ssGet(kt("hidden"), !1) ? "Afficher l’UI" : "Masquer l’UI";
        a.href = "javascript:void(0)";
        a.addEventListener(
            "click",
            () => {
                const hidden = ssGet(kt("hidden"), !1);
                hidden ? showUI() : hideUI();
                a.textContent = hidden ? "Masquer l’UI" : "Afficher l’UI";
            },
            { capture: !0 }
        );
        li.appendChild(a);
        ul.appendChild(li);
        const mainTab = ul.querySelector('#vvp-vine-items-tab a[href*="vine-items"]');
        if (mainTab) {
            mainTab.addEventListener(
                "click",
                (e) => {
                    try {
                        e.preventDefault();
                        e.stopPropagation();
                        const target = settings.defaultLanding || "potluck";
                        location.assign(`/vine/vine-items?queue=${encodeURIComponent(target)}`);
                    } catch {}
                },
                { capture: !0 }
            );
        }
        return !0;
    }
    function ensureNavMounted() {
        if (mountNavToggleTab()) return;
        const mo = new MutationObserver(() => {
            if (mountNavToggleTab()) mo.disconnect();
        });
        mo.observe(document.body, { childList: !0, subtree: !0 });
    }
    function hideUI() {
        card.style.display = "none";
        ssSet(kt("hidden"), !0);
        const t = document.querySelector("#hx-nav-toggle-tab a");
        if (t) t.textContent = "Afficher l’UI";
    }
    function showUI() {
        card.style.display = "";
        ssSet(kt("hidden"), !1);
        const t = document.querySelector("#hx-nav-toggle-tab a");
        if (t) t.textContent = "Masquer l’UI";
    }
    ensureNavMounted();
    document.getElementById("hx-ic-opt").addEventListener("click", openModal);
    document.getElementById("hx-toggle").addEventListener("click", () => setAuto(!isAutoOn()));
    document.getElementById("hx-super").addEventListener("click", () => {
        isSuperOn() ? stopSuper() : startSuper();
    });
    document.getElementById("hx-ic-gate").addEventListener("click", () => {
        gateActive = !gateActive;
        ssSet(kt("gateActive"), gateActive);
        updateHeaderIcons();
    });
    document.getElementById("hx-ic-sched").addEventListener("click", () => {
        useSchedules = !useSchedules;
        settings.queues[QUEUE].useSchedules = useSchedules;
        setSettings(settings);
        updateHeaderIcons();
        scheduleNext();
    });
    if (typeof GM_registerMenuCommand === "function") {
        GM_registerMenuCommand("Hex Vine Fusion — Options", openModal);
        GM_registerMenuCommand("Hex Vine Fusion — ON/OFF", () => setAuto(!isAutoOn()));
        GM_registerMenuCommand("Hex Vine Fusion — Reset compteurs (file courante)", () => resetCounters(QUEUE));
        GM_registerMenuCommand("Hex Vine Fusion — Afficher/Masquer UI", () => {
            const hidden = ssGet(kt("hidden"), !1);
            hidden ? showUI() : hideUI();
        });
        GM_registerMenuCommand("Hex Vine Fusion — Debug logs ON/OFF", () => {
            DEBUG = !DEBUG;
            GM_setValue("hexfuse.debug", DEBUG);
            setStatus(`Debug ${DEBUG ? "ON" : "OFF"}`);
        });
    }
    document.addEventListener("keydown", (e) => {
        if (modal.style.display === "block") {
            if (e.key === "Escape") closeModal();
            if (e.key === "Enter") document.getElementById("hx-save")?.click();
        }
    });
    function bootstrap() {
        updateUIStates();
        setupObserver();
        scheduleNext();
        if (ssGet(kt("hidden"), !1)) hideUI();
        else showUI();
    }
    bootstrap();
    const phrasesHumoristiques = [
        "Notre distributeur automatique d’objets gratuits est en pause café.",
        "Les offres sont en congés payés aujourd’hui.",
        "Votre chance est partie faire du tourisme. Elle reviendra bientôt.",
        "L’algorithme fait la sieste. Ne le réveillez pas, il est grognon.",
        "Les produits sont trop timides pour sortir aujourd’hui.",
        "Un dragon a temporairement confisqué vos offres.",
        "Nos cartons sont coincés dans le trafic intergalactique.",
        "Un vortex a aspiré vos produits gratuits, désolé.",
        "Les colis passent un contrôle technique imprévu.",
        "Les produits disponibles jouent à cache-cache avec vous.",
        "On est à court d’offres, notre hamster est fatigué.",
        "Votre profil est tellement premium que même les offres hésitent à se présenter.",
        "C'est l'heure du goûter pour les produits, revenez plus tard.",
        "La livraison des cadeaux gratuits a été prise en otage par des lutins malicieux.",
        "Aujourd’hui, les produits font la queue à la cantine. Patience.",
        "Les offres sont parties à la plage profiter du soleil.",
        "On recharge le stock avec du café, revenez bientôt.",
        "Une licorne a mangé vos colis. Encore.",
        "La marmotte emballe les produits, mais lentement.",
        "Votre karma recharge ses batteries, réessayez demain.",
        "Toutes les bonnes offres sont occupées à écrire leur autobiographie.",
        "On a envoyé les produits sur Mars par erreur. Oups !",
        "Nos robots font une pause méditation, revenez zen plus tard.",
        "Les produits se maquillent pour être plus beaux en photo.",
        "On attend que Mercure rétrograde pour débloquer les offres.",
        "Les colis sont en atelier peinture pour un relooking.",
        "Les produits gratuits préparent secrètement une surprise pour demain.",
        "La brigade anti-morosité inspecte nos colis. Revenez plus tard.",
        "Un trou noir a temporairement avalé les meilleures offres.",
        "Les colis sont encore dans leur emballage cadeau, patience !",
        "Les lutins du marketing cherchent encore l’idée du siècle.",
        "Nos colis prennent actuellement des selfies pour Instagram.",
        "Les colis sont partis chasser des papillons, soyez indulgents.",
        "Les offres jouent à Pokémon GO, elles reviendront après la capture.",
        "Votre chance a pris une journée sabbatique bien méritée.",
        "Nos produits sont partis en vacances à Tahiti, les veinards.",
        "Votre facteur personnel fait actuellement du ski nautique.",
        "Les colis préparent leur spectacle annuel de magie.",
        "Un escargot livreur transporte vos colis, soyez patient.",
        "Les colis lisent actuellement votre profil avec admiration.",
        "Aujourd’hui, les colis se sont trompés d’étage, attendez-les demain.",
        "Une panne de réveil empêche nos produits de se présenter aujourd'hui.",
        "Les produits passent des tests de charisme approfondis.",
        "Votre livraison est coincée à un feu rouge interminable.",
        "On peaufine le bronzage de vos colis pour une présentation optimale.",
        "Les produits négocient actuellement une augmentation salariale.",
        "Les colis sont en réunion stratégique pour vous épater demain.",
        "Votre page personnelle est trop brillante : les colis sont éblouis.",
        "Un chaton mignon a détourné votre colis pour dormir dessus.",
        "Les colis vérifient leur horoscope avant de sortir.",
        "Le stagiaire a encore confondu le café avec les offres, désolé.",
        "Notre stagiaire expérimente le télétravail depuis son lit.",
        "Le stagiaire a décidé que travailler était une option ce matin.",
        "Le stagiaire a rangé vos colis dans le micro-ondes. On enquête.",
        "On cherche le stagiaire depuis 9h. Vu son efficacité, ça change rien.",
        "Le stagiaire tente actuellement de retrouver son mot de passe (c’est '1234').",
        "Le stagiaire vous conseille de revenir demain, ou jamais.",
        "Votre colis a été avalé par la poubelle grâce au stagiaire.",
        "On envoie le stagiaire chercher vos offres, il revient dans trois ans.",
        "Notre stagiaire fait des tests sur la gravité avec vos colis.",
        "Le stagiaire vient de découvrir comment allumer son ordinateur.",
        "Votre offre est actuellement en train d’être ignorée par le stagiaire.",
        "Le stagiaire a échangé vos produits contre des tickets-resto.",
        "Si le stagiaire avait été payé au mérite, il nous devrait de l’argent.",
        "Le stagiaire prend une pause après chaque clic de souris.",
        "Notre stagiaire est actuellement bloqué dans l’ascenseur. Tant mieux.",
        "Vos offres attendent que le stagiaire finisse sa partie de Candy Crush.",
        "Le stagiaire pensait que ‘offre’ rimait avec ‘coffre’ et les a enterrées.",
        "Le stagiaire a réussi à perdre les offres qu’il n’avait même pas encore reçues.",
        "Vos colis sont actuellement victimes de la dernière idée brillante du stagiaire.",
        "Les offres sont parties faire du yoga en forêt. Sans réseau.",
        "Le stagiaire a utilisé les colis comme repose-pieds.",
        "Les produits refusent de coopérer sans café équitable.",
        "Un bug cosmique a inversé le sens de l’offre. Maintenant, c’est vous qui devez envoyer un colis.",
        "Le serveur a été remplacé par un grille-pain pour 'économie d’énergie'.",
        "Les colis sont en train de réviser pour leur bac.",
        "L'algorithme est tombé amoureux d'une cafetière connectée. Il ne pense plus qu’à elle.",
        "Nos offres ont été troquées contre un NFT de sandwich.",
        "Le système a détecté trop de bonne humeur. Rejet des colis pour raison de conformité.",
        "Le stagiaire a activé le mode « furtif ». Trop bien, ça cache tout.",
        "Le comité éthique des objets gratuits est en grève.",
        "Le karma des colis n'était pas aligné. Ils ont été renvoyés en introspection.",
        "Les offres vous évitent. Elles ont peur de finir testées.",
        "Le système a confondu votre profil avec celui d’un pigeon. Il cherche encore le GPS.",
        "Nos produits refusent de sortir sans leur coach motivationnel.",
        "Les colis se remettent d’un team building émotionnel intense.",
        "L’algorithme a tout envoyé chez mamie. Par nostalgie.",
        "Une IA jalouse a supprimé toutes vos offres, juste pour embêter.",
        "Les colis attendent le bon moment cosmique. Ce n’est pas encore l’heure.",
        "Le stagiaire a accidentellement lancé le protocole 'Fin du monde'. Tout est en pause.",
        "Les colis suivent une thérapie de groupe pour apprendre à se livrer.",
        "Les offres sont en quarantaine, elles ont éternué dans l'entrepôt.",
        "Le stagiaire a tenté de les imprimer. En PDF.",
        "On attend que Mercure sorte de rétrograde ET que le stagiaire sorte du lit.",
        "Les produits sont actuellement à la recherche d'eux-mêmes.",
        "Vos offres ont glissé sous le tapis algorithmique.",
        "C’est mort. Cordialement.",
    ];
    const messagesStagiaire = [
        "Désolé, j'avais la flemme. Revenez demain... ou après-demain. Ou pas.",
        "J’ai lancé une recherche d’offres. J’ai trouvé ma dignité. Résultat : introuvable.",
        "J’ai cliqué sur « activer les offres », mais le bouton m’a ignoré.",
        "Je devais traiter vos offres. Puis j’ai vu un pigeon. Bref, j’ai suivi le pigeon.",
        "Je voulais bosser, mais je me suis souvenu que j’étais stagiaire.",
        "Les offres sont là. Mais je les ai laissées dans l’autre navigateur.",
        "Mon ordi a planté. Comme moi, tous les matins.",
        "J’ai tenté un truc… ça n’a pas marché. Je réessaierai si j’y pense.",
        "J’étais motivé. Pendant 4 secondes. Puis j’ai ouvert YouTube.",
        "Je vous aurais bien aidé, mais j’ai un niveau d’autorisation de plante verte.",
        "J’ai demandé à ChatGPT de faire le boulot. Il a refusé.",
        "J’ai mis vos offres dans un dossier... que j’ai effacé. Oups.",
        "Si vous lisez ce message, c’est que j’ai échoué. Encore.",
        "J’ai mis une alerte pour penser à bosser. Snoozée 42 fois.",
        "Y avait un choix à faire entre faire mon taf ou nourrir mon tamagotchi. Il est en vie.",
        "Je vous jure que j’ai failli presque commencer.",
        "Si j’étais payé au clic, j’aurais toujours pas cliqué.",
        "Mon café a planté. Du coup moi aussi.",
        "Vous êtes tombé sur moi. Pas de chance.",
        'Je me suis dit : "et si je faisais rien ?". Et bah voilà.',
        "Une erreur est survenue. Pas l’erreur système. Moi.",
        "J’ai rangé les offres par ordre d’apparition dans mes rêves.",
        "J’ai essayé un nouveau truc. Résultat : le site ne s’en est pas remis.",
        'J’ai demandé au responsable. Il m’a dit "hein ?".',
        "L’algorithme m’a demandé un conseil. C’est pour ça qu’il bug.",
        "Les offres sont dans un cloud. Et moi je suis dans les nuages.",
        "J’ai juré d’essayer. J’ai pas juré de réussir.",
        "Je vous ai préparé une surprise. C’est l’absence de toute offre.",
        "Faut pas trop m’en demander. Déjà que je suis là, c’est un miracle.",
        "Vous avez besoin d’aide ? Moi aussi.",
        "Le stagiaire a échangé vos produits contre des tickets-resto.",
        "Je suis parti acheter des offres gratuites avec ma carte bleue personnelle.",
        "Le stagiaire pensait que ‘offre’ rimait avec ‘coffre’ et les a enterrées.",
        "Le stagiaire tente actuellement de retrouver son mot de passe (c’est '1234').",
        "Je vous aurais bien affiché des offres, mais j’ai appuyé sur la mauvaise touche.",
    ];
    function remplacerTexte() {
        const msgContainer = document.querySelector(".a-section.vvp-no-offers-msg");
        if (!msgContainer) return;
        const paragraphe = msgContainer.querySelector("p");
        const ul = msgContainer.querySelector("ul.a-unordered-list.a-vertical");
        if (!paragraphe || !ul) return;
        ul.innerHTML = "";
        const showStagiaire = Math.random() < 0.4;
        if (showStagiaire) {
            paragraphe.textContent = "Message du stagiaire :";
            const li = document.createElement("li");
            li.className = "a-spacing-mini";
            const span = document.createElement("span");
            span.className = "a-list-item";
            span.textContent = messagesStagiaire[Math.floor(Math.random() * messagesStagiaire.length)];
            li.appendChild(span);
            ul.appendChild(li);
        } else {
            paragraphe.textContent = "Nous n'avons rien à vous proposer pour l'instant, mais voici pourquoi :";
            const shuffled = [...phrasesHumoristiques].sort(() => Math.random() - 0.5).slice(0, 4);
            shuffled.forEach((text) => {
                const li = document.createElement("li");
                li.className = "a-spacing-mini";
                const span = document.createElement("span");
                span.className = "a-list-item";
                span.textContent = text;
                li.appendChild(span);
                ul.appendChild(li);
            });
        }
    }
    window.addEventListener("load", remplacerTexte);
})();
if (ENABLE_VPP)
    (function () {
        "use strict";
        let DEBUG = !!GM_getValue("vp_debug", !1);
        const log = (...a) => {
                if (DEBUG) console.log("[VPP]", ...a);
            },
            warn = (...a) => console.warn("[VPP]", ...a);
        const ASIN_REGEX = /\b(B0[A-Z0-9]{8})\b/;
        const MS_PER_DAY = 86400000;
        const ORPHAN_GRACE_DAYS = 7,
            WINDOW_COMPLETED_MATCH_DAYS = 2,
            EVAL_SELECTOR = "#vvp-evaluation-period-tooltip-trigger";
        let VP_INTERACTING = !1,
            VP_INTERACT_TOUT = null;
        function vpStartInteract() {
            VP_INTERACTING = !0;
            if (VP_INTERACT_TOUT) {
                clearTimeout(VP_INTERACT_TOUT);
                VP_INTERACT_TOUT = null;
            }
        }
        function vpEndInteractSoon(d = 700) {
            if (VP_INTERACT_TOUT) clearTimeout(VP_INTERACT_TOUT);
            VP_INTERACT_TOUT = setTimeout(() => {
                VP_INTERACTING = !1;
                VP_INTERACT_TOUT = null;
            }, d);
        }
        let EVAL_START_CACHED = GM_getValue("eval_start_cached", null);
        let EVAL_END_CACHED = GM_getValue("eval_end_cached", null);
        let HIDE_APPROVED = GM_getValue("hide_approved", !1);
        let UI_SLICES_OPEN = !!GM_getValue("ui_slices_open", !1);
        let UI_DARK_MODE = GM_getValue("ui_darkmode", null);
        let PREF_HL_DATES = GM_getValue("pref_hl_dates", !0);
        let PREF_HL_STATUS = GM_getValue("pref_hl_status", !0);
        let PREF_COLOR_PROGRESS = GM_getValue("pref_color_progress", !0);
        let PREF_HIDE_SUBMITTED = GM_getValue("pref_hide_submitted", !1);
        const KEY_DEFAULTS = { enabled: !0, left: "q", right: "d", up: "z", down: "s" };
        let NAV_ENABLED = GM_getValue("nav_enabled", KEY_DEFAULTS.enabled);
        let KEY_LEFT = (GM_getValue("key_left", KEY_DEFAULTS.left) || "").toLowerCase();
        let KEY_RIGHT = (GM_getValue("key_right", KEY_DEFAULTS.right) || "").toLowerCase();
        let KEY_UP = (GM_getValue("key_up", KEY_DEFAULTS.up) || "").toLowerCase();
        let KEY_DOWN = (GM_getValue("key_down", KEY_DEFAULTS.down) || "").toLowerCase();
        let HMP_ENABLED = GM_getValue("hmp_enabled", !0);
        let HMP_REF_STR = GM_getValue("hmp_reference_date", "31/12/2022");
        let RATIO_START_STR = GM_getValue("ratio_start_iso", "2019-06-27");
        const SUBMIT_STORE = "vpp_submitted_local",
            SUBMIT_CTX = "vpp_submit_ctx";
        function subGet() {
            try {
                return JSON.parse(localStorage.getItem(SUBMIT_STORE) || "[]");
            } catch {
                return [];
            }
        }
        function subSet(a) {
            localStorage.setItem(SUBMIT_STORE, JSON.stringify(a || []));
        }
        function subAdd(rec) {
            const a = subGet(),
                same = (x) => x.asin === rec.asin && (x.day ?? null) === (rec.day ?? null);
            if (!a.some(same)) a.push(rec);
            subSet(a);
            console.info("[VPP][submit] add", rec);
            return a;
        }
        function subFind(asin, day = null) {
            const a = subGet();
            return day != null ? a.some((x) => x.asin === asin && (x.day ?? null) === day) : a.some((x) => x.asin === asin);
        }
        function subRemove(asin, day = null) {
            const a = subGet().filter((x) => !(x.asin === asin && (day == null || (x.day ?? null) === day)));
            subSet(a);
            console.info("[VPP][submit] purge", asin, day);
            return a;
        }
        function subPrune(days = 150) {
            const now = Date.now(),
                keep = subGet().filter((x) => now - new Date(x.submitted_at).getTime() < days * MS_PER_DAY);
            if (keep.length !== subGet().length) subSet(keep);
        }
        function asinFromURL(u = location.href) {
            const q = new URL(u, location.origin);
            return q.searchParams.get("asin") || q.pathname.match(/\/(B0[A-Z0-9]{8})/i)?.[1] || null;
        }
        const LF = { templates: "lazyflag_templates", groupTpl: "lazyflag_group_template", checked: "lazyflag_checked", orderFor: (asin) => `lazyflag_order_${asin}` };
        const defaultTemplates = [
            { name: "Produit non livré", content: "Bonjour,\n\nJe n'ai jamais reçu le produit suivant, pouvez-vous le retirer de ma liste ?\nCommande : $order\nASIN : $asin\nRaison : $reason\nCordialement." },
            { name: "Produit supprimé", content: "Bonjour,\n\nLe produit suivant a été supprimé, pouvez-vous le retirer de ma liste ?\nCommande : $order\nASIN : $asin\nRaison : $reason\nCordialement." },
            { name: "Avis en doublon", content: "Bonjour,\n\nJe ne peux pas déposer d'avis sur le produit suivant (doublon), pouvez-vous le retirer de ma liste ?\nCommande : $order\nASIN : $asin\nRaison : $reason\nCordialement." },
            { name: "Fusion de fiche produit", content: "Bonjour,\n\nLe produit suivant est une fusion de fiche, pouvez-vous le retirer de ma liste ?\nCommande : $order\nASIN : $asin\nRaison : $reason\nCordialement." },
            { name: "Produit livré endommagé", content: "Bonjour,\n\nLe produit suivant a été livré endommagé, pouvez-vous le retirer de ma liste ?\nCommande : $order\nASIN : $asin\nRaison : $reason\nCordialement." },
            {
                name: "Vous n'êtes pas éligible à commenter",
                content: "Bonjour,\n\nJe ne peux pas commenter ce produit (message : vous n'êtes pas éligible à commenter), pouvez-vous le retirer de ma liste ?\nCommande : $order\nASIN : $asin\nRaison : $reason\nCordialement.",
            },
        ];
        const defaultGroupTemplate = {
            name: "Mail groupé",
            content: "Bonjour,\n\nLes produits suivants ne peuvent pas être commentés pour les raisons suivantes :\n$debut\nASIN : $asin\nCommande : $order\nRaison : $reason\n$fin\nPouvez vous procéder à leur retrait ? Merci.",
        };
        GM_addStyle(`
:root{--c-bg:#fff;--c-fg:#111827;--c-muted:#6b7280;--c-card:#F3F4F6;--c-border:#E5E7EB;--c-green:#16a34a;--c-orange:#f59e0b;--c-red:#dc2626;--c-blue:#2563eb;--c-amber:#d97706;--radius:10px;--shadow:0 10px 30px rgba(0,0,0,.20)}
.vs-dark{--c-bg:#0b0f16;--c-fg:#e5e7eb;--c-muted:#94a3b8;--c-card:#111827;--c-border:#1f2937;--c-green:#22c55e;--c-orange:#fbbf24;--c-red:#ef4444;--c-blue:#3b82f6;--c-amber:#f59e0b}
.vs-container{margin-top:16px;font-size:15px;color:var(--c-fg)} .vs-cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
.vs-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius);padding:12px}
.vs-card-title{font-size:12px;color:var(--c-muted)} .vs-card-value{font-size:22px;font-weight:700;margin-top:2px}
.vs-details{margin-top:12px;border:1px solid var(--c-border);border-radius:8px;background:var(--c-bg)}
.vs-summary{cursor:pointer;padding:10px 12px;font-weight:600;user-select:none;color:var(--c-fg)} .vs-details[open] .vs-summary{border-bottom:1px solid var(--c-border)}
.vs-periods{padding:10px 12px;display:grid;gap:8px} .vs-period-line{display:flex;gap:10px;flex-wrap:wrap;align-items:center} .vs-period-name{font-weight:600}
.vs-chip{background:var(--c-card);border:1px solid var(--c-border);border-radius:999px;padding:4px 10px;font-size:12px;color:var(--c-fg)} .vs-chip-warn{color:var(--c-red);font-weight:700}
.vs-muted{color:var(--c-muted);font-size:12px}
#vpp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center}
#vpp-modal{background:var(--c-bg);color:var(--c-fg);border:1px solid var(--c-border);border-radius:12px;box-shadow:var(--shadow);width:96vw;max-width:1200px;max-height:88vh;display:grid;grid-template-rows:auto auto 1fr auto;overflow:hidden}
#vpp-modal header,#vpp-modal footer{padding:10px 14px} #vpp-modal header{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid var(--c-border)}
.vpp-tabs{display:flex;gap:6px} .vpp-tab-btn{border:1px solid var(--c-border);background:var(--c-card);color:var(--c-fg);padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:600}
.vpp-tab-btn[aria-selected="true"]{background:var(--c-blue);color:#fff;border-color:transparent} .vpp-body{padding:10px 14px;overflow:auto}
.vpp-section{display:none} .vpp-section[data-active="true"]{display:block}
.vpp-row{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.vs-input,.vs-select,.vs-textarea{background:var(--c-bg);color:var(--c-fg);border:1px solid var(--c-border);border-radius:8px;padding:8px 10px;outline:none}
.vs-btn{padding:8px 12px;border:1px solid var(--c-border);border-radius:8px;background:var(--c-card);color:var(--c-fg);cursor:pointer} .vs-btn:hover{filter:brightness(1.05)}
.vs-btn.primary{background:var(--c-blue);color:#fff;border-color:transparent} .vs-btn.warn{background:var(--c-red);color:#fff;border-color:transparent}
.vs-table-wrap{overflow:auto;border:1px solid var(--c-border);border-radius:12px;background:var(--c-bg)}
table.vs-table{width:100%;border-collapse:collapse;min-width:760px} table.vs-table th,table.vs-table td{padding:10px;border-bottom:1px solid var(--c-border);color:var(--c-fg)} table.vs-table th{background:var(--c-card);position:sticky;top:0;z-index:1;white-space:nowrap}
.vs-badge{padding:4px 8px;border-radius:999px;font-size:12px;font-weight:600;display:inline-block;color:var(--c-fg)} .vs-badge.pending{background:rgba(245,158,11,.15);color:var(--c-amber)} .vs-badge.verified{background:rgba(34,197,94,.15);color:var(--c-green)} .vs-badge.cancel{background:rgba(239,68,68,.15);color:var(--c-red)}
.vp-date-chip{font-weight:700;padding:2px 6px;border-radius:999px;border:1px solid transparent;display:inline-block;line-height:1;font-size:12px}
.vp-date-blue{color:#1d4ed8;background:rgba(29,78,216,.10);border-color:rgba(29,78,216,.25)}
.vp-date-green{color:#16a34a;background:rgba(22,163,74,.10);border-color:rgba(22,163,74,.25)}
.vp-date-orange{color:#d97706;background:rgba(217,119,6,.10);border-color:rgba(217,119,6,.25)}
.vp-date-red{color:#dc2626;background:rgba(220,38,38,.10);border-color:rgba(220,38,38,.25)}
.vp-status-orange{color:#d97706!important;font-weight:700!important} .vp-status-green{color:#16a34a!important;font-weight:700!important} .vp-status-red{color:#dc2626!important;font-weight:700!important} .vp-status-blue{color:#1d4ed8!important;font-weight:700!important} .vp-unavailable{color:#dc2626!important;font-weight:700!important}
.vp-pending-actions{display:flex;align-items:center;gap:8px;position:relative;z-index:5} .vp-pending-select{width:200px;max-width:260px}
.vp-order-link{display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:#007fff;font-size:13px} .vp-order-link[aria-disabled="true"]{color:#9CA3AF;pointer-events:none}
.vp-order-icon{width:16px;height:16px;display:inline-block}
#vvp-reviews-table--review-content-heading{display:flex!important;align-items:center;justify-content:space-between;gap:8px;white-space:nowrap}
.vp-th-actions-wrap{display:inline-flex;gap:6px;margin-left:auto} .vs-btn.sm{padding:4px 8px;font-size:12px;line-height:1.2}
.vpp-email-pop{position:fixed;z-index:99999;top:50%;left:50%;transform:translate(-50%,-50%);border:1px solid var(--c-border);background:var(--c-bg);color:var(--c-fg);padding:16px;border-radius:10px;box-shadow:var(--shadow);width:95vw;max-width:620px;max-height:80vh;overflow:auto}
.vpp-email-pop textarea{width:100%;height:220px;padding:8px;border:1px solid var(--c-border);border-radius:6px;background:var(--c-bg);color:var(--c-fg)}
/* Bouton "Donner un avis" quand soumis */
.vvp-reviews-table--action-btn.vpp-submitted,
.vvp-reviews-table--action-btn.vpp-submitted .a-button-inner{background:#16a34a!important;border-color:#15803d!important}
.vvp-reviews-table--action-btn.vpp-submitted .a-button-text{color:#fff!important}
.vpp-hide-approved{display:none!important}
`);
        function epochDayFromDate(d) {
            return Math.floor(d.getTime() / MS_PER_DAY);
        }
        function epochDayFromMillis(ms) {
            return Math.floor(ms / MS_PER_DAY);
        }
        function dateFromEpochDay(day) {
            return new Date(day * MS_PER_DAY);
        }
        function key(asin, day) {
            return `${asin}|${day}`;
        }
        function parseFRDateToISO(s) {
            const m = (s || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!m) return null;
            return `${m[3]}-${m[2]}-${m[1]}T00:00:00Z`;
        }
        function toEpochDaySafe(x) {
            if (typeof x === "number") return epochDayFromMillis(x);
            if (x instanceof Date) return epochDayFromDate(x);
            if (typeof x === "string") {
                const m = x.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                if (m) {
                    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
                    return isNaN(d) ? null : epochDayFromDate(d);
                }
                const d = new Date(x);
                return isNaN(d) ? null : epochDayFromDate(d);
            }
            const d = new Date(x);
            return isNaN(d) ? null : epochDayFromDate(d);
        }
        function normalizeSpaces(s) {
            return (s || "")
                .replace(/\u00A0/g, " ")
                .replace(/[–—]/g, "-")
                .replace(/[’]/g, "'")
                .trim();
        }
        function grabDateRange(t) {
            const m = (t || "").match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
            if (!m) return null;
            const s = parseFRDateToISO(m[1]),
                e = parseFRDateToISO(m[2]);
            if (!s || !e) return null;
            return { startISO: s, endISO: e };
        }
        function extractPeriodFromAny(doc) {
            const node = doc.querySelector(EVAL_SELECTOR);
            if (node) {
                const t = normalizeSpaces(node.textContent || "");
                const g = grabDateRange(t);
                if (g) return g;
            }
            const body = normalizeSpaces(doc.body?.textContent || "");
            return grabDateRange(body);
        }
        async function syncEvaluationPeriodFromAmazon() {
            try {
                const resDOM = extractPeriodFromAny(document);
                if (resDOM) {
                    EVAL_START_CACHED = resDOM.startISO;
                    EVAL_END_CACHED = resDOM.endISO;
                    GM_setValue("eval_start_cached", EVAL_START_CACHED);
                    GM_setValue("eval_end_cached", EVAL_END_CACHED);
                    log("Période sync (DOM)", EVAL_START_CACHED, EVAL_END_CACHED);
                    return !0;
                }
                let html = await new Promise((res, rej) => {
                    GM_xmlhttpRequest({ method: "GET", url: "https://www.amazon.fr/vine/account", onload: (r) => (r.status >= 200 && r.status < 400 ? res(r.responseText) : rej(new Error("HTTP " + r.status))), onerror: (e) => rej(e) });
                });
                const doc = new DOMParser().parseFromString(html, "text/html");
                const r = extractPeriodFromAny(doc);
                if (!r) return !1;
                EVAL_START_CACHED = r.startISO;
                EVAL_END_CACHED = r.endISO;
                GM_setValue("eval_start_cached", EVAL_START_CACHED);
                GM_setValue("eval_end_cached", EVAL_END_CACHED);
                log("Période sync (fetch)", EVAL_START_CACHED, EVAL_END_CACHED);
                return !0;
            } catch (e) {
                warn("syncEval error", e);
                return !1;
            }
        }
        const REVIEW_STATUS = { APPROVED: "approved", SUBMITTED: "submitted", PENDING_APPROVAL: "pending_approval", UNKNOWN: "unknown" };
        const STATUS_PRIOR = { unknown: 0, pending_approval: 1, submitted: 2, approved: 3 };
        function classifyStatus(t) {
            if (!t) return null;
            if (/(approuv|publi|approved|published|live)/i.test(t)) return REVIEW_STATUS.APPROVED;
            if (/(en\s*attente.*approbation|pending.*approval|en\s*examen)/i.test(t)) return REVIEW_STATUS.PENDING_APPROVAL;
            if (/(soumis|envoyé|submitted|posted)/i.test(t)) return REVIEW_STATUS.SUBMITTED;
            return null;
        }
        function detectReviewStatus(row) {
            const ds = row.getAttribute?.("data-status") || row.dataset?.status || "";
            return classifyStatus(ds) || classifyStatus(row.textContent || "") || REVIEW_STATUS.UNKNOWN;
        }
        function findAsinInRow(row) {
            const href = row.querySelector("a.a-link-normal")?.href || "";
            const m1 = href.match(/\/dp\/(B0[A-Z0-9]{8})/);
            if (m1) return m1[1];
            for (const c of row.querySelectorAll("td")) {
                const m = c.textContent.trim().match(ASIN_REGEX);
                if (m) return m[1];
            }
            return null;
        }
        function extractDataFromPage() {
            const results = [];
            const url = location.href;
            if (url.includes("/vine/vine-reviews")) {
                document.querySelectorAll("tr.vvp-reviews-table--row").forEach((row) => {
                    const asin = findAsinInRow(row);
                    if (!asin) return;
                    let day = null;
                    const tsCell = row.querySelector("td[data-order-timestamp]");
                    if (tsCell) {
                        const ms = parseInt(tsCell.getAttribute("data-order-timestamp") || "", 10);
                        if (!Number.isNaN(ms)) day = epochDayFromMillis(ms);
                    }
                    if (day === null) {
                        const t = tsCell?.textContent?.trim();
                        if (t) {
                            const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                            if (m) {
                                const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
                                if (!isNaN(d)) day = epochDayFromDate(d);
                            }
                        }
                    }
                    if (day === null) return;
                    const reviewType = new URLSearchParams(location.search).get("review-type") || "pending_review";
                    if (reviewType === "completed") results.push({ asin, day, status: detectReviewStatus(row) });
                    else results.push({ asin, day });
                });
            } else if (url.includes("/vine/orders")) {
                document.querySelectorAll("tr.vvp-orders-table--row").forEach((row) => {
                    const asin = findAsinInRow(row);
                    if (!asin) return;
                    const ts = row.querySelector("td[data-order-timestamp]")?.getAttribute("data-order-timestamp");
                    if (!ts) return;
                    const ms = parseInt(ts, 10);
                    if (Number.isNaN(ms)) return;
                    results.push({ asin, day: epochDayFromMillis(ms) });
                });
            }
            return results;
        }
        function mergeStatus(a, b) {
            const A = a.status || "unknown",
                B = b.status || "unknown";
            return STATUS_PRIOR[B] > STATUS_PRIOR[A] ? { ...a, status: b.status } : a;
        }
        function storeData(type, data) {
            const prev = (GM_getValue(type, []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date), status: x.status || null }));
            const map = new Map(prev.map((it) => [key(it.asin, it.day), it]));
            for (const item of data) {
                const asin = item.asin,
                    day = item.day ?? toEpochDaySafe(item.date),
                    status = item.status || null;
                if (ASIN_REGEX.test(asin) && typeof day === "number") {
                    const k = key(asin, day);
                    if (!map.has(k)) map.set(k, { asin, day, status });
                    else map.set(k, mergeStatus(map.get(k), { asin, day, status }));
                }
            }
            GM_setValue(type, Array.from(map.values()));
        }
        function syncCompletedReviews(completedData) {
            if (!Array.isArray(completedData) || !completedData.length) return;
            let pending = (GM_getValue("pending_reviews", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date) }));
            let completed = (GM_getValue("completed_reviews", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date), status: x.status || null }));
            const pendByAsin = new Map();
            for (const p of pending) {
                if (!pendByAsin.has(p.asin)) pendByAsin.set(p.asin, []);
                pendByAsin.get(p.asin).push(p.day);
            }
            for (const c of completedData) {
                const asin = c.asin,
                    cday = c.day ?? toEpochDaySafe(c.date),
                    cstatus = c.status || null;
                const days = pendByAsin.get(asin) || [];
                for (const d of days) {
                    if (Math.abs(d - cday) <= WINDOW_COMPLETED_MATCH_DAYS) {
                        pending = pending.filter((p) => !(p.asin === asin && p.day === d));
                        break;
                    }
                }
                const idx = completed.findIndex((x) => x.asin === asin && x.day === cday);
                if (idx === -1) completed.push({ asin, day: cday, status: cstatus });
                else completed[idx] = mergeStatus(completed[idx], { asin, day: cday, status: cstatus });
                if ((cstatus || "").toLowerCase() === "approved") {
                    try {
                        subRemove(asin, cday);
                    } catch {}
                }
            }
            const uniq = (arr) => Array.from(new Map(arr.map((x) => [key(x.asin, x.day), x])).values());
            GM_setValue("pending_reviews", uniq(pending));
            GM_setValue("completed_reviews", uniq(completed));
        }
        function reconcileAndPersist() {
            let pending = (GM_getValue("pending_reviews", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date) })),
                completed = (GM_getValue("completed_reviews", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date), status: x.status || null })),
                orders = (GM_getValue("orders_data", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date) }));
            const uniq = (arr, withStatus = !1) => {
                const m = new Map();
                for (const it of arr) {
                    const k = key(it.asin, it.day);
                    if (!m.has(k)) m.set(k, it);
                    else if (withStatus) m.set(k, mergeStatus(m.get(k), it));
                }
                return Array.from(m.values());
            };
            pending = uniq(pending);
            completed = uniq(completed, !0);
            orders = uniq(orders);
            const setOrders = new Set(orders.map((x) => key(x.asin, x.day))),
                setCompleted = new Set(completed.map((x) => key(x.asin, x.day))),
                dayNow = epochDayFromDate(new Date());
            let pendingMeta = GM_getValue("pending_meta", {});
            for (const p of pending) {
                const k = key(p.asin, p.day);
                if (setOrders.has(k) || setCompleted.has(k)) pendingMeta[k] = dayNow;
                else pendingMeta[k] = pendingMeta[k] ?? dayNow;
            }
            const keep = [];
            for (const p of pending) {
                const k = key(p.asin, p.day);
                const lastSeen = pendingMeta[k] ?? dayNow;
                const orphanAge = dayNow - lastSeen;
                const isOrphan = !setOrders.has(k) && !setCompleted.has(k);
                if (isOrphan && orphanAge > ORPHAN_GRACE_DAYS) {
                    delete pendingMeta[k];
                    continue;
                }
                keep.push(p);
            }
            pending = keep;
            GM_setValue("pending_reviews", pending);
            GM_setValue("completed_reviews", completed);
            GM_setValue("orders_data", orders);
            GM_setValue("pending_meta", pendingMeta);
            return { pending, completed, orders };
        }
        function rainbowApplyDates(container = document) {
            if (!PREF_HL_DATES) return;
            if (!location.href.startsWith("https://www.amazon.fr/vine/vine-reviews")) return;
            const type = new URLSearchParams(location.search).get("review-type") || "pending_review";
            if (type === "completed") return;
            container.querySelectorAll("tr.vvp-reviews-table--row").forEach((row) => {
                const td = row.querySelector("td[data-order-timestamp]");
                if (!td) return;
                const ts = td.getAttribute("data-order-timestamp");
                if (!ts) return;
                const ms = parseInt(ts, 10);
                if (Number.isNaN(ms)) return;
                const d = new Date(ms);
                const diffDays = Math.floor((Date.now() - ms) / MS_PER_DAY);
                let cls = "vp-date-red";
                if (diffDays < 7) cls = "vp-date-blue";
                else if (diffDays < 14) cls = "vp-date-green";
                else if (diffDays < 30) cls = "vp-date-orange";
                td.innerHTML = `<span class="vp-date-chip ${cls}">${d.toLocaleDateString("fr-FR")}</span>`;
            });
        }
        function rainbowApplyStatus(container = document) {
            if (!PREF_HL_STATUS) return;
            container.querySelectorAll("td.vvp-reviews-table--text-col").forEach((td) => {
                const txt = (td.innerText || "").trim();
                let cls = null;
                if (/En attente d'?approbation/i.test(txt)) cls = "vp-status-orange";
                else if (/Approuv/i.test(txt)) cls = "vp-status-green";
                else if (/Non approuv/i.test(txt)) cls = "vp-status-red";
                else if (/commenté cet article/i.test(txt)) cls = "vp-status-blue";
                if (cls) td.classList.add(cls);
            });
            container.querySelectorAll("div.vvp-subtitle-color").forEach((div) => {
                const subtitle = (div.innerText || "").trim();
                if (subtitle === "Cet article n'est plus disponible") div.classList.add("vp-unavailable");
            });
        }
        function rainbowApplyProgress() {
            if (!PREF_COLOR_PROGRESS) return;
            const bar = document.querySelector("#vvp-perc-reviewed-metric-display .animated-progress span");
            if (!bar) return;
            const v = parseFloat(bar.getAttribute("data-progress"));
            if (isNaN(v)) return;
            let color = "green";
            if (v < 65) color = "red";
            else if (v < 75) color = "orange";
            bar.style.backgroundColor = color;
        }
        function applyRainbowStably() {
            rainbowApplyProgress();
            rainbowApplyStatus(document);
            rainbowApplyDates(document);
        }
        function parseRefDate(str) {
            const m = (str || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!m) return null;
            return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
        }
        let HMP_LAST_SIG = null,
            HMP_LAST_COUNT = 0,
            HMP_LAST_RUN = 0;
        function hmpSignature() {
            const qs = new URLSearchParams(location.search),
                type = qs.get("review-type") || "pending_review";
            const rowsSig = [...document.querySelectorAll("tr.vvp-reviews-table--row td[data-order-timestamp]")].map((td) => td.getAttribute("data-order-timestamp") || "x").join(",");
            return `${type}|${HMP_REF_STR}|${rowsSig}`;
        }
        function applyHMP() {
            if (!HMP_ENABLED) return 0;
            const qs = new URLSearchParams(location.search);
            const type = qs.get("review-type") || "pending_review";
            if (type !== "pending_review") return 0;
            const ref = parseRefDate(HMP_REF_STR);
            if (!ref) return 0;
            const now = Date.now(),
                sig = hmpSignature();
            if (sig === HMP_LAST_SIG && now - HMP_LAST_RUN < 4000) return HMP_LAST_COUNT;
            let hidden = 0;
            document.querySelectorAll("tr.vvp-reviews-table--row").forEach((row) => {
                const td = row.querySelector("td[data-order-timestamp]");
                if (!td) return;
                const ms = parseInt(td.getAttribute("data-order-timestamp") || "", 10);
                if (Number.isNaN(ms)) return;
                const d = new Date(ms);
                const shouldHide = d < ref;
                if (shouldHide) {
                    if (!row.classList.contains("vpp-hmp-hidden")) row.classList.add("vpp-hmp-hidden");
                    if (row.style.display !== "none") row.style.display = "none";
                    hidden++;
                } else {
                    if (row.classList.contains("vpp-hmp-hidden")) row.classList.remove("vpp-hmp-hidden");
                    if (row.style.display === "none") row.style.display = "";
                }
            });
            const changed = hidden !== HMP_LAST_COUNT || sig !== HMP_LAST_SIG;
            HMP_LAST_SIG = sig;
            HMP_LAST_COUNT = hidden;
            HMP_LAST_RUN = now;
            if (DEBUG && changed) log("HMP masqués:", hidden, "ref=", HMP_REF_STR);
            return hidden;
        }
        function applyHideApproved() {
            if (!location.href.includes("/vine/vine-reviews")) return 0;
            const qs = new URLSearchParams(location.search);
            const type = qs.get("review-type") || "pending_review";
            if (!HIDE_APPROVED || type !== "completed") {
                document.querySelectorAll("tr.vpp-hide-approved").forEach((row) => {
                    row.classList.remove("vpp-hide-approved");
                    if (row.style.display === "none") row.style.display = "";
                });
                return 0;
            }
            const norm = (s) =>
                (s || "")
                    .replace(/\u00A0/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
            let hidden = 0;
            let sawSamples = [];
            document.querySelectorAll("tr.vvp-reviews-table--row").forEach((row) => {
                const candidates = [...row.querySelectorAll("td.vvp-reviews-table--text-col")].filter((td) => !td.querySelector("a"));
                let approvedHere = !1;
                for (const td of candidates) {
                    const txt = norm(td.textContent);
                    if (sawSamples.length < 5) sawSamples.push(txt);
                    if (txt === "Approuvé") {
                        approvedHere = !0;
                        break;
                    }
                }
                if (approvedHere) {
                    if (!row.classList.contains("vpp-hide-approved")) {
                        row.classList.add("vpp-hide-approved");
                        row.style.display = "none";
                        hidden++;
                    }
                } else {
                    if (row.classList.contains("vpp-hide-approved")) {
                        row.classList.remove("vpp-hide-approved");
                        if (row.style.display === "none") row.style.display = "";
                    }
                }
            });
            if (DEBUG) {
                console.log("[VPP] Masqués (Approuvé strict):", hidden);
                if (!hidden) {
                    console.log("[VPP] échantillon cellules statut normalisées (5 max):", sawSamples);
                }
            }
            return hidden;
        }
        function getPageKind() {
            const p = location.pathname;
            if (/\/vine\/vine-items/i.test(p)) return "items";
            if (/\/vine\/vine-reviews/i.test(p)) return "reviews";
            if (/\/vine\/orders/i.test(p)) return "orders";
            return "other";
        }
        function getPageInfo() {
            const u = new URL(location.href);
            const page = parseInt(u.searchParams.get("page") || "1", 10);
            let queue = null;
            if (getPageKind() === "items") {
                const rawQ = (u.searchParams.get("queue") || "potluck").toLowerCase();
                queue = ["potluck", "last_chance", "encore"].includes(rawQ) ? rawQ : "potluck";
            }
            return { page, queue, url: u };
        }
        function setParam(u, key, val) {
            const url = u instanceof URL ? new URL(u) : new URL(u, location.href);
            url.searchParams.set(key, String(val));
            return url.toString();
        }
        function goTo(url) {
            location.href = url;
        }
        function onKeyDown(e) {
            if (!NAV_ENABLED) return;
            const kind = getPageKind();
            if (!["items", "reviews", "orders"].includes(kind)) return;
            const ae = document.activeElement;
            if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
            const k = (e.key || "").toLowerCase();
            const isLeft = k === "arrowleft" || (KEY_LEFT && k === KEY_LEFT);
            const isRight = k === "arrowright" || (KEY_RIGHT && k === KEY_RIGHT);
            const isUp = k === "arrowup" || (KEY_UP && k === KEY_UP);
            const isDown = k === "arrowdown" || (KEY_DOWN && k === KEY_DOWN);
            if (!isLeft && !isRight && !isUp && !isDown) return;
            const { page, queue, url } = getPageInfo();
            if (isLeft || isRight) {
                const nextPage = Math.max(1, page + (isLeft ? -1 : 1));
                goTo(setParam(url, "page", nextPage));
                return;
            }
            if (kind === "items" && (isUp || isDown)) {
                const queues = ["potluck", "last_chance", "encore"];
                let idx = queues.indexOf(queue || "potluck");
                idx = Math.min(queues.length - 1, Math.max(0, idx + (isUp ? -1 : 1)));
                const u = new URL(url);
                u.searchParams.set("queue", queues[idx]);
                u.searchParams.set("page", "1");
                goTo(u.toString());
            }
        }
        const HARVEST_COOLDOWN_MS = 15 * 60 * 1000;
        const HARVEST_STATE = { pending_review: !1, completed: !1 };
        function shouldHarvest(type) {
            const last = GM_getValue("harvest_ts_" + type, 0);
            return Date.now() - last > HARVEST_COOLDOWN_MS;
        }
        function setHarvestStamp(type) {
            GM_setValue("harvest_ts_" + type, Date.now());
        }
        function extractDataFromDoc(doc, url) {
            const results = [];
            if (!/\/vine\/vine-reviews/.test(url)) return results;
            const qs = new URL(url, location.origin);
            const rt = qs.searchParams.get("review-type") || "pending_review";
            doc.querySelectorAll("tr.vvp-reviews-table--row").forEach((row) => {
                let asin = null;
                const link = row.querySelector(".vvp-reviews-table--text-col a.a-link-normal");
                if (link?.href) {
                    const m = link.href.match(/\/dp\/(B0[A-Z0-9]{8})/);
                    if (m) asin = m[1];
                }
                if (!asin) {
                    const t = row.textContent || "";
                    const m = t.match(ASIN_REGEX);
                    if (m) asin = m[1];
                }
                if (!asin) return;
                let day = null;
                const tsCell = row.querySelector("td[data-order-timestamp]");
                if (tsCell) {
                    const ms = parseInt(tsCell.getAttribute("data-order-timestamp") || "", 10);
                    if (!Number.isNaN(ms)) day = epochDayFromMillis(ms);
                }
                if (day === null) {
                    const t = tsCell?.textContent?.trim();
                    if (t) {
                        const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                        if (m) {
                            const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
                            if (!isNaN(d)) day = epochDayFromDate(d);
                        }
                    }
                }
                if (day === null) return;
                if (rt === "completed") results.push({ asin, day, status: detectReviewStatus(row) });
                else results.push({ asin, day });
            });
            return results;
        }
        function getReviewPaginationHrefs(doc) {
            const out = new Set();
            doc.querySelectorAll(".a-pagination a[href]").forEach((a) => {
                const href = a.getAttribute("href");
                if (!href) return;
                const abs = new URL(href, location.origin).href;
                if (/\/vine\/vine-reviews/.test(abs)) out.add(abs);
            });
            return Array.from(out);
        }
        async function harvestAllReviewPagesOnce(typeKey) {
            try {
                if (HARVEST_STATE[typeKey]) return;
                if (!shouldHarvest(typeKey)) return;
                HARVEST_STATE[typeKey] = !0;
                const hrefs = getReviewPaginationHrefs(document).filter((h) => new URL(h).searchParams.get("review-type") === (typeKey || "pending_review"));
                if (!hrefs.length) {
                    setHarvestStamp(typeKey);
                    HARVEST_STATE[typeKey] = !1;
                    return;
                }
                log("Harvest pages=", hrefs.length, "type=", typeKey);
                for (const href of hrefs) {
                    const html = await new Promise((res, rej) => {
                        GM_xmlhttpRequest({ method: "GET", url: href, onload: (r) => (r.status >= 200 && r.status < 400 ? res(r.responseText) : rej(new Error("HTTP " + r.status))), onerror: (e) => rej(e) });
                    });
                    const dom = new DOMParser().parseFromString(html, "text/html");
                    const batch = extractDataFromDoc(dom, href);
                    if (batch?.length) {
                        if (typeKey === "pending_review") storeData("pending_reviews", batch);
                        else storeData("completed_reviews", batch);
                    }
                }
                setHarvestStamp(typeKey);
                log("Harvest terminé pour", typeKey);
                try {
                    displayResults();
                } catch (e) {
                    warn(e);
                }
            } catch (e) {
                warn("harvest error", e);
            } finally {
                HARVEST_STATE[typeKey] = !1;
            }
        }
        function initDaysLeftOnAccount() {
            if (!location.href.startsWith("https://www.amazon.fr/vine/account")) return;
            const waitSel = (sel, cb) => {
                const it = setInterval(() => {
                    const el = document.querySelector(sel);
                    if (el) {
                        clearInterval(it);
                        cb(el);
                    }
                }, 300);
                setTimeout(() => clearInterval(it), 12000);
            };
            function colorForDays(n) {
                if (n < 15) return "red";
                if (n < 30) return "orange";
                if (n < 45) return "green";
                return "blue";
            }
            waitSel("#vvp-evaluation-date-string strong", (strong) => {
                const [d, m, y] = strong.textContent.trim().split("/").map(Number);
                const evalDate = new Date(y, m - 1, d);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                evalDate.setHours(0, 0, 0, 0);
                const diff = Math.ceil((evalDate - now) / MS_PER_DAY);
                const s = document.createElement("span");
                s.style.marginLeft = "10px";
                s.style.fontWeight = "bold";
                s.style.color = colorForDays(diff);
                s.textContent = `(${diff} jour${diff > 1 ? "s" : ""} restant${diff > 1 ? "s" : ""})`;
                strong.parentElement.appendChild(s);
            });
            const prevPct = parseFloat(localStorage.getItem("vineProgressPercentage") || ""),
                prevDate = localStorage.getItem("vineProgressDate") || null;
            const progressText = document.querySelector("#vvp-perc-reviewed-metric-display p strong"),
                progressBar = document.querySelector("#vvp-perc-reviewed-metric-display .animated-progress");
            function renderProgressLastModified(container, dateTime, diff) {
                document.querySelector(".last-modification")?.remove();
                const span = document.createElement("span");
                span.className = "last-modification";
                span.innerHTML = `Dernière modification constatée le <strong>${dateTime}</strong>`;
                if (diff !== null) {
                    const d = document.createElement("span");
                    d.textContent = ` (${diff > 0 ? "+" : ""}${diff.toFixed(1)} %)`;
                    d.style.color = diff > 0 ? "green" : diff < 0 ? "red" : "inherit";
                    span.appendChild(d);
                }
                container.parentNode.insertBefore(span, container.nextSibling);
            }
            if (progressText && progressBar) {
                const pctStr = progressText.textContent.trim();
                const curPct = parseFloat(pctStr.replace("%", "").replace(",", "."));
                if (!isNaN(curPct)) {
                    if (isNaN(prevPct) || prevPct !== curPct) {
                        const nowStr = new Date().toLocaleString();
                        const diff = isNaN(prevPct) ? null : curPct - prevPct;
                        localStorage.setItem("vineProgressPercentage", curPct);
                        localStorage.setItem("vineProgressDate", nowStr);
                        renderProgressLastModified(progressBar, nowStr, diff);
                    } else if (prevDate) {
                        renderProgressLastModified(progressBar, prevDate, null);
                    }
                }
            }
        }
        function ratioOrdersOnOrdersPage() {
            if (!location.href.startsWith("https://www.amazon.fr/vine/orders")) return;
            const h3 = document.querySelector(".vvp-orders-table--heading-top h3");
            if (!h3) return;
            const m = (h3.textContent || "").match(/\d+/);
            if (!m) return;
            const total = parseInt(m[0], 10);
            let start = new Date(RATIO_START_STR);
            if (isNaN(start)) start = new Date("2019-06-27");
            const days = Math.max(1, Math.floor((Date.now() - start.getTime()) / MS_PER_DAY));
            const perDay = (total / days).toFixed(3);
            let color = "#16a34a";
            if (perDay >= 1.25) color = "#80FF00";
            if (perDay >= 2.5) color = "#FFFF00";
            if (perDay >= 3.75) color = "#FF8000";
            if (perDay >= 5.0) color = "#FF0000";
            if (perDay >= 6.25) color = "#FF0000";
            h3.innerHTML = `Commandes (${total}) — Ratio/jour: <span style="color:${color};font-weight:700">${perDay}</span>`;
        }
        function lfGetTemplates() {
            try {
                return JSON.parse(localStorage.getItem(LF.templates) || "[]");
            } catch {
                return [];
            }
        }
        function lfSetTemplates(arr) {
            localStorage.setItem(LF.templates, JSON.stringify(arr));
        }
        function lfGetGroupTpl() {
            try {
                return JSON.parse(localStorage.getItem(LF.groupTpl) || "null");
            } catch {
                return null;
            }
        }
        function lfSetGroupTpl(obj) {
            localStorage.setItem(LF.groupTpl, JSON.stringify(obj));
        }
        function lfGetChecked() {
            try {
                return JSON.parse(localStorage.getItem(LF.checked) || "{}");
            } catch {
                return {};
            }
        }
        function lfSetChecked(o) {
            localStorage.setItem(LF.checked, JSON.stringify(o));
        }
        function lfResetChecked() {
            localStorage.removeItem(LF.checked);
        }
        function lfEnsureDefaults() {
            if (!lfGetTemplates().length) lfSetTemplates(defaultTemplates.slice());
            if (!lfGetGroupTpl()) lfSetGroupTpl({ ...defaultGroupTemplate });
        }
        function lfExtractASIN(str) {
            const m = str?.match(/\/dp\/(B0[A-Z0-9]{8})/i) || str?.match(/\b(B0[A-Z0-9]{8})\b/i);
            return m ? m[1] || m[0] : null;
        }
        function lfExtractOrderId(url) {
            const m = url?.match(/orderID=([0-9\-]+)/);
            return m ? m[1] : null;
        }
        function lfSaveOrderInfoFromOrdersPage() {
            if (!location.href.includes("/vine/orders")) return;
            document.querySelectorAll(".vvp-orders-table--row").forEach((row) => {
                const link = row.querySelector(".vvp-orders-table--text-col a");
                const asin = lfExtractASIN(link?.href || link?.textContent || "");
                if (!asin) return;
                const key = LF.orderFor(asin);
                const imageUrl = row.querySelector(".vvp-orders-table--image-col img")?.src || "";
                const productName = row.querySelector(".vvp-orders-table--text-col a .a-truncate-full")?.textContent.trim() || "—";
                const tsEl = row.querySelector("[data-order-timestamp]");
                const orderDate = tsEl ? new Date(parseInt(tsEl.getAttribute("data-order-timestamp"), 10)).toLocaleDateString("fr-FR") : "—";
                const detailsUrl = row.querySelector(".vvp-orders-table--action-btn a")?.href || "";
                const orderId = lfExtractOrderId(detailsUrl) || "—";
                const cur = localStorage.getItem(key);
                if (!cur) localStorage.setItem(key, JSON.stringify({ productName, imageUrl, orderDate, orderId }));
            });
        }
        function getRowAsinAndOrder(row) {
            let asin = null;
            const a1 = row.querySelector(".vvp-reviews-table--text-col a.a-link-normal");
            if (a1?.href) {
                const m = a1.href.match(/\/dp\/(B0[A-Z0-9]{8})/i);
                if (m) asin = m[1];
            }
            if (!asin) {
                const anyA = row.querySelectorAll('a[href*="/dp/"]');
                for (const a of anyA) {
                    const m = a.href.match(/\/dp\/(B0[A-Z0-9]{8})/i);
                    if (m) {
                        asin = m[1];
                        break;
                    }
                }
            }
            if (!asin) {
                const m = (row.textContent || "").match(/\b(B0[A-Z0-9]{8})\b/);
                if (m) asin = m[1];
            }
            let orderData = null;
            if (asin) {
                try {
                    const key = LF.orderFor(asin);
                    const raw = localStorage.getItem(key);
                    orderData = raw ? JSON.parse(raw) : null;
                } catch {}
            }
            return { asin, orderData };
        }
        const ORDER_SVG = `<svg class="vp-order-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4h10l1 3h3v2h-2l-1.6 8.1A3 3 0 0 1 14.44 20H9.56a3 3 0 0 1-2.96-2.49L5 9H3V7h3l1-3Zm2.38 0-1 3h7.24l-1-3H9.38Zm7.06 5H7.56l1.4 7.06A1 1 0 0 0 9.56 17h4.88a1 1 0 0 0 .99-.82L16.44 9Z"/></svg>`;
        function injectHeaderButtonsForPendingTH(th) {
            if (!th || th.querySelector(".vp-th-actions-wrap")) return;
            th.textContent = "Actions (CS)";
            const holder = document.createElement("span");
            holder.className = "vp-th-actions-wrap";
            const btnEmail = document.createElement("button");
            btnEmail.className = "vs-btn primary sm";
            btnEmail.textContent = "Générer email";
            btnEmail.addEventListener("click", generateAndShowEmail);
            const btnTpl = document.createElement("button");
            btnTpl.className = "vs-btn sm";
            btnTpl.textContent = "Gérer les modèles";
            btnTpl.addEventListener("click", () => openPanel("templates"));
            const btnPanel = document.createElement("button");
            btnPanel.className = "vs-btn sm";
            btnPanel.textContent = "⚙️ Panneau";
            btnPanel.addEventListener("click", () => openPanel("data"));
            holder.append(btnEmail, btnTpl, btnPanel);
            th.appendChild(holder);
        }
        function pendingReplaceStatusColumn() {
            if (!location.href.startsWith("https://www.amazon.fr/vine/vine-reviews")) return;
            const qs = new URLSearchParams(location.search);
            const type = qs.get("review-type") || "pending_review";
            if (type !== "pending_review") return;
            const th = document.querySelector("#vvp-reviews-table--review-content-heading");
            injectHeaderButtonsForPendingTH(th);
            lfEnsureDefaults();
            const checked = lfGetChecked();
            document.querySelectorAll("tr.vvp-reviews-table--row").forEach((row) => {
                const tds = row.querySelectorAll("td");
                if (!tds.length) return;
                const statusTd = tds[3];
                if (!statusTd) return;
                statusTd.innerHTML = "";
                const { asin, orderData } = getRowAsinAndOrder(row);
                if (!asin) {
                    statusTd.textContent = "—";
                    return;
                }
                const wrap = document.createElement("div");
                wrap.className = "vp-pending-actions";
                ["mousedown", "click", "pointerdown", "pointerup", "wheel", "focusin"].forEach((evt) => wrap.addEventListener(evt, vpStartInteract, !0));
                ["pointerup", "blur"].forEach((evt) => wrap.addEventListener(evt, () => vpEndInteractSoon(), !0));
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.dataset.asin = asin;
                const cur = checked[asin];
                if (cur) cb.checked = !0;
                const sel = document.createElement("select");
                sel.className = "vp-pending-select";
                const tpls = lfGetTemplates();
                tpls.forEach((t, i) => {
                    const o = document.createElement("option");
                    o.value = String(i);
                    o.textContent = t.name;
                    sel.appendChild(o);
                });
                if (cur?.templateIdx != null && cur.templateIdx < tpls.length) sel.selectedIndex = cur.templateIdx;
                const a = document.createElement("a");
                const hasOrder = !!orderData?.orderId;
                a.href = hasOrder ? `https://www.amazon.fr/gp/your-account/order-details?orderID=${orderData.orderId}` : "#";
                a.target = "_blank";
                a.rel = "noopener";
                a.className = "vp-order-link";
                if (!hasOrder) a.setAttribute("aria-disabled", "true");
                a.title = hasOrder ? `Voir la commande ${orderData.orderId}` : `Commande inconnue (ouvrez /vine/orders pour remplir le cache)`;
                a.innerHTML = ORDER_SVG;
                cb.addEventListener("change", () => {
                    const map = lfGetChecked();
                    if (cb.checked) map[asin] = { templateIdx: sel.selectedIndex };
                    else delete map[asin];
                    lfSetChecked(map);
                    log("checked map", map);
                });
                sel.addEventListener("change", () => {
                    const map = lfGetChecked();
                    if (!cb.checked) cb.checked = !0;
                    map[asin] = { templateIdx: sel.selectedIndex };
                    lfSetChecked(map);
                });
                wrap.append(cb, sel, a);
                statusTd.appendChild(wrap);
            });
        }
        function generateAndShowEmail() {
            lfEnsureDefaults();
            const map = lfGetChecked() || {};
            const asins = Object.keys(map);
            if (!asins.length) {
                alert("Aucun produit sélectionné.");
                return;
            }
            const tpls = lfGetTemplates() || defaultTemplates || [];
            const blocks = asins.map((asin) => {
                const tplIdx = map[asin]?.templateIdx ?? 0;
                const tpl = tpls[tplIdx] || tpls[0] || defaultTemplates?.[0] || { name: "Motif", content: "ASIN $asin / Commande $order — $reason" };
                const odRaw = localStorage.getItem(LF.orderFor(asin));
                const od = odRaw ? JSON.parse(odRaw) : {};
                const reason = tpl.name || "—";
                const mail = (tpl.content || "")
                    .replace(/\$asin/g, asin)
                    .replace(/\$order/g, od.orderId || "—")
                    .replace(/\$nom/g, od.productName || "—")
                    .replace(/\$date/g, od.orderDate || "—")
                    .replace(/\$reason/g, reason);
                return { asin, tplIdx, od, reason, mail };
            });
            let finalText = "";
            if (blocks.length === 1) {
                finalText = blocks[0].mail;
            } else {
                const grp = lfGetGroupTpl() || defaultGroupTemplate || { name: "Mail groupé", content: "Bonjour,\n\n$debutASIN : $asin | Commande : $order | Raison : $reason\n$fin\nCordialement." };
                const m = grp.content.match(/\$debut([\s\S]*)\$fin/);
                const lineTpl = m ? m[1] : "ASIN : $asin • Commande : $order • Raison : $reason\n";
                const lines = blocks
                    .map((b) =>
                        lineTpl
                            .replace(/\$asin/g, b.asin)
                            .replace(/\$order/g, b.od.orderId || "—")
                            .replace(/\$nom/g, b.od.productName || "—")
                            .replace(/\$date/g, b.od.orderDate || "—")
                            .replace(/\$reason/g, tpls[b.tplIdx]?.name || b.reason)
                    )
                    .join("");
                finalText = grp.content.replace(/\$debut[\s\S]*\$fin/, lines);
            }
            showEmailPopup(finalText);
            lfResetChecked();
            setTimeout(() => pendingReplaceStatusColumn(), 150);
        }
        function showEmailPopup(text) {
            if (!document.getElementById("vpp-email-style")) {
                const s = document.createElement("style");
                s.id = "vpp-email-style";
                s.textContent = `.vpp-email-pop{position:fixed;z-index:99999;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--c-bg,#fff);color:var(--c-fg,#111);border:1px solid var(--c-border,#ddd);padding:16px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.2);max-width:720px;width:95vw;max-height:85vh;overflow:auto}.vpp-email-pop textarea{width:100%;height:240px;font-size:14px;padding:10px;border-radius:8px;border:1px solid var(--c-border,#bbb);background:var(--c-bg,#fff);color:var(--c-fg,#111)}.vs-dark .vpp-email-pop{background:var(--c-bg,#0b0f16);color:var(--c-fg,#e5e7eb);border-color:var(--c-border,#1f2937)}.vs-dark .vpp-email-pop textarea{background:var(--c-card,#111827);color:var(--c-fg,#e5e7eb);border-color:var(--c-border,#1f2937)}`;
                document.head.appendChild(s);
            }
            document.getElementById("vpp-email-popup")?.remove();
            const pop = document.createElement("div");
            pop.id = "vpp-email-popup";
            pop.className = "vpp-email-pop" + (UI_DARK_MODE ? " vs-dark" : "");
            pop.innerHTML = `<h3 style="margin:0 0 10px 0;">Email généré (copié)</h3><textarea readonly>${text}</textarea><div style="margin-top:10px;display:flex;justify-content:flex-end;gap:8px;"><button id="vp-mail-copy" class="vs-btn">Copier</button><button id="vp-mail-close" class="vs-btn warn">Fermer</button></div>`;
            document.body.appendChild(pop);
            navigator.clipboard?.writeText(text).catch(() => {});
            pop.querySelector("#vp-mail-copy").onclick = () => navigator.clipboard?.writeText(text);
            pop.querySelector("#vp-mail-close").onclick = () => pop.remove();
        }
        function pendingMinusCompleted(pending, completed) {
            const rel = completed.filter((c) => {
                const st = (c.status || "").toLowerCase();
                return st === "submitted" || st === "approved";
            });
            const map = new Map();
            for (const c of rel) {
                const asin = c.asin;
                const d = typeof c.day === "number" ? c.day : null;
                if (!map.has(asin)) map.set(asin, { days: [], hasNull: !1 });
                const entry = map.get(asin);
                if (d == null) entry.hasNull = !0;
                else entry.days.push(d);
            }
            return pending.filter((p) => {
                const m = map.get(p.asin);
                if (!m) return !0;
                if (m.hasNull) return !1;
                const pd = typeof p.day === "number" ? p.day : null;
                if (pd == null) return !1;
                return !m.days.some((cd) => Math.abs(pd - cd) <= WINDOW_COMPLETED_MATCH_DAYS);
            });
        }
        function getCompletionRateColor(rate) {
            if (rate < 65) return "var(--c-red)";
            if (rate < 70) return "var(--c-orange)";
            return "var(--c-green)";
        }
        function getCancellationRateColor(rate) {
            if (rate <= 5) return "var(--c-green)";
            if (rate <= 7.5) return "var(--c-orange)";
            return "var(--c-red)";
        }
        function countInRange(arr, s, e) {
            return arr.filter((x) => x.day >= s && x.day <= e).length;
        }
        function countApproved(completed, s, e) {
            return completed.filter((x) => x.day >= s && x.day <= e && x.status === "approved").length;
        }
        function countSubmittedOrPending(completed, s, e) {
            return completed.filter((x) => {
                if (x.day < s || x.day > e) return !1;
                return x.status === "submitted" || x.status === "pending_approval" || x.status === "unknown";
            }).length;
        }
        function countSubmitted(completed, s, e) {
            return completed.filter((x) => x.day >= s && x.day <= e && x.status === "submitted").length;
        }
        function card(title, value, type, color) {
            return `<div class="vs-card vs-${type}"><div class="vs-card-title">${title}</div><div class="vs-card-value" style="${color ? `color:${color}` : ""}">${value}</div></div>`;
        }
        function blockSlice(name, startDay, endDay, pending, completed, orders) {
            const p = countInRange(pending, startDay, endDay),
                c = countInRange(completed, startDay, endDay),
                a = countApproved(completed, startDay, endDay),
                s = countSubmitted(completed, startDay, endDay),
                o = countInRange(orders, startDay, endDay),
                t = p + c,
                rate = t ? (c / t) * 100 : null,
                display = rate === null ? "—" : `${rate.toFixed(1)}%`,
                color = rate === null ? "var(--c-muted)" : getCompletionRateColor(rate);
            const wrap = document.createElement("div");
            wrap.className = "vs-period-line";
            wrap.innerHTML = `<span class="vs-period-name">${name}</span><span class="vs-chip ${
                p > c ? "vs-chip-warn" : ""
            }">En attente: ${p}</span><span class="vs-chip">Vérifiés: ${c}</span><span class="vs-chip">• Approuvés: ${a}</span><span class="vs-chip">• Soumis: ${s}</span><span class="vs-chip">Commandes: ${o}</span><span class="vs-chip" style="color:${color};font-weight:600">Taux: ${display}</span>`;
            return wrap;
        }
        function displayResults() {
            if (!location.href.startsWith("https://www.amazon.fr/vine/vine-reviews")) return;
            const { pending, completed, orders } = reconcileAndPersist();
            const headingTopDiv = document.querySelector(".vvp-reviews-table--heading-top") || document.querySelector(".vvp-reviews-table");
            if (!headingTopDiv) return;
            const pendingEff = pendingMinusCompleted(pending, completed);
            document.getElementById("review-statistics-container")?.remove();
            const resultDiv = document.createElement("div");
            resultDiv.id = "review-statistics-container";
            resultDiv.className = "vs-container";
            headingTopDiv.appendChild(resultDiv);
            const dayNow = epochDayFromDate(new Date());
            const SL0S = dayNow - 29,
                SL0E = dayNow,
                SL1S = dayNow - 59,
                SL1E = dayNow - 30,
                SL2S = dayNow - 89,
                SL2E = dayNow - 60;
            const evalStartISO = GM_getValue("customStartDate", EVAL_START_CACHED),
                evalEndISO = GM_getValue("customEndDate", EVAL_END_CACHED),
                fallbackStart = dayNow - 89,
                evalStart = evalStartISO ? toEpochDaySafe(evalStartISO) : fallbackStart,
                evalEnd = evalEndISO ? toEpochDaySafe(evalEndISO) : dayNow;
            const pendingCount = countInRange(pendingEff, evalStart, evalEnd);
            const completedCount = countInRange(completed, evalStart, evalEnd);
            const approvedCount = countApproved(completed, evalStart, evalEnd);
            const submittedCount = completed.filter((x) => x.day >= evalStart && x.day <= evalEnd && (x.status || "").toLowerCase() === "submitted").length;
            const ordersCount = countInRange(orders, evalStart, evalEnd);
            const totalCount = pendingCount + completedCount;
            const cancelledCount = Math.max(0, ordersCount - (pendingCount + completedCount));
            const cancelledRate = ordersCount ? (cancelledCount / ordersCount) * 100 : null;
            const completionRatePct = totalCount ? (completedCount / totalCount) * 100 : null;
            const completionDisplay = completionRatePct === null ? "—" : `${completionRatePct.toFixed(1)}%`;
            const completionColor = completionRatePct === null ? "var(--c-muted)" : getCompletionRateColor(completionRatePct);
            const cards = document.createElement("div");
            cards.className = "vs-cards";
            cards.innerHTML =
                `${card("En attente", pendingCount, "pending")}` +
                `${card("Vérifiés (total)", completedCount, "verified")}` +
                `${card("• Approuvés", approvedCount, "verified")}` +
                `${card("• Soumis", submittedCount, "verified")}` +
                `${card("Taux vérif", completionDisplay, "rate", completionColor)}` +
                `${card("Annulations", cancelledRate === null ? "—" : `${cancelledRate.toFixed(1)}%`, "cancel", cancelledRate === null ? "var(--c-muted)" : getCancellationRateColor(cancelledRate))}`;
            resultDiv.appendChild(cards);
            const info = document.createElement("div");
            info.className = "vs-muted";
            info.style.marginTop = "6px";
            const showISO = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
            info.textContent = `Période d'évaluation utilisée : ${showISO(evalStartISO)} → ${showISO(evalEndISO)} (sinon 90 jours glissants)`;
            resultDiv.appendChild(info);
            const details = document.createElement("details");
            if (UI_SLICES_OPEN) details.setAttribute("open", "");
            details.className = "vs-details";
            const summary = document.createElement("summary");
            summary.textContent = UI_SLICES_OPEN ? "Masquer les statistiques détaillées (30/60/90)" : "Afficher les statistiques détaillées (30/60/90)";
            summary.className = "vs-summary";
            details.appendChild(summary);
            const slices = document.createElement("div");
            slices.className = "vs-periods";
            slices.appendChild(blockSlice("0–30 jours", SL0S, SL0E, pendingEff, completed, orders));
            slices.appendChild(blockSlice("31–60 jours", SL1S, SL1E, pendingEff, completed, orders));
            slices.appendChild(blockSlice("61–90 jours", SL2S, SL2E, pendingEff, completed, orders));
            details.appendChild(slices);
            details.addEventListener("toggle", () => {
                UI_SLICES_OPEN = details.open;
                GM_setValue("ui_slices_open", UI_SLICES_OPEN);
                summary.textContent = details.open ? "Masquer les statistiques détaillées (30/60/90)" : "Afficher les statistiques détaillées (30/60/90)";
            });
            resultDiv.appendChild(details);
        }
        function openPanel(tab = "data") {
            document.getElementById("vpp-overlay")?.remove();
            const ov = document.createElement("div");
            ov.id = "vpp-overlay";
            const modal = document.createElement("div");
            modal.id = "vpp-modal";
            if (UI_DARK_MODE) modal.classList.add("vs-dark");
            ov.appendChild(modal);
            modal.innerHTML = `<header><strong>Panneau Vine Power Pack</strong><div class="vpp-tabs" role="tablist"><button class="vpp-tab-btn" data-tab="data">Données</button><button class="vpp-tab-btn" data-tab="templates">Modèles</button><button class="vpp-tab-btn" data-tab="options">Options</button></div></header><div class="vpp-body"><section class="vpp-section" id="tab-data"></section><section class="vpp-section" id="tab-templates"></section><section class="vpp-section" id="tab-options"></section></div><footer style="display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:8px;"><label class="vs-btn" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;"><input id="vpp-dark-toggle" type="checkbox" ${
                UI_DARK_MODE ? "checked" : ""
            }/>Mode sombre</label><button id="vpp-sync" class="vs-btn">Sync période (account)</button></div><div><button id="vpp-close" class="vs-btn warn">Fermer</button></div></footer>`;
            document.body.appendChild(ov);
            const tabBtns = [...modal.querySelectorAll(".vpp-tab-btn")];
            function showTab(name) {
                tabBtns.forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === name ? "true" : "false"));
                modal.querySelectorAll(".vpp-section").forEach((s) => (s.dataset.active = s.id === `tab-${name}` ? "true" : "false"));
            }
            tabBtns.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
            showTab(tab);
            buildDataTab(modal.querySelector("#tab-data"));
            buildTemplatesTab(modal.querySelector("#tab-templates"));
            buildOptionsTab(modal.querySelector("#tab-options"));
            modal.querySelector("#vpp-close").onclick = () => ov.remove();
            modal.querySelector("#vpp-sync").onclick = async () => {
                const ok = await syncEvaluationPeriodFromAmazon();
                alert(ok ? "Période synchronisée." : "Échec de la synchronisation.");
                try {
                    displayResults();
                } catch {}
            };
            modal.querySelector("#vpp-dark-toggle").onchange = (e) => {
                UI_DARK_MODE = !!e.target.checked;
                GM_setValue("ui_darkmode", UI_DARK_MODE);
                modal.classList.toggle("vs-dark", UI_DARK_MODE);
            };
        }
        function buildDataTab(container) {
            let pageSize = GM_getValue("ui_page_size", 50),
                pageIndex = GM_getValue("ui_page_index", 0),
                filterType = GM_getValue("ui_filter_type", ""),
                filterASIN = GM_getValue("ui_filter_asin", ""),
                sortCol = GM_getValue("ui_sort_col", "day"),
                sortDir = GM_getValue("ui_sort_dir", "desc");
            let pending = (GM_getValue("pending_reviews", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date), type: "En attente" }));
            let completed = (GM_getValue("completed_reviews", []) || []).map((x) => {
                const st = (x.status || "").toLowerCase();
                const type = st === "submitted" ? "Soumis" : "Vérifié";
                return { asin: x.asin, day: x.day ?? toEpochDaySafe(x.date), type };
            });
            let orders = (GM_getValue("orders_data", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date), type: "Annulé" }));
            const prior = { Vérifié: 4, Soumis: 3, "En attente": 2, Annulé: 1 };
            const map = new Map();
            [...pending, ...completed, ...orders].forEach((it) => {
                const k = key(it.asin, it.day);
                if (!map.has(k) || prior[it.type] > prior[map.get(k).type]) map.set(k, it);
            });
            let allData = Array.from(map.values());
            container.innerHTML = `<div class="vpp-row"><input id="vs-filter-asin" class="vs-input" placeholder="Filtrer par ASIN…"><select id="vs-filter-type" class="vs-select"><option value="">Type: Tous</option><option value="En attente">En attente</option><option value="Soumis">Soumis</option><option value="Vérifié">Vérifié</option><option value="Annulé">Annulé</option></select><select id="vs-sort-col" class="vs-select"><option value="day">Tri par date</option><option value="asin">Tri par ASIN</option><option value="type">Tri par type</option></select><select id="vs-sort-dir" class="vs-select"><option value="asc">Ascendant</option><option value="desc" selected>Descendant</option></select><select id="vs-page-size" class="vs-select"><option>10</option><option>25</option><option>50</option><option>100</option><option>150</option><option>200</option><option>250</option></select><button id="vs-save" class="vs-btn primary">Enregistrer</button></div><div class="vs-table-wrap"><table class="vs-table"><thead><tr><th>Type</th><th>ASIN</th><th>Date</th><th>Suppr. ?</th><th>Statut manuel</th></tr></thead><tbody></tbody></table></div><div class="vpp-row" style="justify-content:space-between;"><div id="vs-global-stats" class="vs-muted"></div><div><button id="vs-prev" class="vs-btn">◀</button><span id="vs-page" class="vs-muted">Page</span><button id="vs-next" class="vs-btn">▶</button></div></div>`;
            const elAsin = container.querySelector("#vs-filter-asin"),
                elType = container.querySelector("#vs-filter-type"),
                elSC = container.querySelector("#vs-sort-col"),
                elSD = container.querySelector("#vs-sort-dir"),
                elPS = container.querySelector("#vs-page-size"),
                elPrev = container.querySelector("#vs-prev"),
                elNext = container.querySelector("#vs-next"),
                elPage = container.querySelector("#vs-page"),
                elBody = container.querySelector("tbody"),
                elStats = container.querySelector("#vs-global-stats");
            elAsin.value = filterASIN;
            elType.value = filterType;
            elSC.value = sortCol;
            elSD.value = sortDir;
            elPS.value = String(pageSize);
            const toDelete = new Set();
            const statusEdit = new Map();
            const badgeType = (t) => `<span class="vs-badge ${t === "Vérifié" ? "verified" : t === "Annulé" ? "cancel" : t === "Soumis" ? "pending" : "pending"}">${t}</span>`;
            const filteredSorted = () => {
                let arr = allData.slice();
                if (filterType) arr = arr.filter((it) => it.type === filterType);
                if (filterASIN) {
                    const q = filterASIN.toUpperCase();
                    arr = arr.filter((it) => it.asin.toUpperCase().includes(q));
                }
                arr.sort((a, b) => {
                    let va, vb;
                    if (sortCol === "asin") {
                        va = a.asin;
                        vb = b.asin;
                    } else if (sortCol === "type") {
                        va = a.type;
                        vb = b.type;
                    } else {
                        va = a.day;
                        vb = b.day;
                    }
                    if (va < vb) return sortDir === "asc" ? -1 : 1;
                    if (va > vb) return sortDir === "asc" ? 1 : -1;
                    return 0;
                });
                return arr;
            };
            const paginate = (arr) => {
                const totalPages = Math.max(1, Math.ceil(arr.length / pageSize));
                if (pageIndex >= totalPages) pageIndex = totalPages - 1;
                if (pageIndex < 0) pageIndex = 0;
                const start = pageIndex * pageSize;
                return { part: arr.slice(start, start + pageSize), totalPages };
            };
            function render() {
                const arr = filteredSorted();
                const { part, totalPages } = paginate(arr);
                elPage.textContent = `Page ${totalPages ? pageIndex + 1 : 0}/${totalPages}`;
                elPrev.disabled = pageIndex <= 0;
                elNext.disabled = pageIndex >= totalPages - 1;
                elBody.innerHTML = "";
                for (const it of part) {
                    const d = dateFromEpochDay(it.day);
                    const k = key(it.asin, it.day);
                    const edited = statusEdit.get(k) || it.type;
                    const tr = document.createElement("tr");
                    const tdT = document.createElement("td");
                    tdT.innerHTML = badgeType(edited);
                    const tdA = document.createElement("td");
                    tdA.textContent = it.asin;
                    const tdD = document.createElement("td");
                    tdD.textContent = d.toLocaleDateString("fr-FR");
                    const tdDel = document.createElement("td");
                    const cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.checked = toDelete.has(k);
                    cb.onchange = () => {
                        if (cb.checked) toDelete.add(k);
                        else toDelete.delete(k);
                    };
                    tdDel.appendChild(cb);
                    const tdEdit = document.createElement("td");
                    const sel = document.createElement("select");
                    sel.className = "vs-select";
                    ["En attente", "Soumis", "Vérifié", "Annulé"].forEach((name) => {
                        const o = document.createElement("option");
                        o.value = name;
                        o.textContent = name;
                        if (name === edited) o.selected = !0;
                        sel.appendChild(o);
                    });
                    sel.onchange = () => {
                        statusEdit.set(k, sel.value);
                        tdT.innerHTML = badgeType(sel.value);
                    };
                    tdEdit.appendChild(sel);
                    tr.append(tdT, tdA, tdD, tdDel, tdEdit);
                    elBody.appendChild(tr);
                }
                const total = allData.length,
                    nV = allData.filter((x) => x.type === "Vérifié").length,
                    nS = allData.filter((x) => x.type === "Soumis").length,
                    nP = allData.filter((x) => x.type === "En attente").length,
                    nA = allData.filter((x) => x.type === "Annulé").length;
                elStats.innerHTML = `Total: ${total} · <span class="vs-badge verified">Vérifiés: ${nV}</span> <span class="vs-badge pending" style="margin-left:6px;">Soumis: ${nS}</span> <span class="vs-badge pending" style="margin-left:6px;">En attente: ${nP}</span> <span class="vs-badge cancel" style="margin-left:6px;">Annulés: ${nA}</span>`;
            }
            function saveDataChanges() {
                let pending = (GM_getValue("pending_reviews", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date) }));
                let completed = (GM_getValue("completed_reviews", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date), status: x.status || null }));
                let orders = (GM_getValue("orders_data", []) || []).map((x) => ({ asin: x.asin, day: x.day ?? toEpochDaySafe(x.date) }));
                const K = (it) => key(it.asin, it.day);
                pending = pending.filter((it) => !toDelete.has(K(it)));
                completed = completed.filter((it) => !toDelete.has(K(it)));
                orders = orders.filter((it) => !toDelete.has(K(it)));
                statusEdit.forEach((type, k) => {
                    const [asin, d] = k.split("|");
                    const day = parseInt(d, 10);
                    pending = pending.filter((it) => !(it.asin === asin && it.day === day));
                    completed = completed.filter((it) => !(it.asin === asin && it.day === day));
                    orders = orders.filter((it) => !(it.asin === asin && it.day === day));
                    if (type === "En attente") pending.push({ asin, day });
                    else if (type === "Soumis") {
                        completed.push({ asin, day, status: "submitted" });
                        subAdd({ asin, day, submitted_at: new Date().toISOString(), source: "manual" });
                    } else if (type === "Vérifié") completed.push({ asin, day, status: "approved" });
                    else if (type === "Annulé") orders.push({ asin, day });
                });
                const uniq = (arr, withStatus = !1) => {
                    const m = new Map();
                    arr.forEach((it) => {
                        const kk = K(it);
                        if (!m.has(kk)) m.set(kk, it);
                        else if (withStatus) m.set(kk, mergeStatus(m.get(kk), it));
                    });
                    return Array.from(m.values());
                };
                GM_setValue("pending_reviews", uniq(pending));
                GM_setValue("completed_reviews", uniq(completed, !0));
                GM_setValue("orders_data", uniq(orders));
                console.info("[VPP][submit] save: pending=", pending.length, "completed=", completed.length, "orders=", orders.length);
                displayResults();
                alert("Enregistré.");
            }
            let t = null;
            elAsin.oninput = () => {
                clearTimeout(t);
                t = setTimeout(() => {
                    filterASIN = elAsin.value;
                    GM_setValue("ui_filter_asin", filterASIN);
                    pageIndex = 0;
                    GM_setValue("ui_page_index", pageIndex);
                    render();
                }, 220);
            };
            elType.onchange = () => {
                filterType = elType.value;
                GM_setValue("ui_filter_type", filterType);
                pageIndex = 0;
                GM_setValue("ui_page_index", pageIndex);
                render();
            };
            elSC.onchange = () => {
                sortCol = elSC.value;
                GM_setValue("ui_sort_col", sortCol);
                render();
            };
            elSD.onchange = () => {
                sortDir = elSD.value;
                GM_setValue("ui_sort_dir", sortDir);
                render();
            };
            elPS.onchange = () => {
                pageSize = parseInt(elPS.value, 10);
                pageIndex = 0;
                GM_setValue("ui_page_size", pageSize);
                GM_setValue("ui_page_index", pageIndex);
                render();
            };
            elPrev.onclick = () => {
                pageIndex = Math.max(0, pageIndex - 1);
                GM_setValue("ui_page_index", pageIndex);
                render();
            };
            elNext.onclick = () => {
                const totalPages = Math.max(1, Math.ceil(filteredSorted().length / pageSize));
                pageIndex = Math.min(totalPages - 1, pageIndex + 1);
                GM_setValue("ui_page_index", pageIndex);
                render();
            };
            container.querySelector("#vs-save").onclick = saveDataChanges;
            render();
        }
        function buildTemplatesTab(container) {
            lfEnsureDefaults();
            const tpls = lfGetTemplates();
            const grp = lfGetGroupTpl() || defaultGroupTemplate;
            container.innerHTML = `<div class="vpp-row"><label style="font-weight:600;">Individuels :</label><select id="tpl-sel" class="vs-select" style="min-width:260px;"></select><button id="tpl-edit" class="vs-btn">Modifier</button><button id="tpl-del" class="vs-btn warn">Supprimer</button><button id="tpl-new" class="vs-btn">Nouveau</button></div><div class="vpp-row"><input id="tpl-name" class="vs-input" placeholder="Nom (raison)" style="flex:1;"></div><div class="vpp-row"><textarea id="tpl-content" class="vs-textarea" style="width:100%;height:120px;"></textarea></div><div class="vpp-row" style="justify-content:flex-end;"><button id="tpl-save" class="vs-btn primary">Enregistrer</button></div><hr><div class="vpp-row"><label style="font-weight:600;">Mail groupé</label></div><div class="vpp-row"><textarea id="tpl-group" class="vs-textarea" style="width:100%;height:100px;"></textarea></div><div class="vpp-row" style="justify-content:flex-end;"><button id="tpl-group-save" class="vs-btn primary">Enregistrer modèle groupé</button></div><div class="vs-muted">Variables: $asin, $order, $nom, $date, $reason — Pour le groupé, utilisez $debut ... $fin comme bloc répété.</div>`;
            const sel = container.querySelector("#tpl-sel");
            function refreshSel() {
                const arr = lfGetTemplates();
                sel.innerHTML = "";
                arr.forEach((t, i) => {
                    const o = document.createElement("option");
                    o.value = String(i);
                    o.textContent = t.name;
                    sel.appendChild(o);
                });
                if (arr.length) {
                    sel.selectedIndex = 0;
                    container.querySelector("#tpl-name").value = arr[0].name;
                    container.querySelector("#tpl-content").value = arr[0].content;
                }
            }
            refreshSel();
            container.querySelector("#tpl-group").value = grp.content;
            sel.onchange = () => {
                const t = lfGetTemplates()[sel.selectedIndex];
                container.querySelector("#tpl-name").value = t.name;
                container.querySelector("#tpl-content").value = t.content;
            };
            container.querySelector("#tpl-edit").onclick = () => {
                const t = lfGetTemplates()[sel.selectedIndex];
                container.querySelector("#tpl-name").value = t.name;
                container.querySelector("#tpl-content").value = t.content;
            };
            container.querySelector("#tpl-del").onclick = () => {
                let arr = lfGetTemplates();
                if (arr.length <= 1) return alert("Impossible de supprimer le dernier modèle !");
                arr.splice(sel.selectedIndex, 1);
                lfSetTemplates(arr);
                refreshSel();
            };
            container.querySelector("#tpl-new").onclick = () => {
                sel.selectedIndex = -1;
                container.querySelector("#tpl-name").value = "";
                container.querySelector("#tpl-content").value = "";
            };
            container.querySelector("#tpl-save").onclick = () => {
                const name = container.querySelector("#tpl-name").value.trim();
                const content = container.querySelector("#tpl-content").value;
                if (!name || !content) return alert("Nom et contenu requis.");
                let arr = lfGetTemplates();
                if (sel.selectedIndex >= 0 && sel.selectedIndex < arr.length) arr[sel.selectedIndex] = { name, content };
                else arr.push({ name, content });
                lfSetTemplates(arr);
                refreshSel();
                alert("Modèle sauvegardé.");
            };
            container.querySelector("#tpl-group-save").onclick = () => {
                lfSetGroupTpl({ name: "Mail groupé", content: container.querySelector("#tpl-group").value });
                alert("Modèle groupé sauvegardé.");
            };
        }
        function buildOptionsTab(container) {
            container.innerHTML = `<div class="vpp-row" style="gap:16px;align-items:flex-end;"><div><label style="font-weight:600;display:block;">HMP (masquer anciens pending)</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-hmp-enabled" type="checkbox" ${HMP_ENABLED ? "checked" : ""}> Activer</label></div><div>
<label class="vs-muted" style="display:block;">Date de référence (JJ/MM/AAAA)</label><input id="opt-hmp-ref" class="vs-input" value="${HMP_REF_STR}"></div></div><div class="vpp-row" style="gap:16px;"><div><label style="display:block;font-weight:600;">Ratio commandes/jour — date de départ</label><input id="opt-ratio-start" class="vs-input" value="${RATIO_START_STR}"></div></div><div class="vpp-row" style="gap:16px;"><label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-hide-submitted" type="checkbox" ${
                PREF_HIDE_SUBMITTED ? "checked" : ""
            }> Masquer automatiquement les avis “Soumis” (onglet En attente)</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-hl-dates" type="checkbox" ${PREF_HL_DATES ? "checked" : ""}> Couleurs dates (pending uniquement)</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-hl-status" type="checkbox" ${PREF_HL_STATUS ? "checked" : ""}> Couleurs statuts</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-color-progress" type="checkbox" ${PREF_COLOR_PROGRESS ? "checked" : ""}> Couleur barre progression</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-debug" type="checkbox" ${DEBUG ? "checked" : ""}> DEBUG logs</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;">
  <input id="opt-hide-approved" type="checkbox" ${HIDE_APPROVED ? "checked" : ""}>
  Masquer automatiquement les “Approuvés” (onglet Vérifiés)
</label>

</div>
<div class="vpp-row" style="justify-content:flex-end;"><button id="opt-save" class="vs-btn primary">Enregistrer</button></div>`;
            const navWrap = document.createElement("div");
            navWrap.className = "vpp-row";
            navWrap.style.marginTop = "6px";
            navWrap.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:8px;">
    <label style="font-weight:600;display:block;">Navigation clavier</label>
    <label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;">
      <input id="nav-enabled" type="checkbox">
      Activer (pages ←/→ sur items/reviews/orders ; files ↑/↓ sur items)
    </label>
    <div style="display:grid;grid-template-columns:180px 1fr;gap:10px;align-items:center;margin-top:6px;">
      <span>Page précédente</span><input id="nav-left"  class="vs-input" placeholder="ex: q" style="max-width:140px">
      <span>Page suivante</span><input id="nav-right" class="vs-input" placeholder="ex: d" style="max-width:140px">
      <span>File précédente (items)</span><input id="nav-up"    class="vs-input" placeholder="ex: z" style="max-width:140px">
      <span>File suivante (items)</span><input id="nav-down"  class="vs-input" placeholder="ex: s" style="max-width:140px">
    </div>
    <div class="vs-muted">Astuce: clique dans un champ puis appuie la touche désirée. Laisse vide pour désactiver la touche secondaire (les flèches restent actives).</div>
  </div>`;
            container.appendChild(navWrap);
            const inEnabled = container.querySelector("#nav-enabled");
            const inLeft = container.querySelector("#nav-left");
            const inRight = container.querySelector("#nav-right");
            const inUp = container.querySelector("#nav-up");
            const inDown = container.querySelector("#nav-down");
            inEnabled.checked = !!NAV_ENABLED;
            inLeft.value = KEY_LEFT || "";
            inRight.value = KEY_RIGHT || "";
            inUp.value = KEY_UP || "";
            inDown.value = KEY_DOWN || "";
            [inLeft, inRight, inUp, inDown].forEach((inp) => {
                inp.addEventListener("keydown", (e) => {
                    e.preventDefault();
                    const k = (e.key || "").toLowerCase();
                    if (k && !["shift", "control", "alt", "meta", "escape"].includes(k)) inp.value = k;
                });
            });
            container.querySelector("#opt-save").onclick = () => {
                HMP_ENABLED = !!container.querySelector("#opt-hmp-enabled").checked;
                HMP_REF_STR = (container.querySelector("#opt-hmp-ref").value || "").trim() || "31/12/2022";
                RATIO_START_STR = (container.querySelector("#opt-ratio-start").value || "").trim() || "2019-06-27";
                PREF_HIDE_SUBMITTED = !!container.querySelector("#opt-hide-submitted").checked;
                PREF_HL_DATES = !!container.querySelector("#opt-hl-dates").checked;
                PREF_HL_STATUS = !!container.querySelector("#opt-hl-status").checked;
                PREF_COLOR_PROGRESS = !!container.querySelector("#opt-color-progress").checked;
                DEBUG = !!container.querySelector("#opt-debug").checked;
                HIDE_APPROVED = !!container.querySelector("#opt-hide-approved").checked;
                GM_setValue("hide_approved", HIDE_APPROVED);
                GM_setValue("hmp_enabled", HMP_ENABLED);
                GM_setValue("hmp_reference_date", HMP_REF_STR);
                GM_setValue("ratio_start_iso", RATIO_START_STR);
                GM_setValue("pref_hide_submitted", PREF_HIDE_SUBMITTED);
                GM_setValue("pref_hl_dates", PREF_HL_DATES);
                GM_setValue("pref_hl_status", PREF_HL_STATUS);
                GM_setValue("pref_color_progress", PREF_COLOR_PROGRESS);
                GM_setValue("vp_debug", DEBUG);
                NAV_ENABLED = !!inEnabled.checked;
                KEY_LEFT = (inLeft.value || "").trim().toLowerCase();
                KEY_RIGHT = (inRight.value || "").trim().toLowerCase();
                KEY_UP = (inUp.value || "").trim().toLowerCase();
                KEY_DOWN = (inDown.value || "").trim().toLowerCase();
                GM_setValue("nav_enabled", NAV_ENABLED);
                GM_setValue("key_left", KEY_LEFT);
                GM_setValue("key_right", KEY_RIGHT);
                GM_setValue("key_up", KEY_UP);
                GM_setValue("key_down", KEY_DOWN);
                alert("Options enregistrées.");
                try {
                    ratioOrdersOnOrdersPage();
                } catch {}
                try {
                    displayResults();
                    pendingReplaceStatusColumn();
                    applyRainbowStably();
                    applyHMP();
                    applyHideApproved();
                    vppNormalizeReviewButtons();
                    vppStyleSubmittedButtons();
                } catch {}
            };
        }
        (function vppHookCreateReview() {
            const ON_CREATE = /\/review\/create-review(\/|$)/.test(location.pathname);
            const ON_THANKS = /\/review\/create-review\/thankyou/.test(location.pathname);
            if (!ON_CREATE && !ON_THANKS) return;
            function readCtx(asin) {
                try {
                    const raw = sessionStorage.getItem(SUBMIT_CTX);
                    if (!raw) return { day: null };
                    const ctx = JSON.parse(raw);
                    if (ctx.asin !== asin) return { day: null };
                    if (Date.now() - (ctx.ts || 0) > 2 * 60 * 60 * 1000) return { day: null };
                    return { day: typeof ctx.day === "number" ? ctx.day : null };
                } catch {
                    return { day: null };
                }
            }
            function writeCompletedSubmitted(asin, day) {
                const d = day != null ? day : epochDayFromDate(new Date());
                let comp = GM_getValue("completed_reviews", []) || [];
                const K = (o) => `${o.asin}|${o.day}`;
                const m = new Map(comp.map((o) => [K(o), o]));
                const cur = m.get(`${asin}|${d}`);
                if (!cur || cur.status !== "approved") m.set(`${asin}|${d}`, { asin, day: d, status: "submitted" });
                comp = Array.from(m.values());
                GM_setValue("completed_reviews", comp);
                console.info("[VPP][submit] completed_reviews += submitted", { asin, day: d });
            }
            function markSubmitted(source) {
                const asin = asinFromURL();
                if (!asin) {
                    console.warn("[VPP][submit] asin introuvable");
                    return;
                }
                const { day } = readCtx(asin);
                subAdd({ asin, day: day ?? null, submitted_at: new Date().toISOString(), source });
                writeCompletedSubmitted(asin, day ?? null);
            }
            if (ON_THANKS) {
                console.info("[VPP][submit] thankyou hit", location.href);
                markSubmitted("thankyou");
                return;
            }
            const onSubmit = () => {
                console.info("[VPP][submit] form submit detected");
                markSubmitted("form-submit");
            };
            const hookup = () => {
                document.addEventListener(
                    "submit",
                    (e) => {
                        const ok = e.target && /review/i.test(e.target.action || "");
                        if (ok) onSubmit();
                    },
                    !0
                );
                document.querySelectorAll('input.a-button-input[type="submit"]').forEach((btn) => {
                    btn.addEventListener(
                        "click",
                        () => {
                            console.info("[VPP][submit] click submit");
                            markSubmitted("click-submit");
                        },
                        { once: !1, capture: !0 }
                    );
                });
            };
            if (document.readyState === "complete" || document.readyState === "interactive") hookup();
            else window.addEventListener("DOMContentLoaded", hookup, { once: !0 });
            subPrune(150);
        })();
        function vppAttachReviewLinkCtx() {
            if (!location.href.includes("/vine/vine-reviews")) return;
            const qs = new URLSearchParams(location.search);
            const type = qs.get("review-type") || "pending_review";
            if (type !== "pending_review") return;
            document.querySelectorAll("tr.vvp-reviews-table--row").forEach((row) => {
                const link = row.querySelector('td.vvp-reviews-table--actions-col a[href*="/review/create-review"]');
                if (!link) return;
                const asin = (link.href && asinFromURL(link.href)) || findAsinInRow?.(row) || null;
                if (!asin) return;
                const tsCell = row.querySelector("td[data-order-timestamp]");
                const day = tsCell ? epochDayFromMillis(parseInt(tsCell.getAttribute("data-order-timestamp"), 10)) : null;
                link.addEventListener(
                    "click",
                    () => {
                        try {
                            sessionStorage.setItem(SUBMIT_CTX, JSON.stringify({ asin, day, ts: Date.now() }));
                        } catch {}
                        console.info("[VPP][submit] ctx set", { asin, day });
                    },
                    { capture: !0 }
                );
            });
        }
        function vppNormalizeReviewButtons() {
            if (!location.href.includes("/vine/vine-reviews")) return;
            const qs = new URLSearchParams(location.search);
            const type = qs.get("review-type") || "pending_review";
            if (type !== "pending_review") return;
            document.querySelectorAll('td.vvp-reviews-table--actions-col a[href*="/review/create-review"]').forEach((link) => {
                if (!link) return;
                link.textContent = "Donner un avis";
            });
        }
        function vppStyleSubmittedButtons() {
            if (!location.href.includes("/vine/vine-reviews")) return;
            const qs = new URLSearchParams(location.search);
            const type = qs.get("review-type") || "pending_review";
            if (type !== "pending_review") return;
            document.querySelectorAll("tr.vvp-reviews-table--row").forEach((row) => {
                const link = row.querySelector('td.vvp-reviews-table--actions-col a[href*="/review/create-review"]');
                if (!link) return;
                const asin = (link.href && asinFromURL(link.href)) || findAsinInRow?.(row) || null;
                if (!asin) return;
                const tsCell = row.querySelector("td[data-order-timestamp]");
                const day = tsCell ? epochDayFromMillis(parseInt(tsCell.getAttribute("data-order-timestamp"), 10)) : null;
                const submitted = subFind(asin, day) || subFind(asin);
                const btnWrap = link.closest(".vvp-reviews-table--action-btn");
                link.textContent = "Donner un avis";
                if (submitted && btnWrap) {
                    btnWrap.classList.add("vpp-submitted");
                    link.textContent = "Avis soumis";
                    link.title = "Avis déjà soumis";
                    if (PREF_HIDE_SUBMITTED) {
                        const tr = btnWrap.closest("tr.vvp-reviews-table--row");
                        if (tr) tr.style.display = "none";
                    }
                    console.info("[VPP][submit] style applied", { asin, day });
                }
            });
        }
        function debounced(fn, wait = 800) {
            let t = null;
            return (...a) => {
                clearTimeout(t);
                t = setTimeout(() => fn(...a), wait);
            };
        }
        const refreshUI = debounced(() => {
            if (VP_INTERACTING) return;
            if (location.href.includes("/vine/vine-reviews")) {
                try {
                    displayResults();
                } catch (e) {
                    warn(e);
                }
                try {
                    pendingReplaceStatusColumn();
                } catch (e) {
                    warn(e);
                }
                try {
                    applyRainbowStably();
                } catch (e) {
                    warn(e);
                }
                try {
                    applyHMP();
                } catch (e) {
                    warn(e);
                }
                try {
                    vppAttachReviewLinkCtx();
                    vppNormalizeReviewButtons();
                    vppStyleSubmittedButtons();
                } catch (e) {
                    warn(e);
                }
                try {
                    applyHideApproved();
                } catch (e) {
                    warn(e);
                }
            }
        }, 800);
        function observeTables() {
            const rt = document.querySelector(".vvp-reviews-table");
            if (rt) {
                const mo = new MutationObserver((muts) => {
                    if (VP_INTERACTING) return;
                    if (muts.some((m) => m.type === "childList" && (m.addedNodes.length || m.removedNodes.length))) refreshUI();
                });
                mo.observe(rt, { childList: !0, subtree: !0 });
            }
            const ot = document.querySelector(".vvp-orders-table");
            if (ot) {
                const mo2 = new MutationObserver((muts) => {
                    if (muts.some((m) => m.type === "childList" && (m.addedNodes.length || m.removedNodes.length))) lfSaveOrderInfoFromOrdersPage();
                });
                mo2.observe(ot, { childList: !0, subtree: !0 });
            }
        }
        if (location.href.includes("/gp/buy/thankyou")) {
            vppInjectThankyouButtons?.();
        }
        function vppInjectThankyouButtons() {
            if (!location.href.startsWith("https://www.amazon.fr/gp/buy/thankyou")) return;
            function btn(txt, color, url) {
                const b = document.createElement("button");
                b.textContent = txt;
                Object.assign(b.style, {
                    backgroundColor: color,
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    margin: "6px 6px 6px 0",
                    cursor: "pointer",
                    fontSize: "13px",
                    transition: "transform .2s, opacity .2s",
                });
                b.onmouseenter = () => {
                    b.style.opacity = ".85";
                    b.style.transform = "scale(1.05)";
                };
                b.onmouseleave = () => {
                    b.style.opacity = "1";
                    b.style.transform = "scale(1)";
                };
                b.onclick = () => {
                    window.location.href = url;
                };
                return b;
            }
            function injectOnce() {
                if (document.getElementById("vine-shortcuts-container")) return !0;
                const parent = document.querySelector("#widget-accountLevelActions") || document.querySelector("#rightTwo") || document.querySelector("#right-2") || document.body;
                if (!parent) return !1;
                const c = document.createElement("div");
                c.id = "vine-shortcuts-container";
                Object.assign(c.style, { marginTop: "12px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" });
                const label = document.createElement("span");
                label.textContent = "Retournez sur Vine →";
                Object.assign(label.style, { marginRight: "8px", fontWeight: "bold", fontSize: "14px" });
                c.appendChild(label);
                c.appendChild(btn("RFY", "green", "https://www.amazon.fr/vine/vine-items?queue=potluck"));
                c.appendChild(btn("AFA", "blue", "https://www.amazon.fr/vine/vine-items?queue=last_chance"));
                c.appendChild(btn("AI", "goldenrod", "https://www.amazon.fr/vine/vine-items?queue=encore"));
                parent.appendChild(c);
                return !0;
            }
            let tries = 0;
            const iv = setInterval(() => {
                if (injectOnce() || ++tries > 40) clearInterval(iv);
            }, 250);
        }
        async function main() {
            if (!EVAL_START_CACHED || !EVAL_END_CACHED) {
                try {
                    await syncEvaluationPeriodFromAmazon();
                } catch {}
            }
            if (location.href.startsWith("https://www.amazon.fr/vine/account")) {
                try {
                    initDaysLeftOnAccount();
                } catch (e) {
                    warn(e);
                }
            }
            const url = location.href;
            const data = extractDataFromPage();
            if (url.includes("/vine/vine-reviews")) {
                const rt = new URLSearchParams(location.search).get("review-type") || "pending_review";
                if (rt === "pending_review") {
                    storeData("pending_reviews", data);
                    if (shouldHarvest("pending_review")) harvestAllReviewPagesOnce("pending_review");
                } else if (rt === "completed") {
                    storeData("completed_reviews", data);
                    syncCompletedReviews(data);
                    if (shouldHarvest("completed")) harvestAllReviewPagesOnce("completed");
                }
            } else if (url.includes("/vine/orders")) {
                storeData("orders_data", data);
                lfSaveOrderInfoFromOrdersPage();
                ratioOrdersOnOrdersPage();
            }
            if (url.includes("/vine/vine-reviews")) {
                displayResults();
                pendingReplaceStatusColumn();
                applyRainbowStably();
                applyHMP();
                vppAttachReviewLinkCtx();
                vppNormalizeReviewButtons();
                vppStyleSubmittedButtons();
                applyHideApproved();
            }
            window.addEventListener("keydown", onKeyDown, { passive: !0 });
            observeTables();
            try {
                GM_registerMenuCommand("Vine Power Pack — Ouvrir le panneau", () => openPanel("data"));
            } catch {}
        }
        if (document.readyState === "complete" || document.readyState === "interactive") {
            main();
        } else {
            window.addEventListener("DOMContentLoaded", main, { once: !0 });
        }
    })();
(function () {
    "use strict";
    const VER = "3.8.2",
        DAY = 86400000,
        GMK = { orders: "orders", deleted: "deletedOrderIDs", colors: "deliveryColors", settings: "settings", cancelledPrefix: "cancelledOrder_", pinned: "pinnedOrders", syncLock: "syncLock", syncSession: "syncSession" };
    const DEF_COLORS = { today: "#008000", tomorrow: "#0066FF", dayAfterTomorrow: "#FFA500", next7Days: "#800080", overdue: "#dc3545", delivered: "#16a34a", unavailable: "#FFA500", highlight: "rgba(255,225,128,.5)", highlightText: "#000" };
    const DEF_LEX = {
        prefixes: ["livraison prévue(?: le)?", "livraison estimée(?: le)?", "livraison(?: le)?", "arrivera(?: le)?", "arrive(?: le)?", "estimée(?: le)?", "désormais attendu(?: le)?", "pr[ée]lev[ée](?: le)?"],
        statuses: [
            { keys: ["livré", "livree", "livre", "prélevé", "preleve", "prélevée", "prelevee", "commande reçue", "commande recue"], value: "Livré" },
            { keys: ["expédié", "expedie", "expédiée", "expediee"], value: "Expédié" },
            { keys: ["en cours de préparation", "preparation en cours"], value: "En cours de préparation" },
            { keys: ["précommandé", "precommande", "précommandée", "precommandee"], value: "Précommandé" },
            { keys: ["retour demandé", "retour demande"], value: "Retour demandé" },
            { keys: ["annul", "annule", "annulé", "annulee", "annulés", "annules", "annulation", "commande annul"], value: "Annulée" },
            {
                keys: [
                    "en retard",
                    "retardé",
                    "retarde",
                    "retard probable",
                    "retard de livraison",
                    "delai depasse",
                    "délai dépassé",
                    "incident de transport",
                    "votre colis est peut etre perdu",
                    "votre colis est peut-être perdu",
                    "colis peut etre perdu",
                    "colis peut-être perdu",
                    "colis perdu",
                    "peut etre perdu",
                    "peut-être perdu",
                    "désormais attendu le",
                ],
                value: "En retard",
            },
        ],
        months: {
            janvier: 0,
            janv: 0,
            "janv.": 0,
            février: 1,
            fevrier: 1,
            févr: 1,
            "févr.": 1,
            fevr: 1,
            "fevr.": 1,
            mars: 2,
            avril: 3,
            avr: 3,
            "avr.": 3,
            mai: 4,
            juin: 5,
            juillet: 6,
            juil: 6,
            "juil.": 6,
            août: 7,
            aout: 7,
            septembre: 8,
            sept: 8,
            "sept.": 8,
            octobre: 9,
            oct: 9,
            "oct.": 9,
            novembre: 10,
            nov: 10,
            "nov.": 10,
            décembre: 11,
            decembre: 11,
            déc: 11,
            "déc.": 11,
            dec: 11,
            "dec.": 11,
        },
        days: { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 },
        relatives: { "aujourd'hui": 0, aujourdhui: 0, demain: 1, "après-demain": 2, "apres-demain": 2, "après demain": 2, "apres demain": 2 },
        rangePattern: "entre\\s+le\\s+(\\d{1,2}\\s+[a-zéû\\.]+)(?:\\s+et\\s+|\\s*[-–]\\s*)(\\d{1,2}\\s+[a-zéû\\.]+)",
        latePattern: "au plus tard le\\s+(.+)",
    };
    const DEF_SETTINGS = { hideDeliveredOlderThanDays: 30, uiTheme: "auto", customTerms: [], lexicon: DEF_LEX, __userLexEdited: !1 };
    const S = {
        orders: GM_getValue(GMK.orders, []),
        deleted: GM_getValue(GMK.deleted, []),
        pinned: GM_getValue(GMK.pinned, []),
        colors: Object.assign({}, DEF_COLORS, GM_getValue(GMK.colors, {})),
        settings: Object.assign({}, DEF_SETTINGS, GM_getValue(GMK.settings, {})),
        isVine: location.href.includes("/vine/"),
        dirty: !1,
        ui: { sortKey: "lastSeen", sortDir: "desc", filterStatus: "all", filterVine: "all", dateFrom: "", dateTo: "", search: "" },
    };
    const log = (...a) => console.log("[ShipTracker v" + VER + "]", ...a),
        deb = (f, m = 250) => {
            let t;
            return (...a) => {
                clearTimeout(t);
                t = setTimeout(() => f(...a), m);
            };
        },
        thr = (f, m = 300) => {
            let l = 0,
                to = null;
            return (...a) => {
                const n = Date.now(),
                    r = m - (n - l);
                if (r <= 0) {
                    clearTimeout(to);
                    l = n;
                    f(...a);
                } else if (!to) {
                    to = setTimeout(() => {
                        l = Date.now();
                        to = null;
                        f(...a);
                    }, r);
                }
            };
        },
        uniq = (a) => [...new Set(a || [])],
        norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    function fold(s) {
        return (s || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[’'"]/g, "'")
            .replace(/[\(\)\[\]\{\}]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }
    function validId(id) {
        return /^\d{3}-\d{7}-\d{7}$/.test(id || "");
    }
    function shape(o) {
        return {
            orderID: o.orderID || "",
            deliveryInfo: o.deliveryInfo || "",
            deliveryStatus: o.deliveryStatus || "",
            shipmentIDs: uniq(o.shipmentIDs || []),
            isVine: !!o.isVine,
            lastSeen: o.lastSeen || Date.now(),
            cancelled: !!o.cancelled,
            lockStatus: !!o.lockStatus,
            lockDate: !!o.lockDate,
        };
    }
    function save(p = {}) {
        "orders" in p && GM_setValue(GMK.orders, p.orders);
        "deleted" in p && GM_setValue(GMK.deleted, p.deleted);
        "pinned" in p && GM_setValue(GMK.pinned, p.pinned);
        "colors" in p && GM_setValue(GMK.colors, p.colors);
        "settings" in p && GM_setValue(GMK.settings, p.settings);
    }
    const flush = thr(() => {
        if (!S.dirty) return;
        save({ orders: S.orders, deleted: S.deleted, pinned: S.pinned, colors: S.colors, settings: S.settings });
        S.dirty = !1;
    }, 400);
    function persistSettingsNow() {
        try {
            GM_setValue(GMK.settings, JSON.parse(JSON.stringify(S.settings || {})));
        } catch (e) {
            console.warn("Persist settings error:", e);
        }
    }
    function persistOrdersNow() {
        try {
            GM_setValue(GMK.orders, JSON.parse(JSON.stringify(S.orders || [])));
        } catch (e) {
            console.warn("Persist orders error:", e);
        }
    }
    function migrate() {
        let ch = !1;
        S.orders = (S.orders || [])
            .filter((o) => o && validId(o.orderID))
            .map((o) => {
                const n = shape(o);
                if (n !== o) ch = !0;
                return n;
            });
        S.deleted = (S.deleted || []).filter((id) => S.orders.some((o) => o.orderID === id));
        S.pinned = (S.pinned || []).filter((id) => S.orders.some((o) => o.orderID === id));
        if (!S.settings.lexicon) {
            S.settings.lexicon = DEF_LEX;
            ch = !0;
        }
        if (typeof S.settings.__userLexEdited !== "boolean") {
            S.settings.__userLexEdited = !1;
            ch = !0;
        }
        if (ch) {
            S.dirty = !0;
            flush();
        }
    }
    migrate();
    let STIDX = null;
    function buildST() {
        const packs = S.settings.lexicon?.statuses || DEF_LEX.statuses;
        const idx = [];
        for (const p of packs) {
            for (const k of p.keys || []) {
                const f = fold(k);
                if (f) idx.push({ k: f, v: p.value });
            }
        }
        STIDX = idx;
    }
    function parseStatus(s) {
        const f = fold(s);
        if (!f) return "";
        if (!STIDX) buildST();
        for (const e of STIDX) {
            if (f.includes(e.k)) return e.v;
        }
        return "";
    }
    const fmtFR = (d) => (d instanceof Date && !isNaN(d) ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
    function unprefix(raw) {
        let s = raw || "";
        try {
            const px = S.settings.lexicon?.prefixes || DEF_LEX.prefixes;
            if (px?.length) {
                const re = new RegExp(`(?:${px.join("|")})`, "gi");
                s = s.replace(re, "");
            }
        } catch {}
        return s.replace(/^(?:\s*[:\-–]\s*)/, "").trim();
    }
    function parseCustom(raw) {
        const rules = S.settings.customTerms || [];
        const now = new Date();
        for (const t of rules) {
            try {
                if (!t?.regex) continue;
                const re = new RegExp(t.regex, "i");
                if (re.test(raw)) {
                    let d = null;
                    if (typeof t.offsetDays === "number") d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + t.offsetDays);
                    else if (t.target) {
                        const x = new Date(t.target);
                        if (!isNaN(x)) d = x;
                    }
                    return { date: d, status: t.status || "", raw: raw };
                }
            } catch {}
        }
        return null;
    }
    function relDate(s) {
        const rel = S.settings.lexicon?.relatives || DEF_LEX.relatives;
        const f = fold(s);
        for (const k of Object.keys(rel)) {
            if (f.includes(fold(k))) {
                const add = rel[k],
                    n = new Date();
                return new Date(n.getFullYear(), n.getMonth(), n.getDate() + add);
            }
        }
        return null;
    }
    function dowDate(s) {
        const days = S.settings.lexicon?.days || DEF_LEX.days;
        const f = fold(s);
        for (const [name, idx] of Object.entries(days)) {
            if (f.includes(fold(name))) {
                const n = new Date(),
                    cur = n.getDay();
                let add = idx - cur;
                if (add <= 0) add += 7;
                return new Date(n.getFullYear(), n.getMonth(), n.getDate() + add);
            }
        }
        return null;
    }
    function looseDate(s) {
        if (!s) return null;
        const months = S.settings.lexicon?.months || DEF_LEX.months;
        const now = new Date();
        const ss = fold(s);
        const m = ss.match(/(\d{1,2})\s+([a-z\.]+)(?:\s+(\d{4}))?/i);
        if (m) {
            const day = parseInt(m[1], 10),
                mn = (m[2] || "").replace(".", "");
            const mi = months[mn] != null ? months[mn] : months[fold(mn)];
            if (mi == null) return null;
            let y = m[3] ? parseInt(m[3], 10) : now.getFullYear();
            let d = new Date(y, mi, day);
            if (!m[3] && mi === 0 && now.getMonth() >= 10) d = new Date(now.getFullYear() + 1, mi, day);
            return d;
        }
        return null;
    }
    function rangeDate(s) {
        const f = fold(s);
        try {
            const p = S.settings.lexicon?.rangePattern || DEF_LEX.rangePattern;
            const re = new RegExp(p, "i");
            const m = f.match(re);
            if (m) return looseDate(m[1]);
        } catch {}
        let m = f.match(/entre\s+le\s+(\d{1,2})\s+(?:et|au)\s+(\d{1,2})\s+([a-z\.]+)/i);
        if (m) return looseDate(`${m[1]} ${m[3]}`);
        m = f.match(/du\s+(\d{1,2})\s+au\s+(\d{1,2})\s+([a-z\.]+)/i);
        if (m) return looseDate(`${m[1]} ${m[3]}`);
        m = f.match(/entre\s+le\s+(\d{1,2})\s+([a-z\.]+)\s+(?:et|au)\s+(\d{1,2})\s+([a-z\.]+)/i);
        if (m) return looseDate(`${m[1]} ${m[2]}`);
        return null;
    }
    function lateDate(s) {
        const f = fold(s);
        const p = S.settings.lexicon?.latePattern || DEF_LEX.latePattern;
        try {
            const re = new RegExp(p, "i");
            const m = f.match(re);
            if (m) return looseDate(m[1]);
        } catch {}
        return null;
    }
    function parseInfo(raw) {
        const R = (raw || "").trim();
        if (!R) return { date: null, status: "Non communiquée", raw: "" };
        const s0 = parseStatus(R);
        const stripped = unprefix(R);
        const s1 = parseStatus(stripped);
        const st = s0 || s1;
        const custom = parseCustom(R);
        if (custom) return custom;
        const rd = relDate(stripped);
        if (rd) return { date: rd, status: st, raw: stripped || R };
        const rg = rangeDate(stripped);
        if (rg) return { date: rg, status: st, raw: stripped || R };
        const lt = lateDate(stripped);
        if (lt) return { date: lt, status: st, raw: stripped || R };
        const dw = dowDate(stripped);
        if (dw) return { date: dw, status: st, raw: stripped || R };
        const dd = looseDate(stripped);
        return { date: dd, status: st, raw: stripped || R };
    }
    function dateFrom(info) {
        const p = parseInfo(info);
        return p.date || null;
    }
    function isDelivered(o) {
        const s = (o?.deliveryStatus || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
        return s === "livre" || s === "livree";
    }
    function upsert(o) {
        if (!validId(o.orderID)) return;
        const i = S.orders.findIndex((x) => x.orderID === o.orderID);
        const c = shape(o);
        if (i >= 0) S.orders[i] = c;
        else S.orders.push(c);
        S.dirty = !0;
        flush();
    }
    function apply(orderID, text) {
        if (!text) return null;
        let o = S.orders.find((x) => x.orderID === orderID) || shape({ orderID });
        const p = parseInfo(text);
        const rawF = fold(text),
            statF = fold(p.status || "");
        const wantsCancel = /annul/.test(rawF) || /annul/.test(statF) || GM_getValue(GMK.cancelledPrefix + orderID, !1);
        if (!o.lockStatus) {
            if (wantsCancel) {
                o.cancelled = !0;
                o.deliveryStatus = "Annulée";
                if (!o.lockDate) o.deliveryInfo = "—";
            } else if (p.status) {
                o.deliveryStatus = p.status;
                o.cancelled = /annul/.test(fold(p.status));
                if (o.cancelled && !o.lockDate) o.deliveryInfo = "—";
            }
        }
        if (!o.lockStatus && !o.cancelled && (/pr[ée]lev[ée]/.test(rawF) || /pr[ée]lev[ée]/.test(fold(o.deliveryStatus || "")))) o.deliveryStatus = "Livré";
        if (!o.lockDate) {
            if (!o.cancelled && p.date) o.deliveryInfo = fmtFR(p.date);
            else if (!o.deliveryInfo) o.deliveryInfo = p.raw || "Non communiquée";
        }
        o.isVine = o.isVine || S.isVine;
        o.lastSeen = Date.now();
        upsert(o);
        return p;
    }
    function addTick(el, ok) {
        if (!el) return;
        el.querySelector(".st-ind")?.remove();
        const s = document.createElement("span");
        s.className = "st-ind";
        s.textContent = ok ? " ✓" : " ?";
        s.style.fontWeight = "700";
        s.style.marginLeft = "6px";
        s.style.color = ok ? "#16a34a" : "#eab308";
        s.title = ok ? "Date/statut détecté" : "Non reconnu";
        el.appendChild(s);
    }
    function extract() {
        document.querySelectorAll('a[href*="shipmentId="][href*="orderId="]').forEach((a) => {
            try {
                const u = new URL(a.href);
                const oid = u.searchParams.get("orderId");
                const sh = u.searchParams.get("shipmentId");
                if (!validId(oid)) return;
                let o = S.orders.find((x) => x.orderID === oid) || shape({ orderID: oid });
                if (sh && !o.shipmentIDs.includes(sh)) o.shipmentIDs.push(sh);
                o.isVine = o.isVine || S.isVine;
                o.lastSeen = Date.now();
                upsert(o);
            } catch {}
        });
        const prim = document.querySelectorAll("div.yohtmlc-shipment-status-primaryText"),
            ids = document.querySelectorAll('span.a-color-secondary[dir="ltr"]');
        prim.forEach((div, i) => {
            const id = (ids[i]?.innerText || "").trim();
            if (!validId(id)) return;
            const el = div.querySelector("span.a-size-medium") || div.querySelector("span.a-size-medium.a-color-base.a-text-bold");
            const t = el?.innerText?.trim() || "";
            const p = apply(id, t);
            if (el) addTick(el, !!(p && (p.date || p.status || /annul/.test(fold(t)))));
        });
        const legIDs = document.querySelectorAll("span.a-color-secondary.value");
        legIDs.forEach((el) => {
            const id = el.innerText.trim();
            if (!validId(id)) return;
            const infoEl = el.closest(".shipment-top-row")?.querySelector(".a-size-medium.a-color-base.a-text-bold");
            const t = infoEl?.textContent?.trim() || "";
            const p = apply(id, t);
            if (infoEl) addTick(infoEl, !!(p && (p.date || p.status || /annul/.test(fold(t)))));
        });
        document.querySelectorAll(".a-box.shipment .a-box-inner").forEach((b) => {
            const info = b.querySelector(".a-size-medium.a-color-base.a-text-bold");
            const link = b.querySelector(".track-package-button a");
            if (!link) return;
            try {
                const u = new URL(link.href);
                const oid = u.searchParams.get("orderId");
                const sh = u.searchParams.get("shipmentId");
                if (!validId(oid)) return;
                const t = info?.textContent?.trim() || "";
                const p = apply(oid, t);
                if (info) addTick(info, !!(p && (p.date || p.status || /annul/.test(fold(t)))));
                if (sh) {
                    let o = S.orders.find((x) => x.orderID === oid) || shape({ orderID: oid });
                    if (!o.shipmentIDs.includes(sh)) o.shipmentIDs.push(sh);
                    upsert(o);
                }
            } catch {}
        });
        if (location.href.includes("orderFilter=cancelled")) {
            document.querySelectorAll(".yohtmlc-order").forEach((n) => {
                const id = n.querySelector(".a-color-secondary.value")?.textContent?.trim();
                if (validId(id)) {
                    GM_setValue(GMK.cancelledPrefix + id, !0);
                    const o = S.orders.find((x) => x.orderID === id);
                    if (o) {
                        o.cancelled = !0;
                        o.deliveryInfo = "—";
                        o.deliveryStatus = "Annulée";
                        upsert(o);
                    }
                }
            });
        }
    }
    function stats() {
        const now = new Date(),
            s = { today: 0, tomorrow: 0, d2: 0, d7: 0, overdue: 0, cancelled: 0 };
        for (const o of S.orders) {
            if (S.deleted.includes(o.orderID)) continue;
            if (o.cancelled) {
                s.cancelled++;
                continue;
            }
            const stat = fold(o.deliveryStatus || "");
            if (stat.includes("retard") || stat.includes("perdu")) {
                s.overdue++;
                continue;
            }
            if (isDelivered(o)) continue;
            const d = dateFrom(o.deliveryInfo);
            if (!d) continue;
            const diff = Math.ceil((d - now) / DAY);
            if (diff < 0) s.overdue++;
            else if (diff === 0) s.today++;
            else if (diff === 1) s.tomorrow++;
            else if (diff === 2) s.d2++;
            else if (diff > 2 && diff <= 7) s.d7++;
        }
        return s;
    }
    function anomalies() {
        const out = [],
            isPlaceholder = (v) => !v || v === "—" || /^\s*non communiqu[ée]e?\s*$/i.test(v);
        for (const o of S.orders) {
            if (S.deleted.includes(o.orderID)) continue;
            const info = (o.deliveryInfo || "").trim();
            const d = isPlaceholder(info) ? null : dateFrom(info);
            const statF = fold(o.deliveryStatus || "");
            if (o.cancelled && !isPlaceholder(info)) out.push({ type: "CANCELLED_WITH_DATE", order: o });
            if (!o.cancelled && !isDelivered(o) && !isPlaceholder(info) && !d && !/retard|perdu/.test(statF)) out.push({ type: "UNPARSEABLE_DATE", order: o });
        }
        return out;
    }
    function applyTheme() {
        const id = "st-theme";
        document.getElementById(id)?.remove();
        const s = document.createElement("style");
        s.id = id;
        const c = S.colors;
        s.textContent = `:root{--st-today:${c.today};--st-tomorrow:${c.tomorrow};--st-d2:${c.dayAfterTomorrow};--st-d7:${c.next7Days};--st-overdue:${c.overdue};--st-delivered:${c.delivered};--st-unavail:${c.unavailable}}#st-header .vs-card.vs-today{border-top:3px solid var(--st-today)}#st-header .vs-card.vs-tomorrow{border-top:3px solid var(--st-tomorrow)}#st-header .vs-card.vs-d2{border-top:3px solid var(--st-d2)}#st-header .vs-card.vs-d7{border-top:3px solid var(--st-d7)}#st-header .vs-card.vs-overdue{border-top:3px solid var(--st-overdue)}#st-header .vs-card.vs-cancelled{border-top:3px solid var(--st-unavail)}#st-header .vs-card.vs-today .vs-card-value{color:var(--st-today)}#st-header .vs-card.vs-tomorrow .vs-card-value{color:var(--st-tomorrow)}#st-header .vs-card.vs-d2 .vs-card-value{color:var(--st-d2)}#st-header .vs-card.vs-d7 .vs-card-value{color:var(--st-d7)}#st-header .vs-card.vs-overdue .vs-card-value{color:var(--st-overdue)}#st-header .vs-card.vs-cancelled .vs-card-value{color:var(--st-unavail)}.st-soft{margin-top:8px;padding:8px 10px;border-radius:10px;border:1px solid #e5e7eb;background:#fff}.dark .st-soft{border-color:#333;background:#1f1f1f}`;
        document.head.appendChild(s);
    }
    function ensureHeader() {
        const host = document.querySelector(".vvp-orders-table--heading-top");
        if (!host) return;
        if (host.querySelector("#st-header")) return;
        const wrap = document.createElement("div");
        wrap.id = "st-header";
        wrap.innerHTML = `<style>#st-header .head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:6px}#st-header .vs-cards{display:flex;gap:8px;flex-wrap:wrap}#st-header .vs-card{border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;min-width:120px;background:#fff}#st-header .vs-card-title{font-size:12px;color:#6b7280}#st-header .vs-card-value{font-weight:700;font-size:18px}#st-header .actions{display:flex;gap:8px;align-items:center;margin-left:auto}#st-header .btn{padding:6px 10px;border-radius:10px;border:1px solid transparent;color:#fff;cursor:pointer;font-weight:600}#st-header .btn-sync{background:#0073bb;border-color:#0073bb}#st-header .btn-modal{background:#17a2b8;border-color:#17a2b8}.dark #st-header .vs-card{background:#1f1f1f;border-color:#333}.dark #st-header .vs-card-title{color:#9ca3af}</style><div class="head"><div class="vs-cards"><div class="vs-card vs-today"><div class="vs-card-title">Aujourd’hui</div><div class="vs-card-value" id="st-card-today"></div></div><div class="vs-card vs-tomorrow"><div class="vs-card-title">Demain</div><div class="vs-card-value" id="st-card-tomorrow"></div></div><div class="vs-card vs-d2"><div class="vs-card-title">Après-demain</div><div class="vs-card-value" id="st-card-d2"></div></div><div class="vs-card vs-d7"><div class="vs-card-title">7 jours</div><div class="vs-card-value" id="st-card-d7"></div></div><div class="vs-card vs-overdue"><div class="vs-card-title">En retard</div><div class="vs-card-value" id="st-card-overdue"></div></div><div class="vs-card vs-cancelled"><div class="vs-card-title">Annulées</div><div class="vs-card-value" id="st-card-cancelled"></div></div></div><div class="actions"><button id="st-act-sync" class="btn btn-sync">Synchroniser</button><button id="st-act-modal" class="btn btn-modal">Afficher les données</button></div></div><div id="st-soft-area"></div>`;
        host.appendChild(wrap);
        applyTheme();
        refreshCards();
        wrap.querySelector("#st-act-sync").addEventListener("click", () => sync(!0));
        wrap.querySelector("#st-act-modal").addEventListener("click", openModal);
    }
    function refreshCards() {
        const s = stats(),
            set = (id, v) => {
                const el = document.getElementById(id);
                if (el) el.textContent = String(v);
            };
        set("st-card-today", s.today);
        set("st-card-tomorrow", s.tomorrow);
        set("st-card-d2", s.d2);
        set("st-card-d7", s.d7);
        set("st-card-overdue", s.overdue);
        set("st-card-cancelled", s.cancelled);
        renderSoftAlert();
    }
    function fixCancelledWithDate() {
        let n = 0;
        for (const o of S.orders) {
            if (o.cancelled && o.deliveryInfo && o.deliveryInfo !== "—") {
                o.deliveryInfo = "—";
                n++;
                S.dirty = !0;
            }
        }
        if (n) flush();
        return n;
    }
    function renderSoftAlert() {
        const area = document.querySelector("#st-soft-area");
        if (!area) return;
        area.innerHTML = "";
        const list = S.orders.filter((o) => o.cancelled && o.deliveryInfo && o.deliveryInfo !== "—" && !S.deleted.includes(o.orderID));
        if (!list.length) return;
        const b = document.createElement("div");
        b.className = "st-soft";
        b.innerHTML = `<strong>Anomalies détectées :</strong> <span class="pill" style="margin-left:6px;border:1px solid ${S.colors.overdue};color:${S.colors.overdue}">Annulée + date</span> <b>${list.length}</b> &nbsp; <button id="st-soft-fix" style="margin-left:8px" class="btn btn-sync">Corriger</button>`;
        area.appendChild(b);
        b.querySelector("#st-soft-fix").addEventListener("click", () => {
            const n = fixCancelledWithDate();
            if (n) {
                b.remove();
                refreshCards();
            }
        });
    }
    function correlate() {
        if (!location.href.includes("/vine/orders")) return;
        const head = document.querySelector("tr.vvp-orders-table--heading-row");
        if (head && ![...head.children].some((th) => th.textContent.trim() === "Date de livraison")) {
            const th = document.createElement("th");
            th.textContent = "Date de livraison";
            th.style.whiteSpace = "nowrap";
            head.insertBefore(th, head.children[3]);
        }
        document.querySelectorAll("tr.vvp-orders-table--row").forEach((row) => {
            row.querySelector(".delivery-date-cell")?.remove();
            const details = row.querySelector('a[name="vvp-orders-table--order-details-btn"]') || row.querySelector('a[id^="a-autoid-"]');
            let id = "";
            try {
                if (details?.href) {
                    const u = new URL(details.href);
                    id = u.searchParams.get("orderID") || u.pathname.split("/vine/orders/")[1]?.split("?")[0] || "";
                }
            } catch {}
            const td = document.createElement("td");
            td.className = "vvp-orders-table--text-col delivery-date-cell";
            if (!validId(id)) {
                td.textContent = "Non communiquée";
                td.style.color = S.colors.unavailable;
            } else {
                let o = S.orders.find((x) => x.orderID === id) || shape({ orderID: id });
                if (!o.isVine) {
                    o.isVine = !0;
                    upsert(o);
                    persistOrdersNow();
                }
                if (S.deleted.includes(id)) {
                    td.textContent = "Non communiquée";
                    td.style.color = S.colors.unavailable;
                } else if (o.cancelled) {
                    td.innerHTML = `<span class="pill" style="border:1px solid ${S.colors.overdue};color:${S.colors.overdue};padding:2px 6px;border-radius:999px;margin-right:6px">Annulée</span>—`;
                } else if (/retard|perdu/.test(fold(o.deliveryStatus || ""))) {
                    const label = `<span class="pill" style="border:1px solid ${S.colors.overdue};color:${S.colors.overdue};padding:2px 6px;border-radius:999px;margin-right:6px">En retard</span>`;
                    const txt = o.deliveryInfo && o.deliveryInfo !== "—" ? o.deliveryInfo : "—";
                    td.innerHTML = label + txt;
                    td.style.color = S.colors.overdue;
                } else {
                    const info = o.deliveryInfo;
                    if (isDelivered(o)) {
                        td.innerHTML = `<strong>Livré le ${info || "—"}</strong>`;
                        td.style.color = S.colors.delivered;
                    } else {
                        td.textContent = info || "Non communiquée";
                        const d = dateFrom(info);
                        if (d) {
                            const diff = Math.ceil((d - new Date()) / DAY);
                            td.style.color = diff < 0 ? S.colors.overdue : diff === 0 ? S.colors.today : diff === 1 ? S.colors.tomorrow : diff === 2 ? S.colors.dayAfterTomorrow : diff > 2 && diff <= 7 ? S.colors.next7Days : "";
                        } else td.style.color = S.colors.unavailable;
                    }
                }
            }
            const dateCell = row.querySelector("td[data-order-timestamp]");
            if (dateCell) dateCell.insertAdjacentElement("afterend", td);
            else row.appendChild(td);
        });
        ensureHeader();
        refreshCards();
    }
    function exportCSV(a) {
        if (!a?.length) {
            alert("Aucune donnée à exporter.");
            return;
        }
        const h = ["Order ID", "Delivery Info", "Delivery Status", "Shipment IDs", "Is Vine", "Cancelled", "Last Seen"];
        const rows = a.map((o) => [o.orderID, o.deliveryInfo, o.deliveryStatus, o.shipmentIDs.join(";"), o.isVine ? "Oui" : "Non", o.cancelled ? "Oui" : "Non", new Date(o.lastSeen || Date.now()).toISOString()]);
        let csv = h.join(",") + "\n" + rows.map((r) => r.map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const aEl = document.createElement("a");
        aEl.href = url;
        aEl.download = "orders_data.csv";
        aEl.click();
        URL.revokeObjectURL(url);
    }
    function detectDark() {
        try {
            if (S.settings.uiTheme === "dark") return !0;
            if (S.settings.uiTheme === "light") return !1;
            if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return !0;
            const cs = getComputedStyle(document.documentElement).getPropertyValue("color-scheme");
            if ((cs || "").includes("dark")) return !0;
        } catch {}
        return !1;
    }
    function openModal() {
        try {
            const st = GM_getValue(GMK.settings, S.settings) || S.settings;
            S.settings = Object.assign({}, S.settings, st);
        } catch {}
        const dark = detectDark(),
            root = document.createElement("div");
        root.style.position = "fixed";
        root.style.inset = "0";
        root.style.zIndex = "2147483647";
        root.style.background = "rgba(0,0,0,.55)";
        const card = document.createElement("div");
        card.style.maxWidth = "1250px";
        card.style.width = "96%";
        card.style.maxHeight = "92%";
        card.style.overflow = "hidden";
        card.style.background = dark ? "#0e1116" : "#fff";
        card.style.color = dark ? "#f3f4f6" : "#111827";
        card.style.margin = "4vh auto";
        card.style.borderRadius = "14px";
        card.style.boxShadow = "0 16px 40px rgba(0,0,0,.45)";
        if (dark) card.classList.add("dark");
        card.innerHTML = `<style>
  .st-btn{padding:8px 12px;border-radius:10px;border:1px solid ${dark ? "#2b2e33" : "#d1d5db"};background:${dark ? "#12161d" : "#f7f7f7"};color:${dark ? "#f3f4f6" : "#111827"};cursor:pointer}
  .st-btn.primary{background:#0073bb;border-color:#0073bb;color:#fff}.st-btn.danger{background:#dc3545;border-color:#dc3545;color:#fff}.st-btn.ghost{background:transparent}
  .st-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid ${dark ? "#2b2e33" : "#e5e7eb"}}
  .st-input,.st-select,.st-textarea{padding:8px;border-radius:10px;border:1px solid ${dark ? "#2b2e33" : "#d1d5db"};background:${dark ? "#0b0f14" : "#fff"};color:${dark ? "#f3f4f6" : "#111827"}}
  .st-input::placeholder{color:${dark ? "#b6beca" : "#6b7280"};opacity:1}
  .st-input, .st-textarea {caret-color:${dark ? "#f3f4f6" : "#111827"}}
  input[type="date"].st-input{color:${dark ? "#f3f4f6" : "#111827"};background:${dark ? "#0b0f14" : "#fff"}}
  select.st-select option{background:${dark ? "#0e1116" : "#fff"};color:${dark ? "#f3f4f6" : "#111827"}}
  /* Forcer lisibilité (autofill) */
  input.st-input:-webkit-autofill{ -webkit-text-fill-color:${dark ? "#f3f4f6" : "#111827"}; transition: background-color 5000s ease-in-out 0s;}
  .st-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .st-left{width:240px;border-right:1px solid ${dark ? "#1f242a" : "#e5e7eb"};background:${dark ? "#0a0d11" : "#fafafa"};padding:12px 10px;overflow:auto}
  .st-nav h4{margin:8px 8px 6px 8px;font-size:12px;text-transform:uppercase;opacity:.7}
  .st-nav .tab{display:block;padding:9px 10px;margin:6px 8px;border-radius:10px;cursor:pointer;border:1px solid transparent}
  .st-nav .tab.active{background:#0073bb;color:#fff;border-color:#0073bb}
  .st-sub{margin-left:12px}.st-main{flex:1;display:flex;flex-direction:column;min-width:0}
  table.st-table{width:100%;border-collapse:collapse}table.st-table th,table.st-table td{padding:10px 8px;border-bottom:1px solid ${dark ? "#1f242a" : "#eee"};vertical-align:top}
  table.st-table thead th{position:sticky;top:0;background:${dark ? "#0e1116" : "#fff"};z-index:2}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid ${dark ? "#2b2e33" : "#ddd"};font-size:12px}.muted{opacity:.7}
  </style>
<header style="padding:14px 16px;border-bottom:1px solid ${dark ? "#1f242a" : "#e5e7eb"};position:sticky;top:0;background:${dark ? "#0e1116" : "#fff"};z-index:3">
  <div class="st-toolbar"><strong>Suivi des livraisons — v${VER}</strong><span class="muted">|</span>
    <button id="st-sync" class="st-btn primary">Synchroniser</button>
    <button id="st-export-csv" class="st-btn">Export CSV</button>
    <div class="st-toolbar"><label class="st-chip" style="gap:8px"><span>Thème</span>
      <select id="st-theme" class="st-select">
        <option value="auto" ${S.settings.uiTheme === "auto" ? "selected" : ""}>Auto</option>
        <option value="light" ${S.settings.uiTheme === "light" ? "selected" : ""}>Clair</option>
        <option value="dark" ${S.settings.uiTheme === "dark" ? "selected" : ""}>Sombre</option>
      </select></label></div>
    <div style="margin-left:auto" class="st-toolbar">
      <input id="st-search" class="st-input" type="search" placeholder="Rechercher id/statut/texte…" style="min-width:280px">
      <button id="st-close" class="st-btn danger">Fermer</button>
    </div>
  </div>
</header>
<div style="display:flex;height:calc(92vh - 68px)">
  <aside class="st-left"><nav class="st-nav">
    <div class="tab" data-tab="overview">Aperçu</div>
    <h4>Commandes</h4><div class="tab st-sub" data-tab="orders-active">En cours</div><div class="tab st-sub" data-tab="orders-delivered">Livrées</div><div class="tab st-sub" data-tab="orders-hidden">Masquées</div>
    <h4>Affichage</h4><div class="tab" data-tab="filters">Filtres & tri</div><div class="tab" data-tab="colors">Couleurs</div>
    <h4>Parsing</h4><div class="tab" data-tab="rules">Règles & lexique</div><div class="tab" data-tab="anomalies">Anomalies</div>
    <h4>Fonctionnement</h4><div class="tab" data-tab="sync">Synchronisation</div><div class="tab" data-tab="data">Données</div><div class="tab" data-tab="maintenance">Maintenance</div>
    <h4>Info</h4><div class="tab" data-tab="about">À propos</div>
  </nav></aside>
  <main class="st-main">
    <section id="panel-toolbar" style="padding:10px 16px;border-bottom:1px solid ${dark ? "#1f242a" : "#e5e7eb"}">
      <div id="quick-chips" class="st-toolbar"><span class="muted">Raccourcis :</span>
        <button class="st-btn" data-q="today">Aujourd’hui</button>
        <button class="st-btn" data-q="tomorrow">Demain</button>
        <button class="st-btn" data-q="d2">Après-demain</button>
        <button class="st-btn" data-q="d7">≤ 7 jours</button>
        <button class="st-btn" data-q="overdue">En retard</button>
        <button class="st-btn" data-q="cancelled">Annulées</button>
        <button class="st-btn" data-q="vine">Vine</button>
        <button class="st-btn" data-q="private">Privées</button>
        <button class="st-btn" id="chip-reset">Réinitialiser</button>
      </div>
    </section>
    <section id="panel-body" style="flex:1;overflow:auto;padding:12px 16px"></section>
    <footer style="padding:10px 16px;border-top:1px solid ${dark ? "#1f242a" : "#e5e7eb"};background:${dark ? "#0e1116" : "#fff"}">
      <div class="st-toolbar">
        <span class="pill">Aujourd'hui: <b id="st-ftr-today">0</b></span>
        <span class="pill">Demain: <b id="st-ftr-tom">0</b></span>
        <span class="pill">Après-demain: <b id="st-ftr-d2">0</b></span>
        <span class="pill">7 jours: <b id="st-ftr-d7">0</b></span>
        <span class="pill" style="border-color:${S.colors.overdue};color:${S.colors.overdue}">En retard: <b id="st-ftr-ovd">0</b></span>
        <span class="pill">Annulées: <b id="st-ftr-cxl">0</b></span>
      </div>
    </footer>
  </main>
</div>`;
        const body = card.querySelector("#panel-body"),
            fRefs = {
                today: card.querySelector("#st-ftr-today"),
                tom: card.querySelector("#st-ftr-tom"),
                d2: card.querySelector("#st-ftr-d2"),
                d7: card.querySelector("#st-ftr-d7"),
                ovd: card.querySelector("#st-ftr-ovd"),
                cxl: card.querySelector("#st-ftr-cxl"),
            };
        card.querySelector("#st-export-csv").addEventListener("click", () => exportCSV(S.orders));
        card.querySelector("#st-sync").addEventListener("click", () => sync(!0));
        card.querySelector("#st-theme").addEventListener("change", (e) => {
            S.settings.uiTheme = e.target.value;
            persistSettingsNow();
            root.remove();
            openModal();
        });
        function tryClose() {
            const lexEl = card.querySelector("#st-lex"),
                rulesEl = card.querySelector("#st-rules");
            try {
                if (lexEl) {
                    const lex = JSON.parse(lexEl.value || "{}");
                    S.settings.lexicon = lex;
                    S.settings.__userLexEdited = !0;
                    STIDX = null;
                }
                if (rulesEl) {
                    const arr = JSON.parse(rulesEl.value || "[]");
                    if (Array.isArray(arr)) S.settings.customTerms = arr;
                }
                persistSettingsNow();
                root.remove();
            } catch (e) {
                alert('JSON invalide dans "Règles & lexique".\n' + e.message);
            }
        }
        root.addEventListener("click", (e) => {
            if (e.target === root) tryClose();
        });
        card.querySelector("#st-close").addEventListener("click", tryClose);
        let current = "overview";
        const onSearch = deb((e) => {
            S.ui.search = e.target.value;
            sw(current);
        }, 120);
        const searchEl = card.querySelector("#st-search");
        searchEl.addEventListener("input", onSearch);
        card.querySelectorAll(".st-nav .tab").forEach((el) => el.addEventListener("click", () => sw(el.dataset.tab)));
        card.querySelectorAll("#quick-chips .st-btn[data-q]").forEach((b) =>
            b.addEventListener("click", () => {
                const q = b.dataset.q;
                S.ui.search = "";
                searchEl.value = "";
                if (q === "vine") {
                    S.ui.filterVine = "vine";
                    S.ui.filterStatus = "all";
                    sw("overview");
                    return;
                }
                if (q === "private") {
                    S.ui.filterVine = "private";
                    S.ui.filterStatus = "all";
                    sw("overview");
                    return;
                }
                S.ui.filterVine = "all";
                S.ui.filterStatus = { today: "today", tomorrow: "tomorrow", d2: "d2", d7: "d7", overdue: "overdue", cancelled: "cancelled" }[q] || "all";
                sw("overview");
            })
        );
        card.querySelector("#chip-reset").addEventListener("click", () => {
            S.ui = { sortKey: "lastSeen", sortDir: "desc", filterStatus: "all", filterVine: "all", dateFrom: "", dateTo: "", search: "" };
            searchEl.value = "";
            sw("overview");
        });
        function nav(tab) {
            card.querySelectorAll(".st-nav .tab").forEach((el) => el.classList.toggle("active", el.dataset.tab === tab));
        }
        function foot(rows) {
            const a = { today: 0, tomorrow: 0, d2: 0, d7: 0, overdue: 0, cancelled: 0 };
            rows.forEach((o) => {
                const b = bucket(o);
                if (a[b] != null) a[b]++;
            });
            fRefs.today.textContent = a.today;
            fRefs.tom.textContent = a.tomorrow;
            fRefs.d2.textContent = a.d2;
            fRefs.d7.textContent = a.d7;
            fRefs.ovd.textContent = a.overdue;
            fRefs.cxl.textContent = a.cancelled;
        }
        function sw(tab) {
            current = tab;
            nav(tab);
            if (tab === "overview") renderOverview(body);
            else if (tab === "orders-active") renderSimple(body, "active");
            else if (tab === "orders-delivered") renderSimple(body, "delivered");
            else if (tab === "orders-hidden") renderSimple(body, "hidden");
            else if (tab === "filters") renderFilters(body);
            else if (tab === "colors") renderColors(body);
            else if (tab === "rules") renderRules(body);
            else if (tab === "anomalies") renderAnomalies(body);
            else if (tab === "sync") renderSync(body);
            else if (tab === "data") renderData(body);
            else if (tab === "maintenance") renderMaint(body);
            else if (tab === "about") renderAbout(body);
        }
        function bucket(o) {
            const d = dateFrom(o.deliveryInfo),
                now = new Date();
            if (o.cancelled) return "cancelled";
            const stat = fold(o.deliveryStatus || "");
            if (stat.includes("retard") || stat.includes("perdu")) return "overdue";
            if (isDelivered(o)) return "delivered";
            if (!d) return "pending";
            const diff = Math.ceil((d - now) / DAY);
            if (diff < 0) return "overdue";
            if (diff === 0) return "today";
            if (diff === 1) return "tomorrow";
            if (diff === 2) return "d2";
            if (diff > 2 && diff <= 7) return "d7";
            return "pending";
        }
        function matchSearch(o) {
            const q = norm(S.ui.search);
            if (!q) return !0;
            const txt = [o.orderID, o.deliveryStatus, o.deliveryInfo, o.shipmentIDs.join(","), o.isVine ? "vine" : "prive"].join(" ").toLowerCase();
            return txt.includes(q);
        }
        function filtered(base) {
            const from = S.ui.dateFrom ? new Date(S.ui.dateFrom + "T00:00:00") : null,
                to = S.ui.dateTo ? new Date(S.ui.dateTo + "T23:59:59") : null;
            let rows = base
                .filter((o) => !S.deleted.includes(o.orderID))
                .filter(matchSearch)
                .filter((o) => {
                    if (S.ui.filterStatus !== "delivered" && isDelivered(o) && S.settings.hideDeliveredOlderThanDays > 0) {
                        const d = dateFrom(o.deliveryInfo);
                        if (d) {
                            const age = Math.floor((Date.now() - d.getTime()) / DAY);
                            if (age > S.settings.hideDeliveredOlderThanDays) return !1;
                        }
                    }
                    const b = bucket(o);
                    if (S.ui.filterStatus !== "all" && b !== S.ui.filterStatus) return !1;
                    if (S.ui.filterVine === "vine" && !o.isVine) return !1;
                    if (S.ui.filterVine === "private" && o.isVine) return !1;
                    if (from || to) {
                        const d = dateFrom(o.deliveryInfo);
                        if (!d) return !1;
                        if (from && d < from) return !1;
                        if (to && d > to) return !1;
                    }
                    return !0;
                });
            rows.sort((a, b) => {
                const ap = S.pinned.includes(a.orderID) ? 1 : 0,
                    bp = S.pinned.includes(b.orderID) ? 1 : 0;
                if (ap !== bp) return bp - ap;
                const dir = S.ui.sortDir === "desc" ? -1 : 1,
                    k = S.ui.sortKey;
                let va, vb;
                if (k === "date") {
                    va = dateFrom(a.deliveryInfo) || new Date(2100, 0, 1);
                    vb = dateFrom(b.deliveryInfo) || new Date(2100, 0, 1);
                    return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
                }
                if (k === "status") {
                    va = a.deliveryStatus || "";
                    vb = b.deliveryStatus || "";
                    return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
                }
                if (k === "orderID") {
                    va = a.orderID;
                    vb = b.orderID;
                    return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
                }
                if (k === "vine") {
                    va = a.isVine ? 1 : 0;
                    vb = b.isVine ? 1 : 0;
                    return (va - vb) * dir;
                }
                va = a.lastSeen || 0;
                vb = b.lastSeen || 0;
                return (va - vb) * dir;
            });
            return rows;
        }
        function displayStatus(o) {
            if (o.cancelled) return "Annulée";
            if (isDelivered(o)) return "Livré";
            const s = fold(o.deliveryStatus || "");
            if (s.includes("retard") || s.includes("perdu")) return "En retard";
            const d = dateFrom(o.deliveryInfo);
            if (s.includes("expedie") && d && d >= new Date(new Date().toDateString())) return "En transit";
            return o.deliveryStatus || (d ? "Prévu" : "—");
        }
        function renderOverview(host) {
            const rows = filtered(S.orders);
            foot(rows);
            const t = document.createElement("table");
            t.className = "st-table";
            t.innerHTML = "<thead><tr><th>Commande</th><th>Colis</th><th>Statut</th><th>Date</th><th>Vine</th><th>Actions</th></tr></thead><tbody></tbody>";
            const tb = t.querySelector("tbody"),
                c = S.colors;
            for (const o of rows) {
                const tr = document.createElement("tr"),
                    d = dateFrom(o.deliveryInfo),
                    diff = d ? Math.ceil((d - new Date()) / DAY) : null,
                    overStat = /retard|perdu/.test(fold(o.deliveryStatus || "")),
                    col = isDelivered(o)
                        ? c.delivered
                        : overStat
                        ? c.overdue
                        : diff == null
                        ? c.unavailable
                        : diff < 0
                        ? c.overdue
                        : diff === 0
                        ? c.today
                        : diff === 1
                        ? c.tomorrow
                        : diff === 2
                        ? c.dayAfterTomorrow
                        : diff > 2 && diff <= 7
                        ? c.next7Days
                        : "";
                const tdO = document.createElement("td");
                tdO.innerHTML = `<a href="https://www.amazon.fr/gp/your-account/order-details?orderID=${o.orderID}" target="_blank">${o.orderID}</a> ${S.pinned.includes(o.orderID) ? "⭐" : ""} ${
                    o.lockStatus || o.lockDate ? ' <span class="pill" title="Champs verrouillés">🔒</span>' : ""
                }`;
                const tdS = document.createElement("td");
                tdS.textContent = o.shipmentIDs.join(", ") || "—";
                const tdSt = document.createElement("td");
                tdSt.textContent = displayStatus(o);
                if (o.cancelled) tdSt.innerHTML += ` <span class="pill" style="margin-left:6px;border-color:${c.overdue};color:${c.overdue}">Annulée</span>`;
                else if (isDelivered(o)) tdSt.style.color = c.delivered;
                else if (overStat) {
                    tdSt.innerHTML = 'En retard <span class="pill" style="margin-left:6px;border-color:' + c.overdue + ";color:" + c.overdue + '">!</span>';
                }
                const tdD = document.createElement("td");
                tdD.textContent = o.cancelled ? "—" : o.deliveryInfo || "Non communiquée";
                if (o.cancelled) {
                    tdD.style.color = c.unavailable;
                } else if (col) tdD.style.color = col;
                const tdV = document.createElement("td");
                tdV.textContent = o.isVine ? "Oui" : "Non";
                const tdA = document.createElement("td");
                tdA.append(
                    btn(S.pinned.includes(o.orderID) ? "Désépingler" : "Épingler", "", () => {
                        const i = S.pinned.indexOf(o.orderID);
                        if (i >= 0) S.pinned.splice(i, 1);
                        else S.pinned.push(o.orderID);
                        S.dirty = !0;
                        flush();
                        renderOverview(host);
                    }),
                    sep(),
                    btn("Masquer", "danger", () => {
                        if (!S.deleted.includes(o.orderID)) S.deleted.push(o.orderID);
                        S.dirty = !0;
                        flush();
                        tr.remove();
                    }),
                    sep(),
                    btn("Déverrouiller", "", () => {
                        o.lockStatus = !1;
                        o.lockDate = !1;
                        S.dirty = !0;
                        persistOrdersNow();
                        flush();
                        renderOverview(host);
                    })
                );
                tr.append(tdO, tdS, tdSt, tdD, tdV, tdA);
                tb.appendChild(tr);
            }
            host.innerHTML = "";
            host.appendChild(t);
            function btn(t, cls, cb) {
                const b = document.createElement("button");
                b.className = "st-btn " + cls;
                b.textContent = t;
                b.addEventListener("click", cb);
                return b;
            }
            function sep() {
                const s = document.createElement("span");
                s.style.display = "inline-block";
                s.style.width = "6px";
                return s;
            }
        }
        function renderSimple(host, which) {
            let rows = S.orders.slice();
            if (which === "active") rows = rows.filter((o) => !S.deleted.includes(o.orderID) && !isDelivered(o) && !o.cancelled);
            if (which === "delivered") rows = rows.filter((o) => !S.deleted.includes(o.orderID) && isDelivered(o));
            if (which === "hidden") rows = rows.filter((o) => S.deleted.includes(o.orderID));
            rows = rows.filter(matchSearch);
            const title = which === "active" ? "En cours" : which === "delivered" ? "Livrées" : "Masquées",
                t = document.createElement("table");
            t.className = "st-table";
            t.innerHTML = `<thead><tr><th>${title}</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody></tbody>`;
            const tb = t.querySelector("tbody");
            for (const o of rows) {
                const tr = document.createElement("tr"),
                    overStat = /retard|perdu/.test(fold(o.deliveryStatus || ""));
                tr.innerHTML = `<td><a target="_blank" href="https://www.amazon.fr/gp/your-account/order-details?orderID=${o.orderID}">${o.orderID}</a> ${
                    o.lockStatus || o.lockDate ? '<span class="pill" title="Champs verrouillés">🔒</span>' : ""
                }</td><td>${overStat ? 'En retard <span class="pill" style="margin-left:6px;border-color:' + S.colors.overdue + ";color:" + S.colors.overdue + '">!</span>' : displayStatus(o)} ${
                    o.cancelled ? '<span class="pill" style="margin-left:6px;border-color:' + S.colors.overdue + ";color:" + S.colors.overdue + '">Annulée</span>' : ""
                }</td><td>${o.cancelled ? "—" : o.deliveryInfo || "—"}</td><td></td>`;
                const act = tr.lastElementChild;
                if (which === "hidden") {
                    act.appendChild(
                        b("Rétablir", "", () => {
                            S.deleted = S.deleted.filter((id) => id !== o.orderID);
                            S.dirty = !0;
                            flush();
                            tr.remove();
                        })
                    );
                } else {
                    act.appendChild(
                        b("Masquer", "danger", () => {
                            if (!S.deleted.includes(o.orderID)) S.deleted.push(o.orderID);
                            S.dirty = !0;
                            flush();
                            tr.remove();
                        })
                    );
                    act.appendChild(document.createTextNode(" "));
                    act.appendChild(
                        b("Déverrouiller", "", () => {
                            o.lockStatus = !1;
                            o.lockDate = !1;
                            S.dirty = !0;
                            persistOrdersNow();
                            flush();
                            renderSimple(host, which);
                        })
                    );
                }
                tb.appendChild(tr);
            }
            host.innerHTML = "";
            host.appendChild(t);
            function b(t, cls, cb) {
                const x = document.createElement("button");
                x.className = "st-btn " + cls;
                x.textContent = t;
                x.addEventListener("click", cb);
                return x;
            }
        }
        function renderFilters(host) {
            host.innerHTML = `<h3>Filtres & tri</h3><div class="st-toolbar" style="margin-top:8px;flex-wrap:wrap"><select id="f-status" class="st-select"><option value="all">Tous les statuts</option><option value="pending">Non livrés</option><option value="today">Aujourd’hui</option><option value="tomorrow">Demain</option><option value="d2">Après-demain</option><option value="d7">Dans 7 jours</option><option value="overdue">En retard</option><option value="cancelled">Annulées</option><option value="delivered">Livrées (afficher)</option></select><select id="f-vine" class="st-select"><option value="all">Vine & privées</option><option value="vine">Vine seulement</option><option value="private">Privées seulement</option></select><label class="st-chip">Du <input id="f-from" class="st-input" type="date"></label><label class="st-chip">Au <input id="f-to" class="st-input" type="date"></label><select id="s-sort" class="st-select"><option value="lastSeen">Tri : Dernière vue</option><option value="date">Tri : Date prévue</option><option value="status">Tri : Statut</option><option value="orderID">Tri : Numéro commande</option><option value="vine">Tri : Vine/Privé</option></select><button id="s-dir" class="st-btn ghost" title="Asc/Desc">${
                S.ui.sortDir === "desc" ? "↓" : "↑"
            }</button><button id="f-reset" class="st-btn">Réinitialiser</button></div><p class="muted" style="margin-top:8px">Ces réglages s’appliquent à l’onglet “Aperçu”.</p>`;
            const r = {
                fs: host.querySelector("#f-status"),
                fv: host.querySelector("#f-vine"),
                ff: host.querySelector("#f-from"),
                ft: host.querySelector("#f-to"),
                ss: host.querySelector("#s-sort"),
                sd: host.querySelector("#s-dir"),
                fr: host.querySelector("#f-reset"),
            };
            r.fs.value = S.ui.filterStatus;
            r.fv.value = S.ui.filterVine;
            r.ff.value = S.ui.dateFrom;
            r.ft.value = S.ui.dateTo;
            r.ss.value = S.ui.sortKey;
            r.fs.addEventListener("change", () => {
                S.ui.filterStatus = r.fs.value;
                sw("overview");
            });
            r.fv.addEventListener("change", () => {
                S.ui.filterVine = r.fv.value;
                sw("overview");
            });
            r.ff.addEventListener("change", () => {
                S.ui.dateFrom = r.ff.value;
                sw("overview");
            });
            r.ft.addEventListener("change", () => {
                S.ui.dateTo = r.ft.value;
                sw("overview");
            });
            r.ss.addEventListener("change", () => {
                S.ui.sortKey = r.ss.value;
                sw("overview");
            });
            r.sd.addEventListener("click", () => {
                S.ui.sortDir = S.ui.sortDir === "desc" ? "asc" : "desc";
                r.sd.textContent = S.ui.sortDir === "desc" ? "↓" : "↑";
                sw("overview");
            });
            r.fr.addEventListener("click", () => {
                S.ui = { sortKey: "lastSeen", sortDir: "desc", filterStatus: "all", filterVine: "all", dateFrom: "", dateTo: "", search: "" };
                sw("overview");
            });
        }
        function renderColors(host) {
            const rgba = S.colors.highlight.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i),
                op = rgba ? parseFloat(rgba[4] ?? "0.5") : 0.5,
                hex = (r, g, b) => "#" + [r, g, b].map((v) => (+v).toString(16).padStart(2, "0")).join(""),
                hl = rgba ? hex(rgba[1], rgba[2], rgba[3]) : "#ffe180";
            host.innerHTML = `<h3>Couleurs</h3><div class="st-toolbar" style="flex-wrap:wrap;margin-top:8px">${["today", "tomorrow", "dayAfterTomorrow", "next7Days", "overdue", "delivered", "unavailable"]
                .map(
                    (k) =>
                        `<label class="st-chip" style="gap:8px"><span>${
                            { today: "Aujourd'hui", tomorrow: "Demain", dayAfterTomorrow: "Après-demain", next7Days: "7 jours", overdue: "En retard", delivered: "Livré", unavailable: "Non communiqué" }[k]
                        }</span><input type="color" data-k="${k}" value="${S.colors[k]}"></label>`
                )
                .join(
                    ""
                )}</div><div class="st-toolbar" style="margin-top:10px;flex-wrap:wrap"><label class="st-chip" style="gap:8px"><span>Surbrillance</span><input type="color" id="hlColor" value="${hl}"><input type="range" id="hlOpacity" min="0" max="1" step="0.05" value="${op}" style="width:140px"></label><label class="st-chip" style="gap:8px"><span>Texte surbrillance</span><input type="color" id="hlText" value="${
                S.colors.highlightText
            }"></label></div><div style="margin-top:12px"><button id="saveC" class="st-btn primary">Enregistrer</button><button id="resetC" class="st-btn">Réinitialiser</button></div>`;
            host.querySelector("#saveC").addEventListener("click", () => {
                host.querySelectorAll('input[type="color"][data-k]').forEach((i) => {
                    S.colors[i.dataset.k] = i.value;
                });
                const hc = host.querySelector("#hlColor").value,
                    op2 = parseFloat(host.querySelector("#hlOpacity").value),
                    rgb = hexToRgb(hc);
                S.colors.highlight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${op2})`;
                S.colors.highlightText = host.querySelector("#hlText").value;
                S.dirty = !0;
                flush();
                applyTheme();
                persistSettingsNow();
                alert("Couleurs enregistrées.");
            });
            host.querySelector("#resetC").addEventListener("click", () => {
                Object.assign(S.colors, DEF_COLORS);
                S.dirty = !0;
                flush();
                applyTheme();
                persistSettingsNow();
                renderColors(host);
                alert("Couleurs réinitialisées.");
            });
            function hexToRgb(h) {
                h = h.replace("#", "");
                const v = parseInt(h, 16);
                return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
            }
        }
        function renderRules(host) {
            host.innerHTML = `<h3>Règles & lexique</h3><details open style="margin-top:8px"><summary>Lexique (JSON)</summary><textarea id="st-lex" class="st-textarea" style="width:100%;min-height:220px">${JSON.stringify(
                S.settings.lexicon || DEF_LEX,
                null,
                2
            )}</textarea><div style="margin-top:8px" class="st-toolbar"><button id="lexSave" class="st-btn primary">Enregistrer</button><button id="lexReset" class="st-btn">Réinitialiser</button></div></details><details open style="margin-top:8px"><summary>Règles personnalisées (regex → date/status)</summary><textarea id="st-rules" class="st-textarea" style="width:100%;min-height:160px">${JSON.stringify(
                S.settings.customTerms || [],
                null,
                2
            )}</textarea><div style="margin-top:8px" class="st-toolbar"><button id="rSave" class="st-btn primary">Enregistrer</button><button id="rReset" class="st-btn">Vider</button></div></details><details style="margin-top:8px"><summary>Testeur</summary><div class="st-toolbar" style="margin-top:8px"><input id="tTxt" class="st-input" placeholder="Colle un texte (ex: “Désormais attendu le 27 août”, “Prélevé le 24 juin”, “Colis peut-être perdu”)" style="flex:1;min-width:260px"><button id="tRun" class="st-btn">Tester</button></div><pre id="tOut" style="margin-top:8px;white-space:pre-wrap;font-family:monospace"></pre></details>`;
            host.querySelector("#lexSave").addEventListener("click", () => {
                try {
                    const lex = JSON.parse(host.querySelector("#st-lex").value || "{}");
                    S.settings.lexicon = lex;
                    S.settings.__userLexEdited = !0;
                    STIDX = null;
                    persistSettingsNow();
                    alert("Lexique enregistré.");
                } catch (e) {
                    alert("Lexique invalide : " + e.message);
                }
            });
            host.querySelector("#lexReset").addEventListener("click", () => {
                S.settings.lexicon = DEF_LEX;
                S.settings.__userLexEdited = !1;
                STIDX = null;
                persistSettingsNow();
                host.querySelector("#st-lex").value = JSON.stringify(DEF_LEX, null, 2);
                alert("Lexique réinitialisé.");
            });
            host.querySelector("#rSave").addEventListener("click", () => {
                try {
                    const arr = JSON.parse(host.querySelector("#st-rules").value || "[]");
                    if (!Array.isArray(arr)) throw new Error("Doit être un tableau");
                    S.settings.customTerms = arr;
                    persistSettingsNow();
                    alert("Règles enregistrées.");
                } catch (e) {
                    alert("JSON invalide: " + e.message);
                }
            });
            host.querySelector("#rReset").addEventListener("click", () => {
                S.settings.customTerms = [];
                persistSettingsNow();
                host.querySelector("#st-rules").value = "[]";
                alert("Règles vidées.");
            });
            host.querySelector("#tRun").addEventListener("click", () => {
                const t = host.querySelector("#tTxt").value || "";
                const r = parseInfo(t);
                host.querySelector("#tOut").textContent = JSON.stringify({ status: r.status || "(aucun)", date: r.date ? fmtFR(r.date) : "(pas de date)", raw: r.raw }, null, 2);
            });
        }
        function renderAnomalies(host) {
            const list = anomalies().filter((a) => matchSearch(a.order));
            const fmtType = (t) => (t === "CANCELLED_WITH_DATE" ? "Annulée + date" : "Date non comprise");
            const statusOpts = ["", "Livré", "Expédié", "En cours de préparation", "Précommandé", "Retour demandé", "Annulée", "En retard"];
            host.innerHTML = `<h3>Anomalies</h3><p class="muted" style="margin-top:6px">Corrections rapides + édition manuelle (statut/date). Les statuts “En retard” ne sont pas pénalisés s’il manque une date.</p><div class="st-toolbar" style="margin-top:8px"><button id="fixAllCxl" class="st-btn ${
                list.some((a) => a.type === "CANCELLED_WITH_DATE") ? "primary" : "ghost"
            }" ${
                list.some((a) => a.type === "CANCELLED_WITH_DATE") ? "" : "disabled"
            }>Corriger “Annulée + date” (tout)</button></div><table class="st-table" style="margin-top:10px"><thead><tr><th>Commande</th><th>Problème</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody id="anobody"></tbody></table>`;
            const tb = host.querySelector("#anobody");
            if (!list.length) {
                tb.innerHTML = `<tr><td colspan="5"><em>Aucune anomalie détectée.</em></td></tr>`;
            } else {
                for (const a of list) {
                    const o = a.order,
                        tr = document.createElement("tr");
                    tr.innerHTML = `<td><a target="_blank" href="https://www.amazon.fr/gp/your-account/order-details?orderID=${o.orderID}">${o.orderID}</a> ${
                        o.lockStatus || o.lockDate ? '<span class="pill" title="Champs verrouillés">🔒</span>' : ""
                    }</td>
          <td>${fmtType(a.type)}${o.cancelled ? `<span class="pill" style="margin-left:6px;border-color:${S.colors.overdue};color:${S.colors.overdue}">Annulée</span>` : ""}</td>
          <td><select class="st-select st-status">${statusOpts.map((x) => `<option ${x === (o.deliveryStatus || "") ? "selected" : ""}>${x}</option>`).join("")}</select></td>
          <td><input type="date" class="st-input st-date" value="${(function () {
              const d = dateFrom(o.deliveryInfo);
              if (!d || o.cancelled) return "";
              const y = d.getFullYear(),
                  m = String(d.getMonth() + 1).padStart(2, "0"),
                  dd = String(d.getDate()).padStart(2, "0");
              return `${y}-${m}-${dd}`;
          })()}"></td>
          <td></td>`;
                    const actions = tr.lastElementChild;
                    if (a.type === "CANCELLED_WITH_DATE") {
                        const b = document.createElement("button");
                        b.className = "st-btn";
                        b.textContent = "Corriger";
                        b.addEventListener("click", () => {
                            o.deliveryInfo = "—";
                            o.deliveryStatus = "Annulée";
                            o.cancelled = !0;
                            o.lockStatus = !0;
                            o.lockDate = !0;
                            persistOrdersNow();
                            S.dirty = !0;
                            flush();
                            renderAnomalies(host);
                            ensureHeader();
                            refreshCards();
                        });
                        actions.appendChild(b);
                    }
                    const save = document.createElement("button");
                    save.className = "st-btn primary";
                    save.textContent = "Enregistrer";
                    save.addEventListener("click", () => {
                        const sel = tr.querySelector(".st-status").value || "";
                        const di = tr.querySelector(".st-date").value || "";
                        if (sel !== "") {
                            o.deliveryStatus = sel;
                            o.cancelled = /annul/i.test(fold(sel));
                            o.lockStatus = !0;
                        }
                        if (o.cancelled) {
                            o.deliveryInfo = "—";
                            o.lockDate = !0;
                        } else if (di) {
                            const d = new Date(di + "T00:00:00");
                            if (!isNaN(d)) {
                                o.deliveryInfo = fmtFR(d);
                                o.lockDate = !0;
                            }
                        }
                        persistOrdersNow();
                        S.dirty = !0;
                        flush();
                        renderAnomalies(host);
                        ensureHeader();
                        refreshCards();
                    });
                    actions.appendChild(save);
                    const unlock = document.createElement("button");
                    unlock.className = "st-btn";
                    unlock.textContent = "Déverrouiller";
                    unlock.addEventListener("click", () => {
                        o.lockStatus = !1;
                        o.lockDate = !1;
                        persistOrdersNow();
                        S.dirty = !0;
                        flush();
                        renderAnomalies(host);
                    });
                    actions.appendChild(unlock);
                    tb.appendChild(tr);
                }
            }
            host.querySelector("#fixAllCxl").addEventListener("click", () => {
                const n = fixCancelledWithDate();
                if (n) {
                    renderAnomalies(host);
                    ensureHeader();
                    refreshCards();
                }
            });
        }
        function renderSync(host) {
            host.innerHTML = `<h3>Synchronisation</h3><p class="muted" style="margin-top:8px">Synchro mono-onglet, verrou silencieux (aucune alerte si onglet refermé).</p><div style="margin-top:10px"><button id="syncNow" class="st-btn primary">Synchroniser maintenant</button></div>`;
            host.querySelector("#syncNow").addEventListener("click", () => sync(!0));
        }
        function renderData(host) {
            const hidden = S.orders.filter((o) => S.deleted.includes(o.orderID)),
                dlv = S.orders.filter((o) => !S.deleted.includes(o.orderID) && isDelivered(o));
            host.innerHTML = `<h3>Données</h3><div class="st-toolbar" style="flex-wrap:wrap;margin-top:8px"><button id="exCsv" class="st-btn">Exporter CSV</button><button id="unhide" class="st-btn ${hidden.length ? "" : "ghost"}" ${
                hidden.length ? "" : "disabled"
            }>Tout rétablir (${hidden.length})</button><button id="purge" class="st-btn danger">Purger livrées (> ${
                S.settings.hideDeliveredOlderThanDays
            } j)</button></div><div id="zHidden" style="margin-top:12px"></div><div id="zDelivered" style="margin-top:12px"></div>`;
            host.querySelector("#exCsv").addEventListener("click", () => exportCSV(S.orders));
            host.querySelector("#unhide").addEventListener("click", () => {
                S.deleted = [];
                S.dirty = !0;
                flush();
                renderData(host);
                alert("Toutes les commandes masquées ont été rétablies.");
            });
            host.querySelector("#purge").addEventListener("click", () => {
                const cut = Date.now() - S.settings.hideDeliveredOlderThanDays * DAY;
                S.orders = S.orders.filter((o) => {
                    if (!isDelivered(o)) return !0;
                    const d = dateFrom(o.deliveryInfo);
                    return !(d && d.getTime() < cut);
                });
                persistOrdersNow();
                S.dirty = !0;
                flush();
                renderData(host);
                alert("Purge effectuée.");
            });
            renderList(host.querySelector("#zHidden"), hidden, !0);
            renderList(host.querySelector("#zDelivered"), dlv, !1, !0);
            function renderList(m, data, restore) {
                if (!data.length) {
                    m.innerHTML = restore ? "<h4>Masquées</h4><em>Aucune donnée.</em>" : "<h4>Livrées</h4><em>Aucune donnée.</em>";
                    return;
                }
                const t = document.createElement("table");
                t.className = "st-table";
                t.innerHTML = `<thead><tr><th>${restore ? "Masquées" : "Livrées"}</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody></tbody>`;
                const tb = t.querySelector("tbody");
                for (const o of data) {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `<td><a target="_blank" href="https://www.amazon.fr/gp/your-account/order-details?orderID=${o.orderID}">${o.orderID}</a> ${
                        o.lockStatus || o.lockDate ? '<span class="pill" title="Champs verrouillés">🔒</span>' : ""
                    }</td><td>${displayStatus(o)} ${o.cancelled ? '<span class="pill" style="margin-left:6px;border-color:' + S.colors.overdue + ";color:" + S.colors.overdue + '">Annulée</span>' : ""}</td><td>${
                        o.cancelled ? "—" : o.deliveryInfo || "—"
                    }</td><td></td>`;
                    const act = tr.lastElementChild;
                    const b = document.createElement("button");
                    b.className = "st-btn";
                    b.textContent = restore ? "Rétablir" : "Masquer";
                    b.addEventListener("click", () => {
                        if (restore) {
                            S.deleted = S.deleted.filter((id) => id !== o.orderID);
                        } else {
                            if (!S.deleted.includes(o.orderID)) S.deleted.push(o.orderID);
                        }
                        S.dirty = !0;
                        flush();
                        tr.remove();
                    });
                    act.appendChild(b);
                    tb.appendChild(tr);
                }
                m.innerHTML = "";
                m.appendChild(t);
            }
        }
        function renderMaint(host) {
            host.innerHTML = `<h3>Maintenance</h3><div class="st-toolbar" style="flex-wrap:wrap;margin-top:8px"><button id="clean" class="st-btn">Nettoyer données invalides</button><button id="resetOpt" class="st-btn">Réinitialiser options</button><button id="full" class="st-btn danger">Effacer TOUT (données & options)</button></div>`;
            host.querySelector("#clean").addEventListener("click", () => {
                migrate();
                alert("Nettoyage terminé.");
            });
            host.querySelector("#resetOpt").addEventListener("click", () => {
                S.settings = Object.assign({}, DEF_SETTINGS);
                STIDX = null;
                persistSettingsNow();
                alert("Options réinitialisées.");
            });
            host.querySelector("#full").addEventListener("click", () => {
                if (!confirm("Effacer toutes les données et options ?")) return;
                GM_listValues().forEach((k) => GM_deleteValue(k));
                alert("Réinitialisation complète. Recharge la page.");
                location.reload();
            });
        }
        function renderAbout(host) {
            host.innerHTML = `<h3>À propos</h3><p class="muted">Ship tracker Light — v${VER}. “En retard” (colis perdu/retard/désormais attendu), “Prélevé le …” → Livré, parsing fold, modale complète, sync stable, verrous d’édition.</p>`;
        }
        sw("anomalies");
        root.appendChild(card);
        document.body.appendChild(root);
    }
    let changeId = null;
    function newSess() {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    function getSess() {
        try {
            return JSON.parse(GM_getValue(GMK.syncSession, "null"));
        } catch {
            return null;
        }
    }
    function setSess(o) {
        GM_setValue(GMK.syncSession, JSON.stringify(o || {}));
    }
    function setSyncUi(b) {
        const p = document.querySelector("#st-act-sync"),
            m = document.querySelector("#st-sync");
        [p, m].forEach((x) => {
            if (!x) return;
            x.disabled = !!b;
            x.textContent = b ? "Synchronisation…" : "Synchroniser";
        });
    }
    function sync() {
        const now = Date.now(),
            lock = GM_getValue(GMK.syncLock, 0);
        if (lock && now - lock < 90000) {
            setSyncUi(!0);
            return;
        }
        GM_setValue(GMK.syncLock, now);
        setSyncUi(!0);
        if (location.href.includes("/your-orders/orders")) {
            extract();
            correlate();
            ensureHeader();
            refreshCards();
            applyTheme();
            const s = getSess();
            if (s && s.stage === "start") {
                setSess({ id: s.id, stage: "done", startedAt: s.startedAt });
            }
            GM_setValue(GMK.syncLock, 0);
            setSyncUi(!1);
            return;
        }
        const id = newSess();
        setSess({ id, stage: "start", startedAt: now });
        const url = "https://www.amazon.fr/your-orders/orders?ref_=ppx_yo2ov_dt_b_filter_all_y2024",
            w = window.open(url, "ShipTrackerOrdersTab");
        if (!w) {
            alert("Autorise les pop-ups pour synchroniser.");
            GM_setValue(GMK.syncLock, 0);
            setSyncUi(!1);
            return;
        }
        if (changeId !== null) {
            GM_removeValueChangeListener(changeId);
            changeId = null;
        }
        changeId = GM_addValueChangeListener(GMK.syncSession, (k, ov, nv) => {
            try {
                const o = JSON.parse(nv || "null");
                if (!o || o.id !== id) return;
                if (o.stage === "done") {
                    extract();
                    correlate();
                    ensureHeader();
                    refreshCards();
                    applyTheme();
                    GM_setValue(GMK.syncLock, 0);
                    setSyncUi(!1);
                    if (changeId !== null) {
                        GM_removeValueChangeListener(changeId);
                        changeId = null;
                    }
                }
            } catch {}
        });
        setTimeout(() => {
            const s = getSess();
            if (!s || (s.id === id && s.stage !== "done")) {
                GM_setValue(GMK.syncLock, 0);
                setSyncUi(!1);
                if (changeId !== null) {
                    GM_removeValueChangeListener(changeId);
                    changeId = null;
                }
            }
        }, 60000);
    }
    function main() {
        extract();
        correlate();
        ensureHeader();
        applyTheme();
    }
    const debMain = deb(main, 150);
    window.addEventListener("load", () => {
        main();
        const t = document.querySelector("#vvp-orders-table--tbody") || document.body;
        new MutationObserver(debMain).observe(t, { childList: !0, subtree: !0 });
    });
    GM_registerMenuCommand("Ouvrir la modale", openModal);
    GM_registerMenuCommand("Synchroniser maintenant", () => sync(!0));
    GM_registerMenuCommand("Effacer toutes les données", () => {
        if (!confirm("Effacer toutes les données ?")) return;
        GM_listValues().forEach((k) => GM_deleteValue(k));
        alert("Toutes les données ont été effacées.");
        location.reload();
    });
})();
