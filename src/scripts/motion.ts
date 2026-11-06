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

// Pointer parallax + edge glow for every illustration. Runs only on fine hover pointers
// (gated by the caller); each svg gets its own lerp loop that stops once settled.
// Writes --px (-1..1) and --py (-1..0) on the svg; motion.css offsets .wsi-pt by them.
const PARALLAX_VARS = ['--px', '--py'];
const PARALLAX_LERP = 0.1;

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
  area.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    svg.classList.add('is-pointer');
  });
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
    svg.classList.remove('is-pointer');
    tpx = 0;
    tpy = 0;
    kick();
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
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      main.querySelectorAll<SVGElement>('svg.wsi').forEach((svg) => {
        const area = svg.closest<HTMLElement>('section') ?? svg.parentElement;
        if (area) parallax(svg, area);
      });
    }
  }
}
