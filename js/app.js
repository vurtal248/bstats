import { METRICS_SCHEMA, EDITABLE_KEYS, COMPUTED_COLS, SEED_DATA } from './schema.js';
import { STORAGE_KEY_PROFILES, STORAGE_KEY_ACTIVE, STORAGE_KEY_PREFIX, LEGACY_STORAGE_KEY } from './store.js';
import { formatValue, computeDerived, ranZ, getThemeColors } from './utils.js';
import { choreographEntrance, playRowConfirmFlash, playAggregateFlash, playCareerHighsFlash } from './animation.js';
import { initOnboarding } from './onboarding.js';

/**
     * @file BMetrics — Interactive Logic & State Management
     * @description Vanilla JS with reactive state, Anime.js choreography, localStorage persistence.
     */

/** Schema: each column definition
 * @typedef {{ key: string, label: string, computed?: boolean, isPct?: boolean }} MetricColumn */



/** Column keys that are editable (not computed, not id) */


/** Computed column refs for quick lookup */









class BMetricsApp {
  /** @type {{ data: object[], sortRef: { key: string|null, asc: boolean } }} */
  #state;
  #profiles;
  #activeProfileId;

  constructor() {
    this.#initTheme();
    this.#initProfiles();

    this.#state = {
      data: this.#restoreState(),
      sortRef: { key: null, asc: true }
    };

    this.refs = {
      thead: document.getElementById('table-head-row'),
      tbody: document.getElementById('table-body'),
      tfoot: document.getElementById('footer-row'),
      empty: document.getElementById('empty-state'),
      fab: document.getElementById('add-game-fab'),
      predictFab: document.getElementById('predict-games-fab'),
      fabContainer: document.getElementById('main-fab-container'),
      toggleFabsBtn: document.getElementById('toggle-fabs-btn'),

      profileToggle: document.getElementById('profile-toggle'),
      profileMenu: document.getElementById('profile-menu'),
      profileList: document.getElementById('profile-list'),
      activeProfileName: document.getElementById('active-profile-name'),
      btnNewProfile: document.getElementById('btn-new-profile'),
      btnExportProfile: document.getElementById('btn-export-profile'),
      btnImportProfile: document.getElementById('btn-import-profile'),
      inputImportFile: document.getElementById('input-import-file'),
      modalNewProfile: document.getElementById('modal-new-profile'),
      inputProfileName: document.getElementById('input-profile-name'),
      btnCancelProfile: document.getElementById('btn-cancel-profile'),
      btnConfirmProfile: document.getElementById('btn-confirm-profile'),
      playerBio: document.getElementById('player-bio'),
      careerHighsContainer: document.getElementById('career-highs'),

      modalPredict: document.getElementById('modal-predict'),
      inputPredictCount: document.getElementById('input-predict-count'),
      archetypeGrid: document.getElementById('archetype-grid'),
      btnCancelPredict: document.getElementById('btn-cancel-predict'),
      btnConfirmPredict: document.getElementById('btn-confirm-predict')
    };

