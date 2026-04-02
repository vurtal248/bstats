## Purpose
Governs application state management, data persistence, mathematical derivations, and UI choreography.

## Public API
`Store`, `formatValue`, `computeDerived`, `ranZ`, `getThemeColors`, and schema definitions.

## Constraints
MUST degrade gracefully when `localStorage` is inaccessible. MUST safely guard numerical computations against `NaN` or divide-by-zero scenarios. MUST structure persistent objects using random unique identifiers.

## Out of Scope
CSS property assignments, keyframes, and layout configurations (owned by `css/`).
