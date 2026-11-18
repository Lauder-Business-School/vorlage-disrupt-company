'use strict';
// Each learning world is an independent application. Keep destination changes here in the HTML links.
const filterButtons = document.querySelectorAll('[data-filter]');
const courseSpotlights = document.querySelectorAll('[data-course-spotlight]');

function updateFilterStatus(count) {
  const isEn = document.documentElement.lang === 'en';
  const statusEl = document.querySelector('#filter-status');
  if (statusEl) {
    statusEl.textContent = isEn
      ? `${count} ${count === 1 ? 'learning world' : 'learning worlds'} displayed.`
      : `${count} ${count === 1 ? 'Lernwelt' : 'Lernwelten'} angezeigt.`;
  }
}

filterButtons.forEach(button => button.addEventListener('click', () => {
  filterButtons.forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
  let count = 0;
  document.querySelectorAll('.world').forEach(world => { world.hidden = button.dataset.filter !== 'all' && world.dataset.type !== button.dataset.filter; if (!world.hidden) count++; });
  courseSpotlights.forEach(s => { s.hidden = button.dataset.filter === 'simulation'; });
  updateFilterStatus(count);
}));

document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.open).showModal()));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
const dialog = document.querySelector('dialog');
if (dialog) {
  dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
}

// Hero deck: five example scenes, one per learning world. Picking an option shows its consequence.
const motionButton = document.getElementById('motion');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const deck = document.querySelector('[data-deck]');
const scenes = [...deck.querySelectorAll('.scene')];
const deckTabs = [...deck.querySelectorAll('[data-scene]')];
let paused = reducedMotion.matches, engaged = false, current = 0;

function updateMotionLabel() {
  document.documentElement.classList.toggle('motion-paused', paused);
  if (!motionButton) return;
  motionButton.setAttribute('aria-pressed', String(paused));
  const isEn = document.documentElement.lang === 'en';
  motionButton.innerHTML = paused
    ? (isEn ? 'Start animation <span aria-hidden="true">▷</span>' : 'Animation starten <span aria-hidden="true">▷</span>')
    : (isEn ? 'Pause animation <span aria-hidden="true">Ⅱ</span>' : 'Animation pausieren <span aria-hidden="true">Ⅱ</span>');
  deck.classList.toggle('is-playing', !paused && !engaged);
}

function showScene(index) {
  current = (index + scenes.length) % scenes.length;
  scenes.forEach((scene, i) => { const pos = (i - current + scenes.length) % scenes.length; scene.dataset.pos = pos; scene.inert = pos !== 0; });
  deckTabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === current)));
}
updateMotionLabel();
showScene(0);

if (motionButton) {
  motionButton.addEventListener('click', () => { paused = !paused; updateMotionLabel(); });
}
reducedMotion.addEventListener('change', event => { paused = event.matches; updateMotionLabel(); });

// The timer bar on the active tab drives autoplay, so CSS pause states (hover, focus, motion off) pause the deck too.
deck.addEventListener('animationend', event => { if (event.animationName === 'deck-timer') showScene(current + 1); });
deckTabs.forEach((tab, i) => tab.addEventListener('click', () => showScene(i)));

function renderOutcome(scene, button) {
  const outcome = scene.querySelector('.scene-outcome');
  if (!outcome || !button) return;
  const isEn = document.documentElement.lang === 'en';
  const label = document.createElement('strong');
  label.textContent = isEn ? 'Consequence:' : 'Folge:';
  const text = (isEn && button.dataset.outcomeEn) ? button.dataset.outcomeEn : button.dataset.outcome;
  outcome.replaceChildren(label, document.createTextNode(' ' + text));
}

scenes.forEach(scene => {
  const choices = scene.querySelector('.scene-choices');
  choices.querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      choices.classList.add('has-choice');
      choices.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      renderOutcome(scene, button);
      engaged = true;
      updateMotionLabel();
    });
  });
});

// Institution-specific content, with keyboard navigation matching the ARIA tab pattern.
const audienceTabs = [...document.querySelectorAll('[role="tab"][aria-controls]')];
function activateAudience(tab) {
  audienceTabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(item.getAttribute('aria-controls'));
    if (panel) panel.hidden = !selected;
  });
}
audienceTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateAudience(tab));
  tab.addEventListener('keydown', event => {
    const steps = { ArrowRight: 1, ArrowLeft: -1 };
    let target;
    if (event.key in steps) target = (index + steps[event.key] + audienceTabs.length) % audienceTabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = audienceTabs.length - 1;
    else return;
    event.preventDefault();
    activateAudience(audienceTabs[target]);
    audienceTabs[target].focus();
  });
});

