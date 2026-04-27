import {
  METRICS_SCHEMA,
  EDITABLE_KEYS,
  COMPUTED_COLS,
  SEED_DATA,
} from "./schema.js";
import {
  STORAGE_KEY_PROFILES,
  STORAGE_KEY_ACTIVE,
  STORAGE_KEY_PREFIX,
  LEGACY_STORAGE_KEY,
} from "./store.js";
import { formatValue, computeDerived, ranZ, getThemeColors } from "./utils.js";
import {
  choreographEntrance,
  playRowConfirmFlash,
  playAggregateFlash,
  playCareerHighsFlash,
} from "./animation.js";
import { initOnboarding } from "./onboarding.js";
import { MILESTONES } from "./milestones.js";

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
  #activeSeasonId;

  constructor() {
    this.#initTheme();
    this.#initProfiles();

    this.#state = {
      data: this.#restoreState(),
      sortRef: { key: null, asc: true },
    };

    this.refs = {
      thead: document.getElementById("table-head-row"),
      tbody: document.getElementById("table-body"),
      tfoot: document.getElementById("footer-row"),
      empty: document.getElementById("empty-state"),
      fab: document.getElementById("add-game-fab"),
      predictFab: document.getElementById("predict-games-fab"),
      fabContainer: document.getElementById("main-fab-container"),
      toggleFabsBtn: document.getElementById("toggle-fabs-btn"),

      profileToggle: document.getElementById("profile-toggle"),
      profileMenu: document.getElementById("profile-menu"),
      profileList: document.getElementById("profile-list"),
      activeProfileName: document.getElementById("active-profile-name"),
      btnNewProfile: document.getElementById("btn-new-profile"),
      btnExportProfile: document.getElementById("btn-export-profile"),
      btnImportProfile: document.getElementById("btn-import-profile"),
      inputImportFile: document.getElementById("input-import-file"),
      modalNewProfile: document.getElementById("modal-new-profile"),
      inputProfileName: document.getElementById("input-profile-name"),
      btnCancelProfile: document.getElementById("btn-cancel-profile"),
      btnConfirmProfile: document.getElementById("btn-confirm-profile"),

      seasonToggle: document.getElementById("season-toggle"),
      seasonMenu: document.getElementById("season-menu"),
      seasonList: document.getElementById("season-list"),
      activeSeasonName: document.getElementById("active-season-name"),
      btnNewSeason: document.getElementById("btn-new-season"),
      modalNewSeason: document.getElementById("modal-new-season"),
      inputSeasonName: document.getElementById("input-season-name"),
      btnCancelSeason: document.getElementById("btn-cancel-season"),
      btnConfirmSeason: document.getElementById("btn-confirm-season"),

      playerBio: document.getElementById("player-bio"),
      careerHighsContainer: document.getElementById("career-highs"),
      careerTotalsContainer: document.getElementById("career-totals"),
      seasonTotalsContainer: document.getElementById("season-totals"),

      modalPredict: document.getElementById("modal-predict"),
      archetypeGrid: document.getElementById("archetype-grid"),
    };

    this.#init();
  }

  /* ——— Theme Setup ————————————————————————— */

  #initTheme() {
    const saved = localStorage.getItem("bstats_theme");
    // Light is the default (no attribute). Dark mode sets data-theme="dark".
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
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
      // Run once per device if V1 data exists to prevent data stranding if they caught a bad intermediate commit
      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyData && !localStorage.getItem("bstats_v1_migration_done")) {
        let tempProfiles = JSON.parse(
          localStorage.getItem(STORAGE_KEY_PROFILES) || "[]",
        );
        if (tempProfiles.length === 0) {
          tempProfiles = [
            {
              id: "legacy_recovery",
              name: "Recovered Athlete (V1)",
              seasons: [{ id: "s_1", name: "Original Data" }],
              activeSeasonId: "s_1",
            },
          ];
          localStorage.setItem(STORAGE_KEY_ACTIVE, "legacy_recovery");
        } else {
          if (!tempProfiles.find((p) => p.id === "legacy_recovery")) {
            tempProfiles.push({
              id: "legacy_recovery",
              name: "Recovered Athlete (V1)",
              seasons: [{ id: "s_1", name: "Original Data" }],
              activeSeasonId: "s_1",
            });
            localStorage.setItem(STORAGE_KEY_ACTIVE, "legacy_recovery");
          }
        }
        localStorage.setItem(
          STORAGE_KEY_PROFILES,
          JSON.stringify(tempProfiles),
        );
        localStorage.setItem(
          STORAGE_KEY_PREFIX + "legacy_recovery_s_1",
          legacyData,
        );
        localStorage.setItem("bstats_v1_migration_done", "true");
      }

      const rawProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
      if (rawProfiles) {
        this.#profiles = JSON.parse(rawProfiles);
        this.#activeProfileId =
          localStorage.getItem(STORAGE_KEY_ACTIVE) || this.#profiles[0].id;

        // Validate active profile exists
        if (!this.#profiles.find((p) => p.id === this.#activeProfileId)) {
          this.#activeProfileId = this.#profiles[0].id;
          localStorage.setItem(STORAGE_KEY_ACTIVE, this.#activeProfileId);
        }

        // Migrate legacy profiles to support seasons
        this.#profiles.forEach((p) => {
          if (!p.seasons || p.seasons.length === 0) {
            p.seasons = [{ id: "s_1", name: "Season 1" }];
            p.activeSeasonId = "s_1";

            // Migrate their data key safely
            const oldData = localStorage.getItem(STORAGE_KEY_PREFIX + p.id);
            if (oldData) {
              localStorage.setItem(STORAGE_KEY_PREFIX + p.id + "_s_1", oldData);
              localStorage.removeItem(STORAGE_KEY_PREFIX + p.id); // clean up old
            }
          }
          if (!p.activeSeasonId && p.seasons.length > 0) {
            p.activeSeasonId = p.seasons[0].id;
          }
        });

        const activeP = this.#profiles.find(
          (p) => p.id === this.#activeProfileId,
        );
        this.#activeSeasonId = activeP.activeSeasonId;
      } else {
        // First time or legacy migration
        this.#profiles = [
          {
            id: "default",
            name: "Player 1",
            seasons: [{ id: "s_1", name: "Season 1" }],
            activeSeasonId: "s_1",
          },
        ];
        this.#activeProfileId = "default";
        this.#activeSeasonId = "s_1";
        localStorage.setItem(
          STORAGE_KEY_PROFILES,
          JSON.stringify(this.#profiles),
        );
        localStorage.setItem(STORAGE_KEY_ACTIVE, this.#activeProfileId);

        // Migrate extreme legacy data
        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyData) {
          localStorage.setItem(STORAGE_KEY_PREFIX + "default_s_1", legacyData);
        }
      }
    } catch {
      this.#profiles = [
        {
          id: "default",
          name: "Player 1",
          seasons: [{ id: "s_1", name: "Season 1" }],
          activeSeasonId: "s_1",
        },
      ];
      this.#activeProfileId = "default";
      this.#activeSeasonId = "s_1";
    }
  }

  #saveProfiles() {
    try {
      localStorage.setItem(
        STORAGE_KEY_PROFILES,
        JSON.stringify(this.#profiles),
      );
      localStorage.setItem(STORAGE_KEY_ACTIVE, this.#activeProfileId);
    } catch { }
  }

  #renderProfileMenu() {
    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    this.refs.activeProfileName.textContent = activeProfile
      ? activeProfile.name
      : "Unknown";

    this.refs.profileList.innerHTML = this.#profiles
      .map(
        (p) => `
          <div class="profile-item ${p.id === this.#activeProfileId ? "is-active" : ""}" data-id="${p.id}" tabindex="0" role="menuitem">
            <span class="profile-item-name">${p.name}</span>
            <div class="profile-item-actions">
              <button class="btn-profile-action btn-rename-profile" aria-label="Rename ${p.name}" data-action="rename" data-id="${p.id}">
                <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              </button>
              ${this.#profiles.length > 1
            ? `
              <button class="btn-profile-action btn-delete-profile" aria-label="Delete ${p.name}" data-action="delete" data-id="${p.id}">
                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
              </button>
              `
            : ""
          }
            </div>
          </div>
        `,
      )
      .join("");

    // Attach events to list items
    this.refs.profileList.querySelectorAll(".profile-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.tagName === "INPUT") return;
        const deleteBtn = e.target.closest(".btn-delete-profile");
        const renameBtn = e.target.closest(".btn-rename-profile");
        if (deleteBtn) {
          e.stopPropagation();
          this.#handleDeleteProfile(item.dataset.id);
        } else if (renameBtn) {
          e.stopPropagation();
          this.#handleRenameProfile(
            item.dataset.id,
            item.querySelector(".profile-item-name"),
          );
        } else {
          this.#handleSwitchProfile(item.dataset.id);
        }
      });
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
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

    // Load new data using the profile's activeSeasonId
    this.#activeSeasonId = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    ).activeSeasonId;
    this.#state.data = this.#restoreState();
    this.#state.sortRef = { key: null, asc: true };
    this.#hydrateComputed();

    this.#renderProfileMenu();
    this.#renderSeasonMenu();
    this.#renderProfileBio();
    this.#render();
    this.#closeProfileMenu();

    // FLIP or simple entrance anim
    const rows = this.refs.tbody.querySelectorAll("tr.data-row");
    if (rows.length > 0) {
      anime({
        targets: rows,
        opacity: [0, 1],
        translateX: [-10, 0],
        delay: anime.stagger(20),
        duration: 400,
        easing: "spring(1, 100, 20, 0)",
      });
    }
  }

  #handleCreateProfile() {
    const name = this.refs.inputProfileName.value.trim();
    if (!name) return;

    const id =
      "p_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const defaultSeason = { id: "s_1", name: "Season 1" };
    // Initialize with a proper default season so the season menu renders correctly
    // and #persistState writes to the right storage key from the start.
    this.#profiles.push({
      id,
      name,
      seasons: [defaultSeason],
      activeSeasonId: "s_1",
    });
    this.#activeProfileId = id;
    this.#activeSeasonId = "s_1"; // Must be set BEFORE #persistState is called
    this.#saveProfiles();

    // Init empty data
    this.#state.data = [];
    this.#state.sortRef = { key: null, asc: true };
    this.#persistState(); // write empty array to new key

    this.#closeProfileModal();
    this.#closeProfileMenu();

    this.#renderProfileMenu();
    this.#renderSeasonMenu();
    this.#renderProfileBio();
    this.#render();
  }

  #handleDeleteProfile(id) {
    if (this.#profiles.length <= 1) return; // Cannot delete last profile
    const profileToDelete = this.#profiles.find((p) => p.id === id);

    if (
      !confirm(
        `Are you sure you want to delete the database "${profileToDelete.name}" and all its records? This cannot be undone.`,
      )
    ) {
      return;
    }

    // Remove all associated season data from localstorage
    if (profileToDelete.seasons) {
      profileToDelete.seasons.forEach((s) => {
        localStorage.removeItem(STORAGE_KEY_PREFIX + id + "_" + s.id);
      });
    } else {
      localStorage.removeItem(STORAGE_KEY_PREFIX + id); // fallback cleaner
    }

    this.#profiles = this.#profiles.filter((p) => p.id !== id);

    // If deleted profile was active, switch to the first available
    if (this.#activeProfileId === id) {
      this.#activeProfileId = this.#profiles[0].id;
      this.#activeSeasonId = this.#profiles[0].activeSeasonId;
      this.#state.data = this.#restoreState();
      this.#state.sortRef = { key: null, asc: true };
      this.#hydrateComputed();
      this.#renderSeasonMenu();
      this.#renderProfileBio();
      this.#render();
    }

    this.#saveProfiles();
    this.#renderProfileMenu();
  }

  #handleRenameProfile(id, nameSpan) {
    if (nameSpan.parentNode.querySelector(".input-rename")) return;

    const profile = this.#profiles.find((p) => p.id === id);
    if (!profile) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input-edit input-rename";
    input.value = profile.name;
    input.style.width = "100%";
    input.style.minWidth = "80px";

    nameSpan.style.display = "none";
    nameSpan.parentNode.insertBefore(input, nameSpan);
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;

      const newName = input.value.trim();
      if (newName && newName !== profile.name) {
        profile.name = newName;
        this.#saveProfiles();
      }

      this.#renderProfileMenu();
      if (this.#activeProfileId === id) {
        this.refs.activeProfileName.textContent = profile.name;
      }
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        committed = true;
        this.#renderProfileMenu();
      }
    });
  }

  #handleExportProfile() {
    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    if (!activeProfile) return;

    // Export all seasons for the active profile
    const allData = {};
    activeProfile.seasons.forEach((s) => {
      const raw = localStorage.getItem(
        STORAGE_KEY_PREFIX + activeProfile.id + "_" + s.id,
      );
      allData[s.id] = raw ? JSON.parse(raw) : [];
    });

    const payload = {
      profile: activeProfile,
      dataMap: allData,
      data: this.#state.data, // legacy inclusion mapping
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bstats-${activeProfile.name.toLowerCase().replace(/\s+/g, "-")}.json`;
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
          throw new Error("Invalid profile format");
        }

        const newId =
          "p_" +
          Date.now().toString(36) +
          Math.random().toString(36).substr(2, 5);
        const newProfile = { ...parsedJson.profile, id: newId };

        // Safety checks for imported profiles that are old format
        if (!newProfile.seasons || newProfile.seasons.length === 0) {
          newProfile.seasons = [{ id: "s_1", name: "Season 1" }];
          newProfile.activeSeasonId = "s_1";
        }

        this.#profiles.push(newProfile);
        this.#activeProfileId = newId;
        this.#activeSeasonId = newProfile.activeSeasonId;
        this.#saveProfiles();

        // Restore mapped data correctly
        if (parsedJson.dataMap) {
          Object.keys(parsedJson.dataMap).forEach((sId) => {
            localStorage.setItem(
              STORAGE_KEY_PREFIX + newId + "_" + sId,
              JSON.stringify(parsedJson.dataMap[sId] || []),
            );
          });
        } else {
          // Old export format fallback
          const dataToSave = Array.isArray(parsedJson.data)
            ? parsedJson.data
            : [];
          localStorage.setItem(
            STORAGE_KEY_PREFIX + newId + "_" + newProfile.seasons[0].id,
            JSON.stringify(dataToSave),
          );
        }

        // Switch to imported profile
        this.#state.data = this.#restoreState();
        this.#state.sortRef = { key: null, asc: true };
        this.#hydrateComputed();

        this.#renderProfileMenu();
        this.#renderSeasonMenu();
        this.#renderProfileBio();
        this.#render();

        // Clear input for next time
        this.refs.inputImportFile.value = "";
        this.#closeProfileMenu();
      } catch (err) {
        alert("Failed to import database: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  #toggleProfileMenu() {
    const isExpanded =
      this.refs.profileToggle.getAttribute("aria-expanded") === "true";
    if (isExpanded) {
      this.#closeProfileMenu();
    } else {
      this.#closeSeasonMenu(); // Close season menu if open
      this.refs.profileMenu.hidden = false;
      this.refs.profileToggle.setAttribute("aria-expanded", "true");
    }
  }

  #closeProfileMenu() {
    this.refs.profileMenu.hidden = true;
    this.refs.profileToggle.setAttribute("aria-expanded", "false");
  }

  /* ——— Season Management —————————————————— */

  #renderSeasonMenu() {
    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    if (!activeProfile || !activeProfile.seasons) return;

    const activeSeason = activeProfile.seasons.find(
      (s) => s.id === this.#activeSeasonId,
    );
    this.refs.activeSeasonName.textContent = activeSeason
      ? activeSeason.name
      : "Unknown";

    this.refs.seasonList.innerHTML = activeProfile.seasons
      .map(
        (s, index) => `
          <div class="profile-item ${s.id === this.#activeSeasonId ? "is-active" : ""}" data-id="${s.id}" tabindex="0" role="menuitem">
            <span class="profile-item-name">${s.name}</span>
            <div class="profile-item-actions">
              ${index > 0
            ? `
              <button class="btn-profile-action btn-move-up-season" aria-label="Move Up" data-action="move-up" data-id="${s.id}">
                <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
              </button>
              `
            : ""
          }
              ${index < activeProfile.seasons.length - 1
            ? `
              <button class="btn-profile-action btn-move-down-season" aria-label="Move Down" data-action="move-down" data-id="${s.id}">
                <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
              `
            : ""
          }
              <button class="btn-profile-action btn-rename-profile" aria-label="Rename ${s.name}" data-action="rename" data-id="${s.id}">
                <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              </button>
              ${activeProfile.seasons.length > 1
            ? `
              <button class="btn-profile-action btn-delete-profile" aria-label="Delete ${s.name}" data-action="delete" data-id="${s.id}">
                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
              </button>
              `
            : ""
          }
            </div>
          </div>
        `,
      )
      .join("");

    this.refs.seasonList.querySelectorAll(".profile-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.tagName === "INPUT") return;
        const deleteBtn = e.target.closest(".btn-delete-profile");
        const renameBtn = e.target.closest(".btn-rename-profile");
        const upBtn = e.target.closest(".btn-move-up-season");
        const downBtn = e.target.closest(".btn-move-down-season");
        if (deleteBtn) {
          e.stopPropagation();
          this.#handleDeleteSeason(item.dataset.id);
        } else if (renameBtn) {
          e.stopPropagation();
          this.#handleRenameSeason(
            item.dataset.id,
            item.querySelector(".profile-item-name"),
          );
        } else if (upBtn) {
          e.stopPropagation();
          this.#handleReorderSeason(item.dataset.id, -1);
        } else if (downBtn) {
          e.stopPropagation();
          this.#handleReorderSeason(item.dataset.id, 1);
        } else {
          this.#handleSwitchSeason(item.dataset.id);
        }
      });
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.#handleSwitchSeason(item.dataset.id);
        }
      });
    });
  }

  #handleSwitchSeason(id) {
    if (this.#activeSeasonId === id) {
      this.#closeSeasonMenu();
      return;
    }

    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    this.#activeSeasonId = id;
    activeProfile.activeSeasonId = id;
    this.#saveProfiles();

    // Load new data
    this.#state.data = this.#restoreState();
    this.#state.sortRef = { key: null, asc: true };
    this.#hydrateComputed();

    this.#renderSeasonMenu();
    this.#render();
    this.#closeSeasonMenu();

    const rows = this.refs.tbody.querySelectorAll("tr.data-row");
    if (rows.length > 0) {
      anime({
        targets: rows,
        opacity: [0, 1],
        translateX: [-10, 0],
        delay: anime.stagger(20),
        duration: 400,
        easing: "spring(1, 100, 20, 0)",
      });
    }
  }

  #handleCreateSeason() {
    const name = this.refs.inputSeasonName.value.trim();
    if (!name) return;

    const id =
      "s_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    activeProfile.seasons.push({ id, name });
    activeProfile.activeSeasonId = id;
    this.#activeSeasonId = id;
    this.#saveProfiles();

    // Init empty data
    this.#state.data = [];
    this.#state.sortRef = { key: null, asc: true };
    this.#persistState();

    this.#closeSeasonModal();
    this.#closeSeasonMenu();

    this.#renderSeasonMenu();
    this.#render();
  }

  #handleReorderSeason(id, direction) {
    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    if (!activeProfile || !activeProfile.seasons) return;

    const index = activeProfile.seasons.findIndex((s) => s.id === id);
    if (index === -1) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= activeProfile.seasons.length) return;

    // Swap
    const temp = activeProfile.seasons[index];
    activeProfile.seasons[index] = activeProfile.seasons[newIndex];
    activeProfile.seasons[newIndex] = temp;

    this.#saveProfiles();
    this.#renderSeasonMenu();
  }

  #handleDeleteSeason(id) {
    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    if (activeProfile.seasons.length <= 1) return; // Cannot delete last season
    const seasonToDelete = activeProfile.seasons.find((s) => s.id === id);

    if (
      !confirm(
        `Are you sure you want to delete the season "${seasonToDelete.name}" and all its records? This cannot be undone.`,
      )
    ) {
      return;
    }

    // Remove data
    localStorage.removeItem(
      STORAGE_KEY_PREFIX + this.#activeProfileId + "_" + id,
    );

    activeProfile.seasons = activeProfile.seasons.filter((s) => s.id !== id);

    if (this.#activeSeasonId === id) {
      this.#activeSeasonId = activeProfile.seasons[0].id;
      activeProfile.activeSeasonId = this.#activeSeasonId;
      this.#state.data = this.#restoreState();
      this.#state.sortRef = { key: null, asc: true };
      this.#hydrateComputed();
      this.#render();
    }

    this.#saveProfiles();
    this.#renderSeasonMenu();
    this.#renderCareerHighs();
    this.#renderCareerTotals();
    this.#renderSeasonTotals();
  }

  #handleRenameSeason(id, nameSpan) {
    if (nameSpan.parentNode.querySelector(".input-rename")) return;

    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    if (!activeProfile) return;
    const season = activeProfile.seasons.find((s) => s.id === id);
    if (!season) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input-edit input-rename";
    input.value = season.name;
    input.style.width = "100%";
    input.style.minWidth = "80px";

    nameSpan.style.display = "none";
    nameSpan.parentNode.insertBefore(input, nameSpan);
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;

      const newName = input.value.trim();
      if (newName && newName !== season.name) {
        season.name = newName;
        this.#saveProfiles();
      }

      this.#renderSeasonMenu();
      if (this.#activeSeasonId === id) {
        this.refs.activeSeasonName.textContent = season.name;
      }
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        committed = true;
        this.#renderSeasonMenu();
      }
    });
  }

  #toggleSeasonMenu() {
    const isExpanded =
      this.refs.seasonToggle.getAttribute("aria-expanded") === "true";
    if (isExpanded) {
      this.#closeSeasonMenu();
    } else {
      this.#closeProfileMenu(); // Close player menu if open
      this.refs.seasonMenu.hidden = false;
      this.refs.seasonToggle.setAttribute("aria-expanded", "true");
    }
  }

  #closeSeasonMenu() {
    this.refs.seasonMenu.hidden = true;
    this.refs.seasonToggle.setAttribute("aria-expanded", "false");
  }

  #openSeasonModal() {
    this.#closeSeasonMenu();
    this.refs.inputSeasonName.value = "";
    this.refs.modalNewSeason.showModal();
    this.refs.btnConfirmSeason.disabled = true;
  }

  #closeSeasonModal() {
    this.refs.modalNewSeason.setAttribute("closing", "");
    anime({
      targets: this.refs.modalNewSeason,
      opacity: 0,
      translateY: 20,
      duration: 300,
      easing: "easeInExpo",
      complete: () => {
        this.refs.modalNewSeason.close();
        this.refs.modalNewSeason.removeAttribute("closing");
        anime.set(this.refs.modalNewSeason, { opacity: "", translateY: "" });
      },
    });
  }

  #openProfileModal() {
    this.#closeProfileMenu();
    this.refs.inputProfileName.value = "";
    this.refs.modalNewProfile.showModal();
    this.refs.btnConfirmProfile.disabled = true;
  }

  #closeProfileModal() {
    this.refs.modalNewProfile.setAttribute("closing", "");
    anime({
      targets: this.refs.modalNewProfile,
      opacity: 0,
      translateY: 20,
      duration: 300,
      easing: "easeInExpo",
      complete: () => {
        this.refs.modalNewProfile.close();
        this.refs.modalNewProfile.removeAttribute("closing");
        anime.set(this.refs.modalNewProfile, { opacity: "", translateY: "" });
      },
    });
  }

  #openPredictModal() {
    const setupEl = document.getElementById("predict-setup");
    const loadingEl = document.getElementById("predict-loading");
    const resultsEl = document.getElementById("predict-results");
    
    if (setupEl) setupEl.style.display = "block";
    if (loadingEl) loadingEl.style.display = "none";
    if (resultsEl) resultsEl.style.display = "none";

    this.refs.modalPredict.showModal();
  }

  #closePredictModal() {
    this.refs.modalPredict.setAttribute("closing", "");
    anime({
      targets: this.refs.modalPredict,
      opacity: 0,
      translateY: 20,
      duration: 300,
      easing: "easeInExpo",
      complete: () => {
        this.refs.modalPredict.close();
        this.refs.modalPredict.removeAttribute("closing");
        anime.set(this.refs.modalPredict, { opacity: "", translateY: "" });
      },
    });
  }

  /* ——— Biodata Management —————————————————— */

  #renderProfileBio() {
    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    if (!activeProfile) return;
    [
      "position",
      "heightFt",
      "heightIn",
      "weight",
      "wingspan",
      "age",
      "team",
    ].forEach((key) => {
      const el = this.refs.playerBio.querySelector(`[data-bio-key="${key}"]`);
      if (el) {
        el.textContent = activeProfile[key] || "-";
      }
    });
  }

  #renderCareerHighs() {
    if (!this.refs.careerHighsContainer) return;
    const highs = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, "3pm": 0 };

    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    let totalGames = 0;

    if (activeProfile && activeProfile.seasons) {
      activeProfile.seasons.forEach((s) => {
        try {
          const raw = localStorage.getItem(
            STORAGE_KEY_PREFIX + activeProfile.id + "_" + s.id,
          );
          if (raw) {
            const seasonData = JSON.parse(raw);
            if (Array.isArray(seasonData)) {
              seasonData.forEach((row) => {
                totalGames++;
                if (row.ppg > highs.pts) highs.pts = row.ppg;
                if (row.rpg > highs.reb) highs.reb = row.rpg;
                if (row.apg > highs.ast) highs.ast = row.apg;
                if (row.spg > highs.stl) highs.stl = row.spg;
                if (row.bpg > highs.blk) highs.blk = row.bpg;
                if (row.tpm > highs["3pm"]) highs["3pm"] = row.tpm;
              });
            }
          }
        } catch { } // skip bad data
      });
    }

    const metrics = ["pts", "reb", "ast", "stl", "blk", "3pm"];
    const updatedNodes = [];

    metrics.forEach((key) => {
      const el = this.refs.careerHighsContainer.querySelector(
        `[data-high-key="${key}"]`,
      );
      if (el) {
        const displayVal = totalGames > 0 ? highs[key] : "-";
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
        duration: 800,
        delay: anime.stagger(50),
        easing: "spring(1, 100, 20, 0)",
      });
    }
  }

  #renderCareerTotals() {
    if (!this.refs.careerTotalsContainer) return;

    const totals = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, "3pm": 0 };
    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );

    if (activeProfile && activeProfile.seasons) {
      activeProfile.seasons.forEach((s) => {
        try {
          const raw = localStorage.getItem(
            STORAGE_KEY_PREFIX + activeProfile.id + "_" + s.id,
          );
          if (raw) {
            const seasonData = JSON.parse(raw);
            if (Array.isArray(seasonData)) {
              seasonData.forEach((row) => {
                totals.gp++;
                totals.pts += Number(row.ppg) || 0;
                totals.reb += Number(row.rpg) || 0;
                totals.ast += Number(row.apg) || 0;
                totals.stl += Number(row.spg) || 0;
                totals.blk += Number(row.bpg) || 0;
                totals["3pm"] += Number(row.tpm) || 0;
              });
            }
          }
        } catch { } // skip corrupt data
      });
    }

    const hasGames = totals.gp > 0;
    const updatedNodes = [];

    Object.keys(totals).forEach((key) => {
      const el = this.refs.careerTotalsContainer.querySelector(
        `[data-total-key="${key}"]`,
      );
      if (!el) return;
      // Round to 1 decimal for per-game stats, whole for GP
      let displayVal;
      if (!hasGames) {
        displayVal = "-";
      } else if (key === "gp") {
        displayVal = totals.gp;
      } else {
        displayVal = Math.round(totals[key]);
      }
      if (el.textContent !== String(displayVal)) {
        el.textContent = displayVal;
        updatedNodes.push(el);
      }
    });

    if (updatedNodes.length > 0) {
      anime({
        targets: updatedNodes,
        color: ["rgba(212,151,26,0.4)", "#D4971A", "var(--clr-text-primary)"],
        scale: [0.92, 1],
        duration: 900,
        delay: anime.stagger(40),
        easing: "spring(1, 100, 20, 0)",
      });
    }
  }

  #renderSeasonTotals() {
    if (!this.refs.seasonTotalsContainer) return;

    const totals = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, "3pm": 0 };

    // Use the active loaded season data state safely
    if (this.#state && Array.isArray(this.#state.data)) {
      this.#state.data.forEach((row) => {
        totals.gp++;
        totals.pts += Number(row.ppg) || 0;
        totals.reb += Number(row.rpg) || 0;
        totals.ast += Number(row.apg) || 0;
        totals.stl += Number(row.spg) || 0;
        totals.blk += Number(row.bpg) || 0;
        totals["3pm"] += Number(row.tpm) || 0;
      });
    }

    const hasGames = totals.gp > 0;
    const updatedNodes = [];

    Object.keys(totals).forEach((key) => {
      const el = this.refs.seasonTotalsContainer.querySelector(
        `[data-season-total-key="${key}"]`,
      );
      if (!el) return;

      let displayVal;
      if (!hasGames) {
        displayVal = "-";
      } else if (key === "gp") {
        displayVal = totals.gp;
      } else {
        displayVal = Math.round(totals[key]);
      }
      if (el.textContent !== String(displayVal)) {
        el.textContent = displayVal;
        updatedNodes.push(el);
      }
    });

    if (updatedNodes.length > 0) {
      anime({
        targets: updatedNodes,
        color: ["rgba(212,151,26,0.4)", "#D4971A", "var(--clr-text-primary)"],
        scale: [0.92, 1],
        duration: 900,
        delay: anime.stagger(40),
        easing: "spring(1, 100, 20, 0)",
      });
    }
  }

  #initializeBioEdit(spanNode, key) {
    if (spanNode.parentNode.querySelector(".input-edit")) return;

    const prevVal = spanNode.textContent === "-" ? "" : spanNode.textContent;
    let input;

    if (key === "position") {
      input = document.createElement("select");
      input.className = "input-edit";
      input.style.width = "48px";
      input.style.appearance = "none";
      input.style.cursor = "pointer";
      input.style.textAlign = "right";
      input.style.direction = "rtl";
      input.innerHTML =
        '<option value="PG">PG</option><option value="SG">SG</option><option value="G">G</option><option value="SF">SF</option><option value="PF">PF</option><option value="F">F</option><option value="C">C</option>';
      input.value = ["PG", "SG", "G", "SF", "PF", "F", "C"].includes(prevVal)
        ? prevVal
        : "PG";

      Array.from(input.options).forEach((opt) => {
        opt.style.background = "var(--clr-bg)";
        opt.style.color = "var(--clr-text-primary)";
        opt.style.direction = "ltr";
      });
    } else if (key === "team") {
      // Searchable NBA team picker via datalist
      const NBA_TEAMS = [
        "Atlanta Hawks",
        "Boston Celtics",
        "Brooklyn Nets",
        "Charlotte Hornets",
        "Chicago Bulls",
        "Cleveland Cavaliers",
        "Dallas Mavericks",
        "Denver Nuggets",
        "Detroit Pistons",
        "Golden State Warriors",
        "Houston Rockets",
        "Indiana Pacers",
        "LA Clippers",
        "Los Angeles Lakers",
        "Memphis Grizzlies",
        "Miami Heat",
        "Milwaukee Bucks",
        "Minnesota Timberwolves",
        "New Orleans Pelicans",
        "New York Knicks",
        "Oklahoma City Thunder",
        "Orlando Magic",
        "Philadelphia 76ers",
        "Phoenix Suns",
        "Portland Trail Blazers",
        "Sacramento Kings",
        "San Antonio Spurs",
        "Toronto Raptors",
        "Utah Jazz",
        "Washington Wizards",
      ];

      // Unique datalist id to avoid collisions
      const listId = "nba-team-list";
      let datalist = document.getElementById(listId);
      if (!datalist) {
        datalist = document.createElement("datalist");
        datalist.id = listId;
        datalist.innerHTML = NBA_TEAMS.map(
          (t) => `<option value="${t}"></option>`,
        ).join("");
        document.body.appendChild(datalist);
      }

      input = document.createElement("input");
      input.type = "text";
      input.className = "input-edit";
      input.setAttribute("list", listId);
      input.autocomplete = "off";
      input.placeholder = "Search team…";
      input.value = prevVal;
      input.style.width = "220px";

      // Snap to exact team name on valid match
      input.addEventListener("input", () => {
        const match = NBA_TEAMS.find(
          (t) => t.toLowerCase() === input.value.toLowerCase(),
        );
        if (match) input.value = match;
      });
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.className = "input-edit";
      input.value = prevVal;
      input.style.width = Math.max(48, prevVal.length * 9 + 16) + "px";

      // Dynamically adjust width
      input.addEventListener("input", () => {
        input.style.width = Math.max(48, input.value.length * 9 + 16) + "px";
      });
    }

    input.setAttribute("aria-label", `Edit ${key}`);

    spanNode.style.display = "none";
    spanNode.parentNode.appendChild(input);
    input.focus();
    if (input.select) input.select();

    if (key === "position") {
      try {
        input.showPicker();
      } catch (e) {
        /* fallback if unsupported */
      }
    }

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;

      const trimmed = input.value.trim();
      const activeProfile = this.#profiles.find(
        (p) => p.id === this.#activeProfileId,
      );
      if (activeProfile) {
        activeProfile[key] = trimmed;
        this.#saveProfiles();
      }

      spanNode.textContent = trimmed || "-";
      input.remove();
      spanNode.style.display = "";

      // Flash confirmation
      const tc = getThemeColors();
      anime({
        targets: spanNode,
        color: [tc.accent, tc.textSecondary, tc.textPrimary],
        duration: 600,
        easing: "spring(1, 100, 20, 0)",
      });
    };

    if (key === "position") {
      input.addEventListener("change", commit);
    }
    // For datalist inputs, also commit on Enter immediately (blur fires after)
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        committed = true;
        input.remove();
        spanNode.style.display = "";
      }
    });
  }

  /* ——— Persistence ————————————————————————— */

  #restoreState() {
    try {
      const raw = localStorage.getItem(
        STORAGE_KEY_PREFIX + this.#activeProfileId + "_" + this.#activeSeasonId,
      );
      if (!raw) return structuredClone(SEED_DATA);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : structuredClone(SEED_DATA);
    } catch {
      return structuredClone(SEED_DATA);
    }
  }

  #persistState() {
    try {
      localStorage.setItem(
        STORAGE_KEY_PREFIX + this.#activeProfileId + "_" + this.#activeSeasonId,
        JSON.stringify(this.#state.data),
      );
    } catch {
      /* quota exceeded or private mode — silently degrade */
    }
  }

  /* ——— Computation ————————————————————————— */

  #hydrateComputed() {
    this.#state.data.forEach((row) => computeDerived(row));
  }

  /* ——— Advanced Stats —————————————————————— */

  renderAdvancedStats() {
    this.#renderAdvancedStats();
  }

  #renderAdvancedStats() {
    const advContent = document.getElementById("advanced-content");
    const advEmpty = document.getElementById("advanced-empty");
    if (!advContent || !advEmpty) return;

    const data = this.#state.data;
    if (data.length < 3) {
      advContent.style.display = "none";
      advEmpty.style.display = "";
      return;
    }

    advContent.style.display = "grid";
    advEmpty.style.display = "none";

    const len = data.length;
    let sumPts = 0,
      sumReb = 0,
      sumAst = 0,
      sumStl = 0,
      sumBlk = 0;
    let sumFgm = 0,
      sumFga = 0,
      sumFtm = 0,
      sumFta = 0,
      sumTov = 0;

    data.forEach((r) => {
      sumPts += Number(r.ppg) || 0;
      sumReb += Number(r.rpg) || 0;
      sumAst += Number(r.apg) || 0;
      sumStl += Number(r.spg) || 0;
      sumBlk += Number(r.bpg) || 0;
      sumFgm += Number(r.fgm) || 0;
      sumFga += Number(r.fga) || 0;
      sumFtm += Number(r.ftm) || 0;
      sumFta += Number(r.fta) || 0;
      sumTov += Number(r.topg) || 0;
    });

    const totalGameScore =
      sumPts +
      0.4 * sumFgm -
      0.7 * sumFga -
      0.4 * (sumFta - sumFtm) +
      0.5 * sumReb +
      sumStl +
      0.7 * sumAst +
      0.7 * sumBlk -
      sumTov;
    const perProxy = (totalGameScore / len).toFixed(1);

    const totalLoad = sumFga + sumTov + 0.44 * sumFta;
    const avgLoad = (totalLoad / len).toFixed(1);

    const tsDenom = 2 * (sumFga + 0.44 * sumFta);
    const tsPct = tsDenom > 0 ? ((sumPts / tsDenom) * 100).toFixed(1) : "0";

    const astTo =
      sumTov > 0 ? (sumAst / sumTov).toFixed(2) : sumAst > 0 ? "∞" : "0";

    const perEl = document.getElementById("adv-per");
    if (perEl) perEl.textContent = perProxy;

    const loadEl = document.getElementById("adv-load");
    if (loadEl) loadEl.textContent = avgLoad;

    const tsEl = document.getElementById("adv-ts");
    if (tsEl) tsEl.textContent = tsPct + "%";

    const astToEl = document.getElementById("adv-ast-to");
    if (astToEl) astToEl.textContent = astTo;

    const sparkline = document.getElementById("adv-sparkline");
    if (sparkline) {
      sparkline.innerHTML = "";
      const sorted = [...data].sort((a, b) => b.id - a.id);
      const last5 = sorted.slice(0, 5).reverse();
      const maxPts = Math.max(...last5.map((r) => r.ppg || 0), 1);

      last5.forEach((r) => {
        const bar = document.createElement("div");
        bar.className = "spark-bar";
        const heightPct = Math.max(((r.ppg || 0) / maxPts) * 100, 2);
        bar.style.height = heightPct + "%";
        bar.setAttribute("data-val", Math.round(r.ppg || 0));
        sparkline.appendChild(bar);
      });

      anime({
        targets: sparkline.querySelectorAll(".spark-bar"),
        height: (el) => [0, el.style.height],
        delay: anime.stagger(100),
        duration: 800,
        easing: "spring(1, 100, 20, 0)",
      });
    }

    anime({
      targets: "#advanced-content .adv-card-value",
      opacity: [0, 1],
      translateY: [10, 0],
      delay: anime.stagger(50),
      duration: 600,
      easing: "spring(1, 100, 20, 0)",
    });

    this.#renderMilestones();
  }

  /* ——— Compare View ——————————————— */
  renderCompareView() {
    this.#renderCompareView();
  }

  #renderCompareView() {
    const listA = document.getElementById("compare-profile-a-list");
    const listB = document.getElementById("compare-profile-b-list");
    const containerA = document.getElementById("compare-profile-a-container");
    const containerB = document.getElementById("compare-profile-b-container");
    if (!listA || !listB) return;

    const options = [{ value: "", label: "Select Profile" }];
    this.#profiles.forEach((p) => {
      options.push({ value: `c|${p.id}`, label: `${p.name} (Career)` });
      if (p.seasons) {
        p.seasons.forEach((s) => {
          options.push({ value: `s|${p.id}|${s.id}`, label: `${p.name} - ${s.name}` });
        });
      }
    });

    const valA = containerA.dataset.value || "";
    const valB = containerB.dataset.value || "";

    const buildHTML = (activeVal) => options.map(opt => 
      `<button class="profile-menu-item ${opt.value === activeVal ? 'is-active' : ''}" data-value="${opt.value}" data-label="${opt.label}">${opt.label}</button>`
    ).join("");

    listA.innerHTML = buildHTML(valA);
    listB.innerHTML = buildHTML(valB);

    // Setup click handlers for options
    [ { list: listA, container: containerA, activeId: "compare-profile-a-active", menuId: "compare-profile-a-menu", toggleId: "compare-profile-a-toggle" },
      { list: listB, container: containerB, activeId: "compare-profile-b-active", menuId: "compare-profile-b-menu", toggleId: "compare-profile-b-toggle" }
    ].forEach(({ list, container, activeId, menuId, toggleId }) => {
      list.querySelectorAll(".profile-menu-item").forEach(btn => {
        btn.addEventListener("click", () => {
          const val = btn.dataset.value;
          const label = btn.dataset.label;
          container.dataset.value = val;
          document.getElementById(activeId).textContent = label;
          
          // update active class
          list.querySelectorAll(".profile-menu-item").forEach(b => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          
          // hide menu
          const menu = document.getElementById(menuId);
          menu.hidden = true;
          document.getElementById(toggleId).setAttribute("aria-expanded", "false");
        });
      });
      
      // Setup toggle handler if not already done
      const toggle = document.getElementById(toggleId);
      if (!toggle.dataset.bound) {
        toggle.dataset.bound = "true";
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          const menu = document.getElementById(menuId);
          const isHidden = menu.hidden;
          
          // close all other menus
          document.querySelectorAll('.profile-menu').forEach(m => m.hidden = true);
          document.querySelectorAll('.profile-trigger').forEach(t => t.setAttribute("aria-expanded", "false"));
          
          if (isHidden) {
            menu.hidden = false;
            toggle.setAttribute("aria-expanded", "true");
          }
        });
      }
    });
    
    if (valA) {
      const optA = options.find(o => o.value === valA);
      if (optA) document.getElementById("compare-profile-a-active").textContent = optA.label;
    }
    if (valB) {
      const optB = options.find(o => o.value === valB);
      if (optB) document.getElementById("compare-profile-b-active").textContent = optB.label;
    }
  }

  #handleCompareRun() {
    const containerA = document.getElementById("compare-profile-a-container");
    const containerB = document.getElementById("compare-profile-b-container");
    const content = document.getElementById("compare-content");
    const empty = document.getElementById("compare-empty");
    const grid = document.getElementById("compare-grid");
    if (!containerA || !containerB || !content || !empty || !grid) return;

    const valA = containerA.dataset.value;
    const valB = containerB.dataset.value;
    if (!valA || !valB) {
      alert("Please select two distinct profiles/seasons to compare.");
      return;
    }

    const statsA = this.#getAggregatedStats(valA);
    const statsB = this.#getAggregatedStats(valB);

    if (!statsA || !statsB) {
      alert("Insufficient data for one or both selections.");
      return;
    }

    content.style.display = "block";
    empty.style.display = "none";

    // Stat groups — lowerIsBetter inverts the "winner" highlight
    const STAT_GROUPS = [
      {
        label: "Per-Game",
        keys: [
          { key: "ppg" },
          { key: "rpg" },
          { key: "apg" },
          { key: "spg" },
          { key: "bpg" },
          { key: "mpg" },
          { key: "topg", lowerIsBetter: true },
        ],
      },
      {
        label: "Shooting",
        keys: [
          { key: "fgm" },
          { key: "fga" },
          { key: "fgPct" },
          { key: "tpm" },
          { key: "tpPct" },
          { key: "ftm" },
          { key: "ftPct" },
          { key: "efgPct" },
          { key: "tsPct" },
        ],
      },
      {
        label: "Advanced",
        keys: [{ key: "gameScore" }],
      },
    ];

    // Count edge wins per player for scoreboard
    let edgesA = 0,
      edgesB = 0;
    STAT_GROUPS.forEach((group) => {
      group.keys.forEach(({ key, lowerIsBetter }) => {
        const vA = Number(statsA[key]) || 0;
        const vB = Number(statsB[key]) || 0;
        if (vA === vB) return;
        const aWins = lowerIsBetter ? vA < vB : vA > vB;
        if (aWins) edgesA++;
        else edgesB++;
      });
    });

    // Section divider helper
    const buildSectionHeading = (label) => `
      <div style="grid-column: 1 / -1; display:flex; align-items:center; gap:10px; margin-top: 10px; margin-bottom: 2px;">
        <span style="font-family:var(--font-mono); font-size:0.55rem; letter-spacing:0.12em; color:var(--text-dim); text-transform:uppercase; white-space:nowrap;">${label}</span>
        <div style="flex:1; height:1px; background:var(--border-mid);"></div>
      </div>
    `;

    // Single stat row
    const buildRow = (key, lowerIsBetter) => {
      const col = METRICS_SCHEMA.find((c) => c.key === key);
      if (!col) return "";
      const vA = Number(statsA[key]) || 0;
      const vB = Number(statsB[key]) || 0;
      const isPct = col.isPct;

      const max = Math.max(vA, vB, 0.001);
      const wA = (vA / max) * 100;
      const wB = (vB / max) * 100;

      const fA = isPct ? vA.toFixed(1) + "%" : vA.toFixed(1);
      const fB = isPct ? vB.toFixed(1) + "%" : vB.toFixed(1);

      // Edge: lower is better inverts winner
      const aLeads = lowerIsBetter ? vA <= vB : vA >= vB;
      const bLeads = lowerIsBetter ? vB <= vA : vB >= vA;

      return `
        <div class="compare-row" style="display:grid; grid-template-columns: 1fr 72px 1fr; align-items:center; gap: 12px; font-family: var(--font-data);">
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px;">
            <span style="font-weight: 600; font-size: 0.9rem; color: ${aLeads ? "var(--text-primary)" : "var(--text-dim)"}">${fA}</span>
            <div style="height: 6px; width: 0%; background: ${aLeads ? "var(--text-primary)" : "var(--border-strong)"}; transition: width 1s ease-out; border-radius: 3px 0 0 3px;" data-target-width="${wA}%" class="compare-bar-a"></div>
          </div>
          <div style="text-align:center; font-family:var(--font-mono); font-size:0.58rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;">${col.label}${lowerIsBetter ? '<span style="color:var(--text-dim);font-size:0.5rem;"> ↓</span>' : ""}</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="height: 6px; width: 0%; background: ${bLeads ? "var(--text-primary)" : "var(--border-strong)"}; transition: width 1s ease-out; border-radius: 0 3px 3px 0;" data-target-width="${wB}%" class="compare-bar-b"></div>
            <span style="font-weight: 600; font-size: 0.9rem; color: ${bLeads ? "var(--text-primary)" : "var(--text-dim)"}">${fB}</span>
          </div>
        </div>
      `;
    };

    // Scoreboard header
    const nameA = statsA._label || "Player A";
    const nameB = statsB._label || "Player B";
    const gpA = statsA._gp || 0;
    const gpB = statsB._gp || 0;

    const scoreboard = `
      <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:8px;
                  padding: 16px 0 20px; border-bottom: 1px solid var(--border-mid); margin-bottom:4px;">
        <div style="text-align:right;">
          <div style="font-family:var(--font-sans); font-size:clamp(0.85rem,1.5vw,1.05rem); font-weight:700;
                      color:var(--text-primary); line-height:1.2;">${nameA}</div>
          <div style="font-family:var(--font-mono); font-size:0.58rem; color:var(--text-dim); margin-top:3px;">${gpA} GP</div>
          <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-secondary); margin-top:5px;">
            <span style="font-size:1.1rem; font-weight:700; color:var(--text-primary);">${edgesA}</span> edges
          </div>
        </div>
        <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-dim); text-align:center;
                    padding: 0 8px; line-height:1; text-transform:uppercase; letter-spacing:0.1em;">VS</div>
        <div style="text-align:left;">
          <div style="font-family:var(--font-sans); font-size:clamp(0.85rem,1.5vw,1.05rem); font-weight:700;
                      color:var(--text-primary); line-height:1.2;">${nameB}</div>
          <div style="font-family:var(--font-mono); font-size:0.58rem; color:var(--text-dim); margin-top:3px;">${gpB} GP</div>
          <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-secondary); margin-top:5px;">
            <span style="font-size:1.1rem; font-weight:700; color:var(--text-primary);">${edgesB}</span> edges
          </div>
        </div>
      </div>
    `;

    // Build all grouped rows
    let rowsHTML = "";
    STAT_GROUPS.forEach((group) => {
      rowsHTML += buildSectionHeading(group.label);
      group.keys.forEach(({ key, lowerIsBetter }) => {
        rowsHTML += buildRow(key, lowerIsBetter);
      });
    });

    grid.innerHTML = scoreboard + rowsHTML;

    requestAnimationFrame(() => {
      setTimeout(() => {
        grid
          .querySelectorAll(".compare-bar-a, .compare-bar-b")
          .forEach((bar) => {
            bar.style.width = bar.dataset.targetWidth;
          });
      }, 50);
    });
  }

  #getAggregatedStats(selectionId) {
    const parts = selectionId.split("|");
    const type = parts[0];
    const profileId = parts[1];
    const profile = this.#profiles.find(
      (p) => String(p.id) === String(profileId),
    );
    if (!profile) return null;

    let allData = [];
    // Build a human-readable label for the scoreboard
    let selectionLabel = profile.name;
    if (type === "c") {
      selectionLabel = `${profile.name} (Career)`;
      if (profile.seasons) {
        profile.seasons.forEach((s) => {
          const raw = localStorage.getItem(
            STORAGE_KEY_PREFIX + profile.id + "_" + s.id,
          );
          if (raw) allData.push(...JSON.parse(raw));
        });
      }
    } else {
      const seasonId = parts[2];
      const season = profile.seasons?.find(
        (s) => String(s.id) === String(seasonId),
      );
      selectionLabel = season
        ? `${profile.name} — ${season.name}`
        : profile.name;
      const raw = localStorage.getItem(
        STORAGE_KEY_PREFIX + profile.id + "_" + seasonId,
      );
      if (raw) allData.push(...JSON.parse(raw));
    }

    if (allData.length === 0) return null;

    const count = allData.length;
    const totals = {};
    allData.forEach((r) => {
      Object.keys(r).forEach((k) => {
        if (k !== "id") totals[k] = (totals[k] || 0) + (Number(r[k]) || 0);
      });
    });

    const avg = {};
    Object.keys(totals).forEach((k) => {
      avg[k] = totals[k] / count;
    });

    computeDerived(avg);
    // Attach meta for the scoreboard header
    avg._gp = count;
    avg._label = selectionLabel;
    return avg;
  }

  /* ——— Gamification & Milestones ——————————— */

  #renderMilestones() {
    const container = document.getElementById("milestones-container");
    if (!container) return;

    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    const achievements = activeProfile.achievements || {};

    container.innerHTML = MILESTONES.map((m) => {
      // achievements is an object mapping string ids to result objects
      let ach = null;
      if (Array.isArray(achievements)) {
        ach = achievements.includes(m.id)
          ? { tier: "bronze", count: 1 }
          : { tier: "none", count: 0 };
      } else {
        ach = achievements[m.id] || { tier: "none", count: 0 };
      }

      const isUnlocked = ach.tier !== "none";
      return `
        <div class="milestone-badge ${isUnlocked ? "is-unlocked tier-" + ach.tier : ""}">
          <div class="milestone-icon">${m.icon}</div>
          <p class="milestone-title">${m.title}</p>
          <div class="milestone-desc">
            ${isUnlocked ? `<span class="milestone-desc-status">${ach.tier.toUpperCase()} (${ach.count})</span><span class="milestone-desc-req"><span style="display:block; margin-bottom:4px; color:var(--text-primary); font-weight:600;">${ach.next ? `Next at ${ach.next}` : "Max Tier"}</span><span style="display:block; opacity:0.8; font-size:0.95em; line-height:1.3;">${m.description}</span></span>` : `<span>${m.description}</span>`}
          </div>
        </div>
      `;
    }).join("");
  }

  #checkMilestones() {
    const activeProfile = this.#profiles.find(
      (p) => p.id === this.#activeProfileId,
    );
    if (
      !activeProfile.achievements ||
      Array.isArray(activeProfile.achievements)
    ) {
      activeProfile.achievements = {};
    }

    // Collect all data for this profile across all seasons for true career milestones
    const allData = [];
    if (activeProfile.seasons) {
      activeProfile.seasons.forEach((s) => {
        try {
          const raw = localStorage.getItem(
            STORAGE_KEY_PREFIX + activeProfile.id + "_" + s.id,
          );
          if (raw) {
            const seasonData = JSON.parse(raw);
            if (Array.isArray(seasonData)) {
              allData.push(...seasonData);
            }
          }
        } catch { }
      });
    }

    if (allData.length === 0) return;

    const newlyUnlocked = [];

    MILESTONES.forEach((m) => {
      const result = m.evaluate(allData);
      const currentTier = activeProfile.achievements[m.id]?.tier || "none";
      if (result.tier !== "none" && result.tier !== currentTier) {
        // Upgrade or new unlock
        activeProfile.achievements[m.id] = result;
        newlyUnlocked.push({ milestone: m, result });
      } else if (result.tier !== "none") {
        // Just update counts etc.
        activeProfile.achievements[m.id] = result;
      }
    });

    if (newlyUnlocked.length > 0) {
      this.#saveProfiles();

      // Update UI if in advanced tab
      const advContent = document.getElementById("advanced-content");
      if (advContent && advContent.style.display !== "none") {
        this.#renderMilestones();
      }

      newlyUnlocked.forEach(({ milestone, result }) =>
        this.#showAchievementToast(milestone, result),
      );
    }
  }

  #showAchievementToast(milestone, result) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast-notification toast-tier-${result?.tier || "bronze"}`;
    toast.innerHTML = `
      <div class="toast-icon">${milestone.icon}</div>
      <div class="toast-content">
        <p class="toast-title">${result?.tier?.toUpperCase() || "ACHIEVEMENT"} UNLOCKED</p>
        <p class="toast-desc">${milestone.title}</p>
      </div>
    `;

    container.appendChild(toast);

    anime
      .timeline()
      .add({
        targets: toast,
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 400,
        easing: "spring(1, 100, 20, 0)",
      })
      .add({
        targets: toast,
        opacity: 0,
        translateY: -10,
        delay: 3500,
        duration: 300,
        easing: "easeInExpo",
        complete: () => toast.remove(),
      });
  }

  /* ——— DOM Construction ———————————————————— */

  #buildStructure() {
    // --- Table header ---
    this.refs.thead.innerHTML = METRICS_SCHEMA.map((col) => {
      const isSortable = col.key !== "id";
      return `
            <th data-key="${col.key}" scope="col" aria-sort="none"
                ${isSortable ? 'tabindex="0" role="columnheader"' : 'role="columnheader"'}
                class="${col.advanced ? "is-advanced" : ""}">
              ${col.label}
              ${isSortable ? '<span class="sort-indicator"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg></span>' : ""}
            </th>`;
    }).join("");

    // --- Table footer ---
    this.refs.tfoot.innerHTML = METRICS_SCHEMA.map(
      (col) =>
        `<td id="avg-${col.key}" data-key="${col.key}" class="${col.advanced ? "is-advanced" : ""}">0</td>`,
    ).join("");

    // --- Header sort handlers ---
    this.refs.thead.querySelectorAll("th").forEach((th) => {
      if (th.dataset.key === "id") return; // # column is not sortable
      const handler = () => this.#handleSort(th.dataset.key);
      th.addEventListener("click", handler);
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handler();
        }
      });
    });
  }

  #bindGlobalEvents() {
    this.refs.toggleAdvColumns = document.getElementById("toggle-adv-columns");
    if (this.refs.toggleAdvColumns) {
      this.refs.toggleAdvColumns.addEventListener("change", (e) => {
        const table = document.getElementById("stats-table");
        if (table) {
          if (e.target.checked) table.classList.add("show-advanced");
          else table.classList.remove("show-advanced");
        }
      });
    }

    this.refs.fab.addEventListener("click", () => this.#handleAppendRecord());
    this.refs.predictFab.addEventListener("click", () =>
      this.#openPredictModal(),
    );

    const btnRunCompare = document.getElementById("btn-run-compare");
    if (btnRunCompare) {
      btnRunCompare.addEventListener("click", () => this.#handleCompareRun());
    }

    this.refs.toggleFabsBtn.addEventListener("click", () => {
      this.refs.fabContainer.classList.toggle("is-collapsed");
    });

    const btnRunSim = document.getElementById("btn-run-simulation");
    if (btnRunSim) {
      btnRunSim.addEventListener("click", () => this.#handleRunSimulation());
    }
    const btnCloseSim = document.getElementById("btn-close-predict");
    if (btnCloseSim) {
      btnCloseSim.addEventListener("click", () => this.#closePredictModal());
    }
    const btnAddSimGames = document.getElementById("btn-add-sim-games");
    if (btnAddSimGames) {
      btnAddSimGames.addEventListener("click", () => this.#handleAppendSimGames());
    }
    // Profile events
    this.refs.profileToggle.addEventListener("click", () =>
      this.#toggleProfileMenu(),
    );
    this.refs.seasonToggle.addEventListener("click", () =>
      this.#toggleSeasonMenu(),
    );

    // Close menu on outside click
    document.addEventListener("click", (e) => {
      if (
        !this.refs.profileToggle.contains(e.target) &&
        !this.refs.profileMenu.contains(e.target)
      ) {
        this.#closeProfileMenu();
      }
      if (
        !this.refs.seasonToggle.contains(e.target) &&
        !this.refs.seasonMenu.contains(e.target)
      ) {
        this.#closeSeasonMenu();
      }
    });

    this.refs.btnNewProfile.addEventListener("click", () =>
      this.#openProfileModal(),
    );
    this.refs.btnCancelProfile.addEventListener("click", () =>
      this.#closeProfileModal(),
    );
    this.refs.btnConfirmProfile.addEventListener("click", () =>
      this.#handleCreateProfile(),
    );

    this.refs.inputProfileName.addEventListener("input", (e) => {
      this.refs.btnConfirmProfile.disabled = e.target.value.trim().length === 0;
    });

    this.refs.inputProfileName.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !this.refs.btnConfirmProfile.disabled) {
        this.#handleCreateProfile();
      }
    });

    this.refs.btnNewSeason.addEventListener("click", () =>
      this.#openSeasonModal(),
    );
    this.refs.btnCancelSeason.addEventListener("click", () =>
      this.#closeSeasonModal(),
    );
    this.refs.btnConfirmSeason.addEventListener("click", () =>
      this.#handleCreateSeason(),
    );

    this.refs.inputSeasonName.addEventListener("input", (e) => {
      this.refs.btnConfirmSeason.disabled = e.target.value.trim().length === 0;
    });

    this.refs.inputSeasonName.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !this.refs.btnConfirmSeason.disabled) {
        this.#handleCreateSeason();
      }
    });

    if (this.refs.btnExportProfile) {
      this.refs.btnExportProfile.addEventListener("click", () =>
        this.#handleExportProfile(),
      );
    }

    if (this.refs.btnImportProfile && this.refs.inputImportFile) {
      this.refs.btnImportProfile.addEventListener("click", () => {
        this.refs.inputImportFile.click();
      });
      this.refs.inputImportFile.addEventListener("change", (e) =>
        this.#handleImportFile(e),
      );
    }

    // initial render profile menu
    this.#renderProfileMenu();
    this.#renderSeasonMenu();

    const helpBtn = document.getElementById("help-toggle-btn");
    if (helpBtn) {
      helpBtn.addEventListener("click", () => {
        initOnboarding(true);
      });
    }

    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const isDark =
          document.documentElement.getAttribute("data-theme") === "dark";
        if (isDark) {
          // Switch to light (default — remove attribute)
          document.documentElement.removeAttribute("data-theme");
          localStorage.setItem("bstats_theme", "light");
        } else {
          // Switch to dark
          document.documentElement.setAttribute("data-theme", "dark");
          localStorage.setItem("bstats_theme", "dark");
        }
      });
    }

    // bind bio click-to-edit interactions
    this.refs.playerBio.querySelectorAll(".bio-value").forEach((node) => {
      const handler = () => this.#initializeBioEdit(node, node.dataset.bioKey);
      node.addEventListener("click", handler);
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && document.activeElement === node) {
          handler();
        }
      });
    });

    // Archetype Max 2 logic
    if (this.refs.archetypeGrid) {
      this.refs.archetypeGrid.addEventListener("change", (e) => {
        if (e.target.type === "checkbox") {
          const checked = this.refs.archetypeGrid.querySelectorAll(
            'input[name="archetype"]:checked',
          );
          if (checked.length > 2) {
            e.target.checked = false;
          }
        }
      });
    }
  }

  /* ——— Rendering ——————————————————————————— */

  #render() {
    this.refs.tbody.innerHTML = "";

    if (this.#state.data.length === 0) {
      this.refs.empty.classList.add("is-active");
      this.refs.empty.setAttribute("aria-hidden", "false");
      this.refs.tfoot.parentElement.style.opacity = "0";
      return;
    }

    this.refs.empty.classList.remove("is-active");
    this.refs.empty.setAttribute("aria-hidden", "true");
    this.refs.tfoot.parentElement.style.opacity = "1";

    const fragment = document.createDocumentFragment();
    this.#state.data.forEach((row) =>
      fragment.appendChild(this.#buildRowDOM(row)),
    );
    this.refs.tbody.appendChild(fragment);

    this.#updateAggregates(false);
  }

  /** Build a single <tr> element from row data */
  #buildRowDOM(rowData) {
    const tr = document.createElement("tr");
    tr.className = "data-row";
    tr.dataset.id = rowData.id;

    METRICS_SCHEMA.forEach((col) => {
      const td = document.createElement("td");
      td.dataset.key = col.key;
      if (col.advanced) td.classList.add("is-advanced");

      if (col.key === "id") {
        td.innerHTML = `
              <div class="action-context">
                <button class="btn-icon" aria-label="Delete game ${rowData.id}">
                  <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                </button>
              </div>
              <span class="cell-val">${rowData.id}</span>`;
        td.querySelector(".btn-icon").addEventListener("click", (e) => {
          e.stopPropagation();
          this.#handleDeleteRecord(tr, rowData.id);
        });
      } else if (col.computed) {
        td.classList.add("cell-computed");
        td.innerHTML = `<span class="cell-val">${formatValue(rowData[col.key], col.isPct)}</span>`;
      } else {
        td.classList.add("cell-interactive");
        td.tabIndex = 0;
        td.innerHTML = `<span class="cell-val">${formatValue(rowData[col.key])}</span>`;

        // Click to edit
        td.addEventListener("click", () =>
          this.#initializeEdit(td, rowData, col),
        );

        // Keyboard: Enter to edit (single bound handler, no leak)
        td.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && document.activeElement === td) {
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
    METRICS_SCHEMA.forEach((c) => {
      acc[c.key] = 0;
    });
    data.forEach((r) => {
      METRICS_SCHEMA.forEach((c) => {
        acc[c.key] += Number(r[c.key]) || 0;
      });
    });

    // Averages
    const avg = {};
    METRICS_SCHEMA.forEach((c) => {
      avg[c.key] = acc[c.key] / len;
    });

    // Game count label
    avg.id = len;

    // Weighted percentage averages (true shooting %, not averaged %)
    avg.fgPct = acc.fga > 0 ? (acc.fgm / acc.fga) * 100 : 0;
    avg.tpPct = acc.tpa > 0 ? (acc.tpm / acc.tpa) * 100 : 0;
    avg.ftPct = acc.fta > 0 ? (acc.ftm / acc.fta) * 100 : 0;
    const tsAvgDenom = 2 * (acc.fga + 0.44 * acc.fta);
    avg.tsPct = tsAvgDenom > 0 ? (acc.ppg / tsAvgDenom) * 100 : 0;

    const updatedNodes = [];

    METRICS_SCHEMA.forEach((col) => {
      const node = document.getElementById(`avg-${col.key}`);
      if (!node) return;

      let displayVal;
      if (col.key === "id") {
        displayVal = `${len} GAME${len !== 1 ? "S" : ""}`;
      } else if (col.computed && col.key !== "ppg") {
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
      const shadowColor =
        tc.accent === "#050505" ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.5)";
      anime({
        targets: updatedNodes,
        color: [tc.textSecondary, tc.textPrimary],
        textShadow: [`0 0 16px ${shadowColor}`, "none"],
        duration: 600,
        easing: "spring(1, 100, 20, 0)",
      });
    }

    this.#renderCareerHighs();
    this.#renderCareerTotals();
    this.#renderSeasonTotals();
    this.#checkMilestones();
  }

  /* ——— Inline Edit ————————————————————————— */

  #initializeEdit(tdNode, rowData, colMeta) {
    // Guard: already in edit mode
    if (tdNode.querySelector("input")) return;

    const span = tdNode.querySelector(".cell-val");
    const prevVal = span.textContent;

    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "decimal";
    input.className = "input-edit";
    input.value = prevVal;
    input.min = "0";
    input.step = "any";
    input.setAttribute("aria-label", `Edit ${colMeta.label}`);

    span.style.display = "none";
    tdNode.appendChild(input);
    input.focus();
    input.select();

    let committed = false;

    const commit = () => {
      if (committed) return; // prevent double-fire from blur + Enter
      committed = true;

      const trimmed = input.value.trim();

      // Empty input → revert
      if (trimmed === "") {
        input.remove();
        span.style.display = "";
        return;
      }

      const parsed = parseFloat(trimmed);
      if (isNaN(parsed) || parsed < 0) {
        committed = false; // allow retry
        anime({
          targets: input,
          translateX: [0, -4, 4, -2, 2, 0],
          duration: 400,
        });
        input.focus();
        return;
      }

      rowData[colMeta.key] = parsed;
      computeDerived(rowData);
      this.#persistState();

      span.textContent = formatValue(parsed);

      // Update computed cells in this row
      const tr = tdNode.closest("tr");
      COMPUTED_COLS.forEach((c) => {
        const tgtSpan = tr.querySelector(`td[data-key="${c.key}"] .cell-val`);
        if (tgtSpan) tgtSpan.textContent = formatValue(rowData[c.key], c.isPct);
      });

      input.remove();
      span.style.display = "";

      // Subtle flash confirmation
      anime({
        targets: tdNode,
        backgroundColor: [getThemeColors().bgFlashStrong, "transparent"],
        duration: 500,
        easing: "spring(1, 100, 20, 0)",
      });

      this.#updateAggregates(true);
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        committed = true; // skip commit logic
        input.remove();
        span.style.display = "";
      }
    });
  }

  /* ——— Record Management ——————————————————— */

  #handleDeleteRecord(trNode, id) {
    this.#state.data = this.#state.data.filter((r) => r.id !== id);
    this.#persistState();
    trNode.style.pointerEvents = "none";

    anime({
      targets: trNode.querySelectorAll("td"),
      opacity: 0,
      paddingTop: 0,
      paddingBottom: 0,
      height: 0,
      duration: 350,
      easing: "cubicBezier(0.4, 0, 0.2, 1)",
      complete: () => {
        trNode.remove();
        if (this.#state.data.length === 0) this.#render();
        else this.#updateAggregates(true);
      },
    });
  }

  #handleAppendRecord() {
    const ids = this.#state.data.map((d) => d.id);
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    const newRecord = { id: nextId };
    METRICS_SCHEMA.forEach((c) => {
      if (c.key !== "id") newRecord[c.key] = 0;
    });

    this.#state.data.unshift(newRecord);
    computeDerived(newRecord);
    this.#persistState();

    const existingRows = Array.from(
      this.refs.tbody.querySelectorAll("tr.data-row"),
    );
    const rectMap = new Map();
    existingRows.forEach((r) =>
      rectMap.set(r.dataset.id, r.getBoundingClientRect().top),
    );

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
              easing: "spring(1, 100, 20, 0)",
            });
          }
        }
      });

      anime({
        targets: tr,
        translateY: [-40, 0],
        opacity: [0, 1],
        backgroundColor: [getThemeColors().bgFlash, "transparent"],
        duration: 600,
        easing: "spring(1, 100, 20, 0)",
      });
    }

    this.#updateAggregates(true);

    // Scroll to top so the new row is visible
    const scrollCtx = this.refs.tbody.closest(".scroll-context");
    if (scrollCtx) scrollCtx.scrollTo({ top: 0, behavior: "smooth" });
  }

  #handleRunSimulation() {
    const setupEl = document.getElementById("predict-setup");
    const loadingEl = document.getElementById("predict-loading");
    const resultsEl = document.getElementById("predict-results");
    const btnClose = document.getElementById("btn-close-predict");

    if (setupEl) setupEl.style.display = "none";
    if (loadingEl) loadingEl.style.display = "block";
    if (resultsEl) resultsEl.style.display = "none";
    if (btnClose) btnClose.disabled = true;

    const archetypeInputs = Array.from(
      this.refs.archetypeGrid.querySelectorAll(
        'input[name="archetype"]:checked',
      ),
    );
    const archetypes =
      archetypeInputs.length > 0
        ? archetypeInputs.map((inp) => inp.value)
        : ["balanced"];

    const activeProfile =
      this.#profiles.find((p) => p.id === this.#activeProfileId) || {};
    const ageNum = parseInt(activeProfile.age, 10) || 26;
    const ft = parseInt(activeProfile.heightFt, 10) || 6;
    const inc = parseInt(activeProfile.heightIn, 10) || 6;
    const heightInches = ft * 12 + inc; // default to 6'6" (78")
    const pos = activeProfile.position || "SG";

    const data = this.#state.data;
    const len = data.length || 1;

    const acc = {};
    METRICS_SCHEMA.forEach((c) => {
      if (!c.computed && c.key !== "id") acc[c.key] = 0;
    });
    data.forEach((r) => {
      METRICS_SCHEMA.forEach((c) => {
        if (!c.computed && c.key !== "id") acc[c.key] += Number(r[c.key]) || 0;
      });
    });

    const avg = {};
    const variance = {};
    METRICS_SCHEMA.forEach((c) => {
      if (!c.computed && c.key !== "id") {
        avg[c.key] = data.length > 0 ? acc[c.key] / len : 0;

        let sumSquares = 0;
        data.forEach((r) => {
          sumSquares += Math.pow((Number(r[c.key]) || 0) - avg[c.key], 2);
        });
        const stdDev =
          data.length > 1
            ? Math.sqrt(sumSquares / (len - 1))
            : Math.max(avg[c.key] * 0.05, 0.5);
        variance[c.key] = stdDev;
      }
    });

    // Initialize Web Worker
    const worker = new Worker("./js/simWorker.js");

    worker.onmessage = (e) => {
      if (e.data && e.data.type === "projection") {
        const projections = e.data.projections;
        this.#renderSimulationResults(projections);
        if (loadingEl) loadingEl.style.display = "none";
        if (resultsEl) resultsEl.style.display = "flex";
        if (btnClose) btnClose.disabled = false;
        worker.terminate();
      }
    };

    worker.postMessage({
      action: "project",
      iterations: 10000,
      avg,
      variance,
      archetypes,
      ageNum,
      heightInches,
      pos,
      dataLength: data.length
    });
  }

  #handleAppendSimGames() {
    const inputCount = document.getElementById("input-predict-count");
    if (!inputCount) return;
    const count = parseInt(inputCount.value, 10);
    if (isNaN(count) || count <= 0) return;

    const btnClose = document.getElementById("btn-close-predict");
    if (btnClose) btnClose.disabled = true;
    const btnAdd = document.getElementById("btn-add-sim-games");
    if (btnAdd) btnAdd.disabled = true;

    const archetypeInputs = Array.from(
      this.refs.archetypeGrid.querySelectorAll(
        'input[name="archetype"]:checked',
      ),
    );
    const archetypes =
      archetypeInputs.length > 0
        ? archetypeInputs.map((inp) => inp.value)
        : ["balanced"];

    const activeProfile =
      this.#profiles.find((p) => p.id === this.#activeProfileId) || {};
    const ageNum = parseInt(activeProfile.age, 10) || 26;
    const ft = parseInt(activeProfile.heightFt, 10) || 6;
    const inc = parseInt(activeProfile.heightIn, 10) || 6;
    const heightInches = ft * 12 + inc; 
    const pos = activeProfile.position || "SG";

    const data = this.#state.data;
    const len = data.length || 1;

    const acc = {};
    METRICS_SCHEMA.forEach((c) => {
      if (!c.computed && c.key !== "id") acc[c.key] = 0;
    });
    data.forEach((r) => {
      METRICS_SCHEMA.forEach((c) => {
        if (!c.computed && c.key !== "id") acc[c.key] += Number(r[c.key]) || 0;
      });
    });

    const avg = {};
    const variance = {};
    METRICS_SCHEMA.forEach((c) => {
      if (!c.computed && c.key !== "id") {
        avg[c.key] = data.length > 0 ? acc[c.key] / len : 0;
        let sumSquares = 0;
        data.forEach((r) => {
          sumSquares += Math.pow((Number(r[c.key]) || 0) - avg[c.key], 2);
        });
        const stdDev =
          data.length > 1
            ? Math.sqrt(sumSquares / (len - 1))
            : Math.max(avg[c.key] * 0.05, 0.5);
        variance[c.key] = stdDev;
      }
    });

    const worker = new Worker("./js/simWorker.js");

    worker.onmessage = (e) => {
      if (e.data && e.data.type === "generation") {
        const generatedRecords = e.data.records;
        this.#insertGeneratedRecords(generatedRecords);
        
        if (btnClose) btnClose.disabled = false;
        if (btnAdd) btnAdd.disabled = false;
        worker.terminate();
      }
    };

    worker.postMessage({
      action: "generate",
      iterations: count,
      avg,
      variance,
      archetypes,
      ageNum,
      heightInches,
      pos,
      dataLength: data.length
    });
  }

  #insertGeneratedRecords(records) {
    if (!records || records.length === 0) return;

    const data = this.#state.data;
    const ids = data.map((d) => d.id);
    let nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    const newRecords = records.map(rec => {
      rec.id = nextId++;
      computeDerived(rec);
      return rec;
    });

    // Re-reverse them so they are prepended properly, or just unshift directly
    newRecords.reverse();

    // FLIP setup
    const existingRows = Array.from(
      this.refs.tbody.querySelectorAll("tr.data-row"),
    );
    const rectMap = new Map();
    existingRows.forEach((r) =>
      rectMap.set(r.dataset.id, r.getBoundingClientRect().top),
    );

    this.#state.sortRef = { key: null, asc: true }; 
    this.#state.data = [...newRecords, ...this.#state.data];
    this.#persistState();

    this.#closePredictModal();
    this.#render();

    // FLIP for existing rows sliding down
    const currentRows = Array.from(
      this.refs.tbody.querySelectorAll("tr.data-row"),
    );
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
            easing: "spring(1, 100, 20, 0)",
          });
        }
      }
    });

    // Entrance animation for new rows
    const newDoms = currentRows.slice(0, newRecords.length);
    if (newDoms.length > 0) {
      anime({
        targets: newDoms,
        translateY: [-40, 0],
        opacity: [0, 1],
        backgroundColor: [getThemeColors().bgFlash, "transparent"],
        delay: anime.stagger(30),
        duration: 600,
        easing: "spring(1, 100, 20, 0)",
      });
    }

    const scrollCtx = this.refs.tbody.closest(".scroll-context");
    if (scrollCtx) scrollCtx.scrollTo({ top: 0, behavior: "smooth" });
  }

  #renderSimulationResults(projections) {
    const listEl = document.getElementById("predict-results-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const formatNum = (val) => Number(val).toFixed(1);
    
    // Order of importance
    const order = ["pts", "reb", "ast", "stl", "blk", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "topg"];
    const labels = {
      pts: "Points", reb: "Rebounds", ast: "Assists", stl: "Steals", blk: "Blocks",
      fgm: "FGM", fga: "FGA", tpm: "3PM", tpa: "3PA", ftm: "FTM", fta: "FTA", topg: "Turnovers"
    };

    let html = "";
    order.forEach(key => {
      if (!projections[key]) return;
      const proj = projections[key];
      html += `
        <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 8px; font-family: var(--font-data); font-size: 0.95rem; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
          <div style="font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim);">${labels[key]}</div>
          <div style="text-align: right; color: var(--text-secondary);">${formatNum(proj.floor)}</div>
          <div style="text-align: right; color: var(--text-primary); font-weight: 600;">${formatNum(proj.expected)}</div>
          <div style="text-align: right; color: var(--text-secondary);">${formatNum(proj.ceiling)}</div>
        </div>
      `;
    });

    listEl.innerHTML = html;
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
    this.refs.thead
      .querySelectorAll("th")
      .forEach((th) => th.setAttribute("aria-sort", "none"));
    if (sortRef.key) {
      const activeTh = this.refs.thead.querySelector(
        `th[data-key="${sortRef.key}"]`,
      );
      if (activeTh) {
        activeTh.setAttribute(
          "aria-sort",
          sortRef.asc ? "ascending" : "descending",
        );
      }
    }

    // Capture pre-sort positions for FLIP animation
    const rows = Array.from(this.refs.tbody.querySelectorAll("tr.data-row"));
    const rectMap = new Map();
    rows.forEach((r) =>
      rectMap.set(r.dataset.id, r.getBoundingClientRect().top),
    );

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
    const updatedRows = Array.from(
      this.refs.tbody.querySelectorAll("tr.data-row"),
    );
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
            easing: "spring(1, 100, 20, 0)",
            delay: i * 20,
          });
        }
      }
    });
  }

  /* ——— Entrance Choreography ——————————————— */

  #choreographEntrance() {
    /* Cinematic: terminal boot sequence feel */
    const tl = anime.timeline({ easing: "spring(1, 100, 20, 0)" });

    /* Phase 1: Title materializes with vertical clip reveal */
    tl.add({
      targets: ".editorial-header",
      opacity: [0, 1],
      translateY: [-20, 0],
      filter: ["blur(8px)", "blur(0px)"],
      duration: 1400,
    })

      /* Phase 2: Data container rises with scale + shadow bloom */
      .add(
        {
          targets: ".data-container",
          opacity: [0, 1],
          translateY: [50, 0],
          scale: [0.97, 1],
          duration: 1200,
        },
        "-=900",
      )

      /* Phase 3: Table header columns fade in left-to-right stagger */
      .add(
        {
          targets: ".stats-grid th",
          opacity: [0, 1],
          translateY: [-10, 0],
          delay: anime.stagger(25),
          duration: 500,
          easing: "spring(1, 100, 20, 0)",
        },
        "-=900",
      )

      /* Phase 4: Data rows slide in with alternating X offset */
      .add(
        {
          targets: "tr.data-row",
          opacity: [0, 1],
          translateX: (el, i) => [i % 2 === 0 ? -20 : 20, 0],
          delay: anime.stagger(45),
          duration: 700,
          easing: "spring(1, 100, 20, 0)",
          begin: (anim) => {
            /* Flash each row with a scan pulse as it appears */
            const tc = getThemeColors();
            anim.animatables.forEach((a, idx) => {
              setTimeout(() => {
                anime({
                  targets: a.target,
                  backgroundColor: [tc.bgFlash, "transparent"],
                  duration: 600,
                  easing: "spring(1, 100, 20, 0)",
                });
              }, idx * 45);
            });
          },
        },
        "-=700",
      )

      /* Phase 5: Footer rises with breathing glow */
      .add(
        {
          targets: "#footer-row",
          opacity: [0, 1],
          translateY: [15, 0],
          duration: 900,
        },
        "-=400",
      );

    /* FABs entrance: elastic pop with rotation */
    anime({
      targets: [".btn-fab", ".btn-theme", ".btn-fab-mini"],
      scale: [0, 1],
      rotate: [-120, 0],
      opacity: [0, 1],
      delay: anime.stagger(120, { start: 1000 }),
      duration: 1100,
      easing: "spring(1, 100, 20, 0)",
    });

    /* Scanline overlay fades in subtly */
    anime({
      targets: ".scanline-overlay",
      opacity: [0, 0.4],
      duration: 2000,
      delay: 500,
      easing: "spring(1, 100, 20, 0)",
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new BMetricsApp();
});
