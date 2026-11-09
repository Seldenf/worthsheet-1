// Chunks that enter on scroll. Illustrations (svg.wsi) and checklists (ul.list-check) own their
// entrance (see revealIllustrations / revealChecklists) and are not listed here. Markup may also
// opt in with a bare data-reveal attribute.
const SELECTOR = [
  'main section .eyebrow',
  'main section .lead',
  'main .card',
  'main .tile',
  'main .grid > *',
  'main section svg[class*="wsi-"]',
  'main .table-wrap',
  'main details',
  'main [data-reveal]',
].join(',');

// Headings that rise line by line (see splitLines). Card titles, FAQ questions, navigation and anything
// inside an illustration stay out; the hero headline has its own entrance in its page.
const HEADINGS = 'main h1, main h2, main h3';
const HEADING_OUT = '.card, summary, nav, svg, footer';

const main = document.querySelector<HTMLElement>('main');
const header = document.querySelector<HTMLElement>('[data-header]');
const hero = (main?.firstElementChild ?? null) as HTMLElement | null;

// Top edge within 90% of the viewport, i.e. already visible at load.
const inView = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.top < innerHeight * 0.9 && r.bottom > 0;
};

// ---- Load sequence (see "Load sequence" in motion.css) ----
// The grid, the card and the content inside it enter from CSS animations that begin at first style. introAt() runs a
// callback at a time on that sequence's clock, anchored to the start of the hero card's animation so the timers stay
// in step with it however late the script runs; without a gridded hero the clock counts from navigation start.
const INTRO_INNER = 400; // content inside the card starts (matches --intro-inner in motion.css)
const INTRO_DONE = 1400; // the cells may start to light up (html.intro-done)
const gridHero = hero?.matches('.sheet-section.has-grid') ? hero : null;
const introAnimation = gridHero
  ?.querySelector('.sheet')
  ?.getAnimations()
  .find((a) => (a as CSSAnimation).animationName === 'ws-card-in');
const introStart = introAnimation ? performance.now() - Number(introAnimation.currentTime ?? 0) : 0;
const introAt = (ms: number, run: () => void) =>
  setTimeout(run, Math.max(0, introStart + ms - performance.now()));

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
    } else if (
      node instanceof HTMLElement &&
      node.children.length === 0 &&
      node.tagName !== 'BR' &&
      [...node.attributes].every((a) => a.name === 'class')
    ) {
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
  // Fallback if the transition never runs (e.g. the element was hidden meanwhile).
  setTimeout(done, 2000);
}

function show(el: HTMLElement, attr: string) {
  el.classList.add('is-in');
  if (el.dataset.reveal === 'lines') return restoreLines(el);
  // Only this element's own transition ends the reveal, never one bubbling up from a child.
  const done = (e: TransitionEvent) => {
    if (e.target !== el) return;
    el.removeEventListener('transitionend', done);
    el.removeAttribute(attr);
  };
  el.addEventListener('transitionend', done);
}

