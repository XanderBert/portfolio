// Controller for WorkDeck.astro. The host page owns scrolling: it calls
// setTarget(f) with a fractional card index derived from scroll position and
// update(dt) every frame; the deck eases toward it and lays the cards out.

export interface Deck {
  readonly count: number;
  readonly focus: number;          // eased, fractional
  setTarget(f: number): void;
  update(dt: number): number;
  root: HTMLElement;
}

export function createDeck(
  root: HTMLElement,
  opts: { onPick: (index: number) => void; onFilter?: () => void; reduce?: boolean },
): Deck {
  const all = [...root.querySelectorAll<HTMLAnchorElement>('.card')];
  const countEl = root.querySelector<HTMLElement>('[data-count]')!;
  let cards = all.slice();
  let fT = 0, fS = 0, shown = -1;
  const pad = (n: number) => String(n).padStart(2, '0');

  all.forEach((c) => c.addEventListener('click', (e) => {
    const i = cards.indexOf(c);
    if (i !== Math.round(fS)) { e.preventDefault(); opts.onPick(i); }
  }));
  root.querySelector('[data-prev]')!.addEventListener('click', () => opts.onPick(Math.round(fT) - 1));
  root.querySelector('[data-next]')!.addEventListener('click', () => opts.onPick(Math.round(fT) + 1));

  root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.filter!;
    root.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    cards = all.filter((c) => f === 'all' || c.dataset.cats!.split(' ').includes(f));
    all.forEach((c) => { c.style.display = cards.includes(c) ? '' : 'none'; });
    cards.forEach((c, i) => { c.querySelector('.num')!.textContent = pad(i + 1); });
    fT = fS = 0; shown = -1;
    opts.onFilter?.();
  }));

  return {
    root,
    get count() { return cards.length; },
    get focus() { return fS; },
    setTarget(f) { fT = Math.max(0, Math.min(cards.length - 1, f)); },
    update(dt) {
      fS += (fT - fS) * (opts.reduce ? 1 : 1 - Math.exp(-dt * 7));
      const fi = Math.max(0, Math.min(cards.length - 1, Math.round(fS)));
      const spread = (cards[0]?.offsetWidth ?? 400) * 1.04;
      cards.forEach((c, i) => {
        const o = i - fS, a = Math.abs(o);
        c.style.transform = `translate3d(${(o * spread).toFixed(1)}px,0,${(-a * 320).toFixed(1)}px) rotateY(${(-o * 16).toFixed(2)}deg)`;
        c.style.opacity = Math.max(0, 1 - a * 0.42).toFixed(3);
        c.style.zIndex = String(100 - Math.round(a * 10));
        c.style.visibility = a > 3.2 ? 'hidden' : 'visible';
        c.tabIndex = i === fi ? 0 : -1;
      });
      if (fi !== shown) {
        shown = fi;
        all.forEach((c) => c.classList.toggle('on', c === cards[fi]));
        countEl.textContent = `${pad(fi + 1)} / ${pad(cards.length)}`;
      }
      return fS;
    },
  };
}
