import { test, expect, type Page } from "@playwright/test";
import { DEFAULT } from "../src/lib/optics";

async function settings(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  if (await tab.isVisible()) await tab.click();
}

test("complete 2D diagrams fit phone and comparison panes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./");
    if (width === 1366) await page.getByRole("button", { name: "Compare", exact: true }).click();
    for (const name of ["Sensor coverage", "Optical rays", "Image preview", "Scene & pixels", "Depth of field"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await expect.poll(() => page.locator(".optical-svg").evaluateAll((svgs) => svgs.every((element) => {
        const svg = element as SVGSVGElement, bounds = svg.viewBox.baseVal;
        return [...svg.querySelectorAll("text")].every((label) => {
          const box = label.getBBox();
          return box.x >= -1 && box.y >= -1 && box.x + box.width <= bounds.width + 1 && box.y + box.height <= bounds.height + 1;
        });
      })), { message: `${name} labels fit at ${width}` }).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("extreme focal lengths preserve ray spacing, sensor height and relative labels", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await settings(page, "Lens");
  for (const focal of [0.5, 2.1, 16, 35, 2000]) {
    await page.getByLabel("Focal length", { exact: true }).fill(String(focal));
    await page.getByRole("tab", { name: "Optical rays", exact: true }).click();
    const geometry = await page.locator(".optical-svg").evaluate((svg) => {
      const sensor = svg.querySelector('[data-testid="ray-sensor"]')!, lens = svg.querySelector('[data-testid="ray-lens"]')!, target = svg.querySelector('[data-testid="ray-target"]')!;
      const n = (element: Element, name: string) => Number(element.getAttribute(name));
      return { sensorX: n(sensor, "x1"), lensX: n(lens, "cx"), targetX: n(target, "x1"), height: n(sensor, "y2") - n(sensor, "y1"), endpoints: [n(target, "y1"), n(target, "y2")], labelX: n(svg.querySelector('[data-testid="ray-sensor-label"] text')!, "x") };
    });
    expect(geometry.lensX - geometry.sensorX).toBeGreaterThan(100);
    expect(geometry.targetX - geometry.lensX).toBeGreaterThan(100);
    expect(geometry.height).toBeGreaterThanOrEqual(24);
    expect(geometry.endpoints[0]).toBeGreaterThan(40);
    expect(geometry.endpoints[1]).toBeLessThan(340);
    expect(geometry.labelX).toBe(geometry.sensorX);
    await expect(page.locator(".optical-svg")).toContainText("° horizontal FOV");
  }
});

test("small sensors have a readable detail and every overlay keeps its colour", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Sensor format", { exact: true }).selectOption('1/4"');
  await expect(page.getByTestId("sensor-detail")).toBeVisible();
  await expect(page.getByTestId("sensor-detail")).toContainText("3.2 × 2.4 mm");
  expect(await page.locator(".overlay-check").count()).toBe(10);
  await page.locator(".overlay-check").filter({ hasText: "APS-C" }).getByRole("checkbox").check();
  const colour = () => page.locator(".overlay-legend span").filter({ hasText: "APS-C" }).locator("i").evaluate((e) => getComputedStyle(e).backgroundColor);
  const before = await colour();
  await page.locator(".overlay-check").filter({ hasText: '1/4"' }).getByRole("checkbox").check();
  expect(await colour()).toBe(before);
});

test("custom preset selection follows committed values and both B resets use 50 mm", async ({ page }) => {
  await page.goto("./");
  await settings(page, "Lens");
  const preset = page.getByLabel("Focal length preset");
  await preset.selectOption("Custom");
  await expect(preset).toHaveValue("Custom");
  await page.getByLabel("Focal length", { exact: true }).fill("50");
  await expect(preset).toHaveValue("50");
  await preset.selectOption("Custom");
  const slider = page.getByLabel("Focal length slider");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(preset).toHaveValue("50");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page.getByRole("button", { name: "Edit B" }).click();
  await settings(page, "Lens");
  await preset.selectOption("85");
  await page.getByRole("button", { name: "Reset configuration B" }).click();
  await expect(page.getByLabel("Focal length", { exact: true })).toHaveValue("50");
  await preset.selectOption("85");
  await page.getByRole("button", { name: "Reset comparison" }).click();
  await page.getByRole("button", { name: "Edit B" }).click();
  await settings(page, "Lens");
  await expect(page.getByLabel("Focal length", { exact: true })).toHaveValue("50");
});