// Sections never move or hide; their chunks do. Chunks of a section below the fold are revealed
// together (staggered by --reveal-i) when the section's top edge reaches 88% of the viewport, so a
// section of any height always triggers. Chunks outside such a section reveal one by one.
function reveal(root: HTMLElement) {
  // Read layout first, then write, to avoid interleaved reads and writes.
  const sections = Array.from(root.children).filter(
    (el): el is HTMLElement => el.tagName === 'SECTION' && el !== hero && !inView(el),
  );
  // Headings: a pending heading joins the chunks below; one already in view is split and risen at once.
  const headings = Array.from(root.querySelectorAll<HTMLElement>(HEADINGS)).filter(
    (el) => !hero?.contains(el) && !el.closest(HEADING_OUT),
  );
  const liveHeadings = headings.filter((el) => inView(el));
  const candidates = [
    ...new Set([
      ...Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (el) =>
          !hero?.contains(el) &&
          !inView(el) &&
          // Illustrations with .wsi-in parts own their intro; hiding the svg too would hide it twice.
          !(el instanceof SVGElement && el.querySelector('.wsi-in')),
      ),
      ...headings.filter((el) => !inView(el)),
    ]),
  ];
  // A chunk inside another chunk rides along with its parent instead of being hidden twice.
  const children = candidates.filter((el) => !candidates.some((other) => other !== el && other.contains(el)));
  const playNow = liveHeadings.filter((h) => !children.some((c) => c.contains(h)));

  // Chunks tagged in markup that are already visible (or ride along with a parent) must not stay hidden.
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    if (!children.includes(el)) el.classList.add('is-in');
  });
  for (const h of playNow) {
    if (!splitLines(h)) continue;
    h.setAttribute('data-reveal', 'lines');
    void h.offsetWidth; // commit the masked start state so the lines transition from it
    show(h, 'data-reveal');
  }

  const groups = new Map<HTMLElement, HTMLElement[]>();
  const loose: HTMLElement[] = [];
  for (const el of children) {
    const section = sections.find((s) => s.contains(el));
    if (section) groups.set(section, [...(groups.get(section) ?? []), el]);
    else loose.push(el);
  }

  const sectionIO = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        sectionIO.unobserve(target);
        groups.get(target as HTMLElement)?.forEach((el) => show(el, 'data-reveal'));
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
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

  for (const el of children) {
    el.setAttribute('data-reveal', /^H[123]$/.test(el.tagName) && splitLines(el) ? 'lines' : '');
  }
  for (const section of groups.keys()) sectionIO.observe(section);
  for (const el of loose) childIO.observe(el);

  // Stagger: each chunk enters 100ms after the previous one in document order within its
  // section (eyebrow, heading, lead, art, cards), capped so long grids never drag.
  const order = new Map<Element, number>();
  for (const el of children) {
    const group = el.closest('section') ?? root;
    const i = order.get(group) ?? 0;
    el.style.setProperty('--reveal-i', String(Math.min(i, 6)));
    order.set(group, i + 1);
  }
}

// Illustrations own their entrance class, independent of section reveal. Those already in
// view (or in the hero) get is-in at once; the rest get it on first intersection. is-in is
// never removed, so the transitionend cleanup in show() never touches svgs.
function revealIllustrations(root: HTMLElement) {
  const svgs = Array.from(root.querySelectorAll<SVGElement>('svg.wsi'));
  const immediate = svgs.filter((svg) => hero?.contains(svg) || inView(svg));
  const later = svgs.filter((svg) => !immediate.includes(svg));

  const io = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        io.unobserve(target);
        target.classList.add('is-in');
      }
    },
    { threshold: 0.15 },
  );

  for (const svg of immediate) {
    if (gridHero?.contains(svg)) introAt(INTRO_INNER, () => svg.classList.add('is-in'));
    else svg.classList.add('is-in');
  }
  for (const svg of later) io.observe(svg);
}

// Checklists: every item gets its index as --i. Non-hero lists are revealed (is-in) once in
// view; the hero list animates from CSS on load. Hidden state exists only under html.js.
function revealChecklists(root: HTMLElement, animate: boolean) {
  const lists = Array.from(root.querySelectorAll<HTMLElement>('ul.list-check'));
  for (const list of lists) {
    Array.from(list.children).forEach((li, i) => (li as HTMLElement).style.setProperty('--i', String(i)));
  }
  if (!animate) return;

  const pending = lists.filter((list) => !hero?.contains(list));
  const immediate = pending.filter((list) => inView(list));
  const io = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        io.unobserve(target);
        target.classList.add('is-in');
      }
    },
    { threshold: 0.2 },
  );

  for (const list of pending) list.setAttribute('data-check-reveal', '');
  for (const list of immediate) list.classList.add('is-in');
  for (const list of pending) if (!immediate.includes(list)) io.observe(list);
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

