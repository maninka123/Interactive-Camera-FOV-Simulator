import { test, expect, type Page } from "@playwright/test";

async function selectSettings(
  page: Page,
  name: "Camera" | "Lens" | "Target scene",
) {
  const tab = page.getByRole("tab", { name, exact: true });
  if (await tab.isVisible()) await tab.click();
}

test("custom inputs, presets, incompatible coverage and optical invariants", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.getByTestId("horizontal-A")).toContainText("54.4");
  await selectSettings(page, "Lens");
  await page.getByLabel("Focal length preset").selectOption("50");
  await expect(page.getByTestId("horizontal-A")).toContainText("39.6");
  await page.getByLabel("Aperture preset", { exact: true }).selectOption("16");
  await expect(page.getByTestId("horizontal-A")).toContainText("39.6");
  await page.getByLabel("Image circle diameter", { exact: true }).fill("10");
  await expect(
    page.getByText("Insufficient coverage", { exact: true }),
  ).toBeVisible();
  await selectSettings(page, "Camera");
  await page
    .getByLabel("Sensor format", { exact: true })
    .selectOption('1/2.8"');
  await expect(page.getByText("Fully covered", { exact: true })).toBeVisible();
  await page
    .getByLabel("Sensor format", { exact: true })
    .selectOption("Custom");
  await page.getByLabel("Active width", { exact: true }).fill("20.25");
  await expect(page.getByLabel("Active width", { exact: true })).toHaveValue(
    "20.25",
  );
  await selectSettings(page, "Lens");
  await page.getByLabel("Focal length preset").selectOption("Custom");
  await expect(page.getByLabel("Focal length preset")).toHaveValue("Custom");
  const focal = page.getByLabel("Focal length", { exact: true });
  await focal.fill("0");
  await expect(focal).toHaveAttribute("aria-invalid", "true");
  await focal.fill("0.5");
  await expect(focal).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByTestId("horizontal-A")).toContainText("174.3");
  await focal.fill("2000");
  await expect(page.getByTestId("horizontal-A")).toContainText("0.6");
  await selectSettings(page, "Camera");
  await page.getByText("Resolution & pixel size", { exact: true }).click();
  await page.getByLabel("Resolution is the physical pixel array").uncheck();
  await expect(page.getByText("N/A · output resolution")).toBeVisible();
  const lensSwitch = page.getByRole("switch", { name: "Camera + lens" });
  await expect(lensSwitch).toHaveAttribute("aria-checked", "true");
  await lensSwitch.click();
  await expect(
    page.getByRole("heading", { name: "Camera only", exact: true }),
  ).toBeVisible();
  await lensSwitch.click();
  await page.getByRole("button", { name: "Reset configuration A" }).click();
  await expect(page.getByTestId("horizontal-A")).toContainText("54.4");
  expect(errors).toEqual([]);
});

