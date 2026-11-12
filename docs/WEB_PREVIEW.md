# BrightGlobe Web Preview

## Preview URL

Target URL:

https://financingsoft.github.io/brightglobe/

The repository is public and the static web export is configured for the `/brightglobe` project subpath. The URL becomes publicly available after GitHub Pages is enabled once for this repository and the first deployment succeeds.

## One-time GitHub Pages setup

Open the repository settings:

https://github.com/financingsoft/brightglobe/settings/pages

Under **Build and deployment**, set **Source** to **GitHub Actions**.

Then open the failed or latest **Deploy BrightGlobe web preview** workflow under Actions and choose **Re-run all jobs**. The workflow has already been committed and does not require an Expo token, an EAS project, Apple signing credentials, or an iPad UDID.

GitHub's official setup guide: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Continuous deployment

The workflow `.github/workflows/deploy-web-preview.yml`:

1. Installs app dependencies.
2. Runs the TypeScript check and Expo Doctor.
3. Exports a static Expo Router web app into `app/dist`.
4. Verifies the generated `index.html` and assets directory.
5. Uploads and deploys the static site to GitHub Pages.

Subsequent commits under `app/**` automatically rebuild and redeploy the preview.

## Platform-specific Earth renderer

Metro resolves platform-specific files automatically:

- `EarthBackground.tsx`: native renderer using `@react-three/fiber/native` and Expo GL.
- `EarthBackground.web.tsx`: browser renderer using the web entry point from `@react-three/fiber` and browser WebGL.

Both versions use the same locally bundled Earth day, night, cloud, normal, and specular texture files, with day/night lighting, moving clouds, atmosphere, and stars. The web implementation is intentionally separate so it does not replace or change the native iOS/Android renderer.

## Local browser preview

From `app/`:

```bash
npm install
npm run typecheck
npm run export:web
npx expo serve
```

## Validation boundary

A successful web export confirms that Metro can bundle the web routes and local assets. It does not certify native GPU performance, iPad rendering, mobile Safari behavior, or production backend connectivity. Current account, task, wallet, and reward content remains preview data.