// Cursor pusher and drag & drop for every illustration: spring physics. Runs only on fine hover pointers (gated by
// the caller). Every .wsi-pt inside the svg is pushed away from the cursor while the cursor is within PUSH_RADIUS of
// its centre (force falls off with distance; at most PUSH_MAX px x --d, plus a tiny tilt in the push direction)
// and springs back, with a little overshoot, once the cursor is gone. A .wsi-pt can also be grabbed (pointerdown),
// dragged 1:1 and dropped: it stays where it was dropped for the session (that position becomes its rest position,
// the repel spring works around it); double-click sends it back home. While grabbed it lifts (scale GRAB_SCALE and
// a stronger shadow via .is-grabbed in motion.css); on drop the spring settles with a little overshoot. The
// integrator runs in rAF only while something moves. Writes --rx/--ry (translate), --rr (rotate) and --rs (scale) on
// each .wsi-pt; motion.css turns them into `transform`. Positions are tracked in screen px and converted to svg user
// units on write; the dropped offset is stored in svg units so it survives resizes.
const PUSH_RADIUS = 160;
const PUSH_MAX = 10;
const PUSH_TILT = 2; // degrees
const SPRING_K = 170; // stiffness
const SPRING_C = 18; // damping (underdamped: ratio ~0.69, a slight overshoot)
const SPRING_DT = 1 / 120;
const GRAB_SCALE = 1.04;
const DRAG_SLOP = 3; // px: below this a press-and-release is still a click
const FLICK_MAX = 360; // px/s: cap of the release velocity that feeds the drop settle
const FLICK_GAIN = 0.35;

interface Pusher {
  el: SVGElement;
  d: number;
  x: number; y: number; r: number; s: number; // current offset (px, px, deg) and scale
  vx: number; vy: number; vr: number; vs: number;
  ox: number; oy: number; // rest offset from home (svg units): where the piece was dropped
  grabbed: boolean;
}

