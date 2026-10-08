# Camera & Lens Optical Explorer

An interactive optics laboratory that runs entirely in your browser. Pick a camera and lens, edit their specifications, and watch the geometry update.

![Sensor coverage, configuration controls and live optical results](docs/images/explorer-overview.png)

## Explore

- **Sensor coverage:** image circle, exact illuminated area, uncovered regions and sensor-format overlays.
- **Aperture:** animated six- or eight-blade iris, f-stop comparisons and idealised relative light.
- **Optical rays & 3D:** pinhole boundary rays, an orbitable frustum, target dimensions and a 2D alternative.
- **Image preview:** a fixed synthetic scene with world-space projection and a reference frame.
- **Scene & pixels:** coverage at a distance, pixel sampling and object projection.
- **Depth of field:** near/far boundaries and hyperfocal distance with an explicit blur criterion.

![Interactive aperture and f-stop comparison](docs/images/aperture-view.png)

Select **Compare** to edit A and B independently and inspect any view side by side. **Copy A → B** starts a controlled comparison. Results export as JSON/CSV, supported 2D diagrams export as SVG, and **Share** copies a URL containing both configurations. No account or server is needed.

![Interactive 3D field-of-view frustum](docs/images/frustum-view.png)

## Run locally

Use Node.js 22 or newer. From this app’s folder (or the root of its standalone clone):

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Preset dimensions are representative and editable; custom numeric fields are always available. The **Combine camera + lens** action pairs the displayed specifications; subsequent changes stay live. Mobile controls can collapse.

## Verify and build

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

The calculation tests cover reference values, units, exact coverage geometry, optical invariants, pixel sampling, depth of field, input validation and sharing. Browser tests exercise all views, independent comparison, downloads, keyboard navigation and phone/tablet layouts. Three.js loads only when its tab is active.

## Optical assumptions

FOV and target coverage use a rectilinear, infinity-focus pinhole model. Aperture does not change this nominal FOV. Depth of field uses a thin-lens model and the chosen circle of confusion. At close focus, finite conjugates and real focus breathing can change framing. Coverage assumes a centred circular image circle and describes geometry, not measured vignetting or image quality.

Pixel pitch is derived only when resolution represents the physical pixel array. Preview exposure and defocus are not simulated; iris blades are illustrative. See [equations, preset sources and limitations](docs/optical-models.md).

## GitHub Pages

The [deployment workflow](.github/workflows/pages.yml) validates and builds this folder, then publishes a small landing page and the app at `/Interactive-Camera-FOV-Simulator/camera-lens-explorer/`. In repository **Settings → Pages**, the publishing source is **GitHub Actions**. Pushes to `main` deploy automatically; pull requests run validation without publishing.

Stack: React, TypeScript, Vite, Tailwind, local shadcn-style UI components, Lucide, Three.js/React Three Fiber, Vitest and Playwright.
