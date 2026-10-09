# Camera & Lens Optical Explorer

An interactive optics laboratory that runs entirely in your browser, and an independent companion to the [original LiDAR/camera analysis project](https://github.com/maninka123/Lidar_camera_FOV_analysis).

[Open the camera & lens explorer](https://maninka123.github.io/Interactive-Camera-FOV-Simulator/camera-lens-explorer/) · [Feature overview and usage guide](https://maninka123.github.io/Interactive-Camera-FOV-Simulator/#guide)

## Run locally

Use Node.js 22 or newer. From this app’s folder (or the root of its standalone clone):

```sh
npm ci
npm run dev
```

Open the URL printed by Vite.

## Verify and build

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

The calculation tests cover reference values, units, exact coverage geometry, optical invariants, pixel sampling, depth of field, input validation and sharing. Browser tests exercise all views, independent comparison, downloads, keyboard navigation and phone/tablet layouts. Three.js loads only when its tab is active.

See [equations, preset sources and limitations](docs/optical-models.md) for the calculation models.

## GitHub Pages

The [deployment workflow](.github/workflows/pages.yml) validates and builds this folder, then publishes the feature overview, usage guide and app at `/Interactive-Camera-FOV-Simulator/camera-lens-explorer/`. In repository **Settings → Pages**, the publishing source is **GitHub Actions**. Pushes to `main` deploy automatically; pull requests run validation without publishing.

Stack: React, TypeScript, Vite, Tailwind, local shadcn-style UI components, Lucide, Three.js/React Three Fiber, Vitest and Playwright.