function pusher(svg: SVGElement, area: HTMLElement) {
  const pts: Pusher[] = Array.from(svg.querySelectorAll<SVGElement>('.wsi-pt')).map((el) => ({
    el,
    d: parseFloat(el.style.getPropertyValue('--d')) || 1,
    x: 0, y: 0, r: 0, s: 1, vx: 0, vy: 0, vr: 0, vs: 0,
    ox: 0, oy: 0, grabbed: false,
  }));
  if (!pts.length) return;
  let mx = 0, my = 0, active = false, raf = 0, last = 0;

  const svgScale = () => {
    const vb = (svg as unknown as SVGSVGElement).viewBox?.baseVal;
    const w = svg.getBoundingClientRect().width;
    return vb && vb.width && w ? w / vb.width : 1;
  };

  const step = (now: number) => {
    const frame = Math.min((now - last) / 1000 || SPRING_DT, 0.032);
    last = now;
    // Read layout first, then write.
    const scale = svgScale();
    const targets = pts.map((p) => {
      const rx = p.ox * scale;
      const ry = p.oy * scale;
      let tx = rx, ty = ry, tr = 0;
      if (active && !p.grabbed) {
        const r = p.el.getBoundingClientRect();
        if (r.width || r.height) {
          // Rest centre: the measured centre minus the offset we applied ourselves, plus the dropped offset.
          const dx = r.left + r.width / 2 - p.x + rx - mx;
          const dy = r.top + r.height / 2 - p.y + ry - my;
          const dist = Math.hypot(dx, dy);
          if (dist < PUSH_RADIUS && dist > 0.5) {
            const f = (1 - dist / PUSH_RADIUS) ** 2;
            tx += (dx / dist) * f * PUSH_MAX * p.d;
            ty += (dy / dist) * f * PUSH_MAX * p.d;
            tr = (dx / dist) * f * PUSH_TILT;
          }
        }
      }
      return [tx, ty, tr];
    });

    let moving = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const [tx, ty, tr] = targets[i];
      const ts = p.grabbed ? GRAB_SCALE : 1;
      if (p.grabbed) {
        // Follows the pointer 1:1: no spring on position while held.
        p.x = tx; p.y = ty; p.vx = p.vy = 0;
        moving = true;
      }
      for (let t = 0; t < frame; t += SPRING_DT) {
        if (!p.grabbed) {
          p.vx += (SPRING_K * (tx - p.x) - SPRING_C * p.vx) * SPRING_DT;
          p.vy += (SPRING_K * (ty - p.y) - SPRING_C * p.vy) * SPRING_DT;
          p.x += p.vx * SPRING_DT;
          p.y += p.vy * SPRING_DT;
        }
        p.vr += (SPRING_K * (tr - p.r) - SPRING_C * p.vr) * SPRING_DT;
        p.vs += (SPRING_K * (ts - p.s) - SPRING_C * p.vs) * SPRING_DT;
        p.r += p.vr * SPRING_DT;
        p.s += p.vs * SPRING_DT;
      }
      const settled =
        Math.abs(tx - p.x) < 0.02 && Math.abs(ty - p.y) < 0.02 && Math.abs(tr - p.r) < 0.01 && Math.abs(ts - p.s) < 0.0005 &&
        Math.abs(p.vx) < 0.05 && Math.abs(p.vy) < 0.05 && Math.abs(p.vr) < 0.05 && Math.abs(p.vs) < 0.005;
      if (settled) {
        p.x = tx; p.y = ty; p.r = tr; p.s = ts; p.vx = p.vy = p.vr = p.vs = 0;
      } else {
        moving = true;
      }
      if (settled && !tx && !ty && !tr && ts === 1) {
        p.el.style.removeProperty('--rx');
        p.el.style.removeProperty('--ry');
        p.el.style.removeProperty('--rr');
        p.el.style.removeProperty('--rs');
      } else {
        p.el.style.setProperty('--rx', `${(p.x / scale).toFixed(3)}px`);
        p.el.style.setProperty('--ry', `${(p.y / scale).toFixed(3)}px`);
        p.el.style.setProperty('--rr', `${p.r.toFixed(3)}deg`);
        p.el.style.setProperty('--rs', p.s.toFixed(4));
      }
    }
    raf = moving ? requestAnimationFrame(step) : 0;
  };
  const kick = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  };
  area.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX;
      my = e.clientY;
      active = true;
      kick();
    },
    { passive: true },
  );
  area.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    active = false;
    kick();
  });

  // ---- Drag & drop ----
  const noSelect = (e: Event) => e.preventDefault();
  // Where pieces may go: the nearest card / section, not the svg box.
  const bound = svg.closest<HTMLElement>('.sheet-card, .post-card, .card, section') ?? area;
  // While any piece is displaced the svg and its ancestors up to the bound get `.has-dragged` (motion.css raises them
  // above the text; the svg itself stops catching pointer events except on the pieces).
  const raised: Element[] = [];
  for (let n: Element | null = svg; n && n !== bound; n = n.parentElement) raised.push(n);
  const raise = (on: boolean) => raised.forEach((n) => n.classList.toggle('has-dragged', on));
  for (const p of pts) {
    const el = p.el;
    let id = -1;
    let sx = 0, sy = 0, startOx = 0, startOy = 0, scale = 1;
    let minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity;
    let moved = false;
    let lx = 0, ly = 0, lt = 0, vx = 0, vy = 0;

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0 || p.grabbed) return;
      e.preventDefault();
      e.stopPropagation(); // the innermost piece wins
      id = e.pointerId;
      el.setPointerCapture(id);
      scale = svgScale();
      sx = e.clientX; sy = e.clientY;
      startOx = p.ox; startOy = p.oy;
      moved = false;
      lx = e.clientX; ly = e.clientY; lt = e.timeStamp; vx = vy = 0;
      // Clamp to the whole parent card/section (not the svg box): the svg lets its pieces overflow while any is displaced.
      const box = bound.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      minX = Math.min(box.left - r.left, 0); maxX = Math.max(box.right - r.right, 0);
      minY = Math.min(box.top - r.top, 0); maxY = Math.max(box.bottom - r.bottom, 0);
      p.grabbed = true;
      el.classList.add('is-grabbed');
      document.addEventListener('selectstart', noSelect);
      kick();
    });

    el.addEventListener('pointermove', (e) => {
      if (!p.grabbed || e.pointerId !== id) return;
      const dx = Math.min(Math.max(e.clientX - sx, minX), maxX);
      const dy = Math.min(Math.max(e.clientY - sy, minY), maxY);
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > DRAG_SLOP) {
        moved = true;
        raise(true);
      }
      p.ox = startOx + dx / scale;
      p.oy = startOy + dy / scale;
      const dt = (e.timeStamp - lt) / 1000;
      if (dt > 0) {
        // Smoothed pointer velocity (screen px/s) for the drop settle.
        vx = vx * 0.5 + ((e.clientX - lx) / dt) * 0.5;
        vy = vy * 0.5 + ((e.clientY - ly) / dt) * 0.5;
      }
      lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
      kick();
    });

    const drop = (e: PointerEvent) => {
      if (!p.grabbed || e.pointerId !== id) return;
      p.grabbed = false;
      el.classList.remove('is-grabbed');
      document.removeEventListener('selectstart', noSelect);
      if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
      id = -1;
      // A pointer that was still moving hands a little of its velocity to the spring, which overshoots the drop point.
      if (e.timeStamp - lt < 80) {
        const cap = (v: number) => Math.max(-FLICK_MAX, Math.min(FLICK_MAX, v * FLICK_GAIN));
        p.vx = cap(vx);
        p.vy = cap(vy);
      }
      kick();
    };
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
    el.addEventListener('lostpointercapture', drop);

    // A drag ending over a link (illustrations inside cards) must not follow it.
    el.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);

    // Double-click sends the piece back home.
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      p.ox = 0;
      p.oy = 0;
      if (pts.every((q) => !q.ox && !q.oy)) raise(false);
      kick();
    });
  }
}

