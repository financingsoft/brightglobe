# BrightGlobe Earth Background

## Goal

Build a realistic, slowly rotating Earth as a decorative Home-screen background for the Expo / React Native application. The Earth renderer stays isolated from reward, account, and navigation business logic.

## Runtime and dependency decisions

The app targets Expo SDK 58, React Native 0.88, and React 19.3.

| Package | Selected version | Purpose |
|---|---:|---|
| `expo-gl` | `~58.0.4` | Native OpenGL render surface |
| `react-native` | `0.88.1` | React Native runtime patch aligned to Expo Doctor |
| `expo-asset` | `~58.0.21` | Native asset resolution |
| `expo-file-system` | `~58.0.13` | Expo GL / native asset support |
| `three` | `0.187.0` | 3D scene, geometry, textures, and shaders |
| `@react-three/fiber` | `9.8.1` | React renderer for Three.js, Native entry point |
| `@types/three` | `0.187.0` | Three.js TypeScript definitions |
| `typescript` | `7.1.0-beta` | Requested TypeScript compiler line |

React Three Fiber v9 is intentional: its Native entry point patches Three.js texture loading to resolve Expo assets and uses Expo GL. Do not upgrade this integration to the in-development v10 Native package until its maintainers mark that migration stable. See the [React Three Fiber Native documentation](https://r3f.docs.pmnd.rs/getting-started/installation) and [native loader implementation](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/native/polyfills.ts).

TypeScript 7.1 is a beta compiler line. Keep it explicitly marked as pre-release and require the repository validation workflow to pass before upgrading this dependency to a release candidate or stable build. Expo SDK's recommended TypeScript pin is intentionally excluded from the Expo version check via the supported `expo.install.exclude` setting in `app/package.json`; this preserves the requested compiler while still checking other SDK dependencies. Do not hide beta-related failures with broad type suppressions.

## Earth texture provenance and licensing

The three runtime maps come from the official [Solar System Scope texture pack](https://www.solarsystemscope.com/textures/), which states that the textures are provided under the [Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/). The provider describes them as real planetary maps in equirectangular projection, based on merged geospatial data and NASA Blue Marble imagery. The provider explicitly permits commercial use subject to attribution.

| Bundled file | Source map | Runtime use | Bundled size |
|---|---|---|---:|
| `earth-day.jpg` | Earth Day Map | Daytime land/ocean texture | 308,624 bytes |
| `earth-night.jpg` | Earth Night Map | Night-side city lights | 170,657 bytes |
| `earth-clouds.jpg` | Earth Clouds | Separate moving cloud shell | 801,558 bytes |
| `earth-normal.jpg` | Earth Normal Map | Surface normal detail for terrain relief | 91,136 bytes |
| `earth-specular.jpg` | Earth Specular Map | Ocean-only specular highlight mask | 211,373 bytes |

All three images are 2048×1024. The downloader optimizes the images for mobile use and converts the cloud map to grayscale. Source URLs, dimensions, SHA-256 checksums, and license metadata are recorded in `app/assets/earth/ASSET_MANIFEST.json`. Attribution is preserved in `app/assets/earth/ATTRIBUTION.md`.

The current app imports these files with static `require()` calls. They are bundled into the native app; Earth rendering does not make a runtime request to a third-party image CDN.

## Asset build pipeline

- `app/scripts/download-earth-assets.py` downloads the three official 2K maps, verifies JPEG signatures and 2:1 aspect ratios, optimizes them, and writes a manifest plus attribution file.
- `.github/workflows/prepare-earth-assets.yml` runs the download once from a marker-file push or can be manually dispatched.
- The workflow commits the binary assets into `app/assets/earth/` using the repository's GitHub Actions token.
- Do not remove or replace the attribution file when updating the assets.

To refresh the assets, run the **Prepare bundled Earth textures** workflow in GitHub Actions. Review the generated manifest and asset diff before release.

## Current rendering implementation

`app/src/components/earth/EarthBackground.tsx` contains the native Three.js scene:

- The day and night surface maps blend using a GLSL day/night terminator driven by a fixed world-space sun direction.
- City lights are shown on the night side; a subtle twilight band softens the day/night boundary.
- The Earth Normal Map perturbs the surface normal to add fine terrain relief.
- The Earth Specular Map limits directional sun glints to ocean surfaces.
- Clouds are rendered on an independent translucent sphere, lit separately, and rotate slightly faster than the ground surface.
- A sun-aware blue atmospheric rim and a restrained star field complete the scene.
- The component is non-interactive and uses a low-power GPU preference with a capped device-pixel ratio.
- Rendering pauses when the app enters the background.
- The Home route passes its navigation focus state to the Earth component so the animation pauses when another tab is selected.

`app/src/app/(tabs)/index.tsx` places the scene behind the Home contribution card without covering its controls.

## Implementation phases and status

### Phase 1 — Native scene and Home integration

Status: source implemented; physical-device validation pending.

- Add native 3D dependencies.
- Render a textured sphere, day/night transition, city lights, moving clouds, atmosphere, and stars.
- Isolate the implementation in `EarthBackground`.
- Place it behind the existing Home contribution card without capturing touches.

### Phase 2 — Bundle and optimize Earth assets

Status: <strong>completed in source repository</strong>; verify the first install/build on devices.

- Approved CC BY 4.0 texture source selected.
- 2K day, night, and cloud textures committed to `app/assets/earth/`.
- Source manifest, checksums, and attribution committed.
- Runtime switched to static local asset references; no runtime CDN dependency remains.

### Phase 3 — Visual fidelity

Status: visual fidelity pass implemented; final tuning awaits device screenshots.

- Day/night terminator and night lights are driven by a fixed world-space sun direction.
- Normal map and ocean specular map add terrain and sea-light detail.
- Clouds use a separate translucent shell with independent drift and solar lighting.
- Atmosphere shading responds to the lit side of the planet.
- Framing and rotation speed have been tuned for the Home hero card; adjust after physical-device screenshots.

### Phase 4 — Lifecycle and performance

Status: basic pause behavior implemented; profiling pending.

- Pause rendering when Home is not focused or the app is backgrounded.
- Measure memory, GPU use, startup delay, and frame pacing on physical iOS and Android devices.
- Add quality tiers (low / balanced / high) based on device capability.
- Keep the Earth decorative: no pointer interaction or continuous gestures are required for the first release.

### Phase 5 — Release acceptance

Status: pending automated and physical-device validation.

- Home remains readable and all controls remain tappable.
- No black canvas, missing-texture flash, or unhandled GL crash on supported physical devices.
- Earth renders offline after installation.
- TypeScript, Expo Doctor, EAS iOS, and EAS Android checks pass.
- Test at least one physical iPad and one Android device; do not rely on the iOS simulator alone for GL validation.

## Automated validation

The repository includes `.github/workflows/validate-app.yml`, which runs:

```bash
npm install --no-audit --no-fund
npm run typecheck
npx expo-doctor
```

Run locally from `app/` as well:

```bash
npm install
npm run typecheck
npx expo-doctor
npx expo start --dev-client
```

Then create EAS development/preview builds and test on physical devices. Native GL support should be verified on an actual iPhone/iPad and Android device, not only in a simulator.

## Honest status

The texture download workflow has completed successfully and GitHub contains all three bundled local image assets. Source code and documentation have been committed. The previous GitHub Actions run for app commit `360c4bc7e1257e3605f7f4d23edb66413c236bd7` passed `npm install`, TypeScript 7.1 `tsc --noEmit`, and Expo Doctor (20/20). The current Phase 3 shader and new texture references require a fresh validation run. EAS iOS/Android builds and physical-device rendering tests have not yet been performed. Do not describe the Earth background as production-certified until native builds and device tests pass.
