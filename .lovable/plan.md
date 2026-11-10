# Whimsical touches for Common Ground (light sprinkle)

Keep the teal-navy + green gradient, Montserrat/Inter, and the circles logo. Add small moments of delight that stay professional for city staff.

## 1. Playful motion
- New ideas drift in with a soft fade-and-rise; cards lift and tilt very slightly on hover.
- After capturing an idea: a brief burst of small leaf/sparkle confetti in brand colors.
- Checking off a to-do gives a tiny bounce and a strike-through sweep.
- All motion respects "reduce motion" settings.

## 2. Garden theme (subtle)
- Each idea shows a small growth stage icon: seed (new), sprout (has to-dos or comments), bloom (all to-dos done).
- Themes labeled as "beds" in tooltips only; core labels stay plain.

## 3. Hand-drawn touches
- Squiggle underline under page headings and the active tab.
- Soft blob shapes in the landing page and empty-state backgrounds (brand gradient, low opacity).
- A few simple line-doodle illustrations (seed, watering can, lightbulb) for empty states.

## 4. Friendly copy
- Time-of-day greeting on the dashboard ("Good afternoon, Spencer — what's sprouting?").
- Warmer empty states ("No ideas planted yet. Toss one in above.") and loading messages.
- Capture box placeholder rotates through gentle prompts.

## Technical details
- New tokens/keyframes and `@utility` helpers (squiggle, blob, float-in) in `src/styles.css`; no new color families.
- Small reusable components: `GrowthBadge`, `Doodle` (inline SVG), `Confetti` (lightweight, no new dependency).
- Touch landing, auth, dashboard, journal, and public idea pages for presentation only; no data or permission changes.
