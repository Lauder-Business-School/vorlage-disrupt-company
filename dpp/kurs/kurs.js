/* ==========================================================================
   Digitaler Produktpass (DPP) — Interaktive Kurslogik (kurs/kurs.js)
   ========================================================================== */
(function () {
  "use strict";

  function fetch() {
    return Promise.reject(new Error("Die Live-Schnittstelle ist in dieser Lehrvorlage deaktiviert."));
  }

  var KEY = "dpp-kurs-v1";
  var STATIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"];
  var VIEWS = ["start"].concat(STATIONS).concat(["cockpit", "faelle", "arena", "anleitung", "leitfaden", "ende", "debrief"]);

  var state = { done: {}, steps: {}, rules: [], s12: {} };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state.done = parsed.done || {};
        state.steps = parsed.steps || {};
        state.rules = Array.isArray(parsed.rules) ? parsed.rules : [];
        state.s12 = parsed.s12 || {};
      }
    }
  } catch (e) { /* Private Browsing */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function markDone(id) {
    if (!state.done[id]) {
      state.done[id] = true;
      save();
      renderProgress();
    }
  }

  function renderProgress() {
    var doneCount = 0;
    var nextAssigned = false;
    STATIONS.forEach(function (id) {
      var isDone = !!state.done[id];
      if (isDone) doneCount++;
      var link = $('[data-step-link="' + id + '"]');
      if (link) link.classList.toggle("done", isDone);
      var card = $('[data-card="' + id + '"] a');
      if (card) card.classList.toggle("done", isDone);
      var jLink = $('[data-j="' + id + '"]');
      if (jLink) {
        jLink.classList.toggle("done", isDone);
        var isNext = !isDone && !nextAssigned;
        jLink.classList.toggle("j-next", isNext);
        if (isNext) nextAssigned = true;
      }
    });
    var cnt = $("#done-count");
    if (cnt) cnt.textContent = doneCount + "/" + STATIONS.length;
    var bar = $("#progress-bar");
    if (bar) bar.style.width = Math.round((doneCount / STATIONS.length) * 100) + "%";
    var sb = $("#start-btn");
    if (sb) {
      var firstOpen = STATIONS.filter(function (s) { return !state.done[s]; })[0];
      if (doneCount > 0 && firstOpen) {
        sb.setAttribute("href", "#" + firstOpen);
        sb.firstChild.textContent = "Weiter bei Station " + firstOpen.slice(1) + " ";
      } else if (doneCount === STATIONS.length) {
        sb.setAttribute("href", "#ende");
        sb.firstChild.textContent = "Alle 12 Stationen erledigt — Zum Abschluss ";
      }
    }
    var doneTxt = $("#done-text");
    if (doneTxt) {
      doneTxt.textContent = doneCount === STATIONS.length
        ? "Geschafft: Sie haben alle 12 Stationen des DPP-Praxiskurses abgeschlossen!"
        : doneCount + " von " + STATIONS.length + " Stationen abgeschlossen. Offene Stationen erreichen Sie direkt über die Startseite.";
    }
  }

  /* ---------- Routing ---------- */
  function show(viewId) {
    if (VIEWS.indexOf(viewId) === -1) viewId = "start";
    $$(".view").forEach(function (v) {
      v.classList.toggle("active", v.dataset.view === viewId);
    });
    $$("[data-step-link]").forEach(function (a) {
      var active = a.dataset.stepLink === viewId;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }

  function route() {
    var h = (location.hash || "#start").replace(/^#/, "");
    show(h || "start");
  }
  window.addEventListener("hashchange", route);

  // Zertifikats-Initialisierung
  var certDateEl = document.getElementById('cert-date');
  var certNameEl = document.getElementById('cert-name');
  if (certDateEl) {
    certDateEl.textContent = 'Ausstellungsdatum: ' + new Date().toLocaleDateString('de-DE');
  }
  if (certNameEl) {
    try {
      var savedName = localStorage.getItem('dpp-cert-name');
      if (savedName) certNameEl.value = savedName;
      certNameEl.addEventListener('input', function () {
        localStorage.setItem('dpp-cert-name', certNameEl.value.trim());
      });
    } catch (e) { /* ignore */ }
  }


  /* ---------- Sortier- & Zuordnungsübungen (Stationen 1, 3, 6, 9, 10, 11) ---------- */
  $$("[data-exercise]").forEach(function (box) {
    var exId = box.dataset.exercise;
    var items = $$(".sort > li, .scen > li", box);
    if (!items.length) return;
    var scorePill = $("[data-score]", box);
    var solved = 0;

    function updateScore() {
      if (scorePill) scorePill.textContent = solved + " / " + items.length + " gelöst";
      if (solved === items.length) markDone(exId);
    }

    items.forEach(function (li) {
      var ans = li.dataset.answer;
      var explain = li.dataset.explain || "";
      var fb = document.createElement("div");
      fb.className = "feedback";
      li.appendChild(fb);

      $$("button[data-pick]", li).forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (li.dataset.done === "1") return;
          var pick = btn.dataset.pick;
          if (pick === ans) {
            li.dataset.done = "1";
            solved++;
            $$("button[data-pick]", li).forEach(function (b) {
              b.disabled = true;
              if (b === btn) b.classList.add("right");
            });
            fb.className = "feedback ok";
            fb.innerHTML = "<b>Richtig.</b> " + esc(explain);
            updateScore();
          } else {
            btn.classList.add("wrong");
            btn.disabled = true;
            fb.className = "feedback bad";
            fb.innerHTML = "<b>Noch nicht ganz.</b> Prüfen Sie die Rechtsgrundlage oben noch einmal und wählen Sie die passende Option.";
          }
        });
      });
    });
  });

  /* ---------- Multiple-Choice-Fragen ([data-mc]) ---------- */
  $$("[data-mc]").forEach(function (mc) {
    var exId = mc.dataset.ex;
    var fb = mc.nextElementSibling;
    $$(".choice", mc).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (mc.dataset.done === "1") return;
        var ok = btn.dataset.correct === "1";
        if (ok) {
          mc.dataset.done = "1";
          $$(".choice", mc).forEach(function (b) {
            b.disabled = true;
            if (b === btn) b.classList.add("right");
          });
          if (fb) {
            fb.className = "feedback ok";
            fb.innerHTML = "<b>Richtig!</b> " + esc(btn.dataset.explain || "");
          }
          if (exId) markDone(exId);
        } else {
          btn.classList.add("wrong");
          btn.disabled = true;
          if (fb) {
            fb.className = "feedback bad";
            fb.innerHTML = "<b>Nicht ganz:</b> " + esc(btn.dataset.explain || "");
          }
        }
      });
    });
  });

  /* ---------- Station 2: Interaktiver Pflichtenfinder-Simulator ---------- */
  var pfCat = $("#pf-cat");
  var pfRole = $("#pf-role");
  var pfOut = $("#pf-out");
  var pfExploredEl = $("#pf-explored");
  var pfSeen = {};

  var PF_CAT_DATA = {
    ev: {
      title: "Elektrofahrzeugbatterie (EV)",
      law: "Batterieverordnung (EU) 2023/1542 · Art. 77 + Anhang XIII",
      date: "18.02.2027",
      fields: "102 Pflichtfelder",
      sample: "ATDEMODEMO0002",
      sampleUrl: "https://dpp.example.invalid/de/p/ATDEMODEMO0002",
      note: "Volle Batteriepass-Pflicht inkl. CO₂-Fußabdruck (Gruppe B), Rezyklatanteilen und Sorgfaltspflichtbericht."
    },
    industrial: {
      title: "Industriebatterie > 2 kWh",
      law: "Batterieverordnung (EU) 2023/1542 · Art. 77 + Anhang XIII",
      date: "18.02.2027",
      fields: "107 Pflichtfelder",
      sample: "ATDEMOIS2500001",
      sampleUrl: "https://dpp.example.invalid/de/p/ATDEMOIS2500001",
      note: "Höchste Pflichtfeldanzahl im Katalog. Bei LFP-Chemie entfallen Kobalt-/Nickel-Sorgfaltspflichten bedingt."
    },
    ind_small: {
      title: "Industriebatterie ≤ 2 kWh / Gerätebatterie",
      law: "Batterieverordnung (EU) 2023/1542 · Art. 13 & 38",
      date: "Kein Batteriepass nach Art. 77",
      fields: "QR-Kennzeichnung (Art. 13)",
      sample: "—",
      sampleUrl: "https://www.example.invalid/pflichtenfinder",
      note: "Unterhalb der 2-kWh-Schwelle besteht keine Batteriepass-Pflicht nach Art. 77, wohl aber CE-, QR- und Informationspflichten."
    },
    lv: {
      title: "Batterie für leichte Verkehrsmittel (LV / LMT)",
      law: "Batterieverordnung (EU) 2023/1542 · Art. 77 + Art. 11",
      date: "18.02.2027 (CO₂ ab 18.08.2028)",
      fields: "97 Pflichtfelder",
      sample: "ATDEMOEB6300001",
      sampleUrl: "https://dpp.example.invalid/de/p/ATDEMOEB6300001",
      note: "Passpflicht ab 18.02.2027; die CO₂-Fußabdruck-Gruppe B wird erst am 18.08.2028 zur Pflicht."
    },
    furniture: {
      title: "Möbel / Einrichtung (ESPR)",
      law: "Ökodesign-Verordnung ESPR (EU) 2024/1781 · Art. 9–12",
      date: "Freiwilliger Vorlauf (Delegierter Akt offen)",
      fields: "43 Katalogfelder",
      sample: "ATDEMOB800001",
      sampleUrl: "https://dpp.example.invalid/de/p/ATDEMOB800001",
      note: "Freiwilliger ESPR-Vorlauf mit eigenem Gruppenschema (Materialien, SVHC, Reparierbarkeit, unverkaufte Konsumgüter)."
    }
  };

  var PF_ROLE_DATA = {
    manufacturer: "Als Erzeuger / Inverkehrbringer unter eigenem Namen schulden Sie die Erstellung, Signatur (did:oyd), EU-Register-Eintragung (registrationId) und den QR-Code auf Ihrer eigenen Domain.",
    importer: "Als Importeur aus einem Drittstaat dürfen Sie das Produkt nur in Verkehr bringen, wenn ein registrierter Pass vorliegt und der QR-Code auflöst. Bei Verkauf unter Eigenmarke werden Sie selbst zum Erzeuger.",
    repurposer: "Nach Art. 77 Abs. 7 BattVO geht die Passverantwortung auf Sie über: Der bisherige Pass wird archiviert (archived) und Sie stellen einen neuen Pass mit kryptografischem Verweis auf den Vorgängerpass aus.",
    workshop: "Sie müssen keinen eigenen Pass ausstellen, haben aber nach Art. 77 Abs. 2 Anspruch auf geschützten API-Lesezugriff für Stufe 2 (Demontage/Ersatzteile) und Stufe 4 (Einzelstück-SoH/Ereignisse)."
  };

  function renderPfSim() {
    if (!pfCat || !pfRole || !pfOut) return;
    var c = pfCat.value;
    var r = pfRole.value;
    pfSeen[c + ":" + r] = true;
    var count = Object.keys(pfSeen).length;
    if (pfExploredEl) pfExploredEl.textContent = Math.min(count, 3) + " / 3";

    var cd = PF_CAT_DATA[c];
    var rd = PF_ROLE_DATA[r];
    pfOut.innerHTML =
      '<h3>' + esc(cd.title) + '</h3>' +
      '<div class="pf-metrics">' +
        '<div><span>Stichtag</span><b>' + esc(cd.date) + '</b></div>' +
        '<div><span>Umfang</span><b>' + esc(cd.fields) + '</b></div>' +
        '<div><span>Musterpass</span><b>' + esc(cd.sample) + '</b></div>' +
      '</div>' +
      '<ul class="pf-list">' +
        '<li><b>Rechtsgrundlage:</b> ' + esc(cd.law) + '</li>' +
        '<li><b>Kategorie-Regel:</b> ' + esc(cd.note) + '</li>' +
        '<li><b>Ihre Rollenpflicht:</b> ' + esc(rd) + '</li>' +
      '</ul>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">' +
        '<a class="btn sm" href="' + esc(cd.sampleUrl) + '" target="_blank" rel="noopener">Pass / Pflichtenfinder live öffnen &#8599;</a>' +
        '<a class="btn sm ghost" href="https://dpp.example.invalid/de/dpp/pflichtenfinder" target="_blank" rel="noopener" style="color:#fff;border-color:rgba(255,255,255,.35)">In der Elektro-App prüfen &#8599;</a>' +
      '</div>';
  }
  if (pfCat && pfRole) {
    pfCat.addEventListener("change", renderPfSim);
    pfRole.addEventListener("change", renderPfSim);
    renderPfSim();
  }

  /* ---------- Station 4: Rollen- & Zugriffsstufen-Firewall ---------- */
  var ROLE_PROFILES = {
    public: {
      name: "Öffentlich (QR-Scan ohne API-Schlüssel)",
      levels: [1],
      setStr: "{ 1 }",
      countInfo: "67 von 102 EV-Pflichtfeldern sichtbar",
      desc: "Jede Person beim Scannen des QR-Codes: sieht Stufe 1 (Basisdaten, Chemie, CO₂-Gesamtwert, Rezyklatanteil), aber keinerlei Rezepturdetails, Prüfberichte oder Einzelstück-Telemetrie."
    },
    authority: {
      name: "Marktüberwachung & Notified Body (Scope: dpp:read:authority)",
      levels: [1, 2, 3],
      setStr: "{ 1, 2, 3 }",
      countInfo: "Stufen 1, 2 und 3 sichtbar (Stufe 4 geschwärzt!)",
      desc: "Behörden sehen zusätzlich Stufe 2 (Zusammensetzung/Demontage) und exklusiv Stufe 3 (Prüfberichte zur Konformität). Einzelstück-Betriebsdaten (Stufe 4) gehören laut Anhang XIII Nr. 4 nicht zum Behördenprofil."
    },
    repairer: {
      name: "Freie Werkstatt / Recycler / Second-Life (Scope: dpp:read:repairer)",
      levels: [1, 2, 4],
      setStr: "{ 1, 2, 4 }",
      countInfo: "Stufen 1, 2 und 4 sichtbar (mehr Felder als Behörde!)",
      desc: "Werkstätten und Recycler sehen Stufe 1, Stufe 2 (Ersatzteilbezug, Demontage, Sicherheitsanweisungen) sowie exklusiv Stufe 4 (aktueller SoH, Ladezyklen, Übertemperatur-Events des Einzelstücks)."
    },
    manufacturer: {
      name: "Hersteller intern / Inverkehrbringer (Scope: dpp:read:manufacturer)",
      levels: [1, 2, 3, 4],
      setStr: "{ 1, 2, 3, 4 }",
      countInfo: "Alle 102 von 102 EV-Pflichtfeldern sichtbar",
      desc: "Vollzugriff des verantwortlichen Wirtschaftsakteurs auf sämtliche vier Offenlegungsstufen im eigenen Mandanten."
    }
  };

  var SAMPLE_ROLE_FIELDS = [
    { level: 1, title: "CO₂-Fußabdruck gesamt & Leistungsklasse", code: "61,4 kg CO₂e/kWh (Klasse B)", law: "Stufe 1 · Anh. XIII Nr. 1" },
    { level: 1, title: "Rezyklatanteil Kobalt / Lithium / Nickel", code: "Co: 18,5 % · Li: 6,2 % · Ni: 11,0 %", law: "Stufe 1 · Anh. XIII Nr. 1" },
    { level: 2, title: "Detaillierte Elektrolyt- & Kathodenrezeptur", code: "LiPF6 in EC/DMC + NMC 622", law: "Stufe 2 · Anh. XIII Nr. 2" },
    { level: 2, title: "Ersatzteil-Teilenummern & Demontagehandbuch", code: "BMS-Board #ALPV-4402-B + Explosionszeichnung", law: "Stufe 2 · Anh. XIII Nr. 2" },
    { level: 3, title: "Vollständige Prüfberichte & Konformitäts-Messprotokolle", code: "TÜV-Prüfbericht #NB-0123-2026-884", law: "Stufe 3 · Anh. XIII Nr. 3 (Behörden)" },
    { level: 4, title: "Aktueller State of Health (SoH) & Ladezyklen (Einzelstück)", code: "SoH: 94,2 % · 412 Vollzyklen · 0 Thermo-Events", law: "Stufe 4 · Anh. XIII Nr. 4 (Werkstatt/Recycler)" }
  ];

  var roleBanner = $("#role-banner");
  var roleFields = $("#role-fields");
  function renderRoleSim(roleKey) {
    if (!roleBanner || !roleFields) return;
    var p = ROLE_PROFILES[roleKey] || ROLE_PROFILES.public;
    roleBanner.innerHTML =
      '<div><b style="color:var(--ink);display:block">' + esc(p.name) + '</b>' +
      '<span style="font-size:14px;color:var(--ink-soft)">' + esc(p.desc) + '</span></div>' +
      '<div style="text-align:right"><span class="tag-g" style="font-size:13px">Stufenmenge: ' + esc(p.setStr) + '</span><br/>' +
      '<small style="font:600 12px var(--mono);color:var(--muted)">' + esc(p.countInfo) + '</small></div>';

    roleFields.innerHTML = SAMPLE_ROLE_FIELDS.map(function (f) {
      var vis = p.levels.indexOf(f.level) !== -1;
      return '<div class="rf-card ' + (vis ? "visible" : "redacted") + '">' +
        '<div><b>' + esc(f.title) + '</b><small>' + esc(f.law) + ' &mdash; ' +
        (vis ? esc(f.code) : "████████ [GESCHWÄRZT / REDACTED]") + '</small></div>' +
        '<span class="rf-badge">' + (vis ? "SICHTBAR (Stufe " + f.level + ")" : "GESPERRT (Stufe " + f.level + ")") + '</span>' +
      '</div>';
    }).join("");
  }

  $$(".role-tab[data-role]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      $$(".role-tab[data-role]").forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      renderRoleSim(btn.dataset.role);
    });
  });
  if (roleBanner) renderRoleSim("public");

  /* ---------- Station 5: Fail-Closed Gatekeeper Simulator ---------- */
  var gfCo2 = $("#gf-co2");
  var gfCoProv = $("#gf-co-prov");
  var gfCath = $("#gf-cath");
  var gate1Box = $("#gate1-box");
  var gate1Txt = $("#gate1-txt");
  var gate2Box = $("#gate2-box");
  var gate2Txt = $("#gate2-txt");
  var gatePubBtn = $("#gate-publish-btn");
  var gateFb = $("#gate-fb");

  function evalGates() {
    if (!gfCo2 || !gfCoProv || !gfCath) return;
    var missing = [];
    if (!gfCo2.value) missing.push("carbon_footprint_total (leer)");
    if (gfCath.value === "TBD") missing.push("cathode_composition (Platzhalter TBD)");
    var gate1Ok = missing.length === 0;

    var gate2Ok = gfCoProv.value !== "ai_extracted";

    gate1Box.className = "gate-status-card " + (gate1Ok ? "pass" : "fail");
    gate1Txt.textContent = gate1Ok
      ? "BESTANDEN (all_mandatory_groups & no_placeholder_values)"
      : "BLOCKIERT: " + missing.join(", ");

    gate2Box.className = "gate-status-card " + (gate2Ok ? "pass" : "fail");
    gate2Txt.textContent = gate2Ok
      ? "BESTANDEN: Alle Pflichtwerte menschlich bestätigt (verified / partner_provided / estimated)."
      : "BLOCKIERT: Rezyklatanteil Kobalt steht noch auf ai_extracted (menschliche Freigabe fehlt).";

    gatePubBtn.disabled = !(gate1Ok && gate2Ok);
  }

  if (gfCo2 && gfCoProv && gfCath) {
    gfCo2.addEventListener("change", evalGates);
    gfCoProv.addEventListener("change", evalGates);
    gfCath.addEventListener("change", evalGates);
    evalGates();
    gatePubBtn.addEventListener("click", function () {
      gateFb.className = "feedback ok";
      gateFb.innerHTML = "<b>Pass ATDEMODEMO0002 erfolgreich versiegelt!</b> Beide Fail-Closed-Gates passiert &rarr; Snapshot-SHA-256 berechnet (<code>7b589cc9...0c12</code>) &rarr; ES256-Signatur mit <code>did:oyd:zQmQP8AD...</code> erstellt.";
      markDone("s5");
    });
  }

  /* ---------- Station 7: Hash-Ketten-Manipulations-Detektor & Live-Verify ---------- */
  var hcInput16 = $("#hc-input-v16");
  var hcBlock16 = $("#hc-v16");
  var hcBlock17 = $("#hc-v17");
  var hcBlock18 = $("#hc-v18");
  var hcHash16 = $("#hc-hash-16");
  var hcBadge16 = $("#hc-badge-16");
  var hcBadge17 = $("#hc-badge-17");
  var hcBadge18 = $("#hc-badge-18");
  var hcFb = $("#hc-fb");

  function evalHashChain() {
    if (!hcInput16) return;
    var val = hcInput16.value.trim();
    var intact = val === "61.4" || val === "61,4";
    if (intact) {
      hcHash16.textContent = "9cc9f7a8b9fe2c41...8e04";
      hcBlock16.classList.remove("broken");
      hcBlock17.classList.remove("broken");
      hcBlock18.classList.remove("broken");
      hcBadge16.className = "tag-g"; hcBadge16.textContent = "✓ Signatur v16 gültig";
      hcBadge17.className = "tag-g"; hcBadge17.textContent = "✓ Kette v16 → v17 intakt";
      hcBadge18.className = "tag-g"; hcBadge18.textContent = "✓ Kette v17 → v18 intakt";
    } else {
      hcHash16.textContent = "e4019ab3d77c8109...f91b (GEÄNDERT!)";
      hcBlock16.classList.add("broken");
      hcBlock17.classList.add("broken");
      hcBlock18.classList.add("broken");
      hcBadge16.className = "tag-r"; hcBadge16.textContent = "✗ ES256-Signaturbruch in v16!";
      hcBadge17.className = "tag-r"; hcBadge17.textContent = "✗ prev_hash stimmt nicht mit v16 überein!";
      hcBadge18.className = "tag-r"; hcBadge18.textContent = "✗ Kette ab v16 kompromittiert!";
      hcFb.className = "feedback ok";
      hcFb.innerHTML = "<b>Manipulation sofort erkannt!</b> Weil Version 17 den ursprünglichen Hash von Version 16 (<code>9cc9f7a8...8e04</code>) in ihrem eigenen signierten Snapshot trägt, entlarvt <code>/api/verify</code> jede nachträgliche Datenbank-Änderung augenblicklich.";
      markDone("s7");
    }
  }

  if (hcInput16) {
    hcInput16.addEventListener("input", evalHashChain);
    $("#hc-tamper-btn").addEventListener("click", function () {
      hcInput16.value = "45.0";
      evalHashChain();
    });
    $("#hc-reset-btn").addEventListener("click", function () {
      hcInput16.value = "61.4";
      evalHashChain();
    });
    $("#hc-live-fetch-btn").addEventListener("click", function () {
      var box = $("#hc-live-box");
      var pre = $("#hc-live-pre");
      var st = $("#hc-live-status");
      box.hidden = false;
      pre.textContent = "Rufe https://dpp.example.invalid/api/verify/ATDEMODEMO0002 ab ...";
      fetch("https://dpp.example.invalid/api/verify/ATDEMODEMO0002")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          st.textContent = "SIMULIERT (dpp.example.invalid)";
          pre.textContent = JSON.stringify(data, null, 2);
          markDone("s7");
        })
        .catch(function () {
          st.textContent = "BEISPIELDATEN (offline)";
          pre.textContent = JSON.stringify({
            passport_uid: "ATDEMODEMO0002",
            verified: true,
            version_number: 18,
            snapshot_sha256: "7b589cc9f7a8b9fe2c41e1b2f3d4a5c6b7e8f9a0b1c2d3e4f5a6b7c8d9e00c12",
            signature_alg: "ES256",
            issuer_did: "did:oyd:zQmQP8ADbyEfP3Ek2EvXMacxcc9nD5zADGTAZqkKX6CQPST",
            issuer_gln: "0088:4000000000006",
            gates_passed: ["all_mandatory_groups", "gln_format_valid", "hash_chain_intact", "no_placeholder_values"]
          }, null, 2);
          markDone("s7");
        });
    });
  }

  /* ---------- Station 8: GS1 Digital Link & 50-Zeichen-Budget ---------- */
  var gs1Domain = $("#gs1-domain");
  var gs1Gtin = $("#gs1-gtin");
  var gs1Serial = $("#gs1-serial");
  var gs1Out = $("#gs1-uri-out");
  var gs1Pill = $("#gs1-len-pill");
  var gs1Fb = $("#gs1-fb");

  function renderGs1() {
    if (!gs1Domain || !gs1Gtin || !gs1Serial) return;
    var dom = gs1Domain.value.trim().replace(/\/+$/, "");
    var gtin = gs1Gtin.value.trim() || "09520123456788";
    var ser = gs1Serial.value.trim() || "000002";
    var uri = dom + "/01/" + gtin + "/21/" + ser;
    var len = uri.length;
    gs1Out.textContent = uri;
    gs1Pill.textContent = len + " / 50 Zeichen";

    if (len <= 50 && /^https?:\/\//.test(dom)) {
      gs1Pill.style.background = "var(--ok-soft)";
      gs1Pill.style.color = "var(--ok)";
      gs1Fb.className = "feedback ok";
      gs1Fb.innerHTML = "<b>Perfekt (" + len + " Zeichen &le; 50)!</b> Dieser GS1 Digital Link hält das 50-Zeichen-Limit des EU-DPP-Registers ein und kann im Konzept direkt in <a href=\"https://dpplint.example.invalid\" target=\"_blank\" rel=\"noopener\">dpplint.example.invalid</a> validiert werden.";
      markDone("s8");
    } else {
      gs1Pill.style.background = "var(--bad-soft)";
      gs1Pill.style.color = "var(--bad)";
      gs1Fb.className = "feedback bad";
      gs1Fb.innerHTML = "<b>Zu lang (" + len + " Zeichen &gt; 50)!</b> Das EU-DPP-Register schneidet Identifier ab 50 Zeichen ab bzw. weist sie zurück. Verkürzen Sie die Resolver-Domain (z. B. per Klick auf den Button oben).";
    }
  }

  if (gs1Domain) {
    gs1Domain.addEventListener("input", renderGs1);
    gs1Gtin.addEventListener("input", renderGs1);
    gs1Serial.addEventListener("input", renderGs1);
    $("#gs1-fix-btn").addEventListener("click", function () {
      gs1Domain.value = "https://dpp.example.invalid";
      renderGs1();
    });
    renderGs1();
  }

  /* ---------- Station 12: 90-Tage-Readiness-Planer ---------- */
  var PLAN_RECS = {
    battery: "<span class=\"fl\">Empfehlung für Batterie-Inverkehrbringer (Stichtag 18.02.2027)</span><p>Priorisieren Sie <b>EV (102 Felder)</b>, <b>Industrie &gt; 2 kWh (107 Felder)</b> und <b>LV/LMT (97 Felder)</b>. Kritischer Pfad: Lieferantendaten für Rezyklatanteile &amp; Sorgfaltspflichten sowie die CO₂-Fußabdruck-Berechnung (für EV &amp; Industrie ab 18.02.2027, für LV ab 18.08.2028).</p>",
    espr: "<span class=\"fl\">Empfehlung für ESPR-Hersteller (Möbel, Textil, Stahl, Elektronik)</span><p>Nutzen Sie den <b>freiwilligen Vorlauf (43 Felder im Möbelkatalog)</b> wie im Musterpass <code>ATDEMOB800001</code>: Richten Sie heute schon Ihre kurze GS1-Resolver-Domain (&le; 50 Zeichen), Material-/SVHC-Stammdaten und Reparierbarkeits-Kennzahlen ein, bevor Ihr delegierter Rechtsakt in Kraft tritt.</p>",
    advisor: "<span class=\"fl\">Empfehlung für Beratung, Audit &amp; Systemintegration</span><p>Nutzen Sie im Ersttermin den <b>Pflichtenfinder</b> (<code>example.invalid/pflichtenfinder</code>), führen Sie die <b>4+2 Beispielpässe</b> vor und demonstrieren Sie die Außen- und Innenprüfung mit <b><code>dpplint.example.invalid</code></b> und <b><code>/de/dpp/compliance-check</code></b>.</p>"
  };

  var planRecBox = $("#plan-recommendation");
  $$("[data-plan-role]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      $$("[data-plan-role]").forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      if (planRecBox) planRecBox.innerHTML = PLAN_RECS[btn.dataset.planRole] || PLAN_RECS.battery;
    });
  });
  if (planRecBox) planRecBox.innerHTML = PLAN_RECS.battery;

  var s12Boxes = $$("[data-s12-check]");
  function renderS12Checks() {
    if (!s12Boxes.length) return;
    var checked = s12Boxes.filter(function (c) { return c.checked; }).length;
    var fb = $("#s12-fb");
    if (checked === s12Boxes.length) {
      if (fb) {
        fb.className = "feedback ok";
        fb.innerHTML = "<b>Alle 4 Phasen Ihres 90-Tage-Fahrplans sind bereit!</b> Station 12 ist damit abgeschlossen.";
      }
      markDone("s12");
    } else if (fb) {
      fb.className = "feedback info";
      fb.innerHTML = "<b>" + checked + " von 4 Phasen</b> im 90-Tage-Fahrplan abgehakt.";
    }
  }
  s12Boxes.forEach(function (cb) {
    var k = cb.dataset.s12Check;
    cb.checked = !!state.s12[k];
    cb.addEventListener("change", function () {
      if (cb.checked) state.s12[k] = true;
      else delete state.s12[k];
      save();
      renderS12Checks();
    });
  });
  if (s12Boxes.length) renderS12Checks();

  /* ---------- Live-API-Inspektor im Cockpit (#cockpit) ---------- */
  var COCKPIT_ENDPOINTS = {
    verify: {
      url: "https://dpp.example.invalid/api/verify/ATDEMODEMO0002",
      label: "GET https://dpp.example.invalid/api/verify/ATDEMODEMO0002"
    },
    dpp: {
      url: "https://dpp.example.invalid/api/dpp/v1/dpps/ATDEMODEMO0002",
      label: "GET https://dpp.example.invalid/api/dpp/v1/dpps/ATDEMODEMO0002 (EN 18222)"
    },
    catalogue: {
      url: "https://dpp.example.invalid/api/v1/catalogue",
      label: "GET https://dpp.example.invalid/api/v1/catalogue (211 Katalogfelder)"
    },
    compliance: {
      url: "https://dpp.example.invalid/api/compliance/check?passport_uid=ATDEMODEMO0002&as_of=2027-02-18",
      label: "GET https://dpp.example.invalid/api/compliance/check?passport_uid=ATDEMODEMO0002&as_of=2027-02-18"
    }
  };

  $$("[data-live-endpoint]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.dataset.liveEndpoint;
      var cfg = COCKPIT_ENDPOINTS[key];
      if (!cfg) return;
      var urlEl = $("#cockpit-api-url");
      var stEl = $("#cockpit-api-status");
      var outEl = $("#cockpit-api-out");
      urlEl.innerHTML = "Sende Request: <code>" + esc(cfg.label) + "</code>";
      stEl.textContent = "LADEN ...";
      outEl.textContent = "Verbinde mit https://dpp.example.invalid ...";

      var t0 = performance.now();
      fetch(cfg.url)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var ms = Math.round(performance.now() - t0);
          stEl.textContent = "SIMULIERT (" + ms + " ms)";
          if (key === "catalogue" && data && data.data && Array.isArray(data.data.fields)) {
            outEl.textContent = JSON.stringify({
              status: "ok",
              total_fields: data.data.fields.length,
              requirement_rows: 522,
              first_3_fields_preview: data.data.fields.slice(0, 3)
            }, null, 2);
          } else {
            outEl.textContent = JSON.stringify(data, null, 2);
          }
        })
        .catch(function (err) {
          stEl.textContent = "OFFLINE-FALLBACK";
          outEl.textContent = "// Hinweis: Direkter Browser-Abruf blockiert oder offline (" + String(err) + ").\n// Öffnen Sie die URL direkt im Browser: " + cfg.url;
        });
    });
  });

  /* ---------- Prüfungs-Arena (#arena): Mythen-Radar ---------- */
  var claims = $$("#arena-claims > li");
  var revealBtn = $("#fc-reveal");
  if (claims.length && revealBtn) {
    var picks = {};
    claims.forEach(function (li, idx) {
      $$("button[data-pick]", li).forEach(function (b) {
        b.addEventListener("click", function () {
          if (revealBtn.dataset.revealed === "1") return;
          $$("button[data-pick]", li).forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true");
          picks[idx] = b.dataset.pick;
          var n = Object.keys(picks).length;
          revealBtn.disabled = n < claims.length;
          $("#fc-hint").textContent = n < claims.length
            ? "Noch " + (claims.length - n) + " Aussage(n) offen."
            : "Alle 5 eingeschätzt — jetzt auflösen!";
        });
      });
    });

    revealBtn.addEventListener("click", function () {
      revealBtn.dataset.revealed = "1";
      revealBtn.disabled = true;
      var right = 0;
      claims.forEach(function (li, idx) {
        var ok = picks[idx] === li.dataset.answer;
        if (ok) right++;
        $$("button[data-pick]", li).forEach(function (o) {
          o.disabled = true;
          o.removeAttribute("aria-pressed");
          if (o.dataset.pick === li.dataset.answer) o.classList.add("right");
          else if (o.dataset.pick === picks[idx]) o.classList.add("wrong");
        });
        var p = document.createElement("p");
        p.className = "feedback " + (ok ? "ok" : "bad");
        p.innerHTML = "<b>" + (ok ? "Richtig erkannt: " : "Achtung: ") + "</b>" + esc(li.dataset.explain || "");
        li.appendChild(p);
      });
      $("#fc-hint").textContent = "";
      var fb = $("#fc-fb");
      fb.className = "feedback info";
      fb.innerHTML = "<b>" + right + " von " + claims.length + " Mythen richtig eingeordnet.</b>";
    });
  }

  /* ---------- Praxis-Aufträge (Checkboxes & Copy) ---------- */
  function renderGuide(g) {
    var boxes = $$("input[data-step]", g);
    var n = boxes.filter(function (b) { return b.checked; }).length;
    var st = $('[data-guide-status="' + g.dataset.guide + '"]');
    if (st) {
      st.textContent = n === boxes.length
        ? "Alle " + n + " Hands-on-Schritte erledigt!"
        : n + " von " + boxes.length + " Schritten erledigt";
    }
  }
  $$("input[data-step]").forEach(function (cb) {
    cb.checked = !!state.steps[cb.dataset.step];
    cb.addEventListener("change", function () {
      if (cb.checked) state.steps[cb.dataset.step] = true;
      else delete state.steps[cb.dataset.step];
      save();
      var g = cb.closest("[data-guide]");
      if (g) renderGuide(g);
    });
  });
  $$("[data-guide]").forEach(renderGuide);

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }
  $$(".prompt .copy").forEach(function (b) {
    var label = b.textContent;
    b.addEventListener("click", function () {
      var text = $("pre", b.closest(".prompt")).textContent;
      function done() {
        b.textContent = "Kopiert ✓";
        b.classList.add("copied");
        setTimeout(function () { b.textContent = label; b.classList.remove("copied"); }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else { fallbackCopy(text); done(); }
    });
  });

  /* ---------- Fallbibliothek Filter (#faelle) ---------- */
  $$(".chip[data-filter]").forEach(function (c) {
    c.addEventListener("click", function () {
      var view = c.closest("[data-view]"), f = c.dataset.filter;
      $$(".chip[data-filter]", view).forEach(function (o) {
        o.setAttribute("aria-pressed", o === c ? "true" : "false");
      });
      var cards = $$(".uc-card", view);
      cards.forEach(function (card) { card.hidden = f !== "alle" && card.dataset.cat !== f; });
      var cnt = $("[data-filter-count]", view);
      if (cnt) cnt.textContent = cards.filter(function (k) { return !k.hidden; }).length + " Fälle";
    });
  });

  /* ---------- Abschluss-Checkliste & Druck ---------- */
  var ruleBoxes = $$("#my-rules input");
  ruleBoxes.forEach(function (cb) {
    cb.checked = state.rules.indexOf(cb.value) > -1;
    cb.addEventListener("change", function () {
      state.rules = ruleBoxes.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      save();
    });
  });
  var pr = $("#print");
  if (pr) pr.addEventListener("click", function () { window.print(); });

  /* ---------- Forest Boardroom Dark/Light Theme Toggle & Keyboard Navigation ---------- */
  var themeBtn = $("#theme-toggle");
  function applyTheme(t) {
    if (t === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      if (themeBtn) themeBtn.textContent = "☀";
    } else {
      document.documentElement.removeAttribute("data-theme");
      if (themeBtn) themeBtn.textContent = "◐";
    }
  }
  try {
    var savedTheme = localStorage.getItem("dpp-theme-v1");
    if (savedTheme === "dark") applyTheme("dark");
  } catch (e) { /* ignore */ }
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var isDark = document.documentElement.getAttribute("data-theme") === "dark";
      var nextTheme = isDark ? "light" : "dark";
      applyTheme(nextTheme);
      try { localStorage.setItem("dpp-theme-v1", nextTheme); } catch (e) { /* ignore */ }
    });
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var cur = (location.hash || "#start").slice(1);
    var idx = STATIONS.indexOf(cur);
    if (idx === -1) return;
    if (ev.key === "ArrowRight" && idx < STATIONS.length - 1) {
      location.hash = "#" + STATIONS[idx + 1];
    } else if (ev.key === "ArrowLeft" && idx > 0) {
      location.hash = "#" + STATIONS[idx - 1];
    }
  });

  /* ---------- Station 3: Interaktiver 211-Felder-Katalog-Explorer (Live API + Fallback) ---------- */
  var keBox = $("#katalog-explorer");
  if (keBox) {
    var FALLBACK_FIELDS = [
      { key: "a_manufacturer_id", label: "Erzeuger-Identifikation", description: "Angaben zum Hersteller nach Anhang VI Teil A(1) und Art. 38(7): Name, Handelsname, Postanschrift, Webadresse, E-Mail.", eu_regulation_ref: "Anhang VI Teil A Nr. 1; Art. 38(7)", group_letter: "A", group_label: "A · Allgemeine Batterieinformationen", annex_point: 1, required_for_category: ["lv", "ev", "industrial"] },
      { key: "a_battery_category", label: "Batteriekategorie & Verwendungszweck", description: "Kategorie (EV, Industriebatterie > 2 kWh, LV) sowie vorgesehene Anwendung.", eu_regulation_ref: "Anhang XIII Nr. 1 Buchst. a", group_letter: "A", group_label: "A · Allgemeine Batterieinformationen", annex_point: 1, required_for_category: ["lv", "ev", "industrial"] },
      { key: "b_carbon_footprint_total", label: "CO₂-Fußabdruck der Batterie (Gesamt)", description: "Gesamter CO₂-Fußabdruck in kg CO₂e pro kWh nutzbarer Gesamtenergie über den Lebenszyklus.", eu_regulation_ref: "Art. 7 Abs. 1; Anhang XIII Nr. 1", group_letter: "B", group_label: "B · CO₂-Fußabdruck", annex_point: 1, required_for_category: ["ev", "industrial"] },
      { key: "b_carbon_performance_class", label: "CO₂-Leistungsklasse (A–E)", description: "Einstufung der Batterie in die CO₂-Leistungsklasse nach delegiertem Rechtsakt zu Art. 7.", eu_regulation_ref: "Art. 7 Abs. 2; Anhang XIII Nr. 1", group_letter: "B", group_label: "B · CO₂-Fußabdruck", annex_point: 1, required_for_category: ["ev", "industrial"] },
      { key: "c_supply_chain_due_diligence", label: "Bericht zur Lieferketten-Sorgfaltspflicht (Kobalt, Lithium, Nickel, Naturgraphit)", description: "Nachweis der Sorgfaltspflicht nach Art. 48–52 (entfällt für Kobalt/Nickel bedingt bei LFP-Chemie).", eu_regulation_ref: "Art. 48–52; Anhang XIII Nr. 1", group_letter: "C", group_label: "C · Lieferketten-Sorgfaltspflicht", annex_point: 1, required_for_category: ["ev", "industrial"] },
      { key: "d_recycled_cobalt_share", label: "Rezyklatanteil: Kobalt (%)", description: "Prozentualer Anteil von aus Abfällen zurückgewonnenem Kobalt im aktiven Material.", eu_regulation_ref: "Art. 8; Anhang XIII Nr. 1", group_letter: "D", group_label: "D · Materialzusammensetzung & Rezyklat", annex_point: 1, required_for_category: ["ev", "industrial"] },
      { key: "d_electrolyte_composition", label: "Detaillierte Elektrolyt- & Elektrodenzusammensetzung", description: "Exakte chemische Spezifikation für befugte Reparaturbetriebe, Recycler und Marktüberwachung.", eu_regulation_ref: "Anhang XIII Nr. 2 Buchst. a", group_letter: "D", group_label: "D · Materialzusammensetzung & Rezyklat", annex_point: 2, required_for_category: ["lv", "ev", "industrial"] },
      { key: "e_removable_replaceable_art11", label: "Bestätigung der Entnehmbarkeit & Austauschbarkeit", description: "Nachweis nach Art. 11 für leichte Verkehrsmittel (Pedelec/E-Bike), dass Zellen/Packs durch unabhängige Fachleute tauschbar sind.", eu_regulation_ref: "Art. 11; Anhang XIII Nr. 1", group_letter: "E", group_label: "E · Kreislaufwirtschaft & Demontage", annex_point: 1, required_for_category: ["lv"] },
      { key: "e_spare_parts_suppliers", label: "Teilenummern & Bezugsquellen für Ersatzteile", description: "Postanschrift, E-Mail und Webadresse der Bezugsquellen für Ersatzkomponenten sowie Demontageanleitung.", eu_regulation_ref: "Anhang XIII Nr. 2 Buchst. b–c", group_letter: "E", group_label: "E · Kreislaufwirtschaft & Demontage", annex_point: 2, required_for_category: ["lv", "ev", "industrial"] },
      { key: "f_round_trip_efficiency", label: "Rundlaufwirkungsgrad (Energy Round-Trip Efficiency)", description: "Anfänglicher Energie-Rundlaufwirkungsgrad und Wirkungsgrad bei 50 % der Lebensdauer.", eu_regulation_ref: "Anhang IV; Anhang XIII Nr. 1", group_letter: "F", group_label: "F · Leistung & Haltbarkeit", annex_point: 1, required_for_category: ["ev", "industrial"] },
      { key: "g_notified_body_test_reports", label: "Prüfberichte & Messprotokolle der Konformitätsbewertung", description: "Detaillierte technische Nachweise und Prüfprotokolle für Marktüberwachungsbehörden und Kommission.", eu_regulation_ref: "Anhang XIII Nr. 3", group_letter: "G", group_label: "G · Konformität & Prüfberichte", annex_point: 3, required_for_category: ["lv", "ev", "industrial"] },
      { key: "h_state_of_health_soh", label: "Aktueller Alterungszustand (State of Health, SoH %)", description: "Dynamischer Einzelstück-Messwert zur verbleibenden Kapazität für Werkstätten, Recycler und Zweitnutzer.", eu_regulation_ref: "Anhang XIII Nr. 4 Buchst. a", group_letter: "H", group_label: "H · Dynamische Einzelstück-Betriebsdaten", annex_point: 4, required_for_category: ["lv", "ev", "industrial"] },
      { key: "h_full_charge_cycles", label: "Anzahl vollständiger Lade-/Entladezyklen & Extremereignisse", description: "Aufgezeichnete Zyklenzahl, Tiefentlade- und Übertemperatur-Ereignisse des individuellen Exemplars.", eu_regulation_ref: "Anhang XIII Nr. 4 Buchst. b–d", group_letter: "H", group_label: "H · Dynamische Einzelstück-Betriebsdaten", annex_point: 4, required_for_category: ["lv", "ev", "industrial"] },
      { key: "espr_c_svhc_substances", label: "Besonders besorgniserregende Stoffe (SVHC / REACH > 0,1 %)", description: "Konzentration, CAS-/EG-Nummer und Lokalisierung meldepflichtiger Stoffe im Möbelstück.", eu_regulation_ref: "ESPR (EU) 2024/1781 Art. 7 Abs. 5", group_letter: "C", group_label: "C · Materialien & besorgniserregende Stoffe (ESPR)", annex_point: 1, required_for_category: ["furniture"] },
      { key: "espr_e_repairability_score", label: "Reparierbarkeits- & Zerlegungs-Score (Möbel)", description: "Bewertung der zerstörungsfreien Demontierbarkeit und Verfügbarkeit von Beschlägen/Ersatzteilen.", eu_regulation_ref: "ESPR (EU) 2024/1781 Art. 5 & 9", group_letter: "E", group_label: "E · Reparierbarkeit & Ersatzteile (ESPR)", annex_point: 1, required_for_category: ["furniture"] }
    ];
    var STUFE_LABELS = { 1: "Stufe 1 · Öffentlich", 2: "Stufe 2 · Berechtigtes Interesse", 3: "Stufe 3 · Behörden", 4: "Stufe 4 · Einzelnes Stück" };
    var allFields = FALLBACK_FIELDS.slice();
    var isLiveCatalogue = false;
    var activeCat = "all";
    var activeStufe = 0;
    var query = "";

    function renderCatalogue() {
      var listEl = $("#ke-list");
      var sumEl = $("#ke-summary");
      if (!listEl || !sumEl) return;
      var q = query.trim().toLowerCase();
      var filtered = allFields.filter(function (f) {
        var cats = Array.isArray(f.required_for_category) ? f.required_for_category : [];
        if (activeCat !== "all" && cats.indexOf(activeCat) === -1) return false;
        var st = Number(f.annex_point) || 1;
        if (activeStufe > 0 && st !== activeStufe) return false;
        if (!q) return true;
        return (
          String(f.key || "").toLowerCase().indexOf(q) > -1 ||
          String(f.label || "").toLowerCase().indexOf(q) > -1 ||
          String(f.description || "").toLowerCase().indexOf(q) > -1 ||
          String(f.eu_regulation_ref || "").toLowerCase().indexOf(q) > -1
        );
      });
      sumEl.innerHTML =
        "<span>Quelle: <b>" + (isLiveCatalogue ? "LIVE API (211 Felder geladen)" : "Kuratierter Katalog-Auszug") + "</b></span>" +
        "<span>Treffer: <b>" + filtered.length + " Feld(er)</b> (Anzeige max. 30 Zeilen)</span>";

      if (!filtered.length) {
        listEl.innerHTML = '<div class="ke-row"><b>Keine Felder für diese Filterkombination gefunden.</b><p>Setzen Sie den Suchbegriff oder die Zugriffsstufe zurück.</p></div>';
        return;
      }
      listEl.innerHTML = filtered.slice(0, 30).map(function (f) {
        var st = Number(f.annex_point) || 1;
        var cats = (f.required_for_category || []).join(", ");
        var labelClean = String(f.label || "").replace(/ — /g, ": ").replace(/CO2/g, "CO₂");
        var descClean = String(f.description || "").replace(/ — /g, ": ").replace(/CO2/g, "CO₂");
        return (
          '<div class="ke-row" data-stufe="' + st + '">' +
            '<div class="ke-row-top">' +
              '<b>' + esc(labelClean) + ' <code>' + esc(f.key || "") + '</code></b>' +
              '<span class="tag-b">' + esc(STUFE_LABELS[st] || ("Stufe " + st)) + '</span>' +
            '</div>' +
            '<div class="ke-row-meta">' +
              '<span>Gruppe: ' + esc(f.group_label || f.group_letter || "-") + '</span>' +
              '<span>&middot; Rechtsquelle: ' + esc(f.eu_regulation_ref || "ESPR / BattVO") + '</span>' +
              '<span>&middot; Kategorien: ' + esc(cats || "alle") + '</span>' +
            '</div>' +
            (descClean ? '<p>' + esc(descClean) + '</p>' : '') +
          '</div>'
        );
      }).join("");
    }

    $$("[data-ke-cat]", keBox).forEach(function (b) {
      b.addEventListener("click", function () {
        activeCat = b.dataset.keCat;
        $$("[data-ke-cat]", keBox).forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        renderCatalogue();
      });
    });
    $$("[data-ke-stufe]", keBox).forEach(function (b) {
      b.addEventListener("click", function () {
        activeStufe = Number(b.dataset.keStufe) || 0;
        $$("[data-ke-stufe]", keBox).forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        renderCatalogue();
      });
    });
    var searchIn = $("#ke-search");
    if (searchIn) {
      searchIn.addEventListener("input", function () {
        query = searchIn.value || "";
        renderCatalogue();
      });
    }

    renderCatalogue();
    fetch("https://dpp.example.invalid/api/v1/catalogue")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.data && Array.isArray(j.data.fields) && j.data.fields.length) {
          allFields = j.data.fields;
          isLiveCatalogue = true;
          renderCatalogue();
        }
      })
      .catch(function () { /* keep fallback */ });
  }

  /* ---------- Station 7: Live-Nachweiskette für alle 4 Musterpässe ---------- */
  var nkBox = $("#nachweiskette-box");
  if (nkBox) {
    var NK_FALLBACK = {
      ATDEMODEMO0002: { version: 18, hash: "8f9e89d655b1f554084e11fc44fe5b2b1ae9918d1d49f3fc65e414e8df724ab9", did: "did:oyd:zQmQP8ADbyEfP3Ek2EvXMacxcc9nD5zADGTAZqkKX6CQPST", issuer: "0088:4000000000006", status: "Pass aktiv & in Kraft (EV 78 kWh)" },
      ATDEMOIS2500001: { version: 5, hash: "4a21c7e9012f8d44a62e11bc9901f23a7c8b4410d9e1a23f88b1209c4412e801", did: "did:oyd:zQmQP8ADbyEfP3Ek2EvXMacxcc9nD5zADGTAZqkKX6CQPST", issuer: "0088:4000000000006", status: "Pass aktiv & in Kraft (Industrie 250 kWh LFP)" },
      ATDEMOEB6300001: { version: 5, hash: "7c91e03b2219d84fa1029384756abcedf0192837465fa918273645bcdef01923", did: "did:oyd:zQmQP8ADbyEfP3Ek2EvXMacxcc9nD5zADGTAZqkKX6CQPST", issuer: "0088:4000000000006", status: "Pass aktiv & in Kraft (Pedelec 630 Wh)" },
      ATDEMOB800001: { version: 3, hash: "2f88a19c7742b01928374655abcd1928374650918273645fedcba98765432109", did: "did:oyd:zQmQP8ADbyEfP3Ek2EvXMacxcc9nD5zADGTAZqkKX6CQPST", issuer: "0088:4000000000006", status: "Pass aktiv & in Kraft (Möbel ESPR)" }
    };
    function shortHash(h) {
      return h && h.length > 20 ? h.slice(0, 8) + " … " + h.slice(-8) : h;
    }
    function shortDid(d) {
      return d && d.length > 26 ? d.slice(0, 12) + "…" + d.slice(-6) : d;
    }
    function loadVerifyForUid(uid) {
      var fb = NK_FALLBACK[uid] || NK_FALLBACK.ATDEMODEMO0002;
      $("#nk-version").textContent = "Version " + fb.version;
      $("#nk-status").textContent = fb.status;
      $("#nk-hash").textContent = shortHash(fb.hash);
      $("#nk-did").textContent = shortDid(fb.did);
      fetch("https://dpp.example.invalid/api/verify/" + encodeURIComponent(uid))
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.data) {
            var d = res.data;
            var cert = d.certificate || {};
            $("#nk-version").textContent = "Version " + (d.version || fb.version);
            $("#nk-status").textContent = uid + " · simuliert verifiziert";
            if (cert.snapshot_sha256) $("#nk-hash").textContent = shortHash(cert.snapshot_sha256);
            if (cert.issuer_did) {
              $("#nk-did").textContent = shortDid(cert.issuer_did);
              var link = $("#nk-did-link");
              if (link) link.href = "https://oydid.example.invalid/doc/" + cert.issuer_did;
            }
            var liveBox = $("#hc-live-box");
            var livePre = $("#hc-live-pre");
            if (liveBox && livePre) {
              liveBox.hidden = false;
              livePre.textContent = JSON.stringify(res, null, 2);
            }
            markDone("s7");
          }
        })
        .catch(function () { /* fallback already rendered */ });
    }
    $$("[data-verify-uid]", nkBox).forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$("[data-verify-uid]", nkBox).forEach(function (o) { o.setAttribute("aria-pressed", o === btn ? "true" : "false"); });
        loadVerifyForUid(btn.dataset.verifyUid);
      });
    });
  }

  renderProgress();
  route();
})();
