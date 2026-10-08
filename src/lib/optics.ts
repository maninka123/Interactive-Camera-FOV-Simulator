/** All distances are mm except explicitly named *M fields (metres). */
export interface Configuration {
  sensor: string;
  width: number;
  height: number;
  pixelsX: number;
  pixelsY: number;
  physicalPixels: boolean;
  focal: number;
  aperture: number;
  circle: number;
  focusM: number;
  distanceM: number;
  objectM: number;
  coc: number;
}
export const DEFAULT: Configuration = {
  sensor: "Full Frame",
  width: 36,
  height: 24,
  pixelsX: 6000,
  pixelsY: 4000,
  physicalPixels: true,
  focal: 35,
  aperture: 2.8,
  circle: 44,
  focusM: 10,
  distanceM: 10,
  objectM: 1,
  coc: 0.03,
};
export const LIMITS = {
  width: [0.1, 100],
  height: [0.1, 100],
  pixelsX: [1, 100000],
  pixelsY: [1, 100000],
  focal: [0.5, 2000],
  aperture: [0.7, 64],
  circle: [0.1, 200],
  focusM: [0.001, 100000],
  distanceM: [0.001, 100000],
  objectM: [0.001, 1000],
  coc: [0.0001, 1],
} as const;
export type NumericKey = keyof typeof LIMITS;
export function isConfiguration(value: unknown): value is Configuration {
  if (!value || typeof value !== "object") return false;
  const c = value as Configuration;
  return (
    typeof c.sensor === "string" &&
    c.sensor.length <= 80 &&
    typeof c.physicalPixels === "boolean" &&
    Object.entries(LIMITS).every(([key, [min, max]]) => {
      const v = c[key as NumericKey];
      return (
        typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
      );
    }) &&
    Number.isInteger(c.pixelsX) &&
    Number.isInteger(c.pixelsY) &&
    c.focusM * 1000 > c.focal
  );
}
export const diagonal = (width: number, height: number) =>
  Math.hypot(width, height);
export const fov = (dimension: number, focal: number) =>
  (2 * Math.atan(dimension / (2 * focal)) * 180) / Math.PI;
export const sceneExtent = (
  dimension: number,
  focal: number,
  distanceM: number,
) => (distanceM * dimension) / focal;

/** Exact area of a centred rectangle intersected with a centred disk. */
export function coveredArea(
  width: number,
  height: number,
  diameter: number,
): number {
  if (![width, height, diameter].every((v) => Number.isFinite(v) && v > 0))
    throw new RangeError("Dimensions must be positive and finite");
  const r = diameter / 2;
  if (diameter >= diagonal(width, height)) return width * height;
  if (diameter <= Math.min(width, height)) return Math.PI * r * r;
  const a = Math.min(width / 2, r),
    b = height / 2;
  const x0 = Math.min(a, Math.sqrt(Math.max(0, r * r - b * b)));
  const integral = (x: number) =>
    (x * Math.sqrt(Math.max(0, r * r - x * x)) +
      r * r * Math.asin(Math.min(1, x / r))) /
    2;
  return Math.min(width * height, 4 * (b * x0 + integral(a) - integral(x0)));
}
export function depthOfField(
  focal: number,
  aperture: number,
  coc: number,
  focusM: number,
) {
  const s = focusM * 1000;
  if (s <= focal)
    throw new RangeError("Focus distance must exceed the focal length");
  const h = (focal * focal) / (aperture * coc);
  const nearM = (h * s) / (h + s - focal) / 1000;
  const farM = s >= h + focal ? Infinity : (h * s) / (h - s + focal) / 1000;
  return { hyperfocalM: (h + focal) / 1000, nearM, farM, totalM: farM - nearM };
}
export function calculate(c: Configuration) {
  if (!isConfiguration(c))
    throw new RangeError("Invalid optical configuration");
  const sensorDiagonal = diagonal(c.width, c.height);
  const horizontal = fov(c.width, c.focal),
    vertical = fov(c.height, c.focal);
  const sceneWidthM = sceneExtent(c.width, c.focal, c.distanceM);
  const sceneHeightM = sceneExtent(c.height, c.focal, c.distanceM);
  const coverage =
    coveredArea(c.width, c.height, c.circle) / (c.width * c.height);
  return {
    sensorDiagonal,
    aspect: c.width / c.height,
    horizontal,
    vertical,
    diagonal: fov(sensorDiagonal, c.focal),
    sceneWidthM,
    sceneHeightM,
    sceneAreaM2: sceneWidthM * sceneHeightM,
    coverage,
    coverageStatus:
      c.circle >= sensorDiagonal
        ? "Fully covered"
        : c.circle >= Math.min(c.width, c.height)
          ? "Partially covered"
          : "Insufficient coverage",
    apertureDiameter: c.focal / c.aperture,
    apertureArea: Math.PI * (c.focal / c.aperture / 2) ** 2,
    relativeLight: 1 / c.aperture ** 2,
    pitchX: c.physicalPixels ? (c.width * 1000) / c.pixelsX : null,
    pitchY: c.physicalPixels ? (c.height * 1000) / c.pixelsY : null,
    meanAngularX: horizontal / c.pixelsX,
    meanAngularY: vertical / c.pixelsY,
    centralAngularX:
      (2 * Math.atan(c.width / c.pixelsX / (2 * c.focal)) * 180) / Math.PI,
    samplingX: c.pixelsX / sceneWidthM,
    samplingY: c.pixelsY / sceneHeightM,
    objectPixels: (c.objectM / sceneWidthM) * c.pixelsX,
    finiteImageDistance:
      (c.focal * (c.focusM * 1000)) / (c.focusM * 1000 - c.focal),
    dof: depthOfField(c.focal, c.aperture, c.coc, c.focusM),
  };
}
export type Results = ReturnType<typeof calculate>;
export function display(value: number, digits = 2) {
  return Number.isFinite(value)
    ? value.toLocaleString("en", { maximumFractionDigits: digits })
    : "∞";
}
