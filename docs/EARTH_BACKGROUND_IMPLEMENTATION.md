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
| `expo-device` | `~58.0.5` | Device total-memory metadata for quality selection |
| `three` | `0.187.0` | 3D scene, geometry, textures, and shaders |
| `@react-three/fiber` | `9.8.1` | React renderer for Three.js, Native entry point |
| `@types/three` | `0.187.0` | Three.js TypeScript definitions |
| `typescript` | `7.1.0-beta` | Requested TypeScript compiler line |

React Three Fiber v9 is intentional: its Native entry point patches Three.js texture loading to resolve Expo assets and uses Expo GL. Do not upgrade this integration to the in-development v10 Native package until its maintainers mark that migration stable. See the [React Three Fiber Native documentation](https://r3f.docs.pmnd.rs/getting-started/installation) and [native loader implementation](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/native/polyfills.ts).

TypeScript 7.1 is a beta compiler line. Keep it explicitly marked as pre-release and require the repository validation workflow to pass before upgrading this dependency to a release candidate or stable build. Expo SDK's recommended TypeScript pin is intentionally excluded from the Expo version check via the supported `expo.install.exclude` setting in `app/package.json`; this preserves the requested compiler while still checking other SDK dependencies. Do not hide beta-related failures with broad type suppressions.

## Earth texture provenance and licensing

All five runtime maps come from the official [Solar System Scope texture pack](https://www.solarsystemscope.com/textures/), which states that the textures are provided under the [Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/). The provider describes them as real planetary maps in equirectangular projection, based on merged geospatial data and NASA Blue Marble imagery. The provider explicitly permits commercial use subject to attribution.

| Bundled file | Source map | Runtime use | Bundled size |
|---|---|---|---:|
| `earth-day.jpg` | Earth Day Map | Daytime land/ocean texture | 342,626 bytes |
| `earth-night.jpg` | Earth Night Map | Night-side city lights | 187,823 bytes |
| `earth-clouds.jpg` | Earth Clouds | Separate moving cloud shell | 865,624 bytes |
| `earth-normal.jpg` | Earth Normal Map | Surface normal detail for terrain relief | 91,136 bytes |
| `earth-specular.jpg` | Earth Specular Map | Ocean-only specular highlight mask | 225,343 bytes |

Each of the five source maps is bundled in two resolutions: standard 2048×1024 and low-memory 1024×512. The downloader optimizes the images for mobile use, preserves RGB channels in the normal map, and converts cloud/specular masks to grayscale. The manifest records source URLs, both output sizes, SHA-256 checksums, and license metadata in `app/assets/earth/ASSET_MANIFEST.json`. The low-memory set is loaded on devices reporting less than 4 GiB total RAM. Attribution is preserved in `app/assets/earth/ATTRIBUTION.md`.

The current app imports these files with static `require()` calls. They are bundled into the native app; Earth rendering does not make a runtime request to a third-party image CDN.

## Asset build pipeline

- `app/scripts/download-earth-assets.py` downloads the five official 2K maps, verifies image signatures and 2:1 equirectangular dimensions with Pillow, optimizes them, and writes a manifest plus attribution file.
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
- The component is non-interactive, uses a low-power GPU preference, and keeps geometry/texture filtering deliberately modest for a decorative mobile background.
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
- 2K day, night, cloud, normal, and specular textures committed to `app/assets/earth/`.
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

Status: adaptive source implementation and automated bundle validation passed; physical-device profiling pending.

- Use `expo-device` total-memory metadata as a conservative scene-budget proxy: low below 4 GiB, balanced from 4 GiB to below 8 GiB, and high at 8 GiB or above. Unknown memory defaults to balanced.
- Low quality loads 1K texture maps, fewer stars and mesh segments, lower anisotropy, and disables antialiasing. Balanced and high use the standard 2K maps with increasing geometry and filtering detail.
- Use demand-driven rendering with target update rates of 20 / 24 / 30 FPS for low / balanced / high. These are scheduling targets, not measured device frame-rate guarantees. The Canvas stops completely when Home loses focus or the app is backgrounded.
- Device RAM is not a direct GPU benchmark. Validate actual memory pressure, GPU load, frame pacing, heat, and battery impact on physical iPad/iPhone and Android hardware before finalizing thresholds.
- Keep the Earth decorative: no pointer interaction or continuous gestures are required for the first release.

### EAS preview builds

The repository includes `.github/workflows/eas-preview-build.yml`, a manually dispatched internal preview build workflow. It reads `EXPO_TOKEN` from GitHub Actions secrets and `EAS_PROJECT_ID` from repository variables. `app/app.config.js` injects that project ID into Expo config at build time.

Before the workflow can create a build:

1. Create/link the BrightGlobe project with `npx eas-cli@latest init` from `app/` and record its EAS project ID.
2. Add an Expo access token as the `EXPO_TOKEN` GitHub Actions secret.
3. Add the project UUID as the `EAS_PROJECT_ID` GitHub repository variable.
4. Configure EAS-managed signing credentials. For an iOS Ad Hoc build, register the target iPad first with `eas device:create`; the device UDID must be included in the provisioning profile. A paid Apple Developer account is required for normal Ad Hoc distribution.
5. Run **Build BrightGlobe preview** from GitHub Actions and select `ios`, `android`, or `all`.

Expo's internal distribution profile creates a directly installable Android APK. For iOS it creates an Ad Hoc or Enterprise-signed build; Ad Hoc installations are restricted to devices registered in that provisioning profile. See [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/) and [iOS device cloud build](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/).

### Phase 5 — Release acceptance

Status: automated source/bundle validation passed; EAS signing and physical-device validation pending.

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

The texture download workflow has completed successfully and GitHub contains all three bundled local image assets. Source code and documentation have been committed. Phase 4 app commit `8bef0d8544748808f3d62b362f71982ca321b421` passed the GitHub Actions validation workflow: `npm install`, TypeScript 7.1 `tsc --noEmit`, Expo Doctor (20/20), and `npx expo export --platform ios`. Metro exported a 5.2 MB iOS JavaScript bundle and listed all ten bundled Earth texture variants. The follow-up documentation commit does not change the app source. The EAS preview workflow is prepared but has not been dispatched; it requires `EXPO_TOKEN`, `EAS_PROJECT_ID`, configured signing credentials, and a registered iPad UDID for Ad Hoc installation. No EAS IPA/APK or physical-device performance measurements have been produced yet. Do not describe the Earth background as production-certified until native builds and device tests pass.
