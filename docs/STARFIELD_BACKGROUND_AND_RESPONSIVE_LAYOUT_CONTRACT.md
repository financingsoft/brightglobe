# BrightGlobe Starfield Background and Responsive Layout Contract

**Status:** Binding visual implementation contract  
**Revision:** 1.0 · 2026-11-13  
**Scope:** Shared app background, screen surfaces, Earth stage, safe areas and responsive layout for narrow and large phones.

## 1. Visual direction

BrightGlobe uses a full-screen deep-space starfield as its common visual environment.

The visual layers are:
1. Deep navy space base.
2. Low-contrast violet, indigo and blue nebula glows.
3. Small static stars and a few brighter points; no heavy particle animation.
4. Translucent dark content surfaces and controls.
5. A realistic Earth scene that visually floats over the same background.

The starfield is decorative only. It must never receive touches, intercept gestures or be exposed as meaningful screen-reader content.

## 2. Shared background

- A single root-level `StarfieldBackground` is rendered behind every Expo Router screen.
- The background fills the available device viewport, including safe-area edges.
- It uses a deterministic, static star distribution and a small number of low-opacity glow layers.
- It does not download remote images, require network access, or run a continuous animation loop.
- The Earth scene has a transparent WebGL clear surface so the common starfield remains visible around the globe.
- The Earth renderer retains its own scene stars for depth; it must not cover the root background with an opaque rectangle.

## 3. Color and readability

- Base canvas: deep navy (`#030817`).
- Main text: high-contrast cool white.
- Secondary text: muted blue-gray.
- Interactive accent: luminous violet.
- Card/surface colors: translucent navy with subtle cool borders.
- Errors and status states retain distinct, accessible contrast.
- White modal sheets and bright form controls should not be introduced as a default page background; dialogs should follow the same dark-space visual language.
- The starfield stays subdued behind text and controls. Decorative brightness must not reduce text contrast.

## 4. Responsive rules

### Width
- Content width grows naturally on phones, with a maximum reading width of 460 points for wide previews.
- Horizontal padding scales by viewport width: compact phones use 12 points, typical phones 16 points, and wider devices 20 points.
- Inputs, two-column tiles, text rows and action buttons must shrink or wrap without horizontal overflow.
- No layout may depend on a single fixed 390-point viewport.

### Height
- Home Earth stage height is derived from available screen height, bounded to preserve a useful visual focus without consuming the whole screen.
- Earth tap target size is derived from both available width and stage height, centered over the rendered globe.
- Bottom navigation uses a shorter layout on compact devices.
- Scroll containers remain available when screen height is short; controls must not be clipped beneath the tab bar or safe area.

### Supported visual regression viewports
- 320 × 568 — compact phone.
- 375 × 667 — standard phone.
- 390 × 844 — tall phone.
- 430 × 932 — large phone.

These are baseline regression sizes, not an exhaustive list of device models. The layout must remain fluid between them.

## 5. Performance and accessibility

- Static star nodes are non-interactive and must not create accessibility focus stops.
- Avoid per-star animation, expensive blur filters, continuous state updates or network-loaded backgrounds.
- Keep the Earth scene quality profile adaptive to available device resources.
- The Earth tap target remains a separately accessible button with a clear label and hint.
- Respect system safe areas and keep bottom navigation touch targets usable.

## 6. Acceptance checklist

- [ ] Starfield appears behind Home, Discover, Profile, Login and secondary routes.
- [ ] The background extends to safe-area edges without white flashes during navigation.
- [ ] Earth renders transparently over the common starfield on iOS, Android and Web.
- [ ] Home Earth tap target stays centered and fully tappable at all four regression sizes.
- [ ] No horizontal scrolling is introduced at 320-point width.
- [ ] Main text, muted text, borders, buttons and modal content remain legible on the dark theme.
- [ ] Bottom navigation fits compact screen heights.
- [ ] CI captures all four baseline sizes without browser runtime errors.
