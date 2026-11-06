const SELECTOR = [
  'main section h2',
  'main section .lead',
  'main .card',
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

function show(el: HTMLElement, attr: string) {
  el.classList.add('is-in');
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
    el.setAttribute('data-reveal', '');
    const parent = el.parentElement;
    if (parent?.classList.contains('grid')) {
      el.style.setProperty('--reveal-i', String(Math.min(Array.from(parent.children).indexOf(el), 6)));
    }
    // Children of a hidden section are revealed together with that section.
    if (!el.closest('[data-section-reveal]')) childIO.observe(el);
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

  for (const svg of immediate) svg.classList.add('is-in');
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

// Pointer parallax for every illustration. Runs only on fine hover pointers (gated by the
// caller); each svg gets its own lerp loop that stops once settled.
// Writes --px (-1..1) and --py (-1..0) on the svg; motion.css offsets .wsi-pt by them.
const PARALLAX_VARS = ['--px', '--py'];
const PARALLAX_LERP = 0.07;

function parallax(svg: SVGElement, area: HTMLElement) {
  let tpx = 0, tpy = 0, px = 0, py = 0, raf = 0;
  const step = () => {
    px += (tpx - px) * PARALLAX_LERP;
    py += (tpy - py) * PARALLAX_LERP;
    const settled = Math.abs(tpx - px) < 0.001 && Math.abs(tpy - py) < 0.001;
    if (settled) (px = tpx), (py = tpy);
    if (settled && !tpx && !tpy) {
      for (const name of PARALLAX_VARS) svg.style.removeProperty(name);
    } else {
      svg.style.setProperty('--px', px.toFixed(3));
      svg.style.setProperty('--py', py.toFixed(3));
    }
    raf = settled ? 0 : requestAnimationFrame(step);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };
  area.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      tpx = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width / 2)));
      // Pointer above center lifts elements (negative); below center leaves them at 0.
      tpy = -Math.max(0, Math.min(1, (cy - e.clientY) / (r.height / 2)));
      kick();
    },
    { passive: true },
  );
  area.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    tpx = 0;
    tpy = 0;
    kick();
  });
}

// Spreadsheet background for opted-in sections only (`main section[data-sheet]`). Each gets an
// isometric grid generated once at init as an inline SVG data URL in --sheet (motion.css draws
// it on ::before). Each column has one width and each row one height for the whole section, so
// every line runs straight and continuous in the projection. Columns are mostly 1x, sometimes
// 1.6x or 2.2x. About 1 cell in 18 carries a small value; wider columns get longer values.
// Seeded per section, so the pattern is stable.
const SHEET_VALUES = [
  ['$980', '12%', '$310', '28%'],
  ['$1,240', '$4.2k', '=SUM'],
  ['$12,480', '=SUM(C2:C9)', 'Q3 total'],
];
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

  let labels = '';
  for (const row of rows) {
    for (const col of cols) {
      if (rnd() >= 1 / 18) continue;
      // Wider columns take longer values.
      const values = SHEET_VALUES[col.w >= 2.2 ? 2 : col.w >= 1.6 ? 1 : 0];
      const value = values[Math.floor(rnd() * values.length)];
      const [cx, cy] = isoPoint(col.s + col.w / 2, row.t + row.h / 2);
      labels += `<text x="${cx.toFixed(1)}" y="${(cy + 2.5).toFixed(1)}">${value}</text>`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<path fill="none" stroke="rgba(46,41,38,.07)" stroke-width="1" d="${edges}"/>` +
    `<g font-family="sans-serif" font-size="7" text-anchor="middle" fill="rgba(46,41,38,.14)">${labels}</g></svg>`
  );
}

// Sets the grid, then a mask centre that lags the pointer (lerp, rAF, stops once settled).
// On leave only .sheet-on is removed: the CSS opacity fades slowly while the mask keeps drifting.
function sheet(section: HTMLElement, index: number) {
  const svg = sheetSvg(
    Math.max(section.offsetWidth, innerWidth),
    section.offsetHeight,
    hashSeed(section.id || `sheet-${index}`),
  );
  section.style.setProperty('--sheet', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  section.classList.add('has-sheet');

  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const paint = () => {
    section.style.setProperty('--mx', `${cx.toFixed(1)}px`);
    section.style.setProperty('--my', `${cy.toFixed(1)}px`);
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
  section.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    const r = section.getBoundingClientRect();
    tx = e.clientX - r.left;
    ty = e.clientY - r.top;
    // Entering from rest starts the mask at the entry point rather than sweeping in from far away.
    if (!raf) (cx = tx), (cy = ty), paint();
    section.classList.add('sheet-on');
    kick();
  });
  section.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      const r = section.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      kick();
    },
    { passive: true },
  );
  section.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    section.classList.remove('sheet-on');
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
    const duration = 5 + rnd() * 5;
    el.style.setProperty('--amp', (0.55 + rnd() * 0.95).toFixed(3));
    el.style.setProperty('animation-duration', `${duration.toFixed(2)}s`);
    el.style.setProperty('animation-delay', `${(-rnd() * duration).toFixed(2)}s`);
  });
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
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      main.querySelectorAll<SVGElement>('svg.wsi').forEach((svg) => {
        const area = svg.closest<HTMLElement>('section') ?? svg.parentElement;
        if (area) parallax(svg, area);
      });
      main.querySelectorAll<HTMLElement>('section[data-sheet]').forEach((section, i) => sheet(section, i));
      document.querySelectorAll<HTMLElement>(EDGE_SELECTOR).forEach(edgeLight);
    }
  }
}
