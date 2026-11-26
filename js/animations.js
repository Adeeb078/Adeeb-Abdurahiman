/* animations.js — reveals, split-text, progress bar, parallax tilt, active nav */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Wrap each word of [data-split] elements so it can slide up from a mask. */
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.className = 'w';
          const wi = document.createElement('span');
          wi.className = 'wi';
          wi.textContent = part;
          w.append(wi);
          frag.append(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(el);
  el.querySelectorAll('.wi').forEach((wi, i) => wi.style.setProperty('--i', i));
  // Keep the full sentence available to assistive tech as one string
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  el.querySelectorAll('.w').forEach((w) => w.setAttribute('aria-hidden', 'true'));
}

export function initReveals() {
  document.querySelectorAll('[data-split]').forEach(splitWords);

  const targets = document.querySelectorAll('[data-reveal], [data-split], .pipeline');
  if (reduced() || !('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('is-in'));
    return { destroy() {} };
  }

  // Stagger siblings that enter together
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.setProperty('--delay', `${Math.min(n++, 6) * 0.08}s`);
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  // Hero content plays in on load (staggered) instead of waiting for the observer
  const heroItems = [...document.querySelectorAll('.hero [data-reveal], .hero [data-split]')];
  const timers = heroItems.map((el, i) => {
    io.unobserve(el);
    return setTimeout(() => {
      el.style.setProperty('--delay', `${i * 0.09}s`);
      el.classList.add('is-in');
    }, 80);
  });

  targets.forEach((t) => { if (!t.closest('.hero')) io.observe(t); });
  return { destroy() { io.disconnect(); timers.forEach(clearTimeout); } };
}

export function initProgress() {
  const bar = document.querySelector('.progress__bar');
  if (!bar) return { destroy() {} };
  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    ticking = false;
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
  return { destroy() { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); } };
}

/** Nav: hide on scroll down, show on scroll up; mark active section. */
export function initNav() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const links = [...document.querySelectorAll('[data-nav]')];
  if (!nav) return { destroy() {} };

  let lastY = window.scrollY, ticking = false;
  const update = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
    const open = nav.classList.contains('is-open');
    const goingDown = y > lastY + 4, goingUp = y < lastY - 4;
    if (!open) {
      if (goingDown && y > 400) nav.classList.add('is-hidden');
      else if (goingUp || y < 400) nav.classList.remove('is-hidden');
    }
    if (goingDown || goingUp) lastY = y;
    ticking = false;
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  update();

  // Keep nav visible while it has keyboard focus
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  // Mobile menu
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle?.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
  const onKey = (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle?.focus(); } };
  document.addEventListener('keydown', onKey);
  const mq = window.matchMedia('(min-width: 761px)');
  const onMq = () => { if (mq.matches) setOpen(false); };
  mq.addEventListener?.('change', onMq);

  // Active link
  const map = new Map();
  links.forEach((a) => {
    const sec = document.querySelector(a.getAttribute('href'));
    if (sec) map.set(sec, a);
  });
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
        const a = map.get(entry.target);
        if (a) { a.classList.add('is-active'); a.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, sec) => io.observe(sec));
    // Clear when back in hero
    const hero = document.getElementById('top');
    if (hero) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting) links.forEach((l) => { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
      }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
    }
  }

  return {
    destroy() {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener?.('change', onMq);
      io?.disconnect();
    },
  };
}

/** Very light pointer tilt on project visuals (fine pointers, motion allowed). */
export function initTilt() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine || reduced()) return { destroy() {} };
  const cleanups = [];
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const svg = el.querySelector('svg');
    if (!svg) return;
    let raf = 0;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        svg.style.transform = `scale(1.035) translate3d(${x * -14}px, ${y * -10}px, 0)`;
      });
    };
    const leave = () => { cancelAnimationFrame(raf); svg.style.transform = ''; };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    cleanups.push(() => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); });
  });
  return { destroy: () => cleanups.forEach((c) => c()) };
}
