# Project Guidelines

## Code Style
- Keep the current Vite + React + TypeScript structure. Use function components with explicit prop interfaces and shared types from `types.ts`.
- Keep UI concerns in `components/`, Gemini integration and prompt construction in `services/`, and SVG transformation helpers in `utils/`.
- Prefer small event handlers and local component state over introducing new global abstractions.
- Follow the existing utility-class styling approach for UI changes and preserve responsive behavior across desktop and mobile layouts.

## Architecture
- `App.tsx` coordinates generation state, history, and panel visibility. Keep cross-panel orchestration there unless a responsibility clearly belongs in a child component.
- `services/geminiService.ts` owns Gemini session setup, prompt enhancement, SVG generation, and response cleanup. Keep model-specific prompting rules centralized there.
- `utils/svgLayerUtils.ts` should stay pure and deterministic. Do not add Gemini or browser side effects to SVG layer utilities.

## Build And Run
- Install dependencies with `npm install`.
- Run the app locally with `npm run dev`.
- Validate production builds with `npm run build` after non-trivial changes.
- If you change environment variable usage, keep the code and `README.md` in sync.

## Conventions
- Preserve the raw-SVG contract for model output: no markdown wrappers, no conversational text, and a complete `<svg>` payload.
- Preserve SVG requirements enforced by the prompt pipeline, including `viewBox`, self-contained markup, and a `<title>` for accessibility.
- When working on layer-aware features, keep meaningful SVG element or group IDs intact so layer controls continue to function.
- When refining generated art, keep the behavior of returning the full updated SVG rather than partial diffs.