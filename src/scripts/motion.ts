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
