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
  await page.getByRole("button", { name: "Combine camera + lens" }).click();
  await expect(
    page.getByRole("button", { name: "Camera + lens combined" }),
  ).toBeVisible();
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
