const SELECTOR = [
  'main section .eyebrow',
  'main section h2',
  'main section ul.list-check',
  'main section .lead',
  'main .card',
  'main .tile',
  'main .grid > *',
  'main section svg[class*="wsi-"]',
  'main .table-wrap',
  'main details',
].join(',');

const main = document.querySelector<HTMLElement>('main');
const header = document.querySelector<HTMLElement>('[data-header]');
const hero = (main?.firstElementChild ?? null) as HTMLElement | null;

// Top edge within 90% of the viewport, i.e. already visible at load.
const inView = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.top < innerHeight * 0.9 && r.bottom > 0;
};

// ---- Masked line reveal for section headings ----
// A heading is split into one masked block per rendered line while it waits to be revealed;
// the original markup is restored once the last line has landed, so later resizes reflow normally.
const original = new WeakMap<HTMLElement, string>();

function splitLines(el: HTMLElement): boolean {
  // Only plain text with optional one-level inline wrappers (e.g. <span class="accent">).
  const parts: { word: string; tag?: string; cls?: string }[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const w of (node.textContent ?? '').split(/\s+/)) if (w) parts.push({ word: w });
    } else if (node instanceof HTMLElement && node.children.length === 0) {
      for (const w of node.textContent!.split(/\s+/))
        if (w) parts.push({ word: w, tag: node.tagName.toLowerCase(), cls: node.className });
    } else {
      return false;
    }
  }
  if (parts.length < 2) return false;

  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = (p: (typeof parts)[number]) =>
    p.tag ? `<${p.tag} class="${esc(p.cls ?? '')}">${esc(p.word)}</${p.tag}>` : esc(p.word);

  original.set(el, el.innerHTML);
  el.innerHTML = parts.map((p) => `<span class="ws-w">${html(p)}</span>`).join(' ');
  const lines: string[][] = [];
  let top = NaN;
  el.querySelectorAll<HTMLElement>('.ws-w').forEach((w, i) => {
    if (w.offsetTop !== top) {
      top = w.offsetTop;
      lines.push([]);
    }
    lines[lines.length - 1].push(html(parts[i]));
  });
  el.innerHTML = lines
    .map((l, i) => `<span class="ws-line" style="--line-i:${i}"><span>${l.join(' ')}</span></span>`)
    .join('');
  return true;
}

function restoreLines(el: HTMLElement) {
  const inner = el.querySelectorAll<HTMLElement>('.ws-line > span');
  const last = inner[inner.length - 1];
  const done = () => {
    el.innerHTML = original.get(el) ?? el.innerHTML;
    el.removeAttribute('data-reveal');
  };
  if (!last) return done();
  last.addEventListener('transitionend', (e) => e.target === last && done());
}

function show(el: HTMLElement, attr: string) {
  el.classList.add('is-in');
  if (el.dataset.reveal === 'lines') return restoreLines(el);
  el.addEventListener('transitionend', () => el.removeAttribute(attr), { once: true });
}

function reveal(root: HTMLElement) {
  // Read layout first, then write, to avoid interleaved reads and writes.
  const sections = Array.from(root.children).filter(
    (el): el is HTMLElement => el.tagName === 'SECTION' && el !== hero && !inView(el),
  );
  const children = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(
    (el) => !hero?.contains(el) && !inView(el),
  );

  const sectionIO = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        const section = target as HTMLElement;
        sectionIO.unobserve(section);
        show(section, 'data-section-reveal');
        section.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => show(el, 'data-reveal'));
      }
    },
    { threshold: 0.15 },
  );
  const childIO = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        childIO.unobserve(target);
        show(target as HTMLElement, 'data-reveal');
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
  );

  for (const section of sections) {
    section.setAttribute('data-section-reveal', '');
    sectionIO.observe(section);
  }

  for (const el of children) {
    el.setAttribute('data-reveal', el.tagName === 'H2' && splitLines(el) ? 'lines' : '');
    // Children of a hidden section are revealed together with that section.
    if (!el.closest('[data-section-reveal]')) childIO.observe(el);
  }

  // Stagger: each chunk enters 100ms after the previous one in document order within its
  // section (eyebrow, heading, lead, list, art, cards), capped so long grids never drag.
  const order = new Map<Element, number>();
  for (const el of children) {
    const group = el.closest('section') ?? root;
    const i = order.get(group) ?? 0;
    el.style.setProperty('--reveal-i', String(Math.min(i, 6)));
    order.set(group, i + 1);
  }
}

function headerScroll(el: HTMLElement) {
  let ticking = false;
  const update = () => {
    ticking = false;
    el.classList.toggle('is-scrolled', scrollY > 8);
  };
  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

// Pointer tilt + edge glow for every illustration. Runs only on fine hover pointers
// (gated by the caller); each svg gets its own lerp loop that stops once settled.
const TILT_VARS = ['--rx', '--ry', '--tx', '--ty'];

function tilt(svg: SVGElement, area: HTMLElement) {
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const step = () => {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    const settled = Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001;
    if (settled) (cx = tx), (cy = ty);
    if (settled && !tx && !ty) {
      for (const name of TILT_VARS) svg.style.removeProperty(name);
    } else {
      svg.style.setProperty('--rx', `${(-cy * 3).toFixed(3)}deg`);
      svg.style.setProperty('--ry', `${(cx * 4).toFixed(3)}deg`);
      svg.style.setProperty('--tx', `${(cx * 6).toFixed(3)}px`);
      svg.style.setProperty('--ty', `${(cy * 6).toFixed(3)}px`);
    }
    raf = settled ? 0 : requestAnimationFrame(step);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };
  area.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    svg.classList.add('is-pointer');
  });
  area.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      const r = svg.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      kick();
    },
    { passive: true },
  );
  area.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    svg.classList.remove('is-pointer');
    tx = 0;
    ty = 0;
    kick();
  });
}

if (main) {
  // Header scrolled state is a visual state, not motion: it runs under reduced motion too.
  if (header) headerScroll(header);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    main.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => el.classList.add('is-in'));
  } else {
    reveal(main);
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      main.querySelectorAll<SVGElement>('svg.wsi').forEach((svg) => {
        const area = svg.closest<HTMLElement>('section') ?? svg.parentElement;
        if (area) tilt(svg, area);
      });
    }
  }
}
