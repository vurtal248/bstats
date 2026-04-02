/**
 * @file onboarding.js
 * @description Guided onboarding flow with "Terminal Glass" aesthetic.
 */

const STEPS = [
  {
    title: 'Data Engine',
    desc: 'Welcome to BMetrics. This is your professional performance engine. <strong>Click any cell</strong> to safely overwrite metrics, or tap the <strong style="color:var(--clr-text-primary);">+</strong> button to log new game data.'
  },
  {
    title: 'Trend Projection',
    desc: 'The engine automatically calculates derived metrics like True Shooting %. Use the <strong>Predict</strong> button to simulate future performance based on your historical variance.'
  },
  {
    title: 'Profile Isolation',
    desc: 'You can create separate databases for different players, tournaments, or seasons. Click <strong>Database</strong> in the top left to manage your profiles.'
  }
];

export function initOnboarding(force = false) {
  const onboarded = localStorage.getItem('bstats_onboarded');
  if (onboarded === 'true' && !force) return;

  const modal = document.getElementById('modal-onboarding');
  if (!modal) return;

  const terminalContainer = document.getElementById('ob-terminal');
  const terminalText = document.getElementById('ob-terminal-text');
  const uiContainer = document.getElementById('ob-ui');
  const stepTitle = document.getElementById('ob-step-title');
  const stepBody = document.getElementById('ob-step-body');
  const dotsContainer = document.getElementById('ob-dots');
  const btnNext = document.getElementById('btn-ob-next');
  const btnSkip = document.getElementById('btn-ob-skip');

  let currentStep = 0;
  let isAnimating = false;

  // Reset Phase
  terminalContainer.hidden = false;
  uiContainer.hidden = true;
  terminalText.textContent = '';
  modal.showModal();

  // Terminal boot sequence
  async function runTerminalBoot() {
    isAnimating = true;
    const lines = [
      'BMetrics System Initialization...',
      'Allocating memory arrays...',
      'Loading core schema... OK',
      'Mounting visual interfaces...',
      'Bypassing auth protocols... OK',
      '[SYSTEM ONLINE]'
    ];

    for (let i = 0; i < lines.length; i++) {
      await typeLine(lines[i], 20);
      terminalText.textContent += '\n';
      await sleep(150);
    }
    
    await sleep(400);

    // Fade out terminal, fade in UI
    anime({
      targets: terminalContainer,
      opacity: 0,
      duration: 500,
      easing: 'easeInQuad',
      complete: () => {
        terminalContainer.hidden = true;
        terminalContainer.style.opacity = '1'; // reset
        startUiFlow();
      }
    });
  }

  function typeLine(text, speed) {
    return new Promise(resolve => {
      let charIndex = 0;
      function type() {
        if (charIndex < text.length) {
          terminalText.textContent += text.charAt(charIndex);
          charIndex++;
          setTimeout(type, speed + Math.random() * 20); // Add variability
        } else {
          resolve();
        }
      }
      type();
    });
  }

  function startUiFlow() {
    uiContainer.hidden = false;
    uiContainer.style.opacity = '0';
    uiContainer.style.transform = 'translateY(10px)';
    
    anime({
      targets: uiContainer,
      opacity: 1,
      translateY: 0,
      duration: 600,
      easing: 'easeOutExpo',
      complete: () => { isAnimating = false; }
    });

    renderStep();
  }

  function renderStep() {
    const step = STEPS[currentStep];
    
    // Update text content with slight fade
    anime({
      targets: [stepTitle, stepBody],
      opacity: [0, 1],
      translateX: [5, 0],
      duration: 400,
      easing: 'easeOutQuad'
    });
    
    stepTitle.textContent = step.title;
    stepBody.innerHTML = `<p class="ob-desc">${step.desc}</p>`;
    
    // Build dots
    dotsContainer.innerHTML = STEPS.map((_, i) => 
      `<div class="ob-dot ${i === currentStep ? 'active' : ''}"></div>`
    ).join('');

    btnNext.textContent = currentStep === STEPS.length - 1 ? 'Enter Matrix' : 'Next';
  }

  function nextStep() {
    if (isAnimating) return;
    if (currentStep < STEPS.length - 1) {
      currentStep++;
      renderStep();
    } else {
      closeOnboarding();
    }
  }

  function closeOnboarding() {
    localStorage.setItem('bstats_onboarded', 'true');
    modal.setAttribute('closing', '');
    anime({
      targets: modal,
      opacity: 0,
      translateY: 20,
      duration: 300,
      easing: 'easeInExpo',
      complete: () => {
        modal.close();
        modal.removeAttribute('closing');
        anime.set(modal, { opacity: '', translateY: '' });
      }
    });

    // Clean up events
    btnNext.removeEventListener('click', nextStep);
    btnSkip.removeEventListener('click', closeOnboarding);
  }

  btnNext.addEventListener('click', nextStep);
  btnSkip.addEventListener('click', closeOnboarding);

  // If we are forcing (via help button), skip the terminal sequence for speed
  if (force) {
    terminalContainer.hidden = true;
    startUiFlow();
  } else {
    runTerminalBoot();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
