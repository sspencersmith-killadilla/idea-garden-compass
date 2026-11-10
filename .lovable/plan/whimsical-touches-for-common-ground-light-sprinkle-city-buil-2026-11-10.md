# Whimsical touches for Common Ground (light sprinkle, city-builder theme)

Keep the teal-navy + green gradient, Montserrat/Inter, and the circles logo. Add small SimCity-style moments of delight that stay professional for city staff.

## 1. Playful motion
- New ideas "get built": cards rise in with a soft fade, like a building popping up; hover gives a slight lift and tilt.
- After capturing an idea: a brief burst of tiny brand-colored bricks/sparks, like a construction "poof".
- Checking off a to-do gives a tiny bounce and a strike-through sweep.
- All motion respects "reduce motion" settings.

## 2. City-builder theme (subtle)
- Each idea shows a small build-stage icon: empty lot (new), under construction with crane (has to-dos or comments), finished building (all to-dos done).
- Themes called "districts" in tooltips only; core labels stay plain.
- Timeline drawn as a road with dashed lane markings, ideas sitting along it like stops.
- Thin power-line connectors (poles + gently sagging wires) between related sections and on the landing page.

## 3. Hand-drawn touches
- Wavy road-line underline under page headings and the active tab.
- Low-opacity city skyline silhouette along the bottom of the landing page and empty states (brand gradient).
- Simple line-doodle illustrations for empty states: crane, traffic cone, power pole, small block of buildings, lightbulb.

## 4. Friendly copy
- Time-of-day greeting on the dashboard ("Good afternoon, Spencer — what are we building today?").
- Warmer empty states ("This lot's empty. Zone your first idea above.") and loading messages ("Laying down roads...", "Connecting power...").
- Capture box placeholder rotates through gentle city-flavored prompts.

## Technical details
- New tokens/keyframes and `@utility` helpers (road-underline, skyline, rise-in) in `src/styles.css`; no new color families.
- Small reusable components: `BuildStageBadge`, `CityDoodle` (inline SVGs), `PowerLine`, `BuildBurst` (lightweight, no new dependency).
- Touch landing, auth, dashboard (incl. timeline), journal, and public idea pages for presentation only; no data or permission changes.