// Spreadsheet background for opted-in elements only (`main [data-cursor-sheet]`, a block inside a
// Sheet card). Each gets an isometric grid as an inline SVG data URL in --sheet (motion.css draws
// it on ::before). Each column has one width and each row one height for the whole element, so
// every line runs straight and continuous in the projection. Columns are mostly 1x, sometimes
// 1.6x or 2.2x. Grid lines only, no values. Seeded per section, so the pattern is stable.
const SHEET_COL_WIDTHS = [1, 1, 1, 1, 1, 1.6, 2.2];
const SHEET_ROW_HEIGHTS = [1, 1, 1.5];
const SHEET_HX = 44; // screen half-width of a unit cell in the isometric projection
const SHEET_HY = 22; // screen half-height of a unit cell
const SHEET_LERP = 0.12;

// FNV-1a: string to 32-bit seed.
function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// mulberry32: seeded PRNG returning floats in [0, 1).
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sheet coordinates (s = column, t = row) to screen: x = (s - t) * HX, y = (s + t) * HY.
const isoPoint = (s: number, t: number): [number, number] => [(s - t) * SHEET_HX, (s + t) * SHEET_HY];

function sheetSvg(width: number, height: number, seed: number) {
  const rnd = prng(seed);
  // Invert the projection at the section corners to find the sheet range that covers it.
  const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => ({
    s: (x / SHEET_HX + y / SHEET_HY) / 2,
    t: (y / SHEET_HY - x / SHEET_HX) / 2,
  }));
  const sMin = Math.floor(Math.min(...corners.map((c) => c.s))) - 2;
  const sMax = Math.ceil(Math.max(...corners.map((c) => c.s))) + 2;
  const tMin = Math.floor(Math.min(...corners.map((c) => c.t))) - 1;
  const tMax = Math.ceil(Math.max(...corners.map((c) => c.t))) + 1;

  // Column widths and row heights are drawn once, before any cell, so every grid line runs
  // the full length of its column or row.
  const cols: { s: number; w: number }[] = [];
  for (let s = sMin; s < sMax; ) {
    const w = SHEET_COL_WIDTHS[Math.floor(rnd() * SHEET_COL_WIDTHS.length)];
    cols.push({ s, w });
    s += w;
  }
  const rows: { t: number; h: number }[] = [];
  for (let t = tMin; t < tMax; ) {
    const h = SHEET_ROW_HEIGHTS[Math.floor(rnd() * SHEET_ROW_HEIGHTS.length)];
    rows.push({ t, h });
    t += h;
  }
  const last = cols[cols.length - 1];
  const sEnd = last.s + last.w;
  const lastRow = rows[rows.length - 1];
  const tEnd = lastRow.t + lastRow.h;

  // Every column boundary runs top to bottom and every row boundary left to right.
  let edges = '';
  for (const s of [...cols.map((c) => c.s), sEnd]) {
    const [x1, y1] = isoPoint(s, tMin);
    const [x2, y2] = isoPoint(s, tEnd);
    edges += `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  for (const t of [...rows.map((r) => r.t), tEnd]) {
    const [x1, y1] = isoPoint(sMin, t);
    const [x2, y2] = isoPoint(sEnd, t);
    edges += `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<path fill="none" stroke="rgba(46,41,38,.07)" stroke-width="1" d="${edges}"/></svg>`
  );
}

// Sets the grid, then a mask centre that lags the pointer (lerp, rAF, stops once settled).
// On leave only .sheet-on is removed: the CSS opacity fades slowly while the mask keeps drifting.
// The grid is regenerated when the element's size changes (resize, font load).
function sheet(el: HTMLElement, index: number) {
  const seed = hashSeed(el.closest('section')?.id || `sheet-${index}`);
  const draw = () => {
    const svg = sheetSvg(Math.max(el.offsetWidth, innerWidth), el.offsetHeight, seed);
    el.style.setProperty('--sheet', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  };
  draw();
  el.classList.add('has-sheet');
  new ResizeObserver(draw).observe(el);

  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const paint = () => {
    el.style.setProperty('--mx', `${cx.toFixed(1)}px`);
    el.style.setProperty('--my', `${cy.toFixed(1)}px`);
  };
  const step = () => {
    cx += (tx - cx) * SHEET_LERP;
    cy += (ty - cy) * SHEET_LERP;
    const settled = Math.abs(tx - cx) < 0.2 && Math.abs(ty - cy) < 0.2;
    if (settled) (cx = tx), (cy = ty);
    paint();
    raf = settled ? 0 : requestAnimationFrame(step);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    tx = e.clientX - r.left;
    ty = e.clientY - r.top;
    // Entering from rest starts the mask at the entry point rather than sweeping in from far away.
    if (!raf) (cx = tx), (cy = ty), paint();
    el.classList.add('sheet-on');
    kick();
  });
  el.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      kick();
    },
    { passive: true },
  );
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    el.classList.remove('sheet-on');
  });
}
 
// Edge light: the cursor position inside a button, card or menu tile drives a rim highlight
// (::after in motion.css). Fine pointers only; the caller gates it.
const EDGE_SELECTOR = '.btn, .card, .mega-item, .mega-feature, .post-card';

function edgeLight(el: HTMLElement) {
  el.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--ex', `${(e.clientX - r.left).toFixed(1)}px`);
      el.style.setProperty('--ey', `${(e.clientY - r.top).toFixed(1)}px`);
    },
    { passive: true },
  );
}

// Breathing variety: each .wsi-breathe element gets its own amplitude (--amp), period and phase.
// Seeded, so the result is stable across loads. Keyframes (in each illustration) scale --lift by --amp.
function breathe(root: HTMLElement) {
  const rnd = prng(hashSeed('breathe'));
  root.querySelectorAll<HTMLElement>('svg.wsi .wsi-breathe').forEach((el) => {
    const duration = 7 + rnd() * 5;
    el.style.setProperty('--amp', (0.35 + rnd() * 0.45).toFixed(3));
    el.style.setProperty('animation-duration', `${duration.toFixed(2)}s`);
    el.style.setProperty('animation-delay', `${(-rnd() * duration).toFixed(2)}s`);
  });
}

// Grid drift: the highlighted cells of each .has-grid sheet (hero, closing CTA) take turns. One cell at a time
// starts a slide: a gradient of its colour fades in at one side, intensifies and travels across the cell until
// it has left on the other side (5-7s, motion.css keyframes). When the animation ends the cell goes quiet and
// another one starts. At most DRIFT_LIT slides run per sheet; a sheet only starts new ones while on screen.
// Cells are held invisible (CSS) until the load sequence is over (html.intro-done); the first one lights right
// after it, then one every 0.6-1.3s, so each sheet fills up gradually towards DRIFT_LIT.
const DRIFT_LIT = 7;

// One pool per .sheet-glow (page grid behind a sheet, or a grid inside a card): each runs its own DRIFT_LIT budget.
function drift(glow: HTMLElement, ready: Promise<void>) {
  const cells = Array.from(glow.querySelectorAll<HTMLElement>(':scope > i'));
  if (cells.length <= DRIFT_LIT) return;
  const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
  const lit = (c: HTMLElement) => c.classList.contains('is-lit');

  for (const c of cells) {
    c.classList.add('drift');
    c.addEventListener('animationend', (e) => {
      if (e.target === c) c.classList.remove('is-lit');
    });
  }

  const start = () => {
    if (cells.filter(lit).length >= DRIFT_LIT) return;
    const c = pick(cells.filter((x) => !lit(x)));
    c.style.setProperty('--slide-ms', `${between(5000, 7000).toFixed(0)}ms`);
    c.classList.toggle('is-rtl', Math.random() < 0.5);
    c.classList.add('is-lit');
  };

  let timer = 0;
  const tick = () => {
    start();
    timer = window.setTimeout(tick, between(600, 1300));
  };
  // .drift (set above, right away) already keeps every cell invisible; slides only begin once the intro is over.
  ready.then(() =>
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!timer) tick();
      } else {
        clearTimeout(timer);
        timer = 0;
      }
    }).observe(glow),
  );
}

if (main) {
  // Header scrolled state is a visual state, not motion: it runs under reduced motion too.
  if (header) headerScroll(header);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    main.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => el.classList.add('is-in'));
    main.querySelectorAll<SVGElement>('svg.wsi').forEach((svg) => svg.classList.add('is-in'));
    revealChecklists(main, false);
  } else {
    reveal(main);
    revealIllustrations(main);
    revealChecklists(main, true);
    breathe(main);
    const introDone = new Promise<void>((resolve) =>
      introAt(INTRO_DONE, () => {
        document.documentElement.classList.add('intro-done');
        resolve();
      }),
    );
    main.querySelectorAll<HTMLElement>('.sheet-section.has-grid .sheet-glow').forEach((glow) => drift(glow, introDone));
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      main.querySelectorAll<SVGElement>('svg.wsi:not([data-no-push])').forEach((svg) => {
        const area = svg.closest<HTMLElement>('section') ?? svg.parentElement;
        if (area) pusher(svg, area);
      });
      main.querySelectorAll<HTMLElement>('[data-cursor-sheet]').forEach((el, i) => sheet(el, i));
      document.querySelectorAll<HTMLElement>(EDGE_SELECTOR).forEach(edgeLight);
    }
  }
}