test("all views, accessible tabs, frustum interaction and downloads", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.getByRole("tab", { name: "Sensor coverage" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Aperture", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Choose f/8", exact: true }).click();
  await selectSettings(page, "Lens");
  await expect(
    page.getByRole("spinbutton", { name: "Aperture", exact: true }),
  ).toHaveValue("8");
  await page.getByRole("tab", { name: "Optical rays" }).click();
  await page.getByLabel("Cross-section").selectOption("vertical");
  await expect(
    page.getByRole("img", {
      name: "vertical pinhole field-of-view boundary rays",
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "3D field of view" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  const canvas = page.locator("canvas"),
    box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 50,
    box.y + box.height / 2 + 25,
  );
  await page.mouse.up();
  await page.mouse.wheel(0, 100);
  await page.getByLabel("Wireframe only").check();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.getByRole("button", { name: "Use 2D alternative" }).click();
  await expect(
    page.getByRole("img", {
      name: "horizontal pinhole field-of-view boundary rays",
    }),
  ).toBeVisible();
  for (const name of ["Image preview", "Scene & pixels", "Depth of field"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.locator(".optical-svg")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  }
  for (const [button, extension] of [
    ["JSON", ".json"],
    ["CSV", ".csv"],
    ["Diagram SVG", ".svg"],
  ]) {
    const promise = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    const download = await promise;
    expect(download.suggestedFilename()).toContain(extension);
  }
  expect(errors).toEqual([]);
});

test("comparison values stay independent, copy and reset work, share URL round-trips", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator(".config-caption")).toHaveCount(2);
  await page.getByRole("button", { name: "Edit B" }).click();
  await selectSettings(page, "Lens");
  await page.getByLabel("Focal length preset").selectOption("85");
  await expect(page.getByTestId("horizontal-B")).toContainText("23.9");
  await page.getByRole("button", { name: "Edit A" }).click();
  await selectSettings(page, "Lens");
  await expect(page.getByLabel("Focal length", { exact: true })).toHaveValue(
    "35",
  );
  await page.getByRole("button", { name: "Copy A B" }).click();
  await page.getByRole("button", { name: "Edit B" }).click();
  await selectSettings(page, "Lens");
  await expect(page.getByLabel("Focal length", { exact: true })).toHaveValue(
    "35",
  );
  await page.getByLabel("Focal length preset").selectOption("100");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(url);
  await expect(
    page.getByRole("button", { name: "Exit comparison" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit B" }).click();
  await selectSettings(page, "Lens");
  await expect(page.getByLabel("Focal length", { exact: true })).toHaveValue(
    "100",
  );
  await selectSettings(page, "Camera");
  await page.getByLabel("Sensor format", { exact: true }).selectOption("APS-C");
  const svgDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Diagram SVG · B", exact: true })
    .click();
  const exported = await svgDownload;
  const stream = await exported.createReadStream();
  let svgText = "";
  for await (const chunk of stream!) svgText += chunk.toString();
  expect(svgText).toContain("APS-C");
  expect(svgText).not.toContain("Full Frame");
  for (const name of ["Aperture", "Image preview", "3D field of view"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.locator(".config-caption")).toHaveCount(2);
  }
  await expect(page.locator("canvas")).toHaveCount(2);
  await page.getByRole("button", { name: "Reset comparison" }).click();
  await page.getByRole("button", { name: "Edit B" }).click();
  await selectSettings(page, "Lens");
  await expect(page.getByLabel("Focal length", { exact: true })).toHaveValue(
    "50",
  );
});

test("phone and tablet layouts, collapsible controls and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./");
    if (width === 390)
      await page.getByRole("button", { name: "Adjust settings" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByLabel("Sensor format", { exact: true })
      .selectOption("Custom");
    await page.getByLabel("Active width", { exact: true }).fill("40");
    await expect(page.getByLabel("Active width", { exact: true })).toHaveValue(
      "40",
    );
    await page.getByRole("tab", { name: "Image preview" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 390) {
      const sensor = page.locator(".settings-fold").first();
      await sensor.locator(":scope > summary").click();
      await expect(sensor).not.toHaveAttribute("open", "");
      await sensor.locator(":scope > summary").click();
      await expect(
        page.getByLabel("Active width", { exact: true }),
      ).toBeVisible();
    }
  }
});

test("desktop workbench fits laptop screens, explains target settings and enters full screen", async ({
  page,
}) => {
  for (const [width, height] of [
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("./");
    await selectSettings(page, "Lens");
    await expect(
      page.getByLabel("Focal length", { exact: true }),
    ).toBeVisible();
    const fit = await page.evaluate(() => {
      const panels = [".configuration-panel", ".centre", ".results"].map(
        (selector) => document.querySelector(selector) as HTMLElement,
      );
      return (
        document.documentElement.scrollHeight <= innerHeight + 1 &&
        panels.every(
          (panel) =>
            panel.scrollHeight <= panel.clientHeight + 1 &&
            panel.getBoundingClientRect().bottom <= innerHeight,
        )
      );
    });
    expect(fit, `workbench at ${width} × ${height}`).toBe(true);
    await selectSettings(page, "Target scene");
    await page.getByText("What these settings mean", { exact: true }).click();
    await expect(
      page.getByText(
        "These settings update scene coverage and pixel estimates.",
        { exact: false },
      ),
    ).toBeVisible();
    await page.getByText("What these settings mean", { exact: true }).click();
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    expect(await page.locator(".results").evaluate((e) => e.scrollHeight <= e.clientHeight + 1), `comparison results at ${width} x ${height}`).toBe(true);
  }
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);
});

test("wide-angle rays stay inside the diagram and object labels stay clear of the object", async ({
  page,
}) => {
  await page.goto("./");
  await selectSettings(page, "Lens");
  for (const focal of [0.5, 16, 35, 2000]) {
    await page.getByLabel("Focal length", { exact: true }).fill(String(focal));
    await page.getByRole("tab", { name: "Optical rays", exact: true }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect
      .poll(() =>
        page.locator(".optical-svg g line").evaluateAll((lines) =>
          lines.every((line) =>
            ["y1", "y2"].every((attribute) => {
              const y = Number(line.getAttribute(attribute));
              return y >= 40 && y <= 340;
            }),
          ),
        ),
      )
      .toBe(true);
  }
  await page.getByLabel("Focal length preset").selectOption("16");
  await page.getByRole("tab", { name: "Scene & pixels", exact: true }).click();
  const object = (await page.getByTestId("scene-object").boundingBox())!;
  const callout = (await page
    .getByTestId("scene-object-callout")
    .boundingBox())!;
  expect(object.x + object.width).toBeLessThan(callout.x);
  await expect(page.getByTestId("scene-object-callout")).toContainText(
    "266.7 px",
  );
});

test("preset sensor sizes lock, custom sliders and validity explain dimensions and lens coverage", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  const format = page.getByLabel("Sensor format", { exact: true });
  const width = page.getByLabel("Active width", { exact: true });
  const height = page.getByLabel("Active height", { exact: true });
  await format.selectOption('1/4"');
  await expect(width).toHaveValue("3.2");
  await expect(height).toHaveValue("2.4");
  await expect(width).toHaveAttribute("readonly", "");
  await expect(height).toHaveAttribute("readonly", "");
  await format.selectOption("Custom");
  await expect(width).not.toHaveAttribute("readonly", "");
  await expect(page.locator(".format-match")).toHaveText(
    'Matches format: 1/4"',
  );
  const slider = page.getByRole("slider", {
    name: "Custom sensor width slider",
  });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(width).toHaveValue("3.21");
  await width.fill("7.2");
  await height.fill("5.4");
  await expect(page.locator(".format-match")).toHaveText(
    'Matches format: 1/1.8"',
  );
  await width.fill("0");
  await expect(width).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Outside the supported size range"),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Empty, zero and negative dimensions cannot define a sensor.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.locator(".format-match")).toHaveCount(0);
  await width.fill("7.8");
  await expect(page.locator(".format-match")).toContainText(
    'Closest format: 1/1.8" (approximate)',
  );
  await selectSettings(page, "Lens");
  await page.getByLabel("Image circle diameter", { exact: true }).fill("5");
  await selectSettings(page, "Camera");
  await expect(
    page.getByText("Selected lens cannot cover this sensor"),
  ).toBeVisible();
  await expect(
    page.getByText("Use a larger image circle or a smaller sensor.", {
      exact: false,
    }),
  ).toBeVisible();
});

test("camera/lens switch has one consistent state and sharing preserves independent configurations", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  const lens = page.getByRole("switch", { name: "Camera + lens" });
  await expect(lens).toHaveAttribute("aria-checked", "true");
  await lens.click();
  await expect(lens).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("lens-image-circle")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Camera only", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Aperture", exact: true }),
  ).toBeDisabled();
  await lens.click();
  await expect(page.getByTestId("horizontal-A")).toContainText("54.4");
  await lens.click();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page.getByRole("button", { name: "Edit B" }).click();
  await expect(lens).toHaveAttribute("aria-checked", "true");
  await expect(
    page.locator('.diagram-a [data-testid="lens-image-circle"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('.diagram-b [data-testid="lens-image-circle"]'),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Aperture", exact: true }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.goto(await page.evaluate(() => navigator.clipboard.readText()));
  await expect(
    page.getByRole("heading", { name: "Camera only", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit B" }).click();
  await expect(lens).toHaveAttribute("aria-checked", "true");
});

test("diagram labels remain outside sensor objects, height labels stay left and SVG typography matches the app", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  const format = page.getByLabel("Sensor format", { exact: true });
  const formats = await format
    .locator("option")
    .evaluateAll((options) =>
      options
        .map((o) => (o as HTMLOptionElement).value)
        .filter((v) => v !== "Custom"),
    );
  for (const sensor of formats) {
    await format.selectOption(sensor);
    const object = (await page.getByTestId("camera-sensor").boundingBox())!;
    const callout = (await page.getByTestId("sensor-callout").boundingBox())!;
    const heightLabel = (await page
      .getByTestId("sensor-height-label")
      .boundingBox())!;
    const widthLabel = (await page
      .getByTestId("sensor-width-label")
      .boundingBox())!;
    expect(
      callout.x > object.x + object.width ||
        callout.y > object.y + object.height,
    ).toBe(true);
    expect(heightLabel.x + heightLabel.width).toBeLessThan(object.x);
    expect(widthLabel.y).toBeGreaterThan(object.y + object.height);
  }
  for (const mode of [
    "Sensor coverage",
    "Optical rays",
    "Image preview",
    "Scene & pixels",
    "Depth of field",
  ]) {
    await page.getByRole("tab", { name: mode, exact: true }).click();
    expect(
      await page
        .locator(".optical-svg text")
        .evaluateAll((labels) =>
          labels.every(
            (label) =>
              getComputedStyle(label).fontFamily ===
              getComputedStyle(document.body).fontFamily,
          ),
        ),
    ).toBe(true);
  }
  await page.getByRole("tab", { name: "Scene & pixels", exact: true }).click();
  const measurement = (await page
    .getByTestId("scene-height-label")
    .boundingBox())!;
  const object = (await page.getByTestId("scene-object").boundingBox())!;
  expect(measurement.x + measurement.width).toBeLessThan(object.x);
  const calloutSizes = await page
    .getByTestId("scene-object-callout")
    .locator("text")
    .evaluateAll((labels) =>
      labels.map((label) => Number(label.getAttribute("font-size"))),
    );
  expect(Math.max(...calloutSizes)).toBeLessThanOrEqual(18);
  const font = await page
    .locator(".optical-svg")
    .evaluate((e) => getComputedStyle(e).fontFamily);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Diagram SVG", exact: true }).click();
  const stream = await (await downloadPromise).createReadStream();
  let exported = "";
  for await (const chunk of stream!) exported += chunk.toString();
  expect(exported).toContain(font.replaceAll('"', "&quot;"));
  expect(exported).not.toContain("Arial");
});

test("aperture preview shows exposure changes, can compensate brightness and fits a laptop", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [1366, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("./");
    await page.getByRole("tab", { name: "Aperture", exact: true }).click();
    await page
      .getByRole("button", { name: "Choose f/1.4", exact: true })
      .click();
    const brightness = () =>
      page.locator(".aperture-image").evaluate(async (element) => {
        const svg = new XMLSerializer().serializeToString(element);
        const url = URL.createObjectURL(
          new Blob([svg], { type: "image/svg+xml" }),
        );
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = 360;
          canvas.height = 200;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, 360, 200);
          const pixel = ctx.getImageData(10, 10, 1, 1).data;
          return (pixel[0] + pixel[1] + pixel[2]) / 3;
        } finally {
          URL.revokeObjectURL(url);
        }
      });
    const openBrightness = await brightness();
    await page.getByRole("button", { name: "Choose f/8", exact: true }).click();
    expect(await brightness()).toBeLessThan(openBrightness / 2);
    await page.getByLabel("Keep image brightness", { exact: true }).check();
    const compensated = await brightness();
    await page
      .getByRole("button", { name: "Choose f/1.4", exact: true })
      .click();
    expect(await brightness()).toBeCloseTo(compensated, 0);
    const fit = await page
      .locator(".diagram-a")
      .evaluate(
        (e) => e.scrollHeight <= e.clientHeight + 1 && e.scrollTop === 0,
      );
    expect(fit, `aperture view at ${width} x ${height}`).toBe(true);
    const iris = (await page.locator(".iris-feature").boundingBox())!;
    const preview = (await page
      .locator(".aperture-image-panel")
      .boundingBox())!;
    expect(iris.x + iris.width).toBeLessThan(preview.x);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    // Compare changes the available width; wait for ResizeObserver and layout.
    await page.evaluate(() => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ));
    expect(
      await page
        .locator(".diagram-a, .diagram-b")
        .evaluateAll((panels) =>
          panels.every((panel) => panel.scrollHeight <= panel.clientHeight + 1),
        ),
      `comparison aperture view at ${width} x ${height}`,
    ).toBe(true);
    await expect(page.locator(".aperture-image")).toHaveCount(2);
    await page.getByText("Compare all results", { exact: true }).click();
    await expect(
      page.getByRole("table", { name: "Configuration comparison" }),
    ).toBeVisible();
    const table = (await page.locator(".comparison-table").boundingBox())!;
    expect(table.y).toBeGreaterThan(0);
    expect(table.y + table.height).toBeLessThan(height);
  }
});
