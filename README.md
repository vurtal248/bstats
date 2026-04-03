# B-Stats

**B-Stats** is a website that allows you to keep track of basketball stats, as well as allowing you to simulate future game performances based on your past performances.

🔗 **[Link](https://vurtal248.github.io/bstats/)**

##  Core Features

- **Multiple Profiles**: Maintain separate database instances for different players or entire seasons. Seamlessly switch between tracked entities.
- **Performance Tracking**: Log comprehensive box score statistics including points (PTS), rebounds (REB), assists (AST), steals (STL), blocks (BLK), and shooting splits.
- **Player Vitals & Biodata**: Track position, height, weight, wingspan, age, and NBA team selection. 
- **Archetypes**: Define up to two playstyle archetypes (e.g., Scorer, Playmaker, Workhorse, Clutch, Erratic) to contextualize the statistical output.
- **Data Portability**: Full JSON export and import capabilities ensure your metrics are never locked into a single device or session.
- **Simulation Engine**: Predict future game performances based on recent statistical averages and historical variance.
- **Adaptive Interface**: Toggleable dark/light modes and immersive fluid animations powered by the `anime.js` library.

## Technical Implementation

B-Stats is built on:

- **HTML5**: Document structuring and accessibility compliance.
- **CSS3 (`css/styles.css`)**: Utilizes custom CSS variables, flexbox, CSS grid, backdrop-filters, and noise overlays to achieve the Liquid Glass aesthetic without large styling frameworks.
- **JavaScript (`js/app.js`, `js/store.js`)**: ES Modules handle application logic, local storage hydration, complex DOM manipulation, and data schema management.
- **Animation (`anime.js`)**: Lightweight library controlling spatial transitions, spotlight reticles, and layout reveals.

## 📁 Repository Structure

- `index.html`: Main application skeleton and UI scaffolding.
- `css/styles.css`: All visual styling rules, animations, and typography configurations.
- `js/app.js`: Core controller interfacing with the UI.
- `js/store.js`: Data structures, serialization, and `localStorage` persistence logic.
- `js/onboarding.js`: Specialized logic for the HUD onboarding experience.

---
