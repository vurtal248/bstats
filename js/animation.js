import { getThemeColors } from './utils.js';

export function choreographEntrance() {
  // Safety net: if the animation throws or is skipped (GPU issues, browser flags,
  // extensions killing RAF, accessibility set to reduced motion), 
  // immediately restore visibility of critical elements.
  const restoreVisibility = () => {
    const selectors = [
      '.editorial-header', 
      '.data-container', 
      '.stats-grid th',
      'tr.data-row',
      '#footer-row',
      '.btn-fab', 
      '.btn-theme', 
      '.btn-fab-mini',
      '.scanline-overlay'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.opacity = '1';
        el.style.filter = '';
        el.style.transform = 'none';
      });
    });
  };

  // Guard: if anime.js failed to load from CDN, force visibility and skip animation.
  if (typeof anime === 'undefined') {
    restoreVisibility();
    return;
  }

  // Respect OS/browser "Reduce Motion" accessibility preference.
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    restoreVisibility();
    return;
  }

  try {
    /* ─── CINEMATIC BOOT SEQUENCE ──────────────────────────────
       Phase choreography: horizontal rule → title crashes in from 
       top with blur dissolve → HUD modules ascend separately →
       data grid rises → rows flicker in as telemetry data feed.
    ──────────────────────────────────────────────────────────── */
    const tl = anime.timeline({ easing: 'easeOutExpo' });

    tl
      /* Phase 1a: Editorial header border rule flashes in */
      .add({
        targets: '.editorial-header',
        opacity: [0, 1],
        translateY: [-6, 0],
        duration: 600,
        easing: 'easeOutCubic',
      })
      /* Phase 1b: Title CRASHES in from above — overshoots slightly like a slug */
      .add({
        targets: '.header-title',
        opacity: [0, 1],
        translateY: [-60, 0],
        scaleY: [1.15, 1],   /* vertical squish on impact */
        filter: ['blur(12px) brightness(0.4)', 'blur(0px) brightness(1)'],
        duration: 900,
        easing: 'easeOutBack',
      }, '-=200')
      /* Phase 1c: Header meta text fades in with short delay */
      .add({
        targets: '.header-meta',
        opacity: [0, 1],
        translateX: [-16, 0],
        duration: 500,
        easing: 'easeOutQuad',
      }, '-=400')
      /* Phase 2: Profile / selectors + theme buttons stagger left-to-right */
      .add({
        targets: ['.profile-container', '.theme-toggle-container'],
        opacity: [0, 1],
        translateY: [10, 0],
        delay: anime.stagger(80),
        duration: 500,
      }, '-=300')
      /* Phase 3: HUD panels rise from below with stagger — Liquid Glass materialises */
      .add({
        targets: ['.player-bio-container', '.career-highs-container', '.career-totals-container'],
        opacity: [0, 1],
        translateY: [24, 0],
        scale: [0.97, 1],
        delay: anime.stagger(100),
        duration: 750,
        easing: 'easeOutExpo',
      }, '-=350')
      /* Phase 4: Archetype grid cards pop in with spring bounce */
      .add({
        targets: '.archetype-card',
        opacity: [0, 1],
        scale: [0.8, 1],
        translateY: [8, 0],
        delay: anime.stagger(30),
        duration: 450,
        easing: 'easeOutBack',
      }, '-=500')
      /* Phase 5: Data container rises with scale + shadow bloom */
      .add({
        targets: '.data-container',
        opacity: [0, 1],
        translateY: [40, 0],
        scale: [0.975, 1],
        duration: 900,
        easing: 'easeOutExpo',
      }, '-=200')
      /* Phase 6: Table headers reveal left-to-right with micro-stagger */
      .add({
        targets: '.stats-grid th',
        opacity: [0, 1],
        translateY: [-8, 0],
        delay: anime.stagger(18, { from: 'first' }),
        duration: 400,
        easing: 'easeOutQuad',
      }, '-=700')
      /* Phase 7: Data rows flicker in as live telemetry feed */
      .add({
        targets: 'tr.data-row',
        opacity: [0, 1],
        translateX: (el, i) => [i % 2 === 0 ? -16 : 16, 0],
        delay: anime.stagger(35),
        duration: 550,
        easing: 'easeOutCubic',
        begin: (anim) => {
          /* Scan pulse on each row as it appears */
          const tc = getThemeColors();
          anim.animatables.forEach((a, idx) => {
            setTimeout(() => {
              anime({
                targets: a.target,
                backgroundColor: [tc.bgFlash, 'transparent'],
                duration: 500,
                easing: 'easeOutExpo',
              });
            }, idx * 35);
          });
        },
      }, '-=700')
      /* Phase 8: Footer breathing glow appears */
      .add({
        targets: '#footer-row',
        opacity: [0, 1],
        translateY: [12, 0],
        duration: 700,
        easing: 'easeOutExpo',
      }, '-=300')
      /* Phase 9: FAB container slides up last */
      .add({
        targets: '.fab-container',
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 600,
      }, '-=500');

    /* FABs entrance: cut-corner elastic pop with rotation */
    anime({
      targets: ['.btn-fab', '.btn-theme', '.btn-fab-mini'],
      scale: [0.3, 1],
      rotate: [-90, 0],
      opacity: [0, 1],
      delay: anime.stagger(80, { start: 800 }),
      duration: 900,
      easing: 'easeOutElastic(1, .55)',
    });

    /* Scanline overlay fades in with measured delay */
    anime({
      targets: '.scanline-overlay',
      opacity: [0, 0.4],
      duration: 2400,
      delay: 400,
      easing: 'easeOutQuad',
    });

    // Fallback: if the animation stalls for 5s, force visibility.
    setTimeout(restoreVisibility, 5000);

  } catch (e) {
    console.warn('[BStats] Entrance animation failed, restoring visibility.', e);
    restoreVisibility();
  }
}


export function playRowConfirmFlash(tdNode) {
  const tc = getThemeColors();
  anime({
    targets: tdNode,
    backgroundColor: [tc.bgFlashStrong, 'transparent'],
    duration: 500,
    easing: 'easeOutExpo'
  });
}

export function playAggregateFlash(updatedNodes) {
  if (!updatedNodes.length) return;
  const tc = getThemeColors();
  const shadowColor = tc.accent === '#050505' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)';
  anime({
    targets: updatedNodes,
    color: [tc.textSecondary, tc.textPrimary],
    textShadow: [`0 0 16px ${shadowColor}`, 'none'],
    duration: 600,
    easing: 'easeOutExpo'
  });
}

export function playCareerHighsFlash(updatedNodes) {
  if (!updatedNodes.length) return;
  const tc = getThemeColors();
  anime({
    targets: updatedNodes,
    color: [tc.textSecondary, tc.accent],
    scale: [0.95, 1],
    textShadow: ['none', '0 0 16px ' + tc.accent],
    duration: 800,
    delay: anime.stagger(50),
    easing: 'easeOutExpo'
  });
}
