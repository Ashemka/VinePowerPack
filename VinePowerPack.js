// ==UserScript==
// @name         NEW Amazon Vine — Full Stack Power Pack (Fusion Ashemka 3.27c + VPP 1.9.2)
// @version      4.0.0-fusion
// @description  Fusion : Potluck ASIN + Webhook + Auto-refresh + Échanges/Export PDF (Ashemka)  •  +  •  Pro “Vine Reviews” (pending CS, modèles email, harvest, stats, ratio, jours restants, dark) (VPP)
// @author       Ashemka + Vine Power Pack (fusion)
// @match        https://www.amazon.fr/vine/vine-items?*
// @match        https://www.amazon.fr/vine/*
// @match        https://www.amazon.fr/vine/vine-reviews*
// @match        https://www.amazon.fr/vine/orders*
// @match        https://www.amazon.fr/gp/legacy/order-history?orderFilter=cancelled*
// @match        https://www.amazon.fr/your-orders/orders?*
// @match        https://www.amazon.fr/gp/css/order-history?ref_=nav_orders_first
// @match        https://www.amazon.fr/gp/your-account/order-history/*
// @match        https://www.amazon.fr/vine/account*
// @match        https://www.amazon.fr/gp/profile/*
// @match        https://www.amazon.fr/gp/css/homepage.html?ref_=nav_youraccount_btn
// @match        https://www.amazon.fr/gp/css/homepage.html?ref_=nav_AccountFlyout_ya
// @match        https://www.amazon.fr/gp/buy/thankyou*
// @match  https://www.amazon.fr/review/create-review*
// @match  https://www.amazon.fr/review/create-review/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      amazon.fr
// @updateurl https://raw.githubusercontent.com/Ashemka/VinePowerPack/main/VinePowerPack.users.js
// @downloadurl https://raw.githubusercontent.com/Ashemka/VinePowerPack/main/VinePowerPack.users.js
// @connect      *
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// ==/UserScript==

// ——————————————————————————————————————————————————————————
//  Toggles (si besoin de désactiver un module sans éditer le code)
// ——————————————————————————————————————————————————————————
const ENABLE_ASHEMKA = true;
const ENABLE_VPP = true;

