import { describe, expect, it } from "vitest";
import {
  DEFAULT,
  calculate,
  coveredArea,
  depthOfField,
  diagonal,
  fov,
  isConfiguration,
  sceneExtent,
} from "./optics";
import { readSession, toCsv, toJson } from "./sharing";
import { SENSORS, CIRCLES } from "./presets";

describe("rectilinear geometry and unit conversions", () => {
  it("matches a full-frame 50 mm numerical reference", () => {
    const r = calculate({ ...DEFAULT, focal: 50 });
    expect(r.horizontal).toBeCloseTo(39.5977527, 6);
    expect(r.vertical).toBeCloseTo(26.9914666, 6);
    expect(r.sensorDiagonal).toBeCloseTo(Math.sqrt(1872), 10);
    expect(r.sceneWidthM).toBeCloseTo(7.2, 10);
    expect(r.sceneHeightM).toBeCloseTo(4.8, 10);
    expect(r.sceneAreaM2).toBeCloseTo(34.56, 10);
  });
  it("narrows with focal length and widens with sensor dimensions", () => {
    expect(fov(36, 100)).toBeLessThan(fov(36, 35));
    expect(fov(23.5, 35)).toBeLessThan(fov(36, 35));
    expect(fov(36, 0.5)).toBeLessThan(180);
    expect(fov(36, 2000)).toBeGreaterThan(0);
    expect(sceneExtent(36, 50, 20)).toBe(2 * sceneExtent(36, 50, 10));
  });
  it("preserves FOV under aperture, resolution, image-circle and focus changes", () => {
    const a = calculate(DEFAULT),
      b = calculate({
        ...DEFAULT,
        aperture: 16,
        pixelsX: 12000,
        circle: 2,
        focusM: 0.1,
      });
    expect(b.horizontal).toBe(a.horizontal);
    expect(b.vertical).toBe(a.vertical);
    expect(b.diagonal).toBe(a.diagonal);
    expect(b.coverage).toBeLessThan(a.coverage);
    expect(b.finiteImageDistance).toBeGreaterThan(a.finiteImageDistance);
  });
  it.each(SENSORS)(
    "supports preset $name and common diagonal equation",
    (s) => {
      const r = calculate({ ...DEFAULT, ...s, sensor: s.name });
      expect(r.horizontal).toBeGreaterThan(0);
      expect(r.diagonal).toBe(fov(diagonal(s.width, s.height), DEFAULT.focal));
    },
  );
});
describe("exact centred rectangle–circle intersection", () => {
  it("handles full coverage including corner tangency", () => {
    expect(coveredArea(4, 3, 5)).toBe(12);
    expect(coveredArea(4, 3, 6)).toBe(12);
  });
  it("handles a disk completely contained in the sensor", () => {
    expect(coveredArea(10, 8, 4)).toBeCloseTo(4 * Math.PI, 10);
  });
  it("matches the analytic circular segment for an intersecting strip", () => {
    const expected =
      (4 * (2.5 * Math.sqrt(25 - 6.25) + 25 * Math.asin(0.5))) / 2;
    expect(coveredArea(5, 20, 10)).toBeCloseTo(expected, 9);
    expect(coveredArea(20, 5, 10)).toBeCloseTo(expected, 9);
  });
  it("matches independent midpoint quadrature when all four corners clip", () => {
    const w = 8,
      h = 6,
      d = 9,
      n = 40000,
      dx = w / n;
    let reference = 0;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * dx;
      reference += Math.min(h, 2 * Math.sqrt((d / 2) ** 2 - x ** 2)) * dx;
    }
    expect(coveredArea(w, h, d)).toBeCloseTo(reference, 6);
  });
  it("is symmetric, bounded and monotonic", () => {
    let previous = 0;
    for (let d = 0.5; d <= 50; d += 0.5) {
      const area = coveredArea(36, 24, d);
      expect(area).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(area).toBeLessThanOrEqual(864);
      expect(area).toBeCloseTo(coveredArea(24, 36, d), 8);
      previous = area;
    }
  });
  it("rejects invalid geometry and reports incompatible configurations", () => {
    expect(() => coveredArea(0, 10, 10)).toThrow();
    expect(calculate({ ...DEFAULT, circle: 30 }).coverageStatus).toBe(
      "Partially covered",
    );
    expect(calculate({ ...DEFAULT, circle: 10 }).coverageStatus).toBe(
      "Insufficient coverage",
    );
  });
});
describe("aperture and sampling", () => {
  it("uses entrance pupil diameter and inverse square light", () => {
    const a = calculate({ ...DEFAULT, focal: 50, aperture: 2 }),
      b = calculate({ ...DEFAULT, focal: 50, aperture: 2 * Math.sqrt(2) });
    expect(a.apertureDiameter).toBe(25);
    expect(a.apertureArea).toBeCloseTo(Math.PI * 12.5 ** 2, 10);
    expect(a.relativeLight / b.relativeLight).toBeCloseTo(2, 10);
  });
  it("distinguishes physical pitch from output resolution", () => {
    expect(calculate(DEFAULT).pitchX).toBe(6);
    expect(calculate({ ...DEFAULT, physicalPixels: false }).pitchX).toBeNull();
    expect(calculate({ ...DEFAULT, pixelsX: 12000 }).pitchX).toBe(3);
  });
  it("converts metres to object pixels and separates average from central angular sampling", () => {
    const r = calculate({ ...DEFAULT, focal: 50 });
    expect(r.samplingX).toBeCloseTo(6000 / 7.2, 9);
    expect(r.samplingY).toBeCloseTo(4000 / 4.8, 9);
    expect(r.objectPixels).toBeCloseTo(833.3333333, 6);
    expect(r.meanAngularX).toBe(r.horizontal / 6000);
    expect(r.centralAngularX).toBeGreaterThan(r.meanAngularX);
    expect(
      calculate({ ...DEFAULT, focal: 50, distanceM: 20 }).objectPixels,
    ).toBeCloseTo(r.objectPixels / 2, 10);
  });
});
describe("thin-lens depth of field", () => {
  it("matches an independently evaluated finite-focus example", () => {
    const r = depthOfField(50, 4, 0.025, 10);
    expect(r.hyperfocalM).toBe(25.05);
    expect(r.nearM).toBeCloseTo(250000 / 34950, 9);
    expect(r.farM).toBeCloseTo(250000 / 15050, 9);
    expect(r.totalM).toBe(r.farM - r.nearM);
  });
  it("reaches infinity at and beyond hyperfocal, and rejects impossible focus", () => {
    expect(depthOfField(50, 4, 0.025, 25.05).farM).toBe(Infinity);
    expect(depthOfField(50, 4, 0.025, 30).farM).toBe(Infinity);
    expect(() => depthOfField(50, 4, 0.025, 0.05)).toThrow();
    expect(depthOfField(50, 8, 0.025, 10).totalM).toBeGreaterThan(
      depthOfField(50, 4, 0.025, 10).totalM,
    );
  });
});
describe("validation, sharing and export", () => {
  it("rejects nonfinite values, invalid focus, out-of-range values and fractional pixels", () => {
    expect(isConfiguration(DEFAULT)).toBe(true);
    for (const change of [
      { focal: NaN },
      { width: -1 },
      { focal: 0 },
      { circle: Infinity },
      { pixelsX: 1.5 },
      { focusM: 0.01 },
    ])
      expect(isConfiguration({ ...DEFAULT, ...change })).toBe(false);
    expect(() => calculate({ ...DEFAULT, focal: 0 })).toThrow();
  });
  it("round-trips independent configurations and safely falls back from malformed URLs", () => {
    const session = {
      version: 1,
      a: DEFAULT,
      b: { ...DEFAULT, focal: 85 },
      compare: true,
    };
    expect(
      readSession("?config=" + encodeURIComponent(JSON.stringify(session))).b
        .focal,
    ).toBe(85);
    expect(readSession("?config=%7Bbroken").a).toEqual(DEFAULT);
    expect(
      readSession(
        "?config=" +
          encodeURIComponent(
            JSON.stringify({ ...session, a: { ...DEFAULT, focal: 0 } }),
          ),
      ).compare,
    ).toBe(false);
  });
  it("preserves unbounded DOF and quotes CSV labels correctly", () => {
    expect(toJson({ far: Infinity })).toContain('"Infinity"');
    const csv = toCsv({
      a: { ...DEFAULT, sensor: '1/2.3"' },
      b: DEFAULT,
      compare: true,
    });
    expect(csv).toContain('"1/2.3"""');
    expect(csv).toContain('"B","horizontal_fov"');
    expect(csv).toContain('"mean_angular_sampling_y"');
  });
});