test("shared view and mismatched dimensions restore safely; theme persists and exports resolved colours", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const session = { version: 1, a: { ...DEFAULT, width: 10, height: 10 }, b: DEFAULT, compare: false, view: "dof" };
  await page.goto("./?config=" + encodeURIComponent(JSON.stringify(session)));
  await expect(page.getByRole("tab", { name: "Depth of field", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Sensor format", { exact: true })).toHaveValue("Custom");
  await expect(page.getByLabel("Active width", { exact: true })).not.toHaveAttribute("readonly", "");
  await page.getByRole("switch", { name: "Dark theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Diagram SVG", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("optical-dof-A.svg");
  let svg = "";
  for await (const chunk of (await file.createReadStream())!) svg += chunk.toString();
  expect(svg).not.toContain("var(--");
  expect(svg).toContain("rgb(18, 30, 46)");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(url);
  await expect(page.getByRole("tab", { name: "Depth of field", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("full screen retains header actions and notifications", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe("app-shell");
  await expect(page.getByRole("button", { name: "Compare", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeVisible();
  await page.getByRole("switch", { name: "Camera + lens" }).click();
  await expect(page.locator(".toast.visible")).toContainText("camera only");
  expect(await page.locator(".toast").evaluate((e) => document.fullscreenElement!.contains(e))).toBe(true);
});

test("vignetting is geometric, scene object is square and infinity has a continuation arrow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await settings(page, "Lens");
  await page.getByLabel("Image circle diameter", { exact: true }).fill("20");
  await page.getByRole("tab", { name: "Image preview", exact: true }).click();
  await expect(page.getByTestId("preview-vignette")).toBeVisible();
  await page.getByLabel("Image circle diameter", { exact: true }).fill("44");
  await expect(page.getByTestId("preview-vignette")).toHaveCount(0);
  await page.getByRole("tab", { name: "Scene & pixels", exact: true }).click();
  const object = (await page.getByTestId("scene-object").boundingBox())!;
  expect(object.width).toBeCloseTo(object.height, 1);
  await page.getByLabel("Focal length preset").selectOption("16");
  await page.getByRole("tab", { name: "Depth of field", exact: true }).click();
  await expect(page.getByTestId("dof-continuation")).toBeVisible();
  await expect(page.getByTestId("dof-far-boundary")).toHaveCount(0);
  await expect(page.locator(".optical-svg")).toContainText("Far → ∞");
  for (const text of ["Near", "Focus", "Hyperfocal"]) await expect(page.locator(".optical-svg")).toContainText(text);
  await expect(page.locator(".optical-svg")).not.toContainText("∞ m");
  await expect(page.locator(".dof-result")).toContainText("infinity");
});

test("target help tracks settings and close-focus warning stays visible", async ({ page }) => {
  await page.goto("./");
  await settings(page, "Target scene");
  await page.getByLabel("Target distance", { exact: true }).fill("12.3");
  await page.getByLabel("Object width", { exact: true }).fill("2.5");
  await page.getByText("What these settings mean", { exact: true }).click();
  await expect(page.locator(".scene-explanation")).toContainText("At 12.3 m");
  await expect(page.locator(".scene-explanation")).toContainText("At 2.5 m");
  await settings(page, "Lens");
  await page.getByText("Focus & depth of field", { exact: true }).click();
  await page.getByLabel("Focus distance", { exact: true }).fill("0.1");
  await expect(page.locator(".close-focus-warning")).toBeVisible();
  await expect(page.locator(".model-note details")).not.toHaveAttribute("open", "");
});

test("aperture uses one reference, announces committed values and keeps the full image", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("./");
  await page.getByRole("tab", { name: "Aperture", exact: true }).click();
  await expect(page.getByRole("button", { name: "Choose f/2.8", exact: true })).toContainText("100%");
  await page.evaluate(() => {
    const state = window as unknown as { auditAnnouncements: number };
    state.auditAnnouncements = 0;
    new MutationObserver(() => state.auditAnnouncements++).observe(document.querySelector(".aperture-view [aria-live]")!, { subtree: true, characterData: true, childList: true });
  });
  await page.getByRole("button", { name: "Choose f/8", exact: true }).click();
  await expect(page.locator(".aperture-view [aria-live]")).toContainText("f/8");
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => (window as unknown as { auditAnnouncements: number }).auditAnnouncements)).toBeLessThanOrEqual(2);
  const image = (await page.locator(".aperture-image").boundingBox())!;
  expect(image.width / image.height).toBeCloseTo(1.8, 1);
  expect(image.height).toBeGreaterThanOrEqual(100);
  expect(await page.getByTestId("aperture-background").locator("rect").first().getAttribute("x")).toBe("-40");
});

test("3D dimensions and depth planes remain readable; comparison exposes both values", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.getByRole("tab", { name: "3D field of view", exact: true }).click();
  await page.getByLabel("Show depth-of-field planes").check();
  await expect(page.locator(".scene-label.near")).toContainText("Near");
  await expect(page.locator(".scene-label.far")).toContainText("Far");
  for (const word of ["wide", "high", "distance"]) await expect(page.locator(".scene-label.dimension").filter({ hasText: word })).toBeVisible();
  const nonoverlap = () => page.locator(".scene-label").evaluateAll((labels) => {
    const boxes = labels.filter((e) => !(e as HTMLElement).hidden).map((e) => e.getBoundingClientRect());
    return boxes.every((a, i) => boxes.slice(i + 1).every((b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top));
  });
  await expect.poll(nonoverlap).toBe(true);
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator(".comparison-summary")).toContainText("54.4° horizontal");
  await expect(page.locator(".comparison-summary")).toContainText("39.6° horizontal");
  await expect(page.locator(".comparison-summary")).toContainText("30% narrower");
  await expect(page.locator(".equivalent-readouts")).toContainText("Crop factor");
  expect(errors).toEqual([]);
});