// ——————————————————————————————————————————————————————————
//  MODULE 1 : FULL STACK Ashemka (3.27c compact)
//  (Léger fix : suppression d’un double-binding des boutons PDF)
// ——————————————————————————————————————————————————————————
if (ENABLE_ASHEMKA)
    (function () {
        "use strict";
        const d = document,
            w = window,
            byId = (id) => d.getElementById(id),
            $ = (sel) => d.querySelector(sel),
            $$ = (sel) => Array.from(d.querySelectorAll(sel));
        const isPotluckPage = () => {
            try {
                const u = new URL(location.href);
                return u.pathname.includes("/vine/vine-items") && u.searchParams.get("queue") === "potluck";
            } catch {
                return !1;
            }
        };
        let darkMode = GM_getValue("darkMode", !1),
            showClock = GM_getValue("showClock", !0),
            showRefreshCountdown = GM_getValue("showRefreshCountdown", !0);
        let clockAutomationActive = GM_getValue("clockAutomationActive", !1),
            enableAutoRefresh = GM_getValue("enableAutoRefresh", !1),
            autoLoadPotluck = GM_getValue("autoLoadPotluck", !1);
        let webhookUrl = GM_getValue("webhookUrl", ""),
            enableWebhook = GM_getValue("enableWebhook", !0),
            limitWebhookTrigger = GM_getValue("limitWebhookTrigger", !1),
            webhookTriggerInterval = GM_getValue("webhookTriggerInterval", 6e5),
            webhookLastTriggeredKey = "webhookLastTriggeredTime";
        let refreshSchedules = GM_getValue("refreshSchedules", [
            { enabled: !1, start: "00:00", end: "04:00", min: 10, max: 40 },
            { enabled: !1, start: "04:00", end: "06:00", min: 15, max: 45 },
            { enabled: !1, start: "06:00", end: "12:00", min: 20, max: 59 },
            { enabled: !1, start: "12:00", end: "18:00", min: 30, max: 59 },
        ]);
        const LS = "ashemka.vine.",
            LS_LAST_VALUE = LS + "lastKnownValue",
            LS_LAST_VALUE_TIME = LS + "lastKnownValueTime",
            LS_CHANGE_LOG = LS + "changeLog",
            LS_LAST_ZERO_TIME = LS + "lastZeroLogTime",
            LS_LAST_ASINS = LS + "lastASINs",
            LS_EVER_SEEN = LS + "everSeenASINs",
            LS_FLAP_TIMES = LS + "asinFlapTimes",
            LS_AVAIL = "availableProducts",
            FLAP_TTL_MS = 4e3;
        let refreshTimeout = null,
            nextRefreshTime = null;
        console.info("[Ashemka] Boot", { clockAutomationActive, enableAutoRefresh, showClock, showRefreshCountdown });

        GM_addStyle(`:root{--as-accent:#17a2b8;--as-green:#2e7d32;--as-red:#c62828;--as-border:3px;--as-z:2147483647}
.ashemka-container{position:fixed;top:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;z-index:var(--as-z)}
.ashemka-icon-wrap{display:flex;gap:10px}
.ashemka-icon{width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;user-select:none;border:var(--as-border) solid var(--as-green);border-radius:10px;backdrop-filter:saturate(1.2) blur(4px);background:rgba(255,255,255,.6);box-shadow:0 2px 10px rgba(0,0,0,.15)}
.ashemka-icon.active{border-color:var(--as-red)}
.ashemka-tooltip{position:absolute;display:none;z-index:var(--as-z);background:#111;color:#fff;padding:6px 8px;border-radius:8px;font-size:12px;box-shadow:0 4px 18px rgba(0,0,0,.3)}
.ashemka-chip{height:48px;min-width:120px;padding:0 12px;display:flex;align-items:center;justify-content:center;border:var(--as-border) solid #ddd;border-radius:10px;background:#000;color:#fff;font-weight:700;letter-spacing:.5px;box-shadow:0 2px 10px rgba(0,0,0,.15)}
.ashemka-countdown{display:none}
.ashemka-modal{position:fixed;inset:0;display:none;place-items:center;z-index:var(--as-z);background:rgba(0,0,0,.35)}
.ashemka-panel{width:min(980px,96vw);max-height:88vh;display:flex;flex-direction:column;border-radius:16px;overflow:hidden;background:rgba(255,255,255,.88);backdrop-filter:saturate(1.1) blur(10px);box-shadow:0 20px 60px rgba(0,0,0,.35);color:#111}
.ashemka-header{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg, rgba(23,162,184,.15), rgba(0,0,0,0));border-bottom:1px solid rgba(0,0,0,.06)}
.ashemka-body{padding:16px 18px;display:grid;gap:14px;overflow:auto}
.as-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.as-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.as-card{padding:12px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:rgba(255,255,255,.95)}
.as-label{font-weight:600;font-size:13px;opacity:.9}
.as-note{font-size:12px;opacity:.7}
.as-input,.as-select{min-height:36px;border:1px solid #ccc;border-radius:10px;padding:6px 10px;width:100%;background:#fff;color:#111}
.as-toggle{transform:scale(1.1)}
.as-footer{padding:12px 18px;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid rgba(0,0,0,.06);background:rgba(255,255,255,.75)}
.as-btn{padding:10px 14px;border:none;border-radius:10px;cursor:pointer;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.12)}
.as-btn.save{background:var(--as-green);color:#fff}.as-btn.close{background:var(--as-red);color:#fff}.as-btn.ghost{background:var(--as-accent);color:#fff}
.as-sched-header{display:flex;align-items:center;justify-content:space-between;gap:10px}
.as-sched-body{display:none;gap:8px}.as-sched-body.open{display:grid;gap:10px}
.as-sched-row{display:grid;align-items:center;gap:8px;grid-template-columns:auto auto 140px auto 140px auto 100px auto 100px}
.as-input.time{max-width:140px}.as-input.mins{max-width:100px}
.as-accord-body{display:none}.as-accord-body.open{display:block}
.as-list{margin-top:10px}.as-list-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:rgba(255,255,255,.9)}.as-list-item+.as-list-item{margin-top:8px}
.as-list-item a{color:inherit;text-decoration:none}.as-list-item a:hover{color:#007bff}
.ashemka-panel.as-dark{background:rgba(20,20,22,.95);color:#e9e9e9}
.as-dark .ashemka-header{background:linear-gradient(135deg, rgba(23,162,184,.2), rgba(0,0,0,0));border-bottom-color:#2b2f36}
.as-dark .as-card{background:#1d1f23;border-color:#2b2f36}
.as-dark .as-label{color:#e9e9e9;opacity:.95}.as-dark .as-note{color:#b6beca;opacity:.95}
.as-dark .as-input,.as-dark .as-select{background:#101214;color:#e9e9e9;border-color:#3a3f46}
.as-dark .as-btn{box-shadow:0 2px 10px rgba(0,0,0,.4)}.as-dark .as-btn.ghost{background:#1b6d79;color:#fff}.as-dark .as-btn.save{background:#2e7d32}.as-dark .as-btn.close{background:#c62828}
.as-dark .as-list-item{background:#171a1e;border-color:#2b2f36}`);

        // helpers
        const getLS = (k, f = null) => {
                try {
                    const v = localStorage.getItem(k);
                    return v ? JSON.parse(v) : f;
                } catch {
                    return f;
                }
            },
            setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        function tip(t) {
            const e = d.createElement("div");
            e.className = "ashemka-tooltip";
            e.textContent = t;
            d.body.appendChild(e);
            return e;
        }
        function icon(lbl, tt, on) {
            const el = d.createElement("div");
            el.className = "ashemka-icon";
            el.textContent = lbl;
            el.addEventListener("click", on);
            const t = tip(tt);
            el.addEventListener("mouseenter", () => {
                const r = el.getBoundingClientRect();
                t.style.left = `${r.left + scrollX}px`;
                t.style.top = `${r.bottom + 6 + scrollY}px`;
                t.style.display = "block";
            });
            el.addEventListener("mouseleave", () => (t.style.display = "none"));
            return el;
        }
        function purgeKnownASINs({ alsoResetSnapshot = !1 } = {}) {
            setLS(LS_EVER_SEEN, []);
            if (alsoResetSnapshot) setLS(LS_LAST_ASINS, []);
            console.info("[Ashemka] Purge: everSeen" + (alsoResetSnapshot ? " + snapshot" : ""));
            GM_notification && GM_notification({ title: "Ashemka", text: `ASIN connus purgés${alsoResetSnapshot ? " + snapshot" : ""}.`, timeout: 4e3 });
        }

        // top bar
        const container = d.createElement("div");
        container.className = "ashemka-container";
        const clockBox = d.createElement("div");
        clockBox.className = "ashemka-chip";
        clockBox.title = "Horloge";
        const icons = d.createElement("div");
        icons.className = "ashemka-icon-wrap";
        const countdown = d.createElement("div");
        countdown.className = "ashemka-chip ashemka-countdown";
        container.append(clockBox, icons, countdown);
        d.body.appendChild(container);

        // modal
        const modal = d.createElement("div");
        modal.className = "ashemka-modal";
        modal.innerHTML = `
<div class="ashemka-panel">
  <div class="ashemka-header"><div style="font-weight:800;">Paramètres Ashemka</div><div class="as-note" id="lastValueDisplay"></div></div>
  <div class="ashemka-body">
    <div class="as-grid-2">
      <div class="as-card">
        <div class="as-row" style="justify-content:space-between;"><span class="as-label">Webhook</span><span class="as-note">POST JSON à chaque changement</span></div>
        <div class="as-row"><label><input type="checkbox" id="cb_webhook" class="as-toggle"> Activer</label><label><input type="checkbox" id="cb_webhook_limit" class="as-toggle"> Limiter fréquence</label><input id="in_webhook_iv" class="as-input" type="number" min="1" style="max-width:120px"></div>
        <div class="as-row"><input id="in_webhook_url" class="as-input" type="text" placeholder="https://..."></div>
        <div class="as-row"><button id="btn_webhook_test" class="as-btn ghost">Tester Webhook</button><button id="btn_webhook_clear" class="as-btn ghost" style="background:#607d8b;">Effacer URL</button></div>
      </div>
      <div class="as-card"><div class="as-label">Affichage</div>
        <div class="as-row"><label><input type="checkbox" id="cb_clock" class="as-toggle"> Horloge</label><label><input type="checkbox" id="cb_countdown" class="as-toggle"> Décompte rafraîch.</label><label><input type="checkbox" id="cb_dark" class="as-toggle"> Mode sombre (modale)</label></div>
      </div>
    </div>
    <div class="as-card">
      <div class="as-label">Données Potluck</div>
      <div class="as-row"><button id="btn_purge_everseen" class="as-btn close" style="background:#e53935;">Purger ASIN connus</button><button id="btn_purge_everseen_snapshot" class="as-btn" style="background:#8e24aa;color:#fff;">Purger ASIN + snapshot</button></div>
      <div class="as-note">“Purger ASIN connus” vide seulement la mémoire des ASIN déjà vus (brand_new réévalué).<br>“+ snapshot” force le prochain scan à marquer tous les ASIN affichés comme “added”.</div>
    </div>
    <div class="as-card">
      <div class="as-sched-header"><div class="as-label">Échanges (Produits disponibles)</div><button id="btn_avail_toggle" class="as-btn ghost" style="padding:6px 10px;">Afficher</button></div>
      <div class="as-accord-body" id="avail_body">
        <div class="as-row" style="margin:8px 0 4px 0;"><button id="btn_export_pdf" class="as-btn ghost">Exporter PDF</button><button id="btn_clear_avail" class="as-btn close" style="background:#e53935;">Effacer données</button></div>
        <div id="avail_list" class="as-list"></div>
        <div class="as-note" style="margin-top:6px;">La liste “Disponible” est stockée localement. Sur la page Orders, les lignes marquées sont surlignées en vert.</div>
      </div>
    </div>
    <div class="as-card">
      <div class="as-sched-header"><div class="as-label">Plages de rafraîchissement (Potluck)</div><button id="btn_sched_toggle" class="as-btn ghost" style="padding:6px 10px;">Afficher</button></div>
      <div class="as-sched-body" id="sched_body"></div><div class="as-note" style="margin-top:6px;">Heures HH:MM ; Min/Max en minutes. Intervalle tiré dans [min,max].</div>
    </div>
  </div>
  <div class="as-footer"><button id="btn_save" class="as-btn save">Enregistrer</button><button id="btn_close" class="as-btn close">Fermer</button></div>
</div>`;
        d.body.appendChild(modal);

        // hydrate modal
        (() => {
            byId("cb_webhook").checked = enableWebhook;
            byId("cb_webhook_limit").checked = limitWebhookTrigger;
            byId("in_webhook_iv").value = Math.max(1, Math.round(webhookTriggerInterval / 6e4));
            byId("in_webhook_url").value = webhookUrl;
            byId("cb_clock").checked = showClock;
            byId("cb_countdown").checked = showRefreshCountdown;
            byId("cb_dark").checked = darkMode;
        })();

        function openModal() {
            modal.style.display = "grid";
            updateLastValueDisplay();
            applyThemePanel();
        }
        function closeModal() {
            modal.style.display = "none";
        }
        function renderSchedules() {
            const body = byId("sched_body");
            if (!body) return;
            body.innerHTML = "";
            refreshSchedules.forEach((s, i) => {
                const row = d.createElement("div");
                row.className = "as-sched-row";
                row.innerHTML = `<label><input type="checkbox" id="sc_en_${i}" class="as-toggle" ${s.enabled ? "checked" : ""}> Plage ${
                    i + 1
                }</label><span>de</span><input type="time" step="900" id="sc_start_${i}" class="as-input time" value="${s.start}"><span>à</span><input type="time" step="900" id="sc_end_${i}" class="as-input time" value="${
                    s.end
                }"><span>min</span><input type="number" id="sc_min_${i}" class="as-input mins" value="${s.min}" min="1"><span>max</span><input type="number" id="sc_max_${i}" class="as-input mins" value="${s.max}" min="1">`;
                body.appendChild(row);
            });
        }
        (() => {
            const btnS = byId("btn_sched_toggle"),
                bodyS = byId("sched_body");
            let open = refreshSchedules.some((s) => s.enabled);
            const sync = () => {
                bodyS.classList.toggle("open", open);
                btnS.textContent = open ? "Masquer" : "Afficher";
            };
            btnS.addEventListener("click", () => {
                open = !open;
                sync();
            });
            sync();
            renderSchedules();
            const btnA = byId("btn_avail_toggle"),
                bodyA = byId("avail_body");
            let o2 = !1;
            const s2 = () => {
                bodyA.classList.toggle("open", o2);
                btnA.textContent = o2 ? "Masquer" : "Afficher";
            };
            btnA.addEventListener("click", () => {
                o2 = !o2;
                s2();
                if (o2) updateAvailListInModal();
            });
            s2();
        })();
        function updateLastValueDisplay() {
            const el = byId("lastValueDisplay"),
                v = getLastValue(),
                ts = new Date(getLastValueTime());
            el.textContent = `Dernière valeur: ${v} — ${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`;
        }

        byId("btn_close").addEventListener("click", closeModal);
        byId("btn_save").addEventListener("click", () => {
            enableWebhook = byId("cb_webhook").checked;
            limitWebhookTrigger = byId("cb_webhook_limit").checked;
            webhookTriggerInterval = Math.max(1, parseInt(byId("in_webhook_iv").value || "10", 10)) * 6e4;
            webhookUrl = byId("in_webhook_url").value.trim();
            showClock = byId("cb_clock").checked;
            showRefreshCountdown = byId("cb_countdown").checked;
            darkMode = byId("cb_dark").checked;
            refreshSchedules = refreshSchedules.map((s, i) => ({
                enabled: byId(`sc_en_${i}`).checked,
                start: byId(`sc_start_${i}`).value || "00:00",
                end: byId(`sc_end_${i}`).value || "00:00",
                min: Math.max(1, parseInt(byId(`sc_min_${i}`).value, 10) || 1),
                max: Math.max(1, parseInt(byId(`sc_max_${i}`).value, 10) || 1),
            }));
            GM_setValue("enableWebhook", enableWebhook);
            GM_setValue("limitWebhookTrigger", limitWebhookTrigger);
            GM_setValue("webhookTriggerInterval", webhookTriggerInterval);
            GM_setValue("webhookUrl", webhookUrl);
            GM_setValue("showClock", showClock);
            GM_setValue("showRefreshCountdown", showRefreshCountdown);
            GM_setValue("darkMode", darkMode);
            GM_setValue("refreshSchedules", refreshSchedules);
            clockBox.style.display = showClock ? "flex" : "none";
            countdown.style.display = enableAutoRefresh && showRefreshCountdown ? "flex" : "none";
            closeModal();
        });
        byId("btn_webhook_test").addEventListener("click", () => triggerWebhook({ event: "test", now: new Date().toISOString(), note: "test modale" }, !0));
        byId("btn_webhook_clear").addEventListener("click", () => {
            GM_setValue("webhookUrl", "");
            byId("in_webhook_url").value = "";
            alert("Webhook effacé");
        });
        byId("btn_purge_everseen").addEventListener("click", () => {
            if (confirm("Purger la liste des ASIN connus (everSeen) ?")) purgeKnownASINs({ alsoResetSnapshot: !1 });
        });
        byId("btn_purge_everseen_snapshot").addEventListener("click", () => {
            if (confirm("Purger ASIN connus + snapshot courant ?")) purgeKnownASINs({ alsoResetSnapshot: !0 });
        });

        // ÉCHANGES
        const getAvail = () => getLS(LS_AVAIL, {}) || {},
            setAvail = (m) => setLS(LS_AVAIL, m || {}),
            asinFromUrl = (u) => {
                const m = u.match(/\/dp\/([A-Z0-9]{10})/i);
                return m ? m[1].toUpperCase() : null;
            },
            cleanName = (s) =>
                s
                    .normalize("NFKD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 72);
        function updateAvailListInModal() {
            const list = byId("avail_list");
            if (!list) return;
            list.innerHTML = "";
            const map = getAvail(),
                items = Object.values(map);
            if (!items.length) {
                const e = d.createElement("div");
                e.className = "as-note";
                e.textContent = 'Aucun produit marqué "Disponible".';
                list.appendChild(e);
                return;
            }
            items.forEach((p) => {
                const row = d.createElement("div");
                row.className = "as-list-item";
                const a = d.createElement("a");
                a.href = p.url;
                a.target = "_blank";
                a.textContent = p.name || p.url;
                const b = d.createElement("button");
                b.className = "as-btn close";
                b.textContent = "Supprimer";
                b.addEventListener("click", () => {
                    const asin = asinFromUrl(p.url),
                        m = getAvail();
                    if (asin && m[asin]) {
                        delete m[asin];
                        setAvail(m);
                    }
                    if (location.pathname.startsWith("/vine/orders")) {
                        $$(".vvp-orders-table--row").forEach((r) => {
                            const L = r.querySelector(".a-link-normal");
                            if (L && L.href === p.url) {
                                r.style.backgroundColor = "";
                                r.classList.remove("available");
                            }
                        });
                    }
                    updateAvailListInModal();
                });
                row.append(a, b);
                list.appendChild(row);
            });
        }
        function clearAvail() {
            if (!confirm("Effacer toutes les disponibilités enregistrées ?")) return;
            localStorage.removeItem(LS_AVAIL);
            if (location.pathname.startsWith("/vine/orders")) {
                $$(".vvp-orders-table--row").forEach((r) => {
                    r.style.backgroundColor = "";
                    r.classList.remove("available");
                });
            }
            updateAvailListInModal();
            alert('Données "Échanges" effacées.');
        }
        const ts = () => {
            const x = new Date(),
                z = (n) => String(n).padStart(2, "0");
            return `${z(x.getDate())}-${z(x.getMonth() + 1)}-${x.getFullYear()} ${z(x.getHours())}-${z(x.getMinutes())}-${z(x.getSeconds())}`;
        };
        function exportPDF() {
            const map = getAvail(),
                arr = Object.values(map);
            if (!arr.length) {
                alert("Aucun produit disponible à exporter.");
                return;
            }
            const { jsPDF } = w.jspdf,
                doc = new jsPDF({ orientation: "landscape" });
            let y = 20,
                ph = doc.internal.pageSize.getHeight(),
                m = 10,
                c1 = m,
                c2 = 160,
                c3 = 210,
                lh = 8;
            doc.setFontSize(12);
            doc.text("Produits Disponibles", c1, y);
            y += 10;
            doc.setFontSize(10);
            doc.text("Nom du Produit", c1, y);
            doc.text("Prix", c2, y);
            doc.text("URL", c3, y);
            y += 10;
            arr.forEach((p) => {
                if (y > ph - m) {
                    doc.addPage();
                    y = m;
                }
                doc.text(String(p.name || ""), c1, y);
                doc.text(String(p.price || ""), c2, y);
                doc.textWithLink(p.url, c3, y, { url: p.url, target: "_blank" });
                y += lh;
            });
            if (y > ph - m) {
                doc.addPage();
                y = m;
            }
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            y += 10;
            if (y > ph - m) {
                doc.addPage();
                y = m;
            }
            doc.text("SOUS RÉSERVE D'ÉCHANGE EN COURS OU D'ERREUR DE STOCK", m, y);
            doc.save(`Liste de produits ${ts()}.pdf`);
        }
        byId("btn_export_pdf").addEventListener("click", exportPDF);
        byId("btn_clear_avail").addEventListener("click", clearAvail);

        // thème
        function applyThemePanel() {
            const p = $(".ashemka-panel");
            if (!p) return;
            p.classList.toggle("as-dark", !!darkMode);
        }

        // icônes
        const icoAlarm = icon("🔔", "Automatisation horloge (navigate aux minutes clés)", () => {
            clockAutomationActive = !clockAutomationActive;
            GM_setValue("clockAutomationActive", clockAutomationActive);
            icoAlarm.classList.toggle("active", clockAutomationActive);
            console.info("[Ashemka] Clock automation:", clockAutomationActive);
        });
        const icoRefresh = icon("🗘", "Auto-refresh Potluck selon plages", () => {
            if (!isPotluckPage()) return;
            enableAutoRefresh = !enableAutoRefresh;
            GM_setValue("enableAutoRefresh", enableAutoRefresh);
            icoRefresh.classList.toggle("active", enableAutoRefresh);
            countdown.style.display = enableAutoRefresh && showRefreshCountdown ? "flex" : "none";
            if (enableAutoRefresh) {
                console.info("[Ashemka] scheduleRefresh()");
                scheduleRefresh();
            } else {
                console.info("[Ashemka] Auto-refresh OFF");
                clearTimeout(refreshTimeout);
                nextRefreshTime = null;
            }
        });
        const icoSettings = icon("⚙️", "Paramètres", openModal);
        icons.append(icoAlarm, icoRefresh, icoSettings);
        icoAlarm.classList.toggle("active", clockAutomationActive);
        console.info("[Ashemka] Clock automation (rehydrated):", clockAutomationActive);

        // clock & countdown
        function startClock() {
            const tick = () => {
                clockAutomationActive = GM_getValue("clockAutomationActive", clockAutomationActive);
                const n = new Date(),
                    hh = String(n.getHours()).padStart(2, "0"),
                    mm = String(n.getMinutes()).padStart(2, "0"),
                    ss = String(n.getSeconds()).padStart(2, "0");
                clockBox.textContent = `${hh}:${mm}:${ss}`;
                if (clockAutomationActive) {
                    if ((mm === "59" && ss === "55") || (mm === "00" && ss === "00") || (mm === "23" && ss === "00")) {
                        if (isPotluckPage()) {
                            console.info("[Ashemka] Clock automation: reload");
                            location.reload();
                        } else if (autoLoadPotluck) {
                            console.info("[Ashemka] Clock automation: goto Potluck");
                            location.href = "https://www.amazon.fr/vine/vine-items?queue=potluck";
                        }
                    }
                }
            };
            tick();
            setInterval(tick, 1e3);
        }
        function startCountdown() {
            const tick = () => {
                if (!enableAutoRefresh || !showRefreshCountdown) {
                    countdown.textContent = "";
                    return;
                }
                if (!nextRefreshTime) {
                    countdown.textContent = "Aucune plage active";
                    return;
                }
                const left = nextRefreshTime - Date.now();
                if (left <= 0) {
                    countdown.textContent = "";
                    return;
                }
                const m = String(Math.floor((left / 1e3 / 60) % 60)).padStart(2, "0"),
                    s = String(Math.floor((left / 1e3) % 60)).padStart(2, "0");
                countdown.textContent = `Prochain refresh: ${m}:${s}`;
            };
            tick();
            setInterval(tick, 1e3);
        }
        clockBox.style.display = showClock ? "flex" : "none";
        countdown.style.display = enableAutoRefresh && showRefreshCountdown ? "flex" : "none";
        startClock();
        startCountdown();

        // Potluck by ASIN
        function gridASINs() {
            const grid = byId("vvp-items-grid");
            if (!grid) {
                console.warn("[Ashemka] #vvp-items-grid introuvable");
                return [];
            }
            const items = $$(".vvp-item-tile"),
                as = [];
            items.forEach((el, i) => {
                let a = null;
                const A = el.querySelector('a[href*="/dp/"]');
                if (A) {
                    const h = A.getAttribute("href") || A.href || "",
                        m = h.match(/\/dp\/([A-Z0-9]{10})/i);
                    if (m) a = m[1].toUpperCase();
                }
                if (!a) {
                    const d = el.querySelector("[data-asin]"),
                        attr = d?.getAttribute("data-asin");
                    if (attr && /^[A-Z0-9]{10}$/i.test(attr)) a = attr.toUpperCase();
                }
                if (!a) {
                    const t = el.textContent || "",
                        m2 = t.match(/\b(B0[0-9A-Z]{8})\b/i);
                    if (m2) a = m2[1].toUpperCase();
                }
                if (a) as.push(a);
                else console.debug("[Ashemka] ASIN non trouvé index", i, el);
            });
            const u = [...new Set(as)];
            console.groupCollapsed("[Ashemka] getGridASINs()");
            console.info("Items:", items.length, "ASINs uniques:", u.length);
            u.length && console.table(u.map((x) => ({ ASIN: x })));
            console.groupEnd();
            return u;
        }
        const jget = (k, f) => getLS(k, f),
            getLastASINs = () => jget(LS_LAST_ASINS, []),
            setLastASINs = (a) => setLS(LS_LAST_ASINS, [...new Set(a)]),
            getEverSeenSet = () => new Set(jget(LS_EVER_SEEN, [])),
            setEverSeenASINs = (a) => setLS(LS_EVER_SEEN, [...new Set(a)]),
            getFlapTimes = () => jget(LS_FLAP_TIMES, {}),
            setFlapTimes = (m) => setLS(LS_FLAP_TIMES, m),
            allowedChange = (a, t) => {
                const m = getFlapTimes(),
                    L = m[a] ? new Date(m[a]).getTime() : 0;
                return t - L >= FLAP_TTL_MS;
            },
            markChanged = (arr, t) => {
                const m = getFlapTimes();
                arr.forEach((a) => (m[a] = new Date(t).toISOString()));
                setFlapTimes(m);
            },
            getLastValue = () => parseInt(localStorage.getItem(LS_LAST_VALUE) || "0", 10),
            getLastValueTime = () => localStorage.getItem(LS_LAST_VALUE_TIME) || new Date().toISOString(),
            setLastValue = (v) => {
                const old = getLastValue(),
                    diff = v - old;
                localStorage.setItem(LS_LAST_VALUE, String(v));
                localStorage.setItem(LS_LAST_VALUE_TIME, new Date().toISOString());
                updateLastValueDisplay();
                logChange(v, diff);
            },
            logChange = (value, diff) => {
                const logs = getLS(LS_CHANGE_LOG, []),
                    now = new Date(),
                    e = { date: now.toLocaleDateString(), time: now.toLocaleTimeString(), value, diff };
                if (value === 0) {
                    const l = localStorage.getItem(LS_LAST_ZERO_TIME);
                    if (l && now - new Date(l) < 36e5) return;
                    localStorage.setItem(LS_LAST_ZERO_TIME, now.toISOString());
                }
                logs.push(e);
                setLS(LS_CHANGE_LOG, logs);
            };
        function triggerWebhook(payload, isTest = !1) {
            if (!webhookUrl) {
                alert("Attention, aucun webhook saisi !");
                return;
            }
            const now = new Date(),
                last = new Date(GM_getValue(webhookLastTriggeredKey, 0));
            if (limitWebhookTrigger && !isTest && now - last < webhookTriggerInterval) {
                console.info("[Ashemka] Webhook ignoré (limite)");
                return;
            }
            console.groupCollapsed("[Ashemka] Webhook POST");
            console.info("URL:", webhookUrl);
            console.info("Payload:", payload);
            console.groupEnd();
            GM_xmlhttpRequest({
                method: "POST",
                url: webhookUrl,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify(payload),
                timeout: 1e4,
                onload: () => console.info("[Ashemka] Webhook OK"),
                onerror: (e) => console.warn("[Ashemka] Webhook erreur", e),
                ontimeout: () => console.warn("[Ashemka] Webhook timeout"),
            });
            GM_setValue(webhookLastTriggeredKey, now.toISOString());
        }
        function checkValue() {
            if (!isPotluckPage()) return;
            const cur = gridASINs().sort(),
                prev = getLastASINs().sort(),
                S = new Set(cur),
                P = new Set(prev),
                added = cur.filter((a) => !P.has(a)),
                removed = prev.filter((a) => !S.has(a));
            console.groupCollapsed("[Ashemka] checkValue() Δ");
            console.info("previous:", prev.length, "current:", cur.length);
            added.length && console.info("ADDED:", added.length), added.length && console.table(added.map((a) => ({ ASIN: a })));
            removed.length && console.info("REMOVED:", removed.length), removed.length && console.table(removed.map((a) => ({ ASIN: a })));
            console.groupEnd();
            setLastValue(cur.length);
            const ever = getEverSeenSet(),
                brandNew = added.filter((a) => !ever.has(a)),
                reap = added.filter((a) => ever.has(a));
            setEverSeenASINs([...ever, ...cur]);
            setLastASINs(cur);
            const now = Date.now(),
                bn = brandNew.filter((a) => allowedChange(a, now)),
                rp = reap.filter((a) => allowedChange(a, now)),
                rm = removed.filter((a) => allowedChange(a, now));
            markChanged([...bn, ...rp, ...rm], now);
            if (enableWebhook && (bn.length || rp.length))
                triggerWebhook({
                    event: "potluck_update",
                    page: location.href,
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    timestamp: new Date().toISOString(),
                    total: cur.length,
                    diff: cur.length - prev.length,
                    brand_new_asins: bn,
                    reappeared_asins: rp,
                    removed_asins: rm,
                });
        }
        function observePotluckGrid() {
            const grid = byId("vvp-items-grid");
            if (!grid) {
                console.warn("[Ashemka] observePotluckGrid: grid introuvable");
                return;
            }
            const mo = new MutationObserver(() => {
                clearTimeout(grid.__asdebounce);
                grid.__asdebounce = setTimeout(checkValue, 150);
            });
            mo.observe(grid, { childList: !0, subtree: !0 });
            console.info("[Ashemka] MutationObserver actif sur #vvp-items-grid");
        }

        // auto-refresh
        function refreshInterval() {
            const now = new Date(),
                m = now.getHours() * 60 + now.getMinutes();
            for (const s of refreshSchedules) {
                if (!s.enabled) continue;
                const [sh, sm] = s.start.split(":").map(Number),
                    [eh, em] = s.end.split(":").map(Number),
                    S = sh * 60 + sm,
                    E = eh * 60 + em;
                if (m >= S && m < E) {
                    const a = s.min * 6e4,
                        b = s.max * 6e4,
                        v = Math.floor(Math.random() * (b - a + 1)) + a;
                    console.info("[Ashemka] Plage active", s.start, "→", s.end, "→", Math.round(v / 1e3), "s");
                    return v;
                }
            }
            console.info("[Ashemka] Aucune plage active");
            return null;
        }
        function scheduleRefresh() {
            clearTimeout(refreshTimeout);
            const it = refreshInterval();
            if (it != null) {
                nextRefreshTime = new Date(Date.now() + it);
                console.info("[Ashemka] Prochain refresh à", nextRefreshTime.toLocaleTimeString());
                refreshTimeout = setTimeout(() => location.reload(), it);
            } else {
                nextRefreshTime = null;
                refreshTimeout = setTimeout(scheduleRefresh, 6e4);
            }
        }

        // Orders: colonne Échange + boutons
        function addExchangeHeader() {
            const hr = $(".vvp-orders-table--heading-row");
            if (!hr) return;
            const th = d.createElement("th");
            th.innerText = "Échange";
            th.className = "vvp-orders-table--text-col vvp-text-align-right";
            const i = Math.min(4, hr.children.length);
            hr.insertBefore(th, hr.children[i] || null);
        }
        function addExchangeButtons() {
            const rows = $$(".vvp-orders-table--row");
            let map = getAvail();
            rows.forEach((row) => {
                const nm = row.querySelector(".a-truncate-full, .a-truncate-cut"),
                    pr = row.querySelector(".vvp-orders-table--text-col.vvp-text-align-right"),
                    lk = row.querySelector(".a-link-normal");
                if (!nm || !pr || !lk) return;
                const td = d.createElement("td");
                td.className = "vvp-orders-table--text-col vvp-text-align-right";
                const btn = d.createElement("a");
                btn.innerText = "Disponible";
                btn.className = "a-button a-button-base";
                btn.style.padding = "0 10px";
                const url = lk.href,
                    asin = asinFromUrl(url);
                if (!asin) return;
                const name = cleanName(nm.innerText.trim()),
                    price = (pr.innerText || "").trim().replace(/[^\d,]/g, "");
                if (map[asin]) {
                    row.style.backgroundColor = "rgba(144,238,144,.3)";
                    row.classList.add("available");
                }
                btn.addEventListener("click", () => {
                    const on = row.classList.toggle("available"),
                        m = getAvail();
                    if (on) {
                        m[asin] = { name, price, url };
                        row.style.backgroundColor = "rgba(144,238,144,.3)";
                    } else {
                        delete m[asin];
                        row.style.backgroundColor = "";
                    }
                    setAvail(m);
                    updateAvailListInModal();
                });
                td.appendChild(btn);
                const i = Math.min(4, row.children.length);
                row.insertBefore(td, row.children[i] || null);
            });
        }

        // menus
        if (typeof GM_registerMenuCommand !== "undefined") {
            GM_registerMenuCommand("Ashemka — Ouvrir Paramètres", openModal);
            GM_registerMenuCommand("Ashemka — Purger ASIN connus (everSeen)", () => purgeKnownASINs());
            GM_registerMenuCommand("Ashemka — Purger ASIN connus + snapshot", () => purgeKnownASINs({ alsoResetSnapshot: !0 }));
            GM_registerMenuCommand("Ashemka — Reset complet (prefs + LS)", () => {
                if (confirm("Tout réinitialiser (GM + localStorage) ?")) {
                    GM_listValues().forEach((k) => GM_deleteValue(k));
                    localStorage.clear();
                    location.reload();
                }
            });
        }

        // start
        w.addEventListener("load", () => {
            const potluckTab = $("li#vvp-vine-items-tab a");
            if (potluckTab) potluckTab.href = "https://www.amazon.fr/vine/vine-items?queue=potluck";
            if (isPotluckPage()) {
                setTimeout(checkValue, 150);
                observePotluckGrid();
                icoRefresh.classList.toggle("active", enableAutoRefresh);
                if (enableAutoRefresh) scheduleRefresh();
            }
            if (location.pathname.startsWith("/vine/orders")) {
                addExchangeHeader();
                addExchangeButtons();
            }
        });

        // (Fix fusion) — on garde un seul binding pour ces boutons, déjà fait plus haut
        // (Pas de doublon ici)
    })();

// ——————————————————————————————————————————————————————————
//  MODULE 2 : Vine Power Pack — v1.9.2 (+ Submit tracking, bouton vert, “Soumis”)
// ——————————————————————————————————————————————————————————
if (ENABLE_VPP)
    (function () {
        "use strict";

        /* ========== LOGS ========== */
        let DEBUG = !!GM_getValue("vp_debug", false);
        const log = (...a) => {
                if (DEBUG) console.log("[VPP]", ...a);
            },
            warn = (...a) => console.warn("[VPP]", ...a);

        /* ========== CONSTS ========== */
        const ASIN_REGEX = /\b(B0[A-Z0-9]{8})\b/;
        const MS_PER_DAY = 86400000;
        const ORPHAN_GRACE_DAYS = 7,
            WINDOW_COMPLETED_MATCH_DAYS = 2,
            EVAL_SELECTOR = "#vvp-evaluation-period-tooltip-trigger";

        /* ========== INTERACTION GUARD ========== */
        let VP_INTERACTING = false,
            VP_INTERACT_TOUT = null;
        function vpStartInteract() {
            VP_INTERACTING = true;
            if (VP_INTERACT_TOUT) {
                clearTimeout(VP_INTERACT_TOUT);
                VP_INTERACT_TOUT = null;
            }
        }
        function vpEndInteractSoon(d = 700) {
            if (VP_INTERACT_TOUT) clearTimeout(VP_INTERACT_TOUT);
            VP_INTERACT_TOUT = setTimeout(() => {
                VP_INTERACTING = false;
                VP_INTERACT_TOUT = null;
            }, d);
        }

        /* ========== PÉRIODE EVAL (CACHE) ========== */
        let EVAL_START_CACHED = GM_getValue("eval_start_cached", null);
        let EVAL_END_CACHED = GM_getValue("eval_end_cached", null);

        /* ========== UI PREFS ========== */
let HIDE_APPROVED = GM_getValue('hide_approved', false);
let UI_SLICES_OPEN = !!GM_getValue("ui_slices_open", false);
        let UI_DARK_MODE = GM_getValue("ui_darkmode", null);
        let PREF_HL_DATES = GM_getValue("pref_hl_dates", true);
        let PREF_HL_STATUS = GM_getValue("pref_hl_status", true);
        let PREF_COLOR_PROGRESS = GM_getValue("pref_color_progress", true);
        /* NEW: Masquage auto des “Soumis” (onglet En attente) */
        let PREF_HIDE_SUBMITTED = GM_getValue("pref_hide_submitted", false);

// —— NAVIGATION CLAVIER (unifiée dans VPP) ——
const KEY_DEFAULTS = { enabled: true, left: 'q', right: 'd', up: 'z', down: 's' };
let NAV_ENABLED = GM_getValue('nav_enabled', KEY_DEFAULTS.enabled);
let KEY_LEFT  = (GM_getValue('key_left',  KEY_DEFAULTS.left)  || '').toLowerCase();
let KEY_RIGHT = (GM_getValue('key_right', KEY_DEFAULTS.right) || '').toLowerCase();
let KEY_UP    = (GM_getValue('key_up',    KEY_DEFAULTS.up)    || '').toLowerCase();
let KEY_DOWN  = (GM_getValue('key_down',  KEY_DEFAULTS.down)  || '').toLowerCase();

        /* ========== HMP ========== */
        let HMP_ENABLED = GM_getValue("hmp_enabled", true);
        let HMP_REF_STR = GM_getValue("hmp_reference_date", "31/12/2022");

        /* ========== RATIO ========== */
        let RATIO_START_STR = GM_getValue("ratio_start_iso", "2019-06-27");

        /* ========== SUBMISSION TRACKING (LOCAL) ========== */
        // IMPORTANT: ajouter @match pour /review/create-review* et /review/create-review/* dans l’entête.
        const SUBMIT_STORE = "vpp_submitted_local",
            SUBMIT_CTX = "vpp_submit_ctx"; // ctx en sessionStorage
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

        /* ========== LAZYFLAG KEYS/TPLS ========== */
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

        /* ========== STYLES ========== */
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

        /* ========== HELPERS ========== */
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

        /* ========== SYNC PÉRIODE (ACCOUNT) ========== */
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
                    return true;
                }
                let html = await new Promise((res, rej) => {
                    GM_xmlhttpRequest({ method: "GET", url: "https://www.amazon.fr/vine/account", onload: (r) => (r.status >= 200 && r.status < 400 ? res(r.responseText) : rej(new Error("HTTP " + r.status))), onerror: (e) => rej(e) });
                });
                const doc = new DOMParser().parseFromString(html, "text/html");
                const r = extractPeriodFromAny(doc);
                if (!r) return false;
                EVAL_START_CACHED = r.startISO;
                EVAL_END_CACHED = r.endISO;
                GM_setValue("eval_start_cached", EVAL_START_CACHED);
                GM_setValue("eval_end_cached", EVAL_END_CACHED);
                log("Période sync (fetch)", EVAL_START_CACHED, EVAL_END_CACHED);
                return true;
            } catch (e) {
                warn("syncEval error", e);
                return false;
            }
        }

        /* ========== EXTRACTION PAGE ========== */
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

        /* ========== STOCKAGE ========== */
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
                // PURGE local submitted si approved
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
            const uniq = (arr, withStatus = false) => {
                const m = new Map();
                for (const it of arr) {
                    const k = key(it.asin, it.day);
                    if (!m.has(k)) m.set(k, it);
                    else if (withStatus) m.set(k, mergeStatus(m.get(k), it));
                }
                return Array.from(m.values());
            };
            pending = uniq(pending);
            completed = uniq(completed, true);
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

        /* ========== RAINBOW + HMP ========== */
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