// Perspectives object in German and English
const perspectives = {
  de: {
    innovation: ['DIE CHANCE PRÜFEN', 'Welche Annahme entscheidet über den Kundennutzen?', 'Was ist der kleinste Test, der uns vor dem Start echte Erkenntnisse liefert? Und was verlieren wir, wenn wir ohne diese Erkenntnis loslegen?'],
    finance: ['DIE WETTE BEGRENZEN', 'Welchen Einsatz können wir uns für diese Annahme leisten?', 'Welche Kosten entstehen durch eine Verschiebung, und welche, wenn wir am Kundenbedarf vorbeientwickeln? Welche Zahl brauchen wir für eine begründete Entscheidung?'],
    security: ['DIE FOLGEN MITDENKEN', 'Welche offenen Risiken tragen wir in den Start hinein?', 'Welche Daten und Abläufe berührt der Service? Welcher Test klärt das größte Risiko, und welche Verantwortung übernimmt das Team mit seiner Entscheidung?'],
    dpp: ['DEN PRODUKTPASS ABSICHERN', 'Sind CO₂-Fußabdruck, Lieferkette und Pflichtfelder vor dem Marktstart prüfsicher belegt?', 'Welche Nachweise verlangt die EU-Verordnung (ESPR / BattVO)? Blockiert unser Fail-Closed-Gatekeeper unbestätigte KI-Schätzwerte, bevor der Pass mit did:oyd signiert wird?']
  },
  en: {
    innovation: ['TEST THE OPPORTUNITY', 'Which assumption determines customer value?', 'What is the smallest test that delivers real insights before launch? And what do we risk by launching without that insight?'],
    finance: ['CAP THE BET', 'What investment can we afford to make on this assumption?', 'What are the costs of delaying, versus building past customer demand? What specific number do we need for a justified decision?'],
    security: ['ANTICIPATE IMPACT', 'What unresolved risks are we carrying into the launch?', 'Which data flows and operations does the service touch? What test addresses the highest risk, and what responsibility does the team take?'],
    dpp: ['VERIFY THE PRODUCT PASSPORT', 'Are carbon footprint, supply chain, and mandatory DPP fields audit-ready before launch?', 'Which evidence does the EU mandate (ESPR / Battery Reg) require? Does our fail-closed gatekeeper block unverified AI estimates before sealing the passport via did:oyd?']
  }
};

let currentPerspective = 'innovation';

function updatePerspective(key) {
  currentPerspective = key || currentPerspective;
  const lang = document.documentElement.lang === 'en' ? 'en' : 'de';
  const data = perspectives[lang][currentPerspective] || perspectives.de[currentPerspective];
  if (!data) return;
  const [kicker, question, detail] = data;
  const kEl = document.getElementById('perspective-kicker');
  const qEl = document.getElementById('perspective-question');
  const dEl = document.getElementById('perspective-detail');
  if (kEl) kEl.textContent = kicker;
  if (qEl) qEl.textContent = question;
  if (dEl) dEl.textContent = detail;
}

document.querySelectorAll('[data-perspective]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-perspective]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  updatePerspective(button.dataset.perspective);
}));

// Prepare a draft locally. No network submission, storage or automatic mail launch.
const inquiryForm = document.getElementById('inquiry-form');
const inquiryResult = document.getElementById('inquiry-result');
const inquiryDraft = document.getElementById('inquiry-draft');
const inquiryStatus = document.getElementById('inquiry-status');

