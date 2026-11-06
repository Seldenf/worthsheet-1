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

function reveal(root: HTMLElement) {
  const targets = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => {
    if (hero?.contains(el)) return false;
    const r = el.getBoundingClientRect();
    return !(r.top < innerHeight * 0.9 && r.bottom > 0);
  });
  const io = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        const el = target as HTMLElement;
        io.unobserve(el);
        el.classList.add('is-in');
        el.addEventListener('transitionend', () => el.removeAttribute('data-reveal'), { once: true });
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
  );
  for (const el of targets) {
    el.setAttribute('data-reveal', '');
    const parent = el.parentElement;
    if (parent?.classList.contains('grid')) {
      el.style.setProperty('--reveal-i', String(Math.min(Array.from(parent.children).indexOf(el), 6)));
    }
    io.observe(el);
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

function parallax(svg: SVGElement, area: HTMLElement) {
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const step = () => {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    const settled = Math.abs(tx - cx) < 0.002 && Math.abs(ty - cy) < 0.002;
    if (settled) (cx = tx), (cy = ty);
    svg.style.setProperty('translate', `${cx * 6}px ${cy * 6}px`);
    svg.style.transform = `perspective(900px) rotateX(${-cy * 2}deg) rotateY(${cx * 2}deg)`;
    if (settled && !tx && !ty) {
      svg.style.removeProperty('translate');
      svg.style.transform = '';
    }
    raf = settled ? 0 : requestAnimationFrame(step);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };
  area.addEventListener(
    'pointermove',
    (e) => {
      const r = area.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      kick();
    },
    { passive: true },
  );
  area.addEventListener('pointerleave', () => {
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
    const svg = main.querySelector<SVGElement>('svg[class*="wsi-"]');
    if (hero && svg && hero.contains(svg) && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      parallax(svg, hero);
    }
  }
}
