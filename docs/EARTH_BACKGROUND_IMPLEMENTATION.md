# BrightGlobe Earth Background

## Goal

Build a realistic, slowly rotating Earth as a decorative Home-screen background for the Expo / React Native application. The Earth renderer must stay isolated from reward, account, and navigation business logic.

## Current implementation

Phase 1 has been committed to `main`:

- `app/src/components/earth/EarthBackground.tsx` contains the native Three.js scene.
- `app/src/app/(tabs)/index.tsx` places the scene behind the Home contribution card.
- The Earth surface shader blends the day map and city-light map across a simulated day/night terminator.
- A cloud texture drifts slowly over the surface.
- A blue atmospheric rim and a restrained star field complete the scene.
- The canvas is non-interactive and uses a low-power GPU preference with a capped device-pixel ratio.

The texture files are currently loaded from remote HTTPS URLs. This is a development-stage choice, not the production asset strategy.

## Runtime and dependency decisions

The app currently targets Expo SDK 58, React Native 0.88, and React 19.3.

| Package | Selected version | Purpose |
|---|---:|---|
| `expo-gl` | `~58.0.4` | Native OpenGL render surface |
| `expo-asset` | `~58.0.21` | Asset loading support for React Three Fiber |
| `expo-file-system` | `~58.0.13` | Native asset caching/loading support |
| `three` | `0.187.0` | 3D scene, geometry, textures, and shaders |
| `@react-three/fiber` | `9.8.1` | React renderer for Three.js, Native entry point |
| `@types/three` | `0.187.0` | Three.js TypeScript definitions |
| `typescript` | `7.1.0-beta` | Requested TypeScript compiler line |

React Three Fiber v9 is intentional: its Native entry point is the established Expo GL path. Do not upgrade this integration to the in-development v10 Native package until its maintainers mark that migration stable.

TypeScript 7.1 is currently a beta release. Keep it clearly marked as pre-release and run the complete typecheck/build matrix before treating it as a production baseline. If the beta breaks Expo or ecosystem tooling, pin TypeScript 7.0.x temporarily rather than introducing local type workarounds.

## Texture sources

- Day surface: [Three.js Earth day texture](https://threejs.org/examples/textures/planets/earth_day_4096.jpg)
- Clouds: [Three.js Earth cloud texture](https://threejs.org/examples/textures/planets/earth_clouds_1024.png)
- Night lights: [NASA Black Marble 2016 global map](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg)

NASA describes the Black Marble global map as satellite-observed nighttime lights and provides the global image in JPEG and GeoTIFF formats: https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/ and https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/

Before release, verify the individual license/credit terms for every texture (including textures stored in the Three.js example repository). Then mirror approved, optimized images into `app/assets/earth/` and load them as bundled assets. Do not make production rendering depend on the availability of `threejs.org` or NASA's image CDN.

## Implementation phases

### Phase 1 — Native scene and Home integration

Status: code committed; device validation pending.

- Add the native 3D dependencies.
- Render a textured sphere, day/night transition, city lights, moving clouds, atmosphere, and stars.
- Isolate the implementation in `EarthBackground`.
- Place it behind the existing Home contribution card without capturing touches.

### Phase 2 — Bundle and optimize Earth assets

- Verify the source and commercial-use/attribution terms of every map.
- Move approved day, night, and cloud maps into `app/assets/earth/`.
- Prefer compressed 2K mobile textures for the initial release; only increase resolution after device profiling.
- Load textures locally so the Earth renders offline and does not depend on a third-party CDN.
- Add a low-resolution asset fallback for constrained devices.

### Phase 3 — Visual fidelity

- Tune the light direction, day/night terminator, city-light intensity, and cloud coverage.
- Add a normal/bump map only if it noticeably improves the mobile result.
- Refine atmospheric scattering and edge glow without obscuring Home text.
- Keep the globe rotation slow and cloud drift even slower.

### Phase 4 — Lifecycle and performance

- Pause rendering when the Home route is not focused or the app is backgrounded.
- Measure memory, GPU use, startup delay, and frame pacing on physical iOS and Android devices.
- Add quality tiers (low / balanced / high) based on device capability.
- Keep the Earth decorative: no pointer interaction or continuous gestures are required for the first release.

### Phase 5 — Release acceptance

- The Home route remains readable and all controls remain tappable.
- No black canvas, missing-texture flash, or unhandled GL crash on supported physical devices.
- The Earth works without network access after the assets are bundled.
- TypeScript, Expo Doctor, EAS iOS, and EAS Android checks pass.
- Test at least one physical iPad and one Android device; do not rely on the iOS simulator alone for GL validation.

## Validation commands

Run from `app/`:

```bash
npm install
npm run typecheck
npx expo-doctor
npx expo start --dev-client
```

Then use EAS development/preview builds and test on physical devices.

## Honest status

The GitHub changes are source-code commits only. No npm install, TypeScript check, Expo Doctor run, simulator run, physical-device run, or EAS build has been performed in this session. The visual output and runtime compatibility are therefore not yet certified.
