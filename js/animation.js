import { getThemeColors } from './utils.js';

export function choreographEntrance() {
  // Safety net: if the animation throws or is skipped (GPU issues, browser flags,
  // extensions killing RAF, accessibility set to reduced motion), 
  // immediately restore visibility of critical elements.
  const restoreVisibility = () => {
    const selectors = [
      '.header-block', 
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
  // If set, skip the entrance sequence entirely — but ensure content becomes visible.
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    restoreVisibility();
    return;
  }

  try {
    /* Cinematic: terminal boot sequence feel */
    const tl = anime.timeline({ easing: 'easeOutExpo' });

    /* Phase 1: Title materializes with vertical clip reveal */
    tl.add({
      targets: '.header-block',
      opacity: [0, 1],
      translateY: [-20, 0],
      filter: ['blur(8px)', 'blur(0px)'],
      duration: 1400,
    })
      /* Phase 2: Data container rises with scale + shadow bloom */
      .add({
        targets: '.data-container',
        opacity: [0, 1],
        translateY: [50, 0],
        scale: [0.97, 1],
        duration: 1200,
      }, '-=900')
      /* Phase 3: Table header columns fade in left-to-right stagger */
      .add({
        targets: '.stats-grid th',
        opacity: [0, 1],
        translateY: [-10, 0],
        delay: anime.stagger(25),
        duration: 500,
        easing: 'easeOutQuad'
      }, '-=900')
      /* Phase 4: Data rows slide in with alternating X offset */
      .add({
        targets: 'tr.data-row',
        opacity: [0, 1],
        translateX: (el, i) => [i % 2 === 0 ? -20 : 20, 0],
        delay: anime.stagger(45),
        duration: 700,
        easing: 'easeOutCubic',
        begin: (anim) => {
          /* Flash each row with a scan pulse as it appears */
          const tc = getThemeColors();
          anim.animatables.forEach((a, idx) => {
            setTimeout(() => {
              anime({
                targets: a.target,
                backgroundColor: [tc.bgFlash, 'transparent'],
                duration: 600,
                easing: 'easeOutExpo'
              });
            }, idx * 45);
          });
        }
      }, '-=700')
      /* Phase 5: Footer rises with breathing glow */
      .add({
        targets: '#footer-row',
        opacity: [0, 1],
        translateY: [15, 0],
        duration: 900,
      }, '-=400');

    /* FABs entrance: elastic pop with rotation */
    anime({
      targets: ['.btn-fab', '.btn-theme', '.btn-fab-mini'],
      scale: [0, 1],
      rotate: [-120, 0],
      opacity: [0, 1],
      delay: anime.stagger(120, { start: 1000 }),
      duration: 1100,
      easing: 'easeOutElastic(1, .5)'
    });

    /* Scanline overlay fades in subtly */
    anime({
      targets: '.scanline-overlay',
      opacity: [0, 0.4],
      duration: 2000,
      delay: 500,
      easing: 'easeOutQuad'
    });

    // Fallback: if the animation stalls for 4s (RAF blocked, GPU failure, etc.),
    // force visibility so content is never permanently hidden.
    setTimeout(restoreVisibility, 4000);

  } catch (e) {
    console.warn('[BMetrics] Entrance animation failed, restoring visibility.', e);
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