    this.#init();
  }

  /* ——— Theme Setup ————————————————————————— */

  #initTheme() {
    const saved = localStorage.getItem('bstats_theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }


  /* ——— Lifecycle ——————————————————————————— */

  #init() {
    this.#buildStructure();
    this.#hydrateComputed();
    this.#bindGlobalEvents();

    // Render Player Bio
    this.#renderProfileBio();

    // Brief delay lets skeleton show before data replaces it
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.#render();
        choreographEntrance();
        initOnboarding();
      }, 120);
    });
  }

  /* ——— Profile Management —————————————————— */

  #initProfiles() {
    try {
      const rawProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
      if (rawProfiles) {
        this.#profiles = JSON.parse(rawProfiles);
        this.#activeProfileId = localStorage.getItem(STORAGE_KEY_ACTIVE) || this.#profiles[0].id;

        // Validate active profile exists
        if (!this.#profiles.find(p => p.id === this.#activeProfileId)) {
          this.#activeProfileId = this.#profiles[0].id;
          localStorage.setItem(STORAGE_KEY_ACTIVE, this.#activeProfileId);
        }
      } else {
        // First time or legacy migration
        this.#profiles = [{ id: 'default', name: 'Player 1' }];
        this.#activeProfileId = 'default';
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(this.#profiles));
        localStorage.setItem(STORAGE_KEY_ACTIVE, this.#activeProfileId);

        // Migrate legacy data
        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyData) {
          localStorage.setItem(STORAGE_KEY_PREFIX + 'default', legacyData);
        }
      }
    } catch {
      this.#profiles = [{ id: 'default', name: 'Player 1' }];
      this.#activeProfileId = 'default';
    }
  }

  #saveProfiles() {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(this.#profiles));
      localStorage.setItem(STORAGE_KEY_ACTIVE, this.#activeProfileId);
    } catch { }
  }

  #renderProfileMenu() {
    const activeProfile = this.#profiles.find(p => p.id === this.#activeProfileId);
    this.refs.activeProfileName.textContent = activeProfile ? activeProfile.name : 'Unknown';

    this.refs.profileList.innerHTML = this.#profiles.map(p => `
          <div class="profile-item ${p.id === this.#activeProfileId ? 'is-active' : ''}" data-id="${p.id}" tabindex="0" role="menuitem">
            <span class="profile-item-name">${p.name}</span>
            ${this.#profiles.length > 1 ? `
            <button class="btn-delete-profile" aria-label="Delete ${p.name}" data-action="delete" data-id="${p.id}">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
            </button>
            ` : ''}
          </div>
        `).join('');

    // Attach events to list items
    this.refs.profileList.querySelectorAll('.profile-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-profile');
        if (deleteBtn) {
          e.stopPropagation();
          this.#handleDeleteProfile(item.dataset.id);
        } else {
          this.#handleSwitchProfile(item.dataset.id);
        }
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.#handleSwitchProfile(item.dataset.id);
        }
      });
    });
  }

  #handleSwitchProfile(id) {
    if (this.#activeProfileId === id) {
      this.#closeProfileMenu();
      return;
    }

    this.#activeProfileId = id;
    this.#saveProfiles();

    // Load new data
    this.#state.data = this.#restoreState();
    this.#state.sortRef = { key: null, asc: true };
    this.#hydrateComputed();

    this.#renderProfileMenu();
    this.#renderProfileBio();
    this.#render();
    this.#closeProfileMenu();

    // FLIP or simple entrance anim
    const rows = this.refs.tbody.querySelectorAll('tr.data-row');
    if (rows.length > 0) {
      anime({
        targets: rows,
        opacity: [0, 1],
        translateX: [-10, 0],
        delay: anime.stagger(20),
        duration: 400,
        easing: 'easeOutExpo'
      });
    }
  }

  #handleCreateProfile() {
    const name = this.refs.inputProfileName.value.trim();
    if (!name) return;

    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    this.#profiles.push({ id, name });
    this.#activeProfileId = id;
    this.#saveProfiles();

    // Init empty data
    this.#state.data = [];
    this.#state.sortRef = { key: null, asc: true };
    this.#persistState(); // write empty array to new key

    this.#closeProfileModal();
    this.#closeProfileMenu();

    this.#renderProfileMenu();
    this.#renderProfileBio();
    this.#render();
  }

  #handleDeleteProfile(id) {
    if (this.#profiles.length <= 1) return; // Cannot delete last profile
    const profileToDelete = this.#profiles.find(p => p.id === id);

    if (!confirm(`Are you sure you want to delete the database "${profileToDelete.name}" and all its records? This cannot be undone.`)) {
      return;
    }

    // Remove data from localstorage
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);

    this.#profiles = this.#profiles.filter(p => p.id !== id);

    // If deleted profile was active, switch to the first available
    if (this.#activeProfileId === id) {
      this.#activeProfileId = this.#profiles[0].id;
      this.#state.data = this.#restoreState();
      this.#state.sortRef = { key: null, asc: true };
      this.#hydrateComputed();
      this.#renderProfileBio();
      this.#render();
    }

    this.#saveProfiles();
    this.#renderProfileMenu();
  }

  #handleExportProfile() {
    const activeProfile = this.#profiles.find(p => p.id === this.#activeProfileId);
    if (!activeProfile) return;

    const payload = {
      profile: activeProfile,
      data: this.#state.data
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bstats-${activeProfile.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.#closeProfileMenu();
  }

  #handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsedJson = JSON.parse(e.target.result);
        if (!parsedJson || !parsedJson.profile || !parsedJson.profile.name) {
          throw new Error('Invalid profile format');
        }

        const newId = 'p_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const newProfile = { ...parsedJson.profile, id: newId };
        
        this.#profiles.push(newProfile);
        this.#activeProfileId = newId;
        this.#saveProfiles();

        const dataToSave = Array.isArray(parsedJson.data) ? parsedJson.data : [];
        localStorage.setItem(STORAGE_KEY_PREFIX + newId, JSON.stringify(dataToSave));

        // Switch to imported profile
        this.#state.data = this.#restoreState();
        this.#state.sortRef = { key: null, asc: true };
        this.#hydrateComputed();

        this.#renderProfileMenu();
        this.#renderProfileBio();
        this.#render();

        // Clear input for next time
        this.refs.inputImportFile.value = '';
        this.#closeProfileMenu();

      } catch (err) {
        alert("Failed to import database: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  #toggleProfileMenu() {
    const isExpanded = this.refs.profileToggle.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      this.#closeProfileMenu();
    } else {
      this.refs.profileMenu.hidden = false;
      this.refs.profileToggle.setAttribute('aria-expanded', 'true');
    }
  }

  #closeProfileMenu() {
    this.refs.profileMenu.hidden = true;
    this.refs.profileToggle.setAttribute('aria-expanded', 'false');
  }

  #openProfileModal() {
    this.#closeProfileMenu();
    this.refs.inputProfileName.value = '';
    this.refs.modalNewProfile.showModal();
    this.refs.btnConfirmProfile.disabled = true;
  }

  #closeProfileModal() {
    this.refs.modalNewProfile.setAttribute('closing', '');
    anime({
      targets: this.refs.modalNewProfile,
      opacity: 0,
      translateY: 20,
      duration: 300,
      easing: 'easeInExpo',
      complete: () => {
        this.refs.modalNewProfile.close();
        this.refs.modalNewProfile.removeAttribute('closing');
        anime.set(this.refs.modalNewProfile, { opacity: '', translateY: '' });
      }
    });
  }

  #openPredictModal() {
    this.refs.inputPredictCount.value = '';
    // Archetypes persist in header, no need to reset unless we really want to

    this.refs.modalPredict.showModal();
    this.refs.btnConfirmPredict.disabled = true;
  }

  #closePredictModal() {
    this.refs.modalPredict.setAttribute('closing', '');
    anime({
      targets: this.refs.modalPredict,
      opacity: 0,
      translateY: 20,
      duration: 300,
      easing: 'easeInExpo',
      complete: () => {
        this.refs.modalPredict.close();
        this.refs.modalPredict.removeAttribute('closing');
        anime.set(this.refs.modalPredict, { opacity: '', translateY: '' });
      }
    });
  }

  /* ——— Biodata Management —————————————————— */

  #renderProfileBio() {
    const activeProfile = this.#profiles.find(p => p.id === this.#activeProfileId);
    if (!activeProfile) return;
    ['position', 'heightFt', 'heightIn', 'weight', 'wingspan', 'age'].forEach(key => {
      const el = this.refs.playerBio.querySelector(`[data-bio-key="${key}"]`);
      if (el) {
        el.textContent = activeProfile[key] || '-';
      }
    });
  }

  #renderCareerHighs() {
    if (!this.refs.careerHighsContainer) return;
    const highs = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, '3pm': 0 };

    if (this.#state.data.length > 0) {
      this.#state.data.forEach(row => {
        if (row.ppg > highs.pts) highs.pts = row.ppg;
        if (row.rpg > highs.reb) highs.reb = row.rpg;
        if (row.apg > highs.ast) highs.ast = row.apg;
        if (row.spg > highs.stl) highs.stl = row.spg;
        if (row.bpg > highs.blk) highs.blk = row.bpg;
        if (row.tpm > highs['3pm']) highs['3pm'] = row.tpm;
      });
    }

    const metrics = ['pts', 'reb', 'ast', 'stl', 'blk', '3pm'];
    const updatedNodes = [];

    metrics.forEach(key => {
      const el = this.refs.careerHighsContainer.querySelector(`[data-high-key="${key}"]`);
      if (el) {
        const displayVal = this.#state.data.length > 0 ? highs[key] : '-';
        if (el.textContent !== String(displayVal)) {
          el.textContent = displayVal;
          updatedNodes.push(el);
        }
      }
    });

    if (updatedNodes.length > 0) {
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
  }

  #initializeBioEdit(spanNode, key) {
    if (spanNode.parentNode.querySelector('.input-edit')) return;

    const prevVal = spanNode.textContent === '-' ? '' : spanNode.textContent;
    let input;

    if (key === 'position') {
      input = document.createElement('select');
      input.className = 'input-edit';
      input.style.width = '48px';
      input.style.appearance = 'none';
      input.style.cursor = 'pointer';
      input.style.textAlign = 'right';
      input.style.direction = 'rtl';
      input.innerHTML = '<option value="PG">PG</option><option value="SG">SG</option><option value="G">G</option><option value="SF">SF</option><option value="PF">PF</option><option value="F">F</option><option value="C">C</option>';
      input.value = ['PG', 'SG', 'G', 'SF', 'PF', 'F', 'C'].includes(prevVal) ? prevVal : 'PG';

      Array.from(input.options).forEach(opt => {
        opt.style.background = 'var(--clr-bg)';
        opt.style.color = 'var(--clr-text-primary)';
        opt.style.direction = 'ltr';
      });
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'input-edit';
      input.value = prevVal;
      input.style.width = Math.max(48, prevVal.length * 9 + 16) + 'px';

      // Dynamically adjust width
      input.addEventListener('input', () => {
        input.style.width = Math.max(48, input.value.length * 9 + 16) + 'px';
      });
    }

    input.setAttribute('aria-label', `Edit ${key}`);

    spanNode.style.display = 'none';
    spanNode.parentNode.appendChild(input);
    input.focus();
    if (input.select) input.select();

    if (key === 'position') {
      try { input.showPicker(); } catch (e) { /* fallback if unsupported */ }
    }

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;

      const trimmed = input.value.trim();
      const activeProfile = this.#profiles.find(p => p.id === this.#activeProfileId);
      if (activeProfile) {
        activeProfile[key] = trimmed;
        this.#saveProfiles();
      }

      spanNode.textContent = trimmed || '-';
      input.remove();
      spanNode.style.display = '';

      // Flash confirmation
      const tc = getThemeColors();
      anime({
        targets: spanNode,
        color: [tc.accent, tc.textSecondary, tc.textPrimary],
        duration: 600,
        easing: 'easeOutExpo'
      });
    };

    if (key === 'position') {
      input.addEventListener('change', commit);
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') {
        committed = true;
        input.remove();
        spanNode.style.display = '';
      }
    });
  }

  /* ——— Persistence ————————————————————————— */

  #restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + this.#activeProfileId);
      if (!raw) return structuredClone(SEED_DATA);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : structuredClone(SEED_DATA);
    } catch {
      return structuredClone(SEED_DATA);
    }
  }

  #persistState() {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + this.#activeProfileId, JSON.stringify(this.#state.data));
    } catch { /* quota exceeded or private mode — silently degrade */ }
  }

  /* ——— Computation ————————————————————————— */

  #hydrateComputed() {
    this.#state.data.forEach(row => computeDerived(row));
  }





  /* ——— DOM Construction ———————————————————— */

  #buildStructure() {
    // --- Table header ---
    this.refs.thead.innerHTML = METRICS_SCHEMA.map(col => {
      const isSortable = col.key !== 'id';
      return `
            <th data-key="${col.key}" scope="col" aria-sort="none"
                ${isSortable ? 'tabindex="0" role="columnheader"' : 'role="columnheader"'}>
              ${col.label}
              ${isSortable ? '<span class="sort-indicator"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg></span>' : ''}
            </th>`;
    }).join('');

    // --- Table footer ---
    this.refs.tfoot.innerHTML = METRICS_SCHEMA.map(col =>
      `<td id="avg-${col.key}" data-key="${col.key}">0</td>`
    ).join('');

    // --- Header sort handlers ---
    this.refs.thead.querySelectorAll('th').forEach(th => {
      if (th.dataset.key === 'id') return; // # column is not sortable
      const handler = () => this.#handleSort(th.dataset.key);
      th.addEventListener('click', handler);
      th.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });
  }

  #bindGlobalEvents() {
    this.refs.fab.addEventListener('click', () => this.#handleAppendRecord());
    this.refs.predictFab.addEventListener('click', () => this.#openPredictModal());

    this.refs.toggleFabsBtn.addEventListener('click', () => {
      this.refs.fabContainer.classList.toggle('is-collapsed');
    });

    this.refs.btnCancelPredict.addEventListener('click', () => this.#closePredictModal());
    this.refs.btnConfirmPredict.addEventListener('click', () => this.#handlePredictGames());
    this.refs.inputPredictCount.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.refs.btnConfirmPredict.disabled = isNaN(val) || val <= 0 || val > 1000;
    });
    this.refs.inputPredictCount.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.refs.btnConfirmPredict.disabled) {
        this.#handlePredictGames();
      }
    });

    // Profile events
    this.refs.profileToggle.addEventListener('click', () => this.#toggleProfileMenu());

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!this.refs.profileToggle.contains(e.target) && !this.refs.profileMenu.contains(e.target)) {
        this.#closeProfileMenu();
      }
    });

    this.refs.btnNewProfile.addEventListener('click', () => this.#openProfileModal());

    this.refs.btnCancelProfile.addEventListener('click', () => this.#closeProfileModal());

    this.refs.btnConfirmProfile.addEventListener('click', () => this.#handleCreateProfile());

    this.refs.inputProfileName.addEventListener('input', (e) => {
      this.refs.btnConfirmProfile.disabled = e.target.value.trim().length === 0;
    });

    this.refs.inputProfileName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.refs.btnConfirmProfile.disabled) {
        this.#handleCreateProfile();
      }
    });

    if (this.refs.btnExportProfile) {
      this.refs.btnExportProfile.addEventListener('click', () => this.#handleExportProfile());
    }

    if (this.refs.btnImportProfile && this.refs.inputImportFile) {
      this.refs.btnImportProfile.addEventListener('click', () => {
        this.refs.inputImportFile.click();
      });
      this.refs.inputImportFile.addEventListener('change', (e) => this.#handleImportFile(e));
    }

    // initial render profile menu
    this.#renderProfileMenu();

    const helpBtn = document.getElementById('help-toggle-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        initOnboarding(true);
      });
    }

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
          document.documentElement.removeAttribute('data-theme');
          localStorage.setItem('bstats_theme', 'dark');
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
          localStorage.setItem('bstats_theme', 'light');
        }
      });
    }

    // bind bio click-to-edit interactions
    this.refs.playerBio.querySelectorAll('.bio-value').forEach(node => {
      const handler = () => this.#initializeBioEdit(node, node.dataset.bioKey);
      node.addEventListener('click', handler);
      node.addEventListener('keydown', e => {
        if (e.key === 'Enter' && document.activeElement === node) {
          handler();
        }
      });
    });

    // Archetype Max 2 logic
    if (this.refs.archetypeGrid) {
      this.refs.archetypeGrid.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          const checked = this.refs.archetypeGrid.querySelectorAll('input[name="archetype"]:checked');
          if (checked.length > 2) {
            e.target.checked = false;
          }
        }
      });
    }
  }

  /* ——— Rendering ——————————————————————————— */

  #render() {
    this.refs.tbody.innerHTML = '';

    if (this.#state.data.length === 0) {
      this.refs.empty.classList.add('is-active');
      this.refs.empty.setAttribute('aria-hidden', 'false');
      this.refs.tfoot.parentElement.style.opacity = '0';
      return;
    }

    this.refs.empty.classList.remove('is-active');
    this.refs.empty.setAttribute('aria-hidden', 'true');
    this.refs.tfoot.parentElement.style.opacity = '1';

    const fragment = document.createDocumentFragment();
    this.#state.data.forEach(row => fragment.appendChild(this.#buildRowDOM(row)));
    this.refs.tbody.appendChild(fragment);

    this.#updateAggregates(false);
  }

  /** Build a single <tr> element from row data */
  #buildRowDOM(rowData) {
    const tr = document.createElement('tr');
    tr.className = 'data-row';
    tr.dataset.id = rowData.id;

    METRICS_SCHEMA.forEach(col => {
      const td = document.createElement('td');
      td.dataset.key = col.key;

      if (col.key === 'id') {
        td.innerHTML = `
              <div class="action-context">
                <button class="btn-icon" aria-label="Delete game ${rowData.id}">
                  <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                </button>
              </div>
              <span class="cell-val">${rowData.id}</span>`;
        td.querySelector('.btn-icon').addEventListener('click', e => {
          e.stopPropagation();
          this.#handleDeleteRecord(tr, rowData.id);
        });
      } else if (col.computed) {
        td.className = 'cell-computed';
        td.innerHTML = `<span class="cell-val">${formatValue(rowData[col.key], col.isPct)}</span>`;
      } else {
        td.className = 'cell-interactive';
        td.tabIndex = 0;
        td.innerHTML = `<span class="cell-val">${formatValue(rowData[col.key])}</span>`;

        // Click to edit
        td.addEventListener('click', () => this.#initializeEdit(td, rowData, col));

        // Keyboard: Enter to edit (single bound handler, no leak)
        td.addEventListener('keydown', e => {
          if (e.key === 'Enter' && document.activeElement === td) {
            this.#initializeEdit(td, rowData, col);
          }
        });
      }

      tr.appendChild(td);
    });

    return tr;
  }

  /* ——— Aggregates ————————————————————————— */

  /** Recalculate footer averages; optionally animate changed cells */
  #updateAggregates(animate = true) {
    const data = this.#state.data;
    const len = data.length;
    if (len === 0) return;

    // Accumulate totals (use Number() to include 0 values correctly)
    const acc = {};
    METRICS_SCHEMA.forEach(c => { acc[c.key] = 0; });
    data.forEach(r => {
      METRICS_SCHEMA.forEach(c => {
        acc[c.key] += Number(r[c.key]) || 0;
      });
    });

    // Averages
    const avg = {};
    METRICS_SCHEMA.forEach(c => { avg[c.key] = acc[c.key] / len; });

    // Game count label
    avg.id = len;

    // Weighted percentage averages (true shooting %, not averaged %)
    avg.fgPct = acc.fga > 0 ? (acc.fgm / acc.fga) * 100 : 0;
    avg.tpPct = acc.tpa > 0 ? (acc.tpm / acc.tpa) * 100 : 0;
    avg.ftPct = acc.fta > 0 ? (acc.ftm / acc.fta) * 100 : 0;

    const updatedNodes = [];

    METRICS_SCHEMA.forEach(col => {
      const node = document.getElementById(`avg-${col.key}`);
      if (!node) return;

      let displayVal;
      if (col.key === 'id') {
        displayVal = `${len} GAME${len !== 1 ? 'S' : ''}`;
      } else if (col.computed && col.key !== 'ppg') {
        displayVal = formatValue(avg[col.key], col.isPct);
      } else {
        displayVal = formatValue(avg[col.key]);
      }

      if (node.textContent !== displayVal) {
        node.textContent = displayVal;
        updatedNodes.push(node);
      }
    });

    if (animate && updatedNodes.length) {
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

    this.#renderCareerHighs();
  }

  /* ——— Inline Edit ————————————————————————— */

  #initializeEdit(tdNode, rowData, colMeta) {
    // Guard: already in edit mode
    if (tdNode.querySelector('input')) return;

    const span = tdNode.querySelector('.cell-val');
    const prevVal = span.textContent;

    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'decimal';
    input.className = 'input-edit';
    input.value = prevVal;
    input.min = '0';
    input.step = 'any';
    input.setAttribute('aria-label', `Edit ${colMeta.label}`);

    span.style.display = 'none';
    tdNode.appendChild(input);
    input.focus();
    input.select();

    let committed = false;

    const commit = () => {
      if (committed) return; // prevent double-fire from blur + Enter
      committed = true;

      const trimmed = input.value.trim();

      // Empty input → revert
      if (trimmed === '') {
        input.remove();
        span.style.display = '';
        return;
      }

      const parsed = parseFloat(trimmed);
      if (isNaN(parsed) || parsed < 0) {
        committed = false; // allow retry
        anime({ targets: input, translateX: [0, -4, 4, -2, 2, 0], duration: 400 });
        input.focus();
        return;
      }

      rowData[colMeta.key] = parsed;
      computeDerived(rowData);
      this.#persistState();

      span.textContent = formatValue(parsed);

      // Update computed cells in this row
      const tr = tdNode.closest('tr');
      COMPUTED_COLS.forEach(c => {
        const tgtSpan = tr.querySelector(`td[data-key="${c.key}"] .cell-val`);
        if (tgtSpan) tgtSpan.textContent = formatValue(rowData[c.key], c.isPct);
      });

      input.remove();
      span.style.display = '';

      // Subtle flash confirmation
      anime({
        targets: tdNode,
        backgroundColor: [getThemeColors().bgFlashStrong, 'transparent'],
        duration: 500,
        easing: 'easeOutExpo'
      });

      this.#updateAggregates(true);
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') {
        committed = true; // skip commit logic
        input.remove();
        span.style.display = '';
      }
    });
  }

  /* ——— Record Management ——————————————————— */

  #handleDeleteRecord(trNode, id) {
    this.#state.data = this.#state.data.filter(r => r.id !== id);
    this.#persistState();
    trNode.style.pointerEvents = 'none';

    anime({
      targets: trNode.querySelectorAll('td'),
      opacity: 0,
      paddingTop: 0,
      paddingBottom: 0,
      height: 0,
      duration: 350,
      easing: 'cubicBezier(0.4, 0, 0.2, 1)',
      complete: () => {
        trNode.remove();
        if (this.#state.data.length === 0) this.#render();
        else this.#updateAggregates(true);
      }
    });
  }

  #handleAppendRecord() {
    const ids = this.#state.data.map(d => d.id);
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    const newRecord = { id: nextId };
    METRICS_SCHEMA.forEach(c => {
      if (c.key !== 'id') newRecord[c.key] = 0;
    });

    this.#state.data.unshift(newRecord);
    computeDerived(newRecord);
    this.#persistState();

    const existingRows = Array.from(this.refs.tbody.querySelectorAll('tr.data-row'));
    const rectMap = new Map();
    existingRows.forEach(r => rectMap.set(r.dataset.id, r.getBoundingClientRect().top));

    if (this.#state.data.length === 1) {
      this.#render();
    } else {
      const tr = this.#buildRowDOM(newRecord);
      this.refs.tbody.prepend(tr);

      // FLIP for existing rows
      existingRows.forEach((r) => {
        const beforeY = rectMap.get(r.dataset.id);
        if (beforeY !== undefined) {
          const afterY = r.getBoundingClientRect().top;
          const delta = beforeY - afterY;
          if (Math.abs(delta) > 1) {
            anime.set(r, { translateY: delta });
            anime({
              targets: r,
              translateY: 0,
              duration: 600,
              easing: 'easeOutExpo'
            });
          }
        }
      });

      anime({
        targets: tr,
        translateY: [-40, 0],
        opacity: [0, 1],
        backgroundColor: [getThemeColors().bgFlash, 'transparent'],
        duration: 600,
        easing: 'easeOutExpo'
      });
    }

    this.#updateAggregates(true);

    // Scroll to top so the new row is visible
    const scrollCtx = this.refs.tbody.closest('.scroll-context');
    if (scrollCtx) scrollCtx.scrollTo({ top: 0, behavior: 'smooth' });
  }

  #handlePredictGames() {
    const count = parseInt(this.refs.inputPredictCount.value, 10);
    if (isNaN(count) || count <= 0) return;

    const archetypeInputs = Array.from(this.refs.archetypeGrid.querySelectorAll('input[name="archetype"]:checked'));
    const archetypes = archetypeInputs.length > 0 ? archetypeInputs.map(inp => inp.value) : ['balanced'];

    const activeProfile = this.#profiles.find(p => p.id === this.#activeProfileId) || {};
    const ageNum = parseInt(activeProfile.age, 10) || 26;
    const ft = parseInt(activeProfile.heightFt, 10) || 6;
    const inc = parseInt(activeProfile.heightIn, 10) || 6;
    const heightInches = (ft * 12) + inc; // default to 6'6" (78")
    const pos = activeProfile.position || 'SG';

    const data = this.#state.data;
    const len = data.length || 1;

    const acc = {};
    METRICS_SCHEMA.forEach(c => { if (!c.computed && c.key !== 'id') acc[c.key] = 0; });
    data.forEach(r => {
      METRICS_SCHEMA.forEach(c => {
        if (!c.computed && c.key !== 'id') acc[c.key] += Number(r[c.key]) || 0;
      });
    });

    const avg = {};
    const variance = {};
    METRICS_SCHEMA.forEach(c => {
      if (!c.computed && c.key !== 'id') {
        avg[c.key] = data.length > 0 ? (acc[c.key] / len) : 0;

        let sumSquares = 0;
        data.forEach(r => {
          sumSquares += Math.pow((Number(r[c.key]) || 0) - avg[c.key], 2);
        });
        const stdDev = data.length > 1 ? Math.sqrt(sumSquares / (len - 1)) : (Math.max(avg[c.key] * 0.2, 1));
        variance[c.key] = stdDev;
      }
    });

    const newRecords = [];
    const ids = data.map(d => d.id);
    let nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    for (let i = 0; i < count; i++) {
      const rec = { id: nextId++ };

      // Box-Muller generator helper (bounded)
      const ranZ = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return Math.max(-3, Math.min(3, z)); // Clamp extreme outliers
      };

      // --- Phase 1: MPG ---
      let baseMpgAvg = avg['mpg'] !== undefined && data.length > 0 ? avg['mpg'] : 24;
      let baseMpgVar = variance['mpg'] !== undefined && data.length > 0 ? variance['mpg'] : 5;

      let mpgMod = 1.0;
      let mpgVarMod = 1.0;
      for (const archetype of archetypes) {
        if (archetype === 'facilitator') mpgMod *= 1.1;
        else if (archetype === 'workhorse') mpgMod *= 1.15;
        else if (archetype === 'fringe') { mpgMod *= 0.7; mpgVarMod *= 1.2; }
      }

      if (data.length === 0) {
        baseMpgAvg *= mpgMod;
        if (archetypes.includes('facilitator')) baseMpgAvg = Math.min(baseMpgAvg, 42);
        if (archetypes.includes('workhorse')) baseMpgAvg = Math.min(baseMpgAvg, 44);
      }
      baseMpgVar *= mpgVarMod;

      let genMpg = Math.round(baseMpgAvg + ranZ() * baseMpgVar);
      if (genMpg < 0) genMpg = 0;
      if (genMpg > 48) genMpg = 48 + Math.floor(Math.random() * 10);
      rec['mpg'] = genMpg;

      const minRatio = baseMpgAvg > 0 ? (genMpg / baseMpgAvg) : (genMpg > 0 ? 1 : 0);

      // --- Phase 2: Volume (Attempts) & Usage ---
      let fgaAvg = (data.length > 0 ? (avg['fga'] || 0) : 10) * minRatio;
      let fgaVar = (data.length > 0 ? (variance['fga'] || 3) : 3) * Math.sqrt(minRatio);
      let tpaAvg = (data.length > 0 ? (avg['tpa'] || 0) : 3) * minRatio;
      let tpaVar = (data.length > 0 ? (variance['tpa'] || 1) : 1) * Math.sqrt(minRatio);
      let ftaAvg = (data.length > 0 ? (avg['fta'] || 0) : 2) * minRatio;
      let ftaVar = (data.length > 0 ? (variance['fta'] || 1) : 1) * Math.sqrt(minRatio);

      let tovAvg = (data.length > 0 ? (avg['topg'] || 0) : 1.5) * minRatio;
      let tovVar = (data.length > 0 ? (variance['topg'] || 1) : 1) * Math.sqrt(minRatio);

      let mod_fga = 1.0, mod_tpa = 1.0, mod_fta = 1.0, mod_tov = 1.0;

      for (const arch of archetypes) {
        if (arch === 'scorer') { mod_fga *= 1.35; fgaVar *= 1.15; mod_fta *= 1.2; mod_tov *= 1.1; }
        else if (arch === 'playmaker') { mod_fga *= 0.85; mod_tov *= 0.75; }
        else if (arch === 'sharp') { mod_tpa *= 1.6; tpaVar *= 1.25; mod_fga *= 1.15; }
        else if (arch === 'defender') { mod_fga *= 0.8; }
        else if (arch === 'glass') { mod_tpa *= 0.4; mod_fta *= 1.2; }
        else if (arch === 'slasher') { mod_fta *= 1.5; ftaVar *= 1.2; mod_fga *= 1.2; fgaVar *= 1.1; mod_tpa *= 0.6; }
        else if (arch === 'erratic') { fgaVar *= 2.5; tpaVar *= 2.5; ftaVar *= 2.5; tovVar *= 2.5; }
        else if (arch === 'clutch') { mod_fta *= 1.3; mod_tov *= 0.65; fgaVar *= 0.75; tovVar *= 0.75; }
        else if (arch === 'fringe') { mod_fga *= 0.7; mod_tpa *= 0.7; mod_fta *= 0.7; fgaVar *= 1.2; }
      }

      if (pos === 'PG') { mod_tpa *= 1.25; mod_fta *= 1.1; mod_tov *= 1.3; }
      else if (pos === 'SG') { mod_tpa *= 1.3; }
      else if (pos === 'G') { mod_tpa *= 1.25; mod_fta *= 1.05; mod_tov *= 1.15; }
      else if (pos === 'SF') { mod_fta *= 1.1; }
      else if (pos === 'F') { mod_tpa *= 0.75; mod_fta *= 1.15; }
      else if (pos === 'PF') { mod_tpa *= 0.5; mod_fta *= 1.2; }
      else if (pos === 'C') { mod_tpa *= 0.1; mod_fta *= 1.4; mod_tov *= 1.2; }

      if (data.length === 0) {
        fgaAvg *= mod_fga;
        tpaAvg *= mod_tpa;
        ftaAvg *= mod_fta;
        tovAvg *= mod_tov;
      }

      let fga = Math.round(fgaAvg + ranZ() * fgaVar);
      let tpa = Math.round(tpaAvg + ranZ() * tpaVar);
      let fta = Math.round(ftaAvg + ranZ() * ftaVar);
      let topg = Math.round(tovAvg + ranZ() * tovVar);

      if (fga < 0) fga = 0; if (tpa < 0) tpa = 0; if (fta < 0) fta = 0; if (topg < 0) topg = 0;
      if (tpa > fga) tpa = fga; // Cannot shoot more 3s than total FGs

      rec['fga'] = fga;
      rec['tpa'] = tpa;
      rec['fta'] = fta;
      rec['topg'] = topg;

      // --- Phase 3: Efficiencies & Makes ---
      const histFgPct = acc.fga > 0 ? (acc.fgm / acc.fga) : 0.45;
      const histTpPct = acc.tpa > 0 ? (acc.tpm / acc.tpa) : 0.35;
      const histFtPct = acc.fta > 0 ? (acc.ftm / acc.fta) : 0.75;

      let fgPctVar = 0.12, tpPctVar = 0.18, ftPctVar = 0.10;

      for (const arch of archetypes) {
        if (arch === 'erratic') { fgPctVar *= 2.0; tpPctVar *= 2.0; ftPctVar *= 2.0; }
        else if (arch === 'clutch') { ftPctVar *= 0.5; }
        else if (arch === 'scorer') { fgPctVar *= 0.95; tpPctVar *= 0.95; ftPctVar *= 0.95; } // Shoot more but slightly more consistent
        else if (arch === 'sharp') { tpPctVar *= 0.7; }
      }

      let nightlyFgPct = histFgPct + ranZ() * fgPctVar;
      let nightlyTpPct = histTpPct + ranZ() * tpPctVar;
      let nightlyFtPct = histFtPct + ranZ() * ftPctVar;

      // Enforce realistic boundaries for percentages
      nightlyFgPct = Math.max(0.1, Math.min(1.0, nightlyFgPct));
      nightlyTpPct = Math.max(0.0, Math.min(1.0, nightlyTpPct));
      nightlyFtPct = Math.max(0.0, Math.min(1.0, nightlyFtPct));

      let fgm = Math.round(fga * nightlyFgPct);
      let tpm = Math.round(tpa * nightlyTpPct);
      let ftm = Math.round(fta * nightlyFtPct);

      if (tpm > fgm) {
        fgm = Math.min(tpm + Math.floor(Math.random() * 3), fga); // Boost fgm if tpm is high
        if (tpm > fgm) tpm = fgm;
      }

      rec['fgm'] = fgm;
      rec['tpm'] = tpm;
      rec['ftm'] = ftm;

      // --- Phase 4: Peripherals (REB, AST, STL, BLK) ---
      const periphKeys = ['rpg', 'apg', 'spg', 'bpg'];
      const defaults = { rpg: 4, apg: 2, spg: 0.8, bpg: 0.4 };

      periphKeys.forEach(key => {
        let baseAvg = data.length > 0 ? (avg[key] || 0) : defaults[key];
        let pAvg = baseAvg * minRatio;
        let pVar = (data.length > 0 ? (variance[key] || Math.max(pAvg * 0.3, 1)) : Math.max(defaults[key] * 0.3, 1)) * Math.sqrt(minRatio);

        let modAvg = 1.0;

        for (const arch of archetypes) {
          if (arch === 'playmaker' && key === 'apg') { modAvg *= 1.5; pVar *= 1.2; }
          if (arch === 'defender') {
            if (['spg', 'bpg'].includes(key)) { modAvg *= 1.7; pVar *= 1.3; }
            if (key === 'rpg') { modAvg *= 1.15; }
          }
          if (arch === 'glass') {
            if (key === 'rpg') { modAvg *= 1.6; pVar *= 1.2; }
            if (key === 'bpg') { modAvg *= 1.35; pVar *= 1.1; }
          }
          if (arch === 'facilitator' && key === 'apg') { modAvg *= 1.6; pVar *= 1.3; }
          if (arch === 'erratic') { pVar *= 2.5; }
          if (arch === 'fringe') { modAvg *= 0.7; pVar *= 1.2; }
        }

        if (pos === 'PG') {
          if (key === 'apg') { modAvg *= 1.4; }
          if (key === 'rpg') { modAvg *= 0.6; }
        } else if (pos === 'SG') {
          if (key === 'apg') { modAvg *= 1.1; }
          if (key === 'rpg') { modAvg *= 0.8; }
        } else if (pos === 'G') {
          if (key === 'apg') { modAvg *= 1.25; }
          if (key === 'rpg') { modAvg *= 0.7; }
        } else if (pos === 'PF') {
          if (key === 'rpg') { modAvg *= 1.3; }
          if (key === 'bpg') { modAvg *= 1.4; }
          if (key === 'apg') { modAvg *= 0.7; }
        } else if (pos === 'F') {
          if (key === 'rpg') { modAvg *= 1.15; }
          if (key === 'bpg') { modAvg *= 1.2; }
          if (key === 'apg') { modAvg *= 0.85; }
        } else if (pos === 'C') {
          if (key === 'rpg') { modAvg *= 1.6; }
          if (key === 'bpg') { modAvg *= 1.8; }
          if (key === 'apg') { modAvg *= 0.5; }
          if (key === 'spg') { modAvg *= 0.6; }
        }

        if (ageNum < 23) pVar *= 1.15;
        else if (ageNum >= 30 && data.length === 0) {
          const decline = ageNum >= 35 ? 0.9 : 0.95;
          if (['rpg', 'spg', 'bpg'].includes(key)) modAvg *= decline;
        }

        const heightDiff = heightInches - 78;
        if (['rpg', 'bpg'].includes(key)) modAvg *= Math.max(0.5, 1 + (heightDiff * 0.05));
        if (['apg', 'spg'].includes(key)) modAvg *= Math.max(0.5, 1 - (heightDiff * 0.03));

        if (data.length === 0) {
          pAvg *= modAvg;
        }

        let pVal = Math.round(pAvg + ranZ() * pVar);
        if (pVal < 0) pVal = 0;

        // Absolute Constraints vs Minutes
        if (key === 'rpg' && pVal > 0.8 * genMpg) pVal = Math.floor(0.8 * genMpg);
        if (key === 'apg' && pVal > 0.5 * genMpg) pVal = Math.floor(0.5 * genMpg);
        if (key === 'spg' && pVal > 0.25 * genMpg) pVal = Math.floor(0.25 * genMpg);
        if (key === 'bpg' && pVal > 0.3 * genMpg) pVal = Math.floor(0.3 * genMpg);

        rec[key] = pVal;
      });

      // Ensure logic invariants
      if (rec.fga < rec.fgm) rec.fga = rec.fgm;
      if (rec.fta < rec.ftm) rec.fta = rec.ftm;
      if (rec.tpa < rec.tpm) rec.tpa = rec.tpm;
      if (rec.fga < rec.tpa) rec.fga = rec.tpa;
      if (rec.fgm < rec.tpm) rec.fgm = rec.tpm;
      if ((rec.fgm - rec.tpm) > (rec.fga - rec.tpa)) {
        rec.fgm = rec.tpm + (rec.fga - rec.tpa);
      }

      computeDerived(rec);
      newRecords.unshift(rec);
    }

    // FLIP setup
    const existingRows = Array.from(this.refs.tbody.querySelectorAll('tr.data-row'));
    const rectMap = new Map();
    existingRows.forEach(r => rectMap.set(r.dataset.id, r.getBoundingClientRect().top));

    // Append new items at top, respect sort if necessary
    this.#state.sortRef = { key: null, asc: true }; // Reset sort to view newly prepended records simply
    this.#state.data = [...newRecords, ...this.#state.data];
    this.#persistState();

    this.#closePredictModal();
    this.#render();

    // FLIP for existing rows sliding down
    const currentRows = Array.from(this.refs.tbody.querySelectorAll('tr.data-row'));
    currentRows.forEach((r) => {
      const beforeY = rectMap.get(r.dataset.id);
      if (beforeY !== undefined) {
        const afterY = r.getBoundingClientRect().top;
        const delta = beforeY - afterY;
        if (Math.abs(delta) > 1) {
          anime.set(r, { translateY: delta });
          anime({
            targets: r,
            translateY: 0,
            duration: 600,
            easing: 'easeOutExpo'
          });
        }
      }
    });

    // Entrance animation for new rows
    const newDoms = currentRows.slice(0, count);
    if (newDoms.length > 0) {
      anime({
        targets: newDoms,
        translateY: [-40, 0],
        opacity: [0, 1],
        backgroundColor: [getThemeColors().bgFlash, 'transparent'],
        delay: anime.stagger(30),
        duration: 600,
        easing: 'easeOutExpo'
      });
    }

    const scrollCtx = this.refs.tbody.closest('.scroll-context');
    if (scrollCtx) scrollCtx.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ——— Sorting ————————————————————————————— */

  #handleSort(key) {
    const sortRef = this.#state.sortRef;

    if (sortRef.key === key) {
      if (sortRef.asc) {
        sortRef.asc = false;
      } else {
        sortRef.key = null;
        sortRef.asc = true;
      }
    } else {
      sortRef.key = key;
      sortRef.asc = true;
    }

    // Update ARIA
    this.refs.thead.querySelectorAll('th').forEach(th => th.setAttribute('aria-sort', 'none'));
    if (sortRef.key) {
      const activeTh = this.refs.thead.querySelector(`th[data-key="${sortRef.key}"]`);
      if (activeTh) {
        activeTh.setAttribute('aria-sort', sortRef.asc ? 'ascending' : 'descending');
      }
    }

    // Capture pre-sort positions for FLIP animation
    const rows = Array.from(this.refs.tbody.querySelectorAll('tr.data-row'));
    const rectMap = new Map();
    rows.forEach(r => rectMap.set(r.dataset.id, r.getBoundingClientRect().top));

    // Sort data
    if (sortRef.key === null) {
      this.#state.data.sort((a, b) => b.id - a.id);
    } else {
      this.#state.data.sort((a, b) => {
        const vA = Number(a[sortRef.key]) || 0;
        const vB = Number(b[sortRef.key]) || 0;
        return sortRef.asc ? vA - vB : vB - vA;
      });
    }

    this.#persistState();
    this.#render();

    // FLIP: animate rows to new positions
    const updatedRows = Array.from(this.refs.tbody.querySelectorAll('tr.data-row'));
    updatedRows.forEach((r, i) => {
      const beforeY = rectMap.get(r.dataset.id);
      if (beforeY !== undefined) {
        const afterY = r.getBoundingClientRect().top;
        const delta = beforeY - afterY;
        if (Math.abs(delta) > 1) {
          anime.set(r, { translateY: delta });
          anime({
            targets: r,
            translateY: 0,
            duration: 500,
            easing: 'easeOutExpo',
            delay: i * 20
          });
        }
      }
    });
  }

  /* ——— Entrance Choreography ——————————————— */

  #choreographEntrance() {
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
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new BMetricsApp();
});