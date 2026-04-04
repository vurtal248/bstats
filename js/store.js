import { SEED_DATA } from './schema.js';

export const STORAGE_KEY_PROFILES = 'bstats_profiles';
export const STORAGE_KEY_ACTIVE = 'bstats_active_profile';
export const STORAGE_KEY_PREFIX = 'bstats_games_';
export const LEGACY_STORAGE_KEY = 'bstats_games';

export class Store {
  constructor() {
    this.profiles = [];
    this.activeProfileId = null;
    this.initProfiles();
  }

  initProfiles() {
    try {
      const rawProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
      if (rawProfiles) {
        this.profiles = JSON.parse(rawProfiles);
        this.activeProfileId = localStorage.getItem(STORAGE_KEY_ACTIVE) || this.profiles[0].id;

        // Validate active profile exists
        if (!this.profiles.find(p => p.id === this.activeProfileId)) {
          this.activeProfileId = this.profiles[0].id;
          localStorage.setItem(STORAGE_KEY_ACTIVE, this.activeProfileId);
        }

        // Migrate legacy profiles to support seasons
        this.profiles.forEach(p => {
          if (!p.seasons || p.seasons.length === 0) {
            p.seasons = [{ id: 's_1', name: 'Season 1' }];
            p.activeSeasonId = 's_1';
            
            // Migrate their data key safely
            const oldData = localStorage.getItem(STORAGE_KEY_PREFIX + p.id);
            if (oldData) {
              localStorage.setItem(STORAGE_KEY_PREFIX + p.id + '_s_1', oldData);
              localStorage.removeItem(STORAGE_KEY_PREFIX + p.id); // clean up old
            }
          }
          if (!p.activeSeasonId && p.seasons.length > 0) {
            p.activeSeasonId = p.seasons[0].id;
          }
        });

      } else {
        // First time or legacy migration
        this.profiles = [{ 
          id: 'default', 
          name: 'Player 1',
          seasons: [{ id: 's_1', name: 'Season 1' }],
          activeSeasonId: 's_1' 
        }];
        this.activeProfileId = 'default';
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(this.profiles));
        localStorage.setItem(STORAGE_KEY_ACTIVE, this.activeProfileId);

        // Migrate legacy data
        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyData) {
          localStorage.setItem(STORAGE_KEY_PREFIX + 'default_s_1', legacyData);
        }
      }
    } catch {
      this.profiles = [{ 
        id: 'default', 
        name: 'Player 1',
        seasons: [{ id: 's_1', name: 'Season 1' }],
        activeSeasonId: 's_1' 
      }];
      this.activeProfileId = 'default';
    }
  }

  saveProfiles() {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(this.profiles));
      localStorage.setItem(STORAGE_KEY_ACTIVE, this.activeProfileId);
    } catch { }
  }

  restoreState() {
    try {
      const profile = this.getActiveProfile();
      const seasonId = profile ? profile.activeSeasonId : 's_1';
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + this.activeProfileId + '_' + seasonId);
      if (!raw) return structuredClone(SEED_DATA);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : structuredClone(SEED_DATA);
    } catch {
      return structuredClone(SEED_DATA);
    }
  }

  persistState(data) {
    try {
      const profile = this.getActiveProfile();
      const seasonId = profile ? profile.activeSeasonId : 's_1';
      localStorage.setItem(STORAGE_KEY_PREFIX + this.activeProfileId + '_' + seasonId, JSON.stringify(data));
    } catch { /* quota exceeded or private mode — silently degrade */ }
  }

  createProfile(name) {
    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    this.profiles.push({ id, name });
    this.activeProfileId = id;
    this.saveProfiles();
    return id;
  }

  deleteProfile(id) {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
    this.profiles = this.profiles.filter(p => p.id !== id);
    if (this.activeProfileId === id) {
      this.activeProfileId = this.profiles[0].id;
    }
    this.saveProfiles();
  }

  exportProfile() {
    const profile = this.getActiveProfile();
    const data = this.restoreState();
    return {
      profile,
      data
    };
  }

  importProfile(parsedJson) {
    if (!parsedJson || !parsedJson.profile || !parsedJson.profile.name) {
      throw new Error("Invalid profile format");
    }
    const name = parsedJson.profile.name;
    const newId = 'p_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    // Copy all bio data, but assign new unique ID
    const newProfile = { ...parsedJson.profile, id: newId };
    
    this.profiles.push(newProfile);
    this.activeProfileId = newId;
    this.saveProfiles();
    
    try {
      const dataToSave = Array.isArray(parsedJson.data) ? parsedJson.data : [];
      localStorage.setItem(STORAGE_KEY_PREFIX + newId, JSON.stringify(dataToSave));
    } catch { }

    return newId;
  }

  getActiveProfile() {
    return this.profiles.find(p => p.id === this.activeProfileId);
  }

  setActiveProfile(id) {
    this.activeProfileId = id;
    this.saveProfiles();
  }
}
