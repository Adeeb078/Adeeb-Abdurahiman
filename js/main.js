/* main.js — entry point */
import { CONFIG } from './config.js';
import { initCursor } from './cursor.js';
import { initRepos } from './repos.js';
import { initReveals, initProgress, initNav, initTilt } from './animations.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Personal details from config ---------- */
function applyConfig() {
  document.querySelectorAll('[data-config="email"]').forEach((a) => {
    a.href = `mailto:${CONFIG.email}`;
    a.textContent = CONFIG.email;
  });
  document.querySelectorAll('[data-config="linkedin"]').forEach((a) => {
    a.href = CONFIG.linkedin;
    if (a.closest('.contact__links')) a.textContent = CONFIG.linkedin.replace(/^https?:\/\/(www\.)?/, '');
  });
}

/* ---------- Theme switch ---------- */
function initTheme() {
  const btn = document.getElementById('theme-toggle');
  const meta = document.querySelector('meta[name="theme-color"]');
  const root = document.documentElement;
  if (!btn) return;
  const sync = () => {
    const light = root.dataset.theme === 'light';
    btn.setAttribute('aria-pressed', String(light));
    btn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    meta?.setAttribute('content', light ? '#f3f0e8' : '#0b0c0a');
  };
  sync();
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
    sync();
    window.dispatchEvent(new Event('themechange'));
  });
}

/* ---------- Small details ---------- */
function initClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: CONFIG.timezone });
  const tick = () => { el.textContent = fmt.format(new Date()) + ' GST'; };
  tick();
  setInterval(tick, 30000);
}

function initFooter() {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  document.getElementById('to-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  });
}

/* Placeholder project links should not navigate anywhere */
function initPlaceholders() {
  document.querySelectorAll('a[data-placeholder]').forEach((a) => {
    a.addEventListener('click', (e) => e.preventDefault());
    a.setAttribute('tabindex', '-1');
  });
}

/* ---------- Contact form ---------- */
function initForm() {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  if (!form || !status) return;

  const rules = {
    name: (v) => (v.trim().length < 2 ? 'Please enter your name.' : ''),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address.'),
    subject: (v) => (v.trim().length < 3 ? 'Please add a short subject.' : ''),
    message: (v) => (v.trim().length < 10 ? 'Message should be at least 10 characters.' : ''),
  };

  function validateField(name) {
    const input = form.elements[name];
    const msg = rules[name](input.value);
    const field = input.closest('.field');
    field.classList.toggle('has-error', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    document.getElementById(`e-${name}`).textContent = msg;
    return !msg;
  }

  Object.keys(rules).forEach((name) => {
    const input = form.elements[name];
    input.addEventListener('blur', () => validateField(name));
    input.addEventListener('input', () => {
      if (input.closest('.field').classList.contains('has-error')) validateField(name);
    });
  });

  const setStatus = (text, kind) => {
    status.textContent = text;
    status.className = 'form__status' + (kind ? ` is-${kind}` : '');
  };

  let lastSent = 0;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const results = Object.keys(rules).map(validateField);
    if (results.includes(false)) {
      setStatus('Please fix the highlighted fields.', 'error');
      form.querySelector('.has-error input, .has-error textarea')?.focus();
      return;
    }
    // Honeypot: pretend success for bots
    if (form.elements._gotcha.value) { setStatus('Thanks, message sent.', 'success'); form.reset(); return; }
    // Client-side throttle (real rate limiting lives with the form provider)
    if (Date.now() - lastSent < 15000) { setStatus('Please wait a few seconds before sending again.', 'error'); return; }

    const data = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      subject: form.elements.subject.value.trim(),
      message: form.elements.message.value.trim(),
    };

    // No endpoint configured: hand off to the visitor's mail client rather than faking a send
    if (!CONFIG.formEndpoint) {
      const body = `${data.message}\n\n— ${data.name} (${data.email})`;
      window.location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(body)}`;
      setStatus('Opening your email app with the message ready to send.', 'success');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    setStatus('Sending…', '');
    try {
      const res = await fetch(CONFIG.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      lastSent = Date.now();
      form.reset();
      setStatus('Thanks, your message has been sent. I will get back to you soon.', 'success');
    } catch {
      setStatus(`Something went wrong. Please try again or email ${CONFIG.email} directly.`, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------- WebGL scene (lazy, with fallback) ---------- */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

async function bootScene() {
  const canvas = document.getElementById('scene-canvas');
  if (!canvas) return;
  if (!webglAvailable()) { document.documentElement.classList.add('no-webgl'); return; }
  try {
    const { initScene } = await import('./scene.js');
    initScene({ canvas, reducedMotion });
  } catch (err) {
    console.warn('Particle scene unavailable, using static fallback.', err);
    document.documentElement.classList.add('no-webgl');
  }
}

/* ---------- Boot ---------- */
applyConfig();
initTheme();
initFooter();
initClock();
initPlaceholders();
initForm();
initRepos();
initNav();
initProgress();
initReveals();
initTilt();
initCursor();
bootScene();