describe("format consistency and new readouts", () => {
  it("every format-equivalent image circle covers the matching sensor", () => {
    for (const sensor of SENSORS) {
      const circle = CIRCLES.find(
        (p) => p.name === `${sensor.name} equivalent`,
      );
      expect(circle).toBeDefined();
      expect(
        calculate({
          ...DEFAULT,
          ...sensor,
          sensor: sensor.name,
          circle: circle!.value,
        }).coverage,
      ).toBe(1);
    }
  });
  it("normalizes mismatched preset names and preserves the active view", () => {
    const value = {
      version: 1,
      a: { ...DEFAULT, width: 10, height: 10 },
      b: { ...DEFAULT, focal: 50 },
      compare: true,
      view: "dof",
    };
    const decoded = readSession(
      "?config=" + encodeURIComponent(JSON.stringify(value)),
    );
    expect(decoded.a.sensor).toBe("Custom");
    expect(decoded.view).toBe("dof");
    expect(
      readSession(
        "?config=" +
          encodeURIComponent(JSON.stringify({ ...value, view: "invalid" })),
      ).view,
    ).toBe("coverage");
  });
  it("computes full-frame crop equivalence and the f/2.8 light reference", () => {
    expect(calculate(DEFAULT).cropFactor).toBe(1);
    expect(calculate(DEFAULT).focalEquivalent35).toBe(35);
    expect(calculate(DEFAULT).relativeLightVs28).toBe(1);
    expect(
      calculate({
        ...DEFAULT,
        sensor: "Custom",
        width: 18,
        height: 12,
        focal: 50,
      }).cropFactor,
    ).toBe(2);
    expect(
      calculate({
        ...DEFAULT,
        sensor: "Custom",
        width: 18,
        height: 12,
        focal: 50,
      }).focalEquivalent35,
    ).toBe(100);
  });
});
