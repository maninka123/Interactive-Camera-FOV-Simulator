import {
  DEFAULT,
  calculate,
  isConfiguration,
  type Configuration,
} from "./optics";
export type Session = { a: Configuration; b: Configuration; compare: boolean };
export function readSession(search: string): Session {
  const fallback = {
    a: { ...DEFAULT },
    b: { ...DEFAULT, focal: 50 },
    compare: false,
  };
  try {
    const raw = new URLSearchParams(search).get("config");
    if (!raw || raw.length > 5000) return fallback;
    const data = JSON.parse(raw);
    return data.version === 1 &&
      isConfiguration(data.a) &&
      isConfiguration(data.b) &&
      typeof data.compare === "boolean"
      ? data
      : fallback;
  } catch {
    return fallback;
  }
}
export function shareUrl(session: Session) {
  const url = new URL(window.location.href);
  url.searchParams.set("config", JSON.stringify({ version: 1, ...session }));
  return url.toString();
}
// JSON represents unbounded DOF as "Infinity", never silently as null.
export const toJson = (value: unknown) =>
  JSON.stringify(value, (_, v) => (v === Infinity ? "Infinity" : v), 2);
export function exportResults(session: Session) {
  return {
    model:
      "Rectilinear, infinity-focus nominal FOV; centred circular image circle; thin-lens DOF",
    units: "mm, m, degrees; pixel pitches in micrometres",
    a: { configuration: session.a, results: calculate(session.a) },
    ...(session.compare
      ? { b: { configuration: session.b, results: calculate(session.b) } }
      : {}),
  };
}
export function toCsv(session: Session) {
  const rows = ["configuration,metric,value,unit"];
  for (const [name, c] of session.compare
    ? ([
        ["A", session.a],
        ["B", session.b],
      ] as const)
    : ([["A", session.a]] as const)) {
    const r = calculate(c);
    const metrics: [string, number | string | null, string][] = [
      ["sensor", c.sensor, ""],
      ["sensor_width", c.width, "mm"],
      ["sensor_height", c.height, "mm"],
      ["resolution_x", c.pixelsX, "px"],
      ["resolution_y", c.pixelsY, "px"],
      ["focal_length", c.focal, "mm"],
      ["f_number", c.aperture, ""],
      ["image_circle", c.circle, "mm"],
      ["focus_distance", c.focusM, "m"],
      ["target_distance", c.distanceM, "m"],
      ["object_width", c.objectM, "m"],
      ["circle_of_confusion", c.coc, "mm"],
      ["horizontal_fov", r.horizontal, "deg"],
      ["vertical_fov", r.vertical, "deg"],
      ["diagonal_fov", r.diagonal, "deg"],
      ["scene_width", r.sceneWidthM, "m"],
      ["scene_height", r.sceneHeightM, "m"],
      ["scene_area", r.sceneAreaM2, "m2"],
      ["coverage", r.coverage * 100, "%"],
      ["aperture_diameter", r.apertureDiameter, "mm"],
      ["relative_light_vs_f1", r.relativeLight, ""],
      ["pixel_pitch_x", r.pitchX, "um"],
      ["pixel_pitch_y", r.pitchY, "um"],
      ["mean_angular_sampling_x", r.meanAngularX, "deg/px"],
      ["mean_angular_sampling_y", r.meanAngularY, "deg/px"],
      ["central_angular_sampling_x", r.centralAngularX, "deg/px"],
      ["sampling_x", r.samplingX, "px/m"],
      ["sampling_y", r.samplingY, "px/m"],
      ["object_pixels", r.objectPixels, "px"],
      ["near_focus", r.dof.nearM, "m"],
      ["far_focus", r.dof.farM, "m"],
      ["total_depth_of_field", r.dof.totalM, "m"],
      ["hyperfocal", r.dof.hyperfocalM, "m"],
    ];
    rows.push(
      ...metrics.map(([key, value, unit]) =>
        [name, key, value ?? "N/A", unit]
          .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
          .join(","),
      ),
    );
  }
  return rows.join("\n");
}
export function download(filename: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadDiagram(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute(
    "style",
    "font-family:Arial,sans-serif;background:#f8fafd;color:#334155",
  );
  download(
    "optical-diagram.svg",
    new XMLSerializer().serializeToString(clone),
    "image/svg+xml",
  );
}
