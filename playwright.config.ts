import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL:
      "http://127.0.0.1:5182/Interactive-Camera-FOV-Simulator/camera-lens-explorer/",
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5182 --strictPort",
    url: "http://127.0.0.1:5182/Interactive-Camera-FOV-Simulator/camera-lens-explorer/",
    reuseExistingServer: !process.env.CI,
  },
});