/* ========== MASQUAGE STRICT DES "Approuvé" SUR L’ONGLET “VÉRIFIÉS” (robuste) ========== */
function applyHideApproved(){
  if (!location.href.includes('/vine/vine-reviews')) return 0;

  const qs = new URLSearchParams(location.search);
  const type = qs.get('review-type') || 'pending_review';

  // Si la feature est OFF ou si on n'est pas sur "Vérifiés", on ré-affiche tout et on sort.
  if (!HIDE_APPROVED || type !== 'completed') {
    document.querySelectorAll('tr.vpp-hide-approved').forEach(row => {
      row.classList.remove('vpp-hide-approved');
      if (row.style.display === 'none') row.style.display = '';
    });
    return 0;
  }

  // Normalisation agressive des contenus (nbsp, multiples espaces, trims).
  const norm = s => (s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let hidden = 0;
  let sawSamples = []; // pour debug

  // On parcourt les lignes, et dans chaque ligne les cellules "text-col" sans lien (la cellule "statut").
  document.querySelectorAll('tr.vvp-reviews-table--row').forEach(row => {
    // candidate = cellule de statut (pas de lien).
    const candidates = [...row.querySelectorAll('td.vvp-reviews-table--text-col')].filter(td => !td.querySelector('a'));
    let approvedHere = false;

    for (const td of candidates) {
      const txt = norm(td.textContent);
      if (sawSamples.length < 5) sawSamples.push(txt); // on garde quelques valeurs observées
      if (txt === 'Approuvé') {
        approvedHere = true;
        break;
      }
    }

    if (approvedHere) {
      if (!row.classList.contains('vpp-hide-approved')) {
        row.classList.add('vpp-hide-approved');
        row.style.display = 'none';
        hidden++;
      }
    } else {
      if (row.classList.contains('vpp-hide-approved')) {
        row.classList.remove('vpp-hide-approved');
        if (row.style.display === 'none') row.style.display = '';
      }
    }
  });

  if (DEBUG) {
    console.log('[VPP] Masqués (Approuvé strict):', hidden);
    if (!hidden) {
      console.log('[VPP] échantillon cellules statut normalisées (5 max):', sawSamples);
    }
  }
  return hidden;
}



        function getPageKind(){
  const p = location.pathname;
  if(/\/vine\/vine-items/i.test(p))   return 'items';
  if(/\/vine\/vine-reviews/i.test(p)) return 'reviews';
  if(/\/vine\/orders/i.test(p))       return 'orders';
  return 'other';
}
function getPageInfo(){
  const u = new URL(location.href);
  const page = parseInt(u.searchParams.get('page')||'1',10);
  let queue = null;
  if(getPageKind()==='items'){
    const rawQ=(u.searchParams.get('queue')||'potluck').toLowerCase();
    queue = ['potluck','last_chance','encore'].includes(rawQ)?rawQ:'potluck';
  }
  return {page, queue, url:u};
}
function setParam(u,key,val){ const url=(u instanceof URL)?new URL(u):new URL(u,location.href); url.searchParams.set(key,String(val)); return url.toString(); }
function goTo(url){ location.href = url; }

function onKeyDown(e){
  if(!NAV_ENABLED) return;
  const kind = getPageKind(); if(!['items','reviews','orders'].includes(kind)) return;

  const ae=document.activeElement;
  if(ae && (ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.isContentEditable)) return;

  const k=(e.key||'').toLowerCase();
  const isLeft  = (k==='arrowleft')  || (KEY_LEFT  && k===KEY_LEFT);
  const isRight = (k==='arrowright') || (KEY_RIGHT && k===KEY_RIGHT);
  const isUp    = (k==='arrowup')    || (KEY_UP    && k===KEY_UP);
  const isDown  = (k==='arrowdown')  || (KEY_DOWN  && k===KEY_DOWN);
  if(!isLeft && !isRight && !isUp && !isDown) return;

  const {page,queue,url} = getPageInfo();

  if(isLeft || isRight){
    const nextPage = Math.max(1, page + (isLeft?-1:1));
    goTo(setParam(url, 'page', nextPage));
    return;
  }
  if(kind==='items' && (isUp || isDown)){
    const queues=['potluck','last_chance','encore'];
    let idx=queues.indexOf(queue||'potluck');
    idx=Math.min(queues.length-1, Math.max(0, idx+(isUp?-1:1)));
    const u=new URL(url); u.searchParams.set('queue',queues[idx]); u.searchParams.set('page','1');
    goTo(u.toString());
  }
}

        /* ========== HARVEST MULTI-PAGES ========== */
        const HARVEST_COOLDOWN_MS = 15 * 60 * 1000;
        const HARVEST_STATE = { pending_review: false, completed: false };
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
                HARVEST_STATE[typeKey] = true;
                const hrefs = getReviewPaginationHrefs(document).filter((h) => new URL(h).searchParams.get("review-type") === (typeKey || "pending_review"));
                if (!hrefs.length) {
                    setHarvestStamp(typeKey);
                    HARVEST_STATE[typeKey] = false;
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
                HARVEST_STATE[typeKey] = false;
            }
        }

        /* ========== PAGE ACCOUNT : jours restants + “dernière modif” progression ========== */
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

        /* ========== ORDERS : RATIO ========= */
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

        /* ========== LAZYFLAG (modèles, mapping commandes…) ========== */
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

        /* ========== EXTRA: robust asin+order pour pendingReplaceStatusColumn ========== */
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

        /* ========== PENDING: header + colonne CS ========== */
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
                ["mousedown", "click", "pointerdown", "pointerup", "wheel", "focusin"].forEach((evt) => wrap.addEventListener(evt, vpStartInteract, true));
                ["pointerup", "blur"].forEach((evt) => wrap.addEventListener(evt, () => vpEndInteractSoon(), true));
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.dataset.asin = asin;
                const cur = checked[asin];
                if (cur) cb.checked = true;
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
                    if (!cb.checked) cb.checked = true;
                    map[asin] = { templateIdx: sel.selectedIndex };
                    lfSetChecked(map);
                });
                wrap.append(cb, sel, a);
                statusTd.appendChild(wrap);
            });
        }

        /* ========== EMAIL ========== */
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

        /* == Pending effectif : pending - (submitted/approved) avec matching par ASIN (+ tolérance date) == */
        function pendingMinusCompleted(pending, completed) {
            // ne retirer que les completed pertinents
            const rel = completed.filter((c) => {
                const st = (c.status || "").toLowerCase();
                return st === "submitted" || st === "approved";
            });
            // par ASIN -> { days: [num|null], hasNull:boolean }
            const map = new Map();
            for (const c of rel) {
                const asin = c.asin;
                const d = typeof c.day === "number" ? c.day : null;
                if (!map.has(asin)) map.set(asin, { days: [], hasNull: false });
                const entry = map.get(asin);
                if (d == null) entry.hasNull = true;
                else entry.days.push(d);
            }
            // garde uniquement les pending qui n'ont pas de match
            return pending.filter((p) => {
                const m = map.get(p.asin);
                if (!m) return true;
                if (m.hasNull) return false; // completed sans jour => on considère match
                const pd = typeof p.day === "number" ? p.day : null;
                if (pd == null) return false; // si pending sans jour et completed avec jour => on écarte par prudence
                return !m.days.some((cd) => Math.abs(pd - cd) <= WINDOW_COMPLETED_MATCH_DAYS);
            });
        }

        /* ========== STATS UI ========== */
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
        /* OLD (gardé pour compat) : countSubmittedOrPending — NON utilisé dans les cartes */
        function countSubmittedOrPending(completed, s, e) {
            return completed.filter((x) => {
                if (x.day < s || x.day > e) return false;
                return x.status === "submitted" || x.status === "pending_approval" || x.status === "unknown";
            }).length;
        }
        /* NEW: Soumis uniquement */
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
   function displayResults(){
  if(!location.href.startsWith('https://www.amazon.fr/vine/vine-reviews'))return;
  const {pending,completed,orders}=reconcileAndPersist();
  const headingTopDiv=document.querySelector('.vvp-reviews-table--heading-top')||document.querySelector('.vvp-reviews-table');
  if(!headingTopDiv)return;

  // >>> pending effectif (retire les Soumis/Approuvés correspondants)
  const pendingEff = pendingMinusCompleted(pending, completed);

  document.getElementById('review-statistics-container')?.remove();
  const resultDiv=document.createElement('div');
  resultDiv.id='review-statistics-container';
  resultDiv.className='vs-container';
  headingTopDiv.appendChild(resultDiv);

  const dayNow=epochDayFromDate(new Date());
  const SL0S=dayNow-29,SL0E=dayNow,SL1S=dayNow-59,SL1E=dayNow-30,SL2S=dayNow-89,SL2E=dayNow-60;

  const evalStartISO=GM_getValue('customStartDate',EVAL_START_CACHED),
        evalEndISO  =GM_getValue('customEndDate',EVAL_END_CACHED),
        fallbackStart=dayNow-89,
        evalStart=evalStartISO?toEpochDaySafe(evalStartISO):fallbackStart,
        evalEnd  =evalEndISO?toEpochDaySafe(evalEndISO):dayNow;

  const pendingCount   = countInRange(pendingEff, evalStart, evalEnd);
  const completedCount = countInRange(completed,  evalStart, evalEnd);
  const approvedCount  = countApproved(completed, evalStart, evalEnd);
  const submittedCount = completed.filter(x=>x.day>=evalStart&&x.day<=evalEnd && (x.status||'').toLowerCase()==='submitted').length;

  const ordersCount    = countInRange(orders, evalStart, evalEnd);
  const totalCount     = pendingCount + completedCount;

  const cancelledCount = Math.max(0, ordersCount - (pendingCount + completedCount));
  const cancelledRate  = ordersCount ? (cancelledCount/ordersCount)*100 : null;

  const completionRatePct = totalCount ? (completedCount/totalCount)*100 : null;
  const completionDisplay = completionRatePct===null?'—':`${completionRatePct.toFixed(1)}%`;
  const completionColor   = completionRatePct===null?'var(--c-muted)':getCompletionRateColor(completionRatePct);

  const cards=document.createElement('div');
  cards.className='vs-cards';
  cards.innerHTML =
    `${card('En attente',pendingCount,'pending')}`
  + `${card('Vérifiés (total)',completedCount,'verified')}`
  + `${card('• Approuvés',approvedCount,'verified')}`
  + `${card('• Soumis',submittedCount,'verified')}`
  + `${card('Taux vérif',completionDisplay,'rate',completionColor)}`
  + `${card('Annulations',cancelledRate===null?'—':`${cancelledRate.toFixed(1)}%`,'cancel',cancelledRate===null?'var(--c-muted)':getCancellationRateColor(cancelledRate))}`;
  resultDiv.appendChild(cards);

  const info=document.createElement('div');
  info.className='vs-muted';
  info.style.marginTop='6px';
  const showISO=(iso)=>iso?new Date(iso).toLocaleDateString(): '—';
  info.textContent=`Période d'évaluation utilisée : ${showISO(evalStartISO)} → ${showISO(evalEndISO)} (sinon 90 jours glissants)`;
  resultDiv.appendChild(info);

  // Slices 30/60/90 avec pending effectif
  const details=document.createElement('details');
  if(UI_SLICES_OPEN)details.setAttribute('open','');
  details.className='vs-details';
  const summary=document.createElement('summary');
  summary.textContent=UI_SLICES_OPEN?'Masquer les statistiques détaillées (30/60/90)':'Afficher les statistiques détaillées (30/60/90)';
  summary.className='vs-summary';
  details.appendChild(summary);

  const slices=document.createElement('div');
  slices.className='vs-periods';
  slices.appendChild(blockSlice('0–30 jours', SL0S, SL0E, pendingEff, completed, orders));
  slices.appendChild(blockSlice('31–60 jours',SL1S, SL1E, pendingEff, completed, orders));
  slices.appendChild(blockSlice('61–90 jours',SL2S, SL2E, pendingEff, completed, orders));
  details.appendChild(slices);

  details.addEventListener('toggle',()=>{
    UI_SLICES_OPEN=details.open;
    GM_setValue('ui_slices_open',UI_SLICES_OPEN);
    summary.textContent=details.open?'Masquer les statistiques détaillées (30/60/90)':'Afficher les statistiques détaillées (30/60/90)';
  });
  resultDiv.appendChild(details);
}


        /* ========== MODALE PRO (DATA / TPL / OPTIONS) ========== */
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

        /* ========== DATA TAB (avec statut “Soumis”) ========== */
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
                        if (name === edited) o.selected = true;
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
                const uniq = (arr, withStatus = false) => {
                    const m = new Map();
                    arr.forEach((it) => {
                        const kk = K(it);
                        if (!m.has(kk)) m.set(kk, it);
                        else if (withStatus) m.set(kk, mergeStatus(m.get(kk), it));
                    });
                    return Array.from(m.values());
                };
                GM_setValue("pending_reviews", uniq(pending));
                GM_setValue("completed_reviews", uniq(completed, true));
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

        /* ========== TEMPLATE TAB ========== */
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

        /* ========== OPTIONS TAB (avec toggle “Masquer les Soumis”) ========== */
        function buildOptionsTab(container) {
            container.innerHTML = `<div class="vpp-row" style="gap:16px;align-items:flex-end;"><div><label style="font-weight:600;display:block;">HMP (masquer anciens pending)</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-hmp-enabled" type="checkbox" ${
                HMP_ENABLED ? "checked" : ""
            }> Activer</label></div><div>
<label class="vs-muted" style="display:block;">Date de référence (JJ/MM/AAAA)</label><input id="opt-hmp-ref" class="vs-input" value="${HMP_REF_STR}"></div></div><div class="vpp-row" style="gap:16px;"><div><label style="display:block;font-weight:600;">Ratio commandes/jour — date de départ</label><input id="opt-ratio-start" class="vs-input" value="${RATIO_START_STR}"></div></div><div class="vpp-row" style="gap:16px;"><label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-hide-submitted" type="checkbox" ${
                PREF_HIDE_SUBMITTED ? "checked" : ""
            }> Masquer automatiquement les avis “Soumis” (onglet En attente)</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-hl-dates" type="checkbox" ${
                PREF_HL_DATES ? "checked" : ""
            }> Couleurs dates (pending uniquement)</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-hl-status" type="checkbox" ${
                PREF_HL_STATUS ? "checked" : ""
            }> Couleurs statuts</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-color-progress" type="checkbox" ${
                PREF_COLOR_PROGRESS ? "checked" : ""
            }> Couleur barre progression</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;"><input id="opt-debug" type="checkbox" ${
                DEBUG ? "checked" : ""
            }> DEBUG logs</label>
<label class="vs-input" style="display:inline-flex;align-items:center;gap:8px;">
  <input id="opt-hide-approved" type="checkbox" ${HIDE_APPROVED?'checked':''}>
  Masquer automatiquement les “Approuvés” (onglet Vérifiés)
</label>

</div>
<div class="vpp-row" style="justify-content:flex-end;"><button id="opt-save" class="vs-btn primary">Enregistrer</button></div>`;

// === Bloc Navigation clavier (dans Options) ===
const navWrap = document.createElement('div');
navWrap.className = 'vpp-row';
navWrap.style.marginTop = '6px';
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

// valeurs initiales
const inEnabled = container.querySelector('#nav-enabled');
const inLeft    = container.querySelector('#nav-left');
const inRight   = container.querySelector('#nav-right');
const inUp      = container.querySelector('#nav-up');
const inDown    = container.querySelector('#nav-down');
inEnabled.checked = !!NAV_ENABLED;
inLeft.value  = KEY_LEFT  || '';
inRight.value = KEY_RIGHT || '';
inUp.value    = KEY_UP    || '';
inDown.value  = KEY_DOWN  || '';

// capture d'une touche dans les inputs
[inLeft,inRight,inUp,inDown].forEach(inp=>{
  inp.addEventListener('keydown', (e)=>{
    e.preventDefault();
    const k=(e.key||'').toLowerCase();
    if(k && !['shift','control','alt','meta','escape'].includes(k)) inp.value = k;
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

HIDE_APPROVED = !!container.querySelector('#opt-hide-approved').checked;
GM_setValue('hide_approved', HIDE_APPROVED);

                GM_setValue("hmp_enabled", HMP_ENABLED);
                GM_setValue("hmp_reference_date", HMP_REF_STR);
                GM_setValue("ratio_start_iso", RATIO_START_STR);
                GM_setValue("pref_hide_submitted", PREF_HIDE_SUBMITTED);
                GM_setValue("pref_hl_dates", PREF_HL_DATES);
                GM_setValue("pref_hl_status", PREF_HL_STATUS);
                GM_setValue("pref_color_progress", PREF_COLOR_PROGRESS);
                GM_setValue("vp_debug", DEBUG);

// — NAV —
NAV_ENABLED = !!inEnabled.checked;
KEY_LEFT  = (inLeft.value  || '').trim().toLowerCase();
KEY_RIGHT = (inRight.value || '').trim().toLowerCase();
KEY_UP    = (inUp.value    || '').trim().toLowerCase();
KEY_DOWN  = (inDown.value  || '').trim().toLowerCase();
GM_setValue('nav_enabled', NAV_ENABLED);
GM_setValue('key_left',  KEY_LEFT);
GM_setValue('key_right', KEY_RIGHT);
GM_setValue('key_up',    KEY_UP);
GM_setValue('key_down',  KEY_DOWN);

                alert("Options enregistrées.");
                try {
                    ratioOrdersOnOrdersPage();
                } catch {}
                try {
                    displayResults();
                    pendingReplaceStatusColumn();
                    applyRainbowStably();
                    applyHMP();
 applyHideApproved(); // <—— nouveau
                    vppNormalizeReviewButtons();
                    vppStyleSubmittedButtons();
                } catch {}
            };
        }

        /* ========== SUBMISSION: CAPTURE SUR CREATE-REVIEW / THANKYOU ========== */
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
                    true
                );
                document.querySelectorAll('input.a-button-input[type="submit"]').forEach((btn) => {
                    btn.addEventListener(
                        "click",
                        () => {
                            console.info("[VPP][submit] click submit");
                            markSubmitted("click-submit");
                        },
                        { once: false, capture: true }
                    );
                });
            };
            if (document.readyState === "complete" || document.readyState === "interactive") hookup();
            else window.addEventListener("DOMContentLoaded", hookup, { once: true });
            subPrune(150);
        })();

        /* ========== CONTEXTE + STYLING BOUTON “DONNER UN AVIS” ========== */
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
                    { capture: true }
                );
            });
        }
        /* NEW: normaliser le libellé “Donner un avis” partout (pending) */
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
        /* MODIF: bouton vert + texte “Avis soumis” + masquage auto optionnel */
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
                // Par défaut → “Donner un avis”
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


        /* ========== OBSERVERS & LIFECYCLE ========== */
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
try{ applyHideApproved() }catch(e){ warn(e) }

            }
        }, 800);
        function observeTables() {
            const rt = document.querySelector(".vvp-reviews-table");
            if (rt) {
                const mo = new MutationObserver((muts) => {
                    if (VP_INTERACTING) return;
                    if (muts.some((m) => m.type === "childList" && (m.addedNodes.length || m.removedNodes.length))) refreshUI();
                });
                mo.observe(rt, { childList: true, subtree: true });
            }
            const ot = document.querySelector(".vvp-orders-table");
            if (ot) {
                const mo2 = new MutationObserver((muts) => {
                    if (muts.some((m) => m.type === "childList" && (m.addedNodes.length || m.removedNodes.length))) lfSaveOrderInfoFromOrdersPage();
                });
                mo2.observe(ot, { childList: true, subtree: true });
            }
        }

        /* ========== THANKYOU shortcut buttons (RFY/AFA/AI) ========== */
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
                if (document.getElementById("vine-shortcuts-container")) return true;
                const parent = document.querySelector("#widget-accountLevelActions") || document.querySelector("#rightTwo") || document.querySelector("#right-2") || document.body;
                if (!parent) return false;
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
                return true;
            }
            let tries = 0;
            const iv = setInterval(() => {
                if (injectOnce() || ++tries > 40) clearInterval(iv);
            }, 250);
        }

        /* ========== MAIN ========== */
        async function main() {
            // Sync période + days-left sur /vine/account
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

window.addEventListener('keydown', onKeyDown, { passive: true });

            observeTables();
            try {
                GM_registerMenuCommand("Vine Power Pack — Ouvrir le panneau", () => openPanel("data"));
            } catch {}
        }
        if (document.readyState === "complete" || document.readyState === "interactive") {
            main();
        } else {
            window.addEventListener("DOMContentLoaded", main, { once: true });
        }
    })(); // END VPP


