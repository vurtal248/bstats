## Purpose
Defines the global layout hierarchy, theming variables, and visual aesthetic.

## Public API
Internal only.

## Constraints
MUST define theme tokens using CSS variables for dark/light mode toggling. MUST enforce an animation safety net via `prefers-reduced-motion: reduce`. MUST utilize fluid functions like `clamp()` for spatial scaling. MUST rely on CSS Grid for layout structures.

## Out of Scope
DOM event interception and dynamic data binding (owned by `js/`).
