/* cursor.js — dot + lagging ring, contextual labels. Fine pointers only. */

export function initCursor() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return null;

  const root = document.documentElement;
  const el = document.querySelector('.cursor');
  const dot = el?.querySelector('.cursor__dot');
  const ring = el?.querySelector('.cursor__ring');
  const label = el?.querySelector('.cursor__label');
  if (!el || !dot || !ring || !label) return null;

  root.classList.add('has-cursor');

  let tx = -100, ty = -100;      // target (pointer)
  let rx = tx, ry = ty;          // ring position
  let raf = 0, running = false, last = performance.now();
  let current = null;

  const INTERACTIVE = 'a, button, [data-cursor], summary, label, input, textarea';

  function setState(target) {
    const host = target && target.closest ? target.closest(INTERACTIVE) : null;
    if (host === current) return;
    current = host;
    const isField = host && host.matches('input, textarea');
    el.classList.toggle('is-link', !!host && !isField);
    const text = host && !isField ? host.getAttribute('data-cursor') : null;
    if (text) {
      label.textContent = text;
      el.classList.add('is-label');
    } else {
      el.classList.remove('is-label');
    }
    el.classList.toggle('is-field', !!isField);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = 1 - Math.exp(-dt * 14);
    rx += (tx - rx) * k;
    ry += (ty - ry) * k;
    dot.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    if (Math.abs(tx - rx) < 0.05 && Math.abs(ty - ry) < 0.05) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    if (!el.classList.contains('is-visible')) {
      rx = tx = e.clientX; ry = ty = e.clientY;
      el.classList.add('is-visible');
    }
    tx = e.clientX; ty = e.clientY;
    setState(e.target);
    kick();
  };
  const onLeave = () => el.classList.remove('is-visible');
  const onEnter = () => el.classList.add('is-visible');
  const onDown = () => ring.animate(
    [{ scale: 1 }, { scale: 0.8 }, { scale: 1 }],
    { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  );

  // Re-check what is under a stationary pointer while the page scrolls
  let scrollRaf = 0;
  const onScroll = () => {
    if (scrollRaf || !el.classList.contains('is-visible')) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      setState(document.elementFromPoint(tx, ty));
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  document.documentElement.addEventListener('mouseenter', onEnter);
  window.addEventListener('blur', onLeave);

  // If the pointer type changes (e.g. hybrid devices), remove the custom cursor
  const onMqChange = () => { if (!fine.matches) destroy(); };
  fine.addEventListener?.('change', onMqChange);

  function destroy() {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(scrollRaf);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    document.documentElement.removeEventListener('mouseenter', onEnter);
    window.removeEventListener('blur', onLeave);
    fine.removeEventListener?.('change', onMqChange);
    root.classList.remove('has-cursor');
  }
  return { destroy };
}
