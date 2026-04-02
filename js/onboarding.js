/**
 * @file onboarding.js
 * @description Guided onboarding flow with "Terminal Glass / HUD Spotlight" aesthetic.
 */

const STEPS = [
  {
    target: '.scroll-context',
    title: 'Data Engine',
    desc: 'Welcome to BMetrics. This is your professional performance engine. <strong>Click any cell</strong> to safely overwrite metrics, or tap the <strong style="color:var(--clr-text-primary);">+</strong> button to log new game data.',
    align: 'top'
  },
  {
    target: '#main-fab-container',
    title: 'Trend Projection',
    desc: 'The engine automatically calculates derived metrics like True Shooting %. Use the <strong>Predict</strong> button to simulate future performance based on your historical variance.',
    align: 'left'
  },
  {
    target: '#profile-selector',
    title: 'Profile Isolation',
    desc: 'You can create separate databases for different players, tournaments, or seasons. Click <strong>Database</strong> in the top left to manage your profiles.',
    align: 'bottom'
  }
];

export function initOnboarding(force = false) {
  const onboarded = localStorage.getItem('bstats_onboarded');
  if (onboarded === 'true' && !force) return;

  // Remove existing spotlight if forced trigger
  const existing = document.getElementById('ob-spotlight');
  if (existing) existing.remove();

  // Create Spotlight HUD Container
  const container = document.createElement('div');
  container.className = 'ob-spotlight-container';
  container.id = 'ob-spotlight';

  // Create the 4 backdrop masks to form the spotlight hole
  const panels = ['top', 'bottom', 'left', 'right'].map(pos => {
    const el = document.createElement('div');
    el.className = 'ob-spotlight-backdrop';
    el.dataset.pos = pos;
    // Set initial size to 0 to avoid flashing large panels
    el.style.width = '0px'; el.style.height = '0px'; el.style.top = '0px'; el.style.left = '0px';
    return el;
  });

  const bracket = document.createElement('div');
  bracket.className = 'ob-spotlight-hole-bracket';
  bracket.innerHTML = `
    <div class="ob-bracket-corner top-left"></div>
    <div class="ob-bracket-corner top-right"></div>
    <div class="ob-bracket-corner bottom-left"></div>
    <div class="ob-bracket-corner bottom-right"></div>
    <div class="ob-crosshair x-axis"></div>
    <div class="ob-crosshair y-axis"></div>
    <div class="ob-scan-bar"></div>
  `;

  const tooltip = document.createElement('div');
  tooltip.className = 'ob-spotlight-tooltip';

  const tooltipContent = document.createElement('div');
  tooltipContent.style.position = 'relative';
  tooltip.appendChild(tooltipContent);

  container.append(...panels, bracket, tooltip);
  document.body.appendChild(container);

  let currentStep = 0;
  let isAnimating = false;
  let activeTarget = null;

  // Ensure table fills layout properly so `.scroll-context` isn't tiny
  // Sometimes when empty, the container compresses. Not critical, but we adapt.

  function renderStep(initial = false) {
    if (currentStep >= STEPS.length) {
      closeOnboarding();
      return;
    }

    const step = STEPS[currentStep];
    const targetEl = document.querySelector(step.target);

    if (!targetEl) {
      console.warn(`Onboarding target not found: ${step.target}`);
      currentStep++;
      renderStep();
      return;
    }

    if (activeTarget) {
      activeTarget.classList.remove('ob-floating-target');
    }
    activeTarget = targetEl;
    activeTarget.classList.add('ob-floating-target');

    // Dimensions
    const rect = activeTarget.getBoundingClientRect();
    const pad = 12; // padding around element

    // Safety check for tiny rects (like if hidden)
    const cw = Math.max(rect.width, 40);
    const ch = Math.max(rect.height, 40);
    const cx = rect.left + (rect.width / 2) - (cw / 2);
    const cy = rect.top + (rect.height / 2) - (ch / 2);

    const hole = {
      top: cy - pad,
      left: cx - pad,
      width: cw + (pad * 2),
      height: ch + (pad * 2)
    };
    hole.bottom = hole.top + hole.height;
    hole.right = hole.left + hole.width;

    // Build the tooltip UI
    tooltipContent.innerHTML = `
      <div class="ob-spotlight-terminal-text">
        <span class="ob-status-indicator"></span> 
        <span>SYS.INIT_STEP[M_${currentStep + 1}]</span>
        <span class="ob-coord-readout">[X:${Math.round(cx)} Y:${Math.round(cy)}]</span>
      </div>
      <h3 class="ob-spotlight-title">${step.title}</h3>
      <p class="ob-spotlight-desc">${step.desc}</p>
      <div class="ob-spotlight-actions">
        <div class="ob-spotlight-dots">
          ${STEPS.map((_, i) => `<div class="ob-spotlight-dot ${i === currentStep ? 'active' : ''}"></div>`).join('')}
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-ghost" id="ob-btn-skip">ABORT</button>
          <button class="btn-primary" id="ob-btn-next" style="width: 110px;">
            ${currentStep === STEPS.length - 1 ? 'EXECUTE' : 'PROCEED'}
          </button>
        </div>
      </div>
    `;

    document.getElementById('ob-btn-skip').addEventListener('click', closeOnboarding);
    document.getElementById('ob-btn-next').addEventListener('click', () => {
      if (isAnimating) return;
      currentStep++;
      renderStep();
    });

    const l = window.innerWidth;
    const t = window.innerHeight;

    // Read actual dimensions after DOM update
    const actualTtWidth = tooltip.offsetWidth || 380;
    const actualTtHeight = tooltip.offsetHeight || 320;

    // Tooltip constraints
    let ttTop = 0;
    let ttLeft = 0;
    const ttMargin = 32;

    if (step.align === 'bottom') {
      ttTop = hole.bottom + ttMargin;
      ttLeft = hole.left;
    } else if (step.align === 'top') {
      ttTop = hole.top - ttMargin - actualTtHeight;
      ttLeft = hole.left;
    } else if (step.align === 'left') {
      ttTop = hole.top + (hole.height / 2) - (actualTtHeight / 2);
      ttLeft = hole.left - ttMargin - actualTtWidth;
    } else if (step.align === 'right') {
      ttTop = hole.top + (hole.height / 2) - (actualTtHeight / 2);
      ttLeft = hole.right + ttMargin;
    }

    // Keep it on screen rigorously
    const safeMargin = 24;
    ttLeft = Math.max(safeMargin, Math.min(ttLeft, l - actualTtWidth - safeMargin));
    ttTop = Math.max(safeMargin, Math.min(ttTop, t - actualTtHeight - safeMargin));

    // Animations
    const dur = initial ? 0 : 500;
    const easing = 'easeOutExpo';

    // Top Panel: 0 to hole.top
    anime({ targets: panels[0], top: 0, left: 0, width: '100%', height: Math.max(0, hole.top), duration: dur, easing });
    // Bottom Panel: hole.bottom to end
    anime({ targets: panels[1], top: hole.bottom, left: 0, width: '100%', height: Math.max(0, t - hole.bottom), duration: dur, easing });
    // Left Panel: middle slice, left to hole.left
    anime({ targets: panels[2], top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, duration: dur, easing });
    // Right Panel: middle slice, hole.right to end
    anime({ targets: panels[3], top: hole.top, left: hole.right, width: Math.max(0, l - hole.right), height: hole.height, duration: dur, easing });

    anime({ targets: bracket, top: hole.top, left: hole.left, width: hole.width, height: hole.height, duration: dur, easing });

    anime({
      targets: tooltip,
      top: ttTop, left: ttLeft,
      opacity: [0, 1],
      translateX: initial ? 0 : (step.align === 'left' ? [10, 0] : [-10, 0]),
      duration: dur, easing
    });
  }

  function closeOnboarding() {
    localStorage.setItem('bstats_onboarded', 'true');
    if (activeTarget) {
      activeTarget.classList.remove('ob-floating-target');
    }
    anime({
      targets: container,
      opacity: 0,
      duration: 400,
      easing: 'easeInExpo',
      complete: () => {
        container.remove();
        isAnimating = false;
      }
    });

    const oldModal = document.getElementById('modal-onboarding');
    if (oldModal && oldModal.hasAttribute('open')) {
      oldModal.close();
    }
  }

  window.addEventListener('resize', () => {
    if (document.getElementById('ob-spotlight')) renderStep(true);
  });

  container.style.opacity = '0';
  renderStep(true);

  anime({
    targets: container,
    opacity: 1,
    duration: 800,
    easing: 'easeOutExpo'
  });
}