function prepareInquiry() {
  if (!inquiryForm || !inquiryForm.reportValidity()) return;
  const isEn = document.documentElement.lang === 'en';
  const fields = new FormData(inquiryForm);
  const value = name => String(fields.get(name) || '').trim() || (isEn ? 'Open' : 'Noch offen');
  const subject = isEn ? `DISRUPT: Deployment Inquiry: ${value('lernwelt')}` : `DISRUPT: Einsatzanfrage: ${value('lernwelt')}`;
  const body = isEn ? [
    'Hello Stefan,', '',
    'I would like to discuss deploying a DISRUPT simulation / learning world.', '',
    `Institution type: ${value('organisation')}`,
    `Institution / Program: ${value('einrichtung')}`,
    `Simulation / Course: ${value('lernwelt')}`,
    `Licensing framework: ${value('lizenz')}`,
    `Expected participants: ${value('teilnehmende')}`,
    `Timeframe: ${value('zeitraum')}`, '',
    'Learning objectives and key requirements:', value('anliegen'), '',
    'Please let us schedule a conversation to discuss educational fit, scope, and pricing for this initiative.', '',
    'Best regards'
  ].join('\n') : [
    'Hallo Stefan,', '',
    'ich möchte den Einsatz einer DISRUPT-Lernwelt besprechen.', '',
    `Einrichtungstyp: ${value('organisation')}`,
    `Einrichtung / Programm: ${value('einrichtung')}`,
    `Lernwelt: ${value('lernwelt')}`,
    `Lizenzrahmen: ${value('lizenz')}`,
    `Erwartete Teilnehmende: ${value('teilnehmende')}`,
    `Zeitraum: ${value('zeitraum')}`, '',
    'Lernziel und wichtige Anforderungen:', value('anliegen'), '',
    'Bitte lass uns die fachliche Passung, den Leistungsumfang und die Konditionen für diesen Einsatz besprechen.', '',
    'Viele Grüße'
  ].join('\n');

  if (inquiryDraft) inquiryDraft.value = body;
  const openLink = document.getElementById('open-inquiry-mail');
  if (openLink) {
    openLink.href = `mailto:kontakt@example.invalid?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  if (inquiryResult) inquiryResult.hidden = false;
  if (inquiryStatus) {
    inquiryStatus.textContent = isEn
      ? 'Draft created. Nothing was sent. Review the message and open your email client or copy the text.'
      : 'Entwurf erstellt. Es wurde nichts versendet. Prüfe den Text und öffne dein E-Mail-Programm oder kopiere ihn.';
  }
  if (inquiryDraft) inquiryDraft.focus();
}

if (inquiryForm) {
  inquiryForm.addEventListener('submit', event => { event.preventDefault(); prepareInquiry(); });
  inquiryForm.addEventListener('input', () => { if (inquiryResult) inquiryResult.hidden = true; });
  inquiryForm.addEventListener('change', () => { if (inquiryResult) inquiryResult.hidden = true; });
}

const prepBtn = document.getElementById('prepare-inquiry');
if (prepBtn) prepBtn.addEventListener('click', prepareInquiry);

document.querySelectorAll('[data-world], [data-license], [data-org]').forEach(link => link.addEventListener('click', () => {
  if (link.dataset.world && document.getElementById('inquiry-world')) document.getElementById('inquiry-world').value = link.dataset.world;
  if (link.dataset.license && document.getElementById('inquiry-license')) document.getElementById('inquiry-license').value = link.dataset.license;
  if (link.dataset.org && document.getElementById('inquiry-org')) document.getElementById('inquiry-org').value = link.dataset.org;
  if (inquiryResult) inquiryResult.hidden = true;
}));

const copyBtn = document.getElementById('copy-inquiry');
if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    const isEn = document.documentElement.lang === 'en';
    try {
      await navigator.clipboard.writeText(inquiryDraft.value);
      inquiryStatus.textContent = isEn
        ? 'Inquiry draft copied. You can paste it into your email program and send it yourself.'
        : 'Anfragetext kopiert. Du kannst ihn in deinem E-Mail-Programm einfügen und selbst versenden.';
    } catch {
      inquiryDraft.focus();
      inquiryDraft.select();
      inquiryStatus.textContent = isEn
        ? 'Automatic copy not available. Text has been selected — please copy with your device shortcut.'
        : 'Automatisches Kopieren ist hier nicht verfügbar. Der Text ist markiert; kopiere ihn bitte über die Kopierfunktion deines Geräts.';
    }
  });
}

// Mobile navigation drawer toggle
const menuToggle = document.getElementById('menu-toggle');
const mobileNav = document.getElementById('mobile-nav');

function updateMenuAria(open) {
  if (!menuToggle) return;
  const isEn = document.documentElement.lang === 'en';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? (isEn ? 'Close menu' : 'Menü schließen') : (isEn ? 'Open menu' : 'Menü öffnen'));
}

if (menuToggle && mobileNav) {
  function toggleMobileNav(open) {
    const shouldOpen = open !== undefined ? open : mobileNav.hidden;
    mobileNav.hidden = !shouldOpen;
    updateMenuAria(shouldOpen);
    document.body.style.overflow = shouldOpen ? 'hidden' : '';
  }
  menuToggle.addEventListener('click', () => toggleMobileNav());
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => toggleMobileNav(false));
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !mobileNav.hidden) toggleMobileNav(false);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 700 && !mobileNav.hidden) toggleMobileNav(false);
  });
}

// React to language toggle events dispatched by i18n.js
window.addEventListener('langchange', () => {
  updateMotionLabel();
  updatePerspective();
  if (menuToggle && mobileNav) {
    updateMenuAria(!mobileNav.hidden);
  }
  // Re-render any active hero outcome
  scenes.forEach(scene => {
    const activeChoice = scene.querySelector('.scene-choices button[aria-pressed="true"]');
    if (activeChoice) {
      renderOutcome(scene, activeChoice);
    }
  });
  // Update filter status if active
  const activeFilterBtn = document.querySelector('[data-filter].active');
  if (activeFilterBtn) {
    let count = 0;
    document.querySelectorAll('.world').forEach(w => { if (!w.hidden) count++; });
    updateFilterStatus(count);
  }
  // If inquiry draft is visible, update text
  if (inquiryResult && !inquiryResult.hidden) {
    prepareInquiry();
  }
});
