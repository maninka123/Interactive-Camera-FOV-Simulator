import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LIMITS, calculate, display, type Configuration } from "../lib/optics";
import { SENSORS } from "../lib/presets";
export type Mode =
  | "coverage"
  | "aperture"
  | "rays"
  | "frustum"
  | "preview"
  | "distance"
  | "dof";
export const MODES: {
  id: Mode;
  label: string;
  title: string;
  description: string;
  equation: string;
}[] = [
  {
    id: "coverage",
    label: "Sensor coverage",
    title: "A sensor. An image circle. The full picture.",
    description:
      "The rectangle is your active sensor; the circle is the lens’s specified image circle. Red regions fall outside it. Overlay other formats to compare their physical dimensions.",
    equation:
      "Full coverage when D ≥ √(w² + h²). Area coverage uses the exact centred rectangle–circle intersection.",
  },
  {
    id: "aperture",
    label: "Aperture",
    title: "See what a stop of light looks like.",
    description:
      "The iris is a stylised blade mechanism. Opening sizes represent the entrance pupil at a fixed focal length. Smaller f-numbers admit more light under equal exposure and transmission. The illustrative image holds shutter speed and ISO fixed relative to f/2.8; Keep image brightness compensates exposure. The subject is at the focus distance and the background at twice that distance. Background blur uses a thin-lens approximation. F-number is not T-stop.",
    equation:
      "Entrance pupil diameter = f / N. Geometric area = π(f / 2N)². Relative irradiance ∝ 1 / N²; it is independent of focal length at fixed N in this model.",
  },
  {
    id: "rays",
    label: "Optical rays",
    title: "Follow the field of view.",
    description:
      "A labelled pinhole cross-section shows the inverted image and boundary rays. The sensor is drawn at the nominal focal distance. This is a geometric approximation of infinity-focus framing, not a multi-element lens ray trace.",
    equation:
      "θ = 2 atan(sensor dimension / 2f). Scene extent = distance × sensor dimension / f.",
  },
  {
    id: "frustum",
    label: "3D field of view",
    title: "Explore the space your camera sees.",
    description:
      "Orbit, pan and zoom around the frustum. Its target plane uses exactly the same width and height as the other diagrams. The camera’s viewing geometry stays fixed while you move the observer.",
    equation:
      "Target width = d × w / f; target height = d × h / f. Coordinates: +Z forward, +Y up, +X right.",
  },
  {
    id: "preview",
    label: "Image preview",
    title: "Same scene. Different perspective on it.",
    description:
      "A fixed synthetic scene is projected from one camera position, 1.6 m above the ground. Every object has world coordinates and depth. Focal length changes framing through a pinhole projection; the scene is not stretched. Exposure and defocus are not simulated.",
    equation:
      "Image x = fX / Z; image y = f(Y − camera height) / Z. The frame uses the active sensor aspect ratio. The dotted frame is a 36 × 24 mm sensor at 35 mm.",
  },
  {
    id: "distance",
    label: "Scene & pixels",
    title: "From field of view to pixels on target.",
    description:
      "The scene width and height are measured on a plane perpendicular to the optical axis at the target distance. An object’s projected size assumes it lies on that plane; it can extend beyond the image.",
    equation:
      "W = dw / f; H = dh / f. Pixels per metre = horizontal pixels / W. Object pixels = object width × pixels per metre.",
  },
  {
    id: "dof",
    label: "Depth of field",
    title: "Where acceptable sharpness begins and ends.",
    description:
      "The blue band marks approximate acceptable sharpness, using your circle of confusion. Aperture, focal length, focus distance and blur criterion all matter. Blur changes gradually outside this band; the edges are a chosen threshold.",
    equation:
      "H = f² / (Nc) + f; K = H − f. Near = Ks / (K + s − f); far = Ks / (K − s + f), or ∞ when s ≥ H. Units in equations: mm.",
  },
];

/** Interpolate display geometry only; reported results always use the actual inputs. */
export function useAnimatedConfig(config: Configuration, direct = false) {
  const [animated, setAnimated] = useState(config);
  const previous = useRef(config);
  const velocity = useRef<Partial<Record<keyof Configuration, number>>>({});
  useEffect(() => {
    if (
      direct ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      previous.current = config;
      velocity.current = {};
      setAnimated(config);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (time: number) => {
      const dt = Math.min((time - last) / 1000, 0.064),
        omega = 30;
      last = time;
      const next = { ...config };
      let settled = true;
      for (const key of [
        "width",
        "height",
        "focal",
        "circle",
        "aperture",
        "focusM",
        "distanceM",
        "objectM",
        "coc",
      ] as const) {
        const displacement = previous.current[key] - config[key],
          speed = velocity.current[key] ?? 0;
        const decay = Math.exp(-omega * dt),
          coefficient = speed + omega * displacement;
        const [min, max] = LIMITS[key];
        next[key] = Math.max(
          min,
          Math.min(
            max,
            config[key] + (displacement + coefficient * dt) * decay,
          ),
        );
        velocity.current[key] = (speed - omega * coefficient * dt) * decay;
        if (
          Math.abs(next[key] - config[key]) >
          Math.max(1e-6, Math.abs(config[key]) * 1e-4)
        )
          settled = false;
      }
      next.focusM = Math.max(next.focusM, next.focal / 1000 + 0.0001);
      if (settled) {
        previous.current = config;
        velocity.current = {};
        setAnimated(config);
        return;
      }
      previous.current = next;
      setAnimated(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [config, direct]);
  return animated;
}
function Board({ children, title }: { children: ReactNode; title: string }) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      className="optical-svg"
      fontFamily="inherit"
      viewBox="0 0 640 400"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <pattern
          id={`grid-${id}`}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="#e8edf4"
            strokeWidth="0.7"
          />
        </pattern>
      </defs>
      <rect width="640" height="400" fill="#f8fafd" />
      <rect width="640" height="400" fill={`url(#grid-${id})`} />
      {children}
    </svg>
  );
}
function Text({
  x,
  y,
  children,
  color = "#64748b",
  size = 12,
  minimumSize = 18,
  anchor = "middle",
}: {
  x: number;
  y: number;
  children: ReactNode;
  color?: string;
  size?: number;
  minimumSize?: number;
  anchor?: "middle" | "start" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={Math.max(minimumSize, size)}
      textAnchor={anchor}
      fontFamily="inherit"
    >
      {children}
    </text>
  );
}
export function CoverageDiagram({
  config: c,
  overlays = [],
  lensAttached = true,
}: {
  config: Configuration;
  overlays?: string[];
  lensAttached?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const scale =
    260 /
    Math.max(
      lensAttached ? 44 : 0,
      lensAttached ? c.circle : 0,
      c.width,
      c.height,
      ...SENSORS.filter((sensor) => overlays.includes(sensor.name)).map(
        (sensor) => Math.hypot(sensor.width, sensor.height),
      ),
    );
  const w = c.width * scale,
    h = c.height * scale,
    radius = (c.circle * scale) / 2;
  const x = 245 - w / 2,
    y = 195 - h / 2;
  const r = calculate(c);
  return (
    <Board
      title={
        lensAttached
          ? `Sensor ${display(c.width)} by ${display(c.height)} mm inside ${display(c.circle)} mm image circle; ${r.coverageStatus}`
          : `Camera-only sensor ${display(c.width)} by ${display(c.height)} mm`
      }
    >
      <defs>
        <clipPath id={`circle-${id}`}>
          <circle cx="245" cy="195" r={radius} />
        </clipPath>
        <pattern
          id={`hatch-${id}`}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="#fce7e7" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#f19a9a" strokeWidth="2" />
        </pattern>
      </defs>
      <line
        x1="100"
        y1="195"
        x2="400"
        y2="195"
        stroke="#b7c5d9"
        strokeDasharray="4 5"
      />
      <line
        x1="245"
        y1="52"
        x2="245"
        y2="335"
        stroke="#b7c5d9"
        strokeDasharray="4 5"
      />
      {lensAttached && (
        <circle
          data-testid="lens-image-circle"
          cx="245"
          cy="195"
          r={radius}
          fill="#dceafb"
          fillOpacity="0.45"
          stroke="#4e8cec"
          strokeWidth="2"
        />
      )}
      {SENSORS.filter((sensor) => overlays.includes(sensor.name)).map(
        (sensor, i) => (
          <g key={sensor.name}>
            <rect
              x={245 - (sensor.width * scale) / 2}
              y={195 - (sensor.height * scale) / 2}
              width={sensor.width * scale}
              height={sensor.height * scale}
              fill="none"
              stroke={
                ["#a078c3", "#d6a342", "#18a2a6", "#6e8bad", "#d4779b"][i % 5]
              }
              strokeDasharray="5 3"
              strokeWidth="1.2"
            />
            <rect
              x="430"
              y={257 + i * 22}
              width="10"
              height="10"
              fill={
                ["#a078c3", "#d6a342", "#18a2a6", "#6e8bad", "#d4779b"][i % 5]
              }
            />
            <Text x={449} y={268 + i * 22} anchor="start">
              {sensor.name}
            </Text>
          </g>
        ),
      )}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={lensAttached ? `url(#hatch-${id})` : "#cce3f8"}
      />
      {lensAttached && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="#cce3f8"
          clipPath={`url(#circle-${id})`}
        />
      )}
      <rect
        data-testid="camera-sensor"
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke="#1673dc"
        strokeWidth="2.2"
      />
      <line
        x1={x}
        y1={y + h}
        x2={x + w}
        y2={y}
        stroke="#2c76c5"
        strokeWidth="1"
        strokeDasharray="5 4"
      />
      <path
        d={`M ${x + w} 195 H 413 V 180 H 430`}
        fill="none"
        stroke="#4c83b8"
        strokeWidth="1.2"
      />
      <g data-testid="sensor-callout">
        <rect
          x="430"
          y="130"
          width="190"
          height="113"
          rx="10"
          fill="#fff"
          stroke="#cadced"
        />
        <Text x={525} y={160} color="#1761a7" size={18}>
          {c.sensor}
        </Text>
        <Text x={525} y={195} color="#1761a7" size={20}>
          {display(c.width * c.height)} mm²
        </Text>
        <Text x={525} y={223}>
          active sensor area
        </Text>
      </g>
      <path
        d={`M ${x} ${y + h + 5} V 350 M ${x + w} ${y + h + 5} V 350 M ${x} 345 v 10 M ${x} 350 H ${x + w} M ${x + w} 345 v 10`}
        fill="none"
        stroke="#64748b"
      />
      <g data-testid="sensor-width-label">
        <Text x={245} y={373}>
          {display(c.width)} mm wide
        </Text>
      </g>
      <path
        d={`M 82 ${y} H ${x - 5} M 82 ${y + h} H ${x - 5} M 77 ${y} h 10 M 82 ${y} V ${y + h} M 77 ${y + h} h 10`}
        fill="none"
        stroke="#64748b"
      />
      <g data-testid="sensor-height-label">
        <Text x={72} y={195} anchor="end">
          {display(c.height)} mm
        </Text>
      </g>
      <Text x={320} y={30} color="#326eaf" size={18}>
        {lensAttached
          ? `LENS IMAGE CIRCLE · Ø ${display(c.circle)} mm`
          : "CAMERA SENSOR · camera-only view"}
      </Text>
      <Text x={320} y={393}>
        Diagonal {display(r.sensorDiagonal)} mm
        {lensAttached
          ? ` · ${display(r.coverage * 100, 1)}% area coverage`
          : ""}
      </Text>
      <circle cx="245" cy="195" r="2.5" fill="#1469e8" />
    </Board>
  );
}
export function Iris({
  aperture,
  blades = 8,
  size = 160,
}: {
  aperture: number;
  blades?: number;
  size?: number;
}) {
  const opening = (65 * 0.7) / aperture;
  const pts = Array.from({ length: blades }, (_, i) => {
    const a = (i * Math.PI * 2) / blades;
    return [80 + opening * Math.cos(a), 80 + opening * Math.sin(a)];
  });
  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      aria-label={`Stylised ${blades}-blade iris at f/${display(aperture)}`}
      role="img"
    >
      <circle cx="80" cy="80" r="76" fill="#233348" />
      <circle cx="80" cy="80" r="69" fill="#34485f" />
      {pts.map((p, i) => {
        const angle = (i * Math.PI * 2) / blades,
          next = ((i + 1) * Math.PI * 2) / blades;
        return (
          <polygon
            key={i}
            points={`${p.join(",")} ${pts[(i + 1) % blades].join(",")} ${80 + 69 * Math.cos(next)},${80 + 69 * Math.sin(next)} ${80 + 69 * Math.cos(angle)},${80 + 69 * Math.sin(angle)}`}
            fill={i % 2 ? "#4b617b" : "#5c7390"}
            stroke="#233348"
            strokeWidth="0.8"
          />
        );
      })}
      <polygon
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="#e3f3fc"
        stroke="#99c6e8"
        strokeWidth="0.8"
      />
      <circle
        cx="80"
        cy="80"
        r="73"
        fill="none"
        stroke="#7891ac"
        strokeWidth="1"
      />
    </svg>
  );
}
export function ApertureDiagram({
  config: c,
  blades,
  choose,
}: {
  config: Configuration;
  blades: number;
  choose: (n: number) => void;
}) {
  const r = calculate(c);
  const id = useId().replaceAll(":", "");
  const [compensated, setCompensated] = useState(false);
  const lightRatio = (2.8 / c.aperture) ** 2;
  const stops = Math.log2(lightRatio);
  // Thin-lens defocus circle for a background at twice the focus distance.
  const focus = c.focusM * 1000;
  const background = focus * 2;
  const blurMm =
    (c.focal ** 2 * Math.abs(background - focus)) /
    (c.aperture * background * (focus - c.focal));
  const blur = Math.min(10, ((blurMm / c.width) * 360) / 2);
  return (
    <div className="aperture-view">
      <div className="aperture-demonstration">
        <div className="iris-feature">
          <div className="iris-opening">
            <Iris aperture={c.aperture} blades={blades} size={210} />
            <div>
              <span className="eyebrow">ENTRANCE PUPIL</span>
              <strong>f/{display(c.aperture)}</strong>
            </div>
          </div>
          <div className="iris-metrics">
            <p>
              {display(r.apertureDiameter)} mm{" "}
              <span className="metric-description">effective diameter</span>
            </p>
            <p>{display(r.apertureArea)} mm² geometric area</p>
            <span className="pill">
              {display(r.relativeLight * 100)}% light vs f/1
            </span>
          </div>
        </div>
        <div className="aperture-image-panel">
          <div className="aperture-preview-heading">
            <strong>Effect on the image</strong>
            <span>Illustrative preview</span>
          </div>
          <svg
            className="aperture-image"
            viewBox="0 0 360 200"
            role="img"
            aria-label={`Aperture image preview at f/${display(c.aperture)}; ${compensated ? "brightness compensated" : `${display(lightRatio * 100, 1)} percent light relative to f/2.8`}`}
            fontFamily="inherit"
          >
            <defs>
              <filter
                id={`defocus-${id}`}
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation={blur} />
              </filter>
              <filter
                id={`exposure-${id}`}
                colorInterpolationFilters="linearRGB"
              >
                <feComponentTransfer>
                  <feFuncR type="linear" slope={compensated ? 1 : lightRatio} />
                  <feFuncG type="linear" slope={compensated ? 1 : lightRatio} />
                  <feFuncB type="linear" slope={compensated ? 1 : lightRatio} />
                </feComponentTransfer>
              </filter>
            </defs>
            <g filter={`url(#exposure-${id})`}>
              <rect width="360" height="200" fill="#8faeca" />
              <g
                filter={`url(#defocus-${id})`}
                data-testid="aperture-background"
              >
                <circle cx="292" cy="38" r="20" fill="#f5d59a" />
                <path
                  d="M0 116 L64 52 L127 116 L194 61 L274 116 L320 74 L360 104 V200 H0Z"
                  fill="#496f75"
                />
                <rect y="128" width="360" height="72" fill="#637d56" />
                {[20, 47, 74, 101, 128, 235, 262, 289, 316, 343].map((x) => (
                  <g key={x}>
                    <rect
                      x={x}
                      y="112"
                      width="9"
                      height="52"
                      rx="3"
                      fill="#e4d5bb"
                    />
                    <circle cx={x + 4} cy="88" r="10" fill="#62864b" />
                  </g>
                ))}
                <rect y="136" width="360" height="6" fill="#e4d5bb" />
                <rect y="155" width="360" height="6" fill="#e4d5bb" />
              </g>
              <rect y="175" width="360" height="25" fill="#bd9e7d" />
              <ellipse cx="178" cy="176" rx="49" ry="7" fill="#856d59" />
              <path
                d="M195 117 H211 Q234 117 234 137 Q234 154 210 154 H202"
                fill="none"
                stroke="#edbc68"
                strokeWidth="10"
              />
              <path d="M140 110 H207 L201 174 H146Z" fill="#edbc68" />
              <ellipse cx="173.5" cy="110" rx="33.5" ry="6" fill="#f5d49b" />
              <ellipse cx="173.5" cy="110" rx="27" ry="3.5" fill="#544339" />
              <path
                d="M155 122 V158"
                stroke="#f7dca9"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </g>
          </svg>
          <div className="aperture-image-stats" aria-live="polite">
            <span>
              <b>
                {stops >= 0 ? "+" : ""}
                {display(stops, 1)} stops
              </b>{" "}
              light vs f/2.8
            </span>
            <span>
              <b>
                {display(r.dof.nearM)}–{display(r.dof.farM)} m
              </b>{" "}
              depth of field
            </span>
          </div>
          <label className="aperture-exposure-toggle">
            <input
              type="checkbox"
              checked={compensated}
              onChange={(e) => setCompensated(e.target.checked)}
            />
            Keep image brightness
          </label>
          <p className="aperture-preview-note">
            {compensated
              ? "Exposure compensated; background blur still changes."
              : "Fixed shutter speed and ISO; brightness is relative to f/2.8."}{" "}
            Subject at {display(c.focusM)} m; background at{" "}
            {display(c.focusM * 2)} m.
          </p>
        </div>
      </div>
      <div className="stop-chart">
        {[1.4, 2, 2.8, 4, 5.6, 8, 11, 16].map((n) => (
          <button
            key={n}
            className={Math.abs(c.aperture - n) < 0.01 ? "selected" : ""}
            onClick={() => choose(n)}
            aria-label={`Choose f/${n}`}
          >
            <Iris aperture={n} blades={blades} size={55} />
            <strong>f/{n}</strong>
            <span>{display((1.4 / n) ** 2 * 100, 1)}%</span>
          </button>
        ))}
      </div>
      <p className="diagram-note">
        Same focal length · light percentages below use f/1.4 as reference ·
        blades are illustrative
      </p>
      <div className="aperture-scale">
        <span>More light / shallower DOF</span>
        <span>Less light / deeper DOF</span>
      </div>
    </div>
  );
}
export function RayDiagram({
  config: c,
  axis,
}: {
  config: Configuration;
  axis: "horizontal" | "vertical";
}) {
  const id = useId().replaceAll(":", "");
  const d = axis === "horizontal" ? c.width : c.height,
    r = calculate(c);
  // Common scale preserves sensor/focal ratio on the sensor side.
  const scale = Math.min(125 / c.focal, 130 / d),
    lensX = 235,
    sensorX = lensX - c.focal * scale,
    half = (d * scale) / 2;
  // Shorten the illustrated target distance for wide angles so both boundary
  // rays remain inside the board, preserving their sensor/focal slope.
  const targetX = lensX + Math.min(315, (260 * c.focal) / d),
    targetHalf = ((targetX - lensX) * d) / (2 * c.focal);
  return (
    <Board title={`${axis} pinhole field-of-view boundary rays`}>
      <defs>
        <clipPath id={`ray-bounds-${id}`}>
          <rect x="40" y="40" width="560" height="300" />
        </clipPath>
      </defs>
      <g clipPath={`url(#ray-bounds-${id})`}>
        <polygon
          points={`${lensX},200 ${targetX},${200 - targetHalf} ${targetX},${200 + targetHalf}`}
          fill="#1469e8"
          fillOpacity="0.09"
        />
        <line
          x1={sensorX}
          y1={200 - half}
          x2={targetX}
          y2={200 + targetHalf}
          stroke="#2684e9"
          strokeWidth="2"
        />
        <line
          x1={sensorX}
          y1={200 + half}
          x2={targetX}
          y2={200 - targetHalf}
          stroke="#25a7b6"
          strokeWidth="2"
        />
        <line
          x1={targetX}
          y1={200 - targetHalf}
          x2={targetX}
          y2={200 + targetHalf}
          stroke="#82a8d4"
          strokeWidth="3"
        />
      </g>
      <line
        x1="35"
        y1="200"
        x2="605"
        y2="200"
        stroke="#8795a8"
        strokeDasharray="6 5"
      />
      <line
        x1={sensorX}
        y1={200 - half}
        x2={sensorX}
        y2={200 + half}
        stroke="#2556a4"
        strokeWidth="6"
      />
      <ellipse
        cx={lensX}
        cy="200"
        rx="10"
        ry="64"
        fill="#d9eefb"
        fillOpacity="0.85"
        stroke="#789dc4"
      />
      <circle cx={lensX} cy="200" r="4" fill="#166bd7" />
      <Text x={100} y={65}>
        Sensor
      </Text>
      <Text x={100} y={86}>
        {display(d)} mm
      </Text>
      <Text x={lensX} y={43}>
        Optical centre
      </Text>
      <Text x={490} y={43}>
        Target plane
      </Text>
      <Text x={490} y={64}>
        {display(c.distanceM)} m
      </Text>
      <path
        d={`M ${sensorX} 290 v 8 M ${sensorX} 294 H ${lensX} M ${lensX} 290 v 8`}
        stroke="#8da1b7"
        fill="none"
      />
      <Text x={(sensorX + lensX) / 2} y={316}>
        f = {display(c.focal)} mm
      </Text>
      <Text x={430} y={351} color="#166bd7">
        {display(axis === "horizontal" ? r.horizontal : r.vertical, 1)}° {axis}{" "}
        FOV
      </Text>
      <Text x={430} y={373}>
        Scene {display(axis === "horizontal" ? r.sceneWidthM : r.sceneHeightM)}{" "}
        m
      </Text>
      <Text x={320} y={392}>
        Drawing distance adapts to fit · sensor/focal ratio is preserved
      </Text>
    </Board>
  );
}
const SCENE_OBJECTS = [
  { x: -11, z: 25, width: 4, height: 7, type: "building", color: "#d6ac89" },
  { x: 7, z: 30, width: 5, height: 9, type: "building", color: "#afc2d0" },
  { x: -5, z: 17, width: 2.5, height: 4.5, type: "tree", color: "#4c897e" },
  { x: 5, z: 19, width: 3, height: 5, type: "tree", color: "#477b74" },
  { x: 1.3, z: 10, width: 0.6, height: 1.75, type: "person", color: "#ce775c" },
  {
    x: -1.5,
    z: 14,
    width: 0.6,
    height: 1.75,
    type: "person",
    color: "#387cb2",
  },
];
export function PreviewDiagram({
  config: c,
  reference,
}: {
  config: Configuration;
  reference: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const frameW = Math.min(580, (300 * c.width) / c.height),
    frameH = (frameW * c.height) / c.width,
    left = (640 - frameW) / 2,
    top = (400 - frameH) / 2;
  const p = (x: number, y: number, z: number) => [
    320 + ((c.focal * x) / z / c.width) * frameW,
    200 - ((c.focal * (y - 1.6)) / z / c.height) * frameH,
  ];
  const polygon = (points: number[][]) =>
    points.map(([x, y, z]) => p(x, y, z).join(",")).join(" ");
  return (
    <Board title="Fixed reference scene with world-space pinhole projection">
      <defs>
        <clipPath id={`frame-${id}`}>
          <rect x={left} y={top} width={frameW} height={frameH} rx="5" />
        </clipPath>
        <linearGradient id={`sky-${id}`} x2="0" y2="1">
          <stop stopColor="#cbe6f5" />
          <stop offset="1" stopColor="#f3f8f7" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#frame-${id})`}>
        <rect
          x={left}
          y={top}
          width={frameW}
          height={frameH}
          fill={`url(#sky-${id})`}
        />
        <rect x={left} y="200" width={frameW} height="500" fill="#c0d6c9" />
        <polygon
          points={polygon([
            [-120, 0, 100],
            [-80, 17, 100],
            [-40, 8, 100],
            [-8, 24, 100],
            [30, 10, 100],
            [65, 21, 100],
            [120, 0, 100],
          ])}
          fill="#9cbbc0"
        />
        <polygon
          points={polygon([
            [-2, 0, 2],
            [2, 0, 2],
            [2, 0, 120],
            [-2, 0, 120],
          ])}
          fill="#d1d4cf"
        />
        {[5, 10, 20, 40, 80].map((z) => (
          <polyline
            key={z}
            points={polygon([
              [-25, 0, z],
              [25, 0, z],
            ])}
            stroke="#87aa9c"
            strokeWidth="0.8"
          />
        ))}
        {[...SCENE_OBJECTS]
          .sort((a, b) => b.z - a.z)
          .map((o, i) => {
            const a = p(o.x - o.width / 2, o.height, o.z),
              b = p(o.x + o.width / 2, 0, o.z),
              w = b[0] - a[0],
              h = b[1] - a[1];
            return (
              <g key={i}>
                {o.type === "building" ? (
                  <>
                    <rect
                      x={a[0]}
                      y={a[1]}
                      width={w}
                      height={h}
                      fill={o.color}
                    />
                    <polygon
                      points={`${a[0] - w * 0.05},${a[1]} ${a[0] + w / 2},${a[1] - h * 0.14} ${b[0] + w * 0.05},${a[1]}`}
                      fill="#748899"
                    />
                    {[0.2, 0.5, 0.8].map((row) =>
                      [0.2, 0.6].map((col) => (
                        <rect
                          key={`${row}-${col}`}
                          x={a[0] + w * col}
                          y={a[1] + h * row}
                          width={w * 0.17}
                          height={h * 0.1}
                          fill="#eef6f6"
                        />
                      )),
                    )}
                  </>
                ) : o.type === "tree" ? (
                  <>
                    <rect
                      x={a[0] + w * 0.46}
                      y={a[1] + h * 0.4}
                      width={w * 0.09}
                      height={h * 0.6}
                      fill="#806b52"
                    />
                    <ellipse
                      cx={a[0] + w / 2}
                      cy={a[1] + h * 0.32}
                      rx={w / 2}
                      ry={h * 0.32}
                      fill={o.color}
                    />
                  </>
                ) : (
                  <>
                    <circle
                      cx={a[0] + w / 2}
                      cy={a[1] + h * 0.1}
                      r={h * 0.09}
                      fill="#d1aa8b"
                    />
                    <rect
                      x={a[0] + w * 0.1}
                      y={a[1] + h * 0.2}
                      width={w * 0.8}
                      height={h * 0.4}
                      rx={w * 0.15}
                      fill={o.color}
                    />
                    <path
                      d={`M ${a[0] + w * 0.3} ${a[1] + h * 0.6} L ${a[0] + w * 0.25} ${b[1]} M ${a[0] + w * 0.7} ${a[1] + h * 0.6} L ${a[0] + w * 0.75} ${b[1]}`}
                      stroke="#445368"
                      strokeWidth={w * 0.2}
                    />
                  </>
                )}
              </g>
            );
          })}
        {reference && (
          <rect
            x={320 - ((36 / 35 / (c.width / c.focal)) * frameW) / 2}
            y={200 - ((24 / 35 / (c.height / c.focal)) * frameH) / 2}
            width={(36 / 35 / (c.width / c.focal)) * frameW}
            height={(24 / 35 / (c.height / c.focal)) * frameH}
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeDasharray="7 5"
          />
        )}
        <line x1="310" x2="330" y1="200" y2="200" stroke="#fff" />
        <line x1="320" x2="320" y1="190" y2="210" stroke="#fff" />
      </g>
      <rect
        x={left}
        y={top}
        width={frameW}
        height={frameH}
        rx="5"
        fill="none"
        stroke="#8ba9c4"
      />
      <Text x={320} y={24}>
        {display(c.focal)} mm · {c.sensor} · {display(c.width / c.height)}:1
      </Text>
      <Text x={320} y={379}>
        {display(calculate(c).horizontal, 1)}° H ×{" "}
        {display(calculate(c).vertical, 1)}° V · fixed scene, no exposure / blur
        simulation
      </Text>
    </Board>
  );
}
export function DistanceDiagram({ config: c }: { config: Configuration }) {
  const r = calculate(c),
    width = Math.min(350, (210 * c.width) / c.height),
    height = (width * c.height) / c.width,
    x = 220 - width / 2,
    y = 185 - height / 2,
    object = (width * c.objectM) / r.sceneWidthM;
  const id = useId().replaceAll(":", "");
  const objectRight = Math.min(x + width, 220 + object / 2);
  return (
    <Board
      title={`Scene coverage ${display(r.sceneWidthM)} by ${display(r.sceneHeightM)} metres`}
    >
      <defs>
        <clipPath id={`target-${id}`}>
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
      </defs>
      <Text x={320} y={30} color="#226bb5" size={18}>
        TARGET PLANE · {display(c.distanceM)} m from camera
      </Text>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#e2effa"
        stroke="#5896d7"
        strokeWidth="2"
      />
      <g clipPath={`url(#target-${id})`}>
        {Array.from({ length: 19 }, (_, i) => (
          <g key={i}>
            <line
              x1={x + (width * (i + 1)) / 20}
              x2={x + (width * (i + 1)) / 20}
              y1={y}
              y2={y + height}
              stroke="#c8deef"
            />
            <line
              x1={x}
              x2={x + width}
              y1={y + (height * (i + 1)) / 20}
              y2={y + (height * (i + 1)) / 20}
              stroke="#c8deef"
            />
          </g>
        ))}
        <rect
          data-testid="scene-object"
          x={220 - object / 2}
          y={185 - height * 0.25}
          width={object}
          height={height * 0.5}
          rx="2"
          fill="#2675d3"
        />
      </g>
      <path
        d={`M ${x} ${y + height + 9} v 10 M ${x} ${y + height + 14} H ${x + width} M ${x + width} ${y + height + 9} v 10`}
        stroke="#607d9c"
        fill="none"
      />
      <Text x={220} y={y + height + 38}>
        {display(r.sceneWidthM)} m wide
      </Text>
      <path
        d={`M ${x - 18} ${y} h 10 M ${x - 13} ${y} V ${y + height} M ${x - 18} ${y + height} h 10`}
        stroke="#607d9c"
        fill="none"
      />
      <text
        data-testid="scene-height-label"
        x={x - 28}
        y={185}
        transform={`rotate(-90 ${x - 28} 185)`}
        textAnchor="middle"
        fontSize="16"
        fill="#526b85"
      >
        {display(r.sceneHeightM)} m high
      </text>
      <path
        data-testid="scene-object-leader"
        d={`M ${objectRight} 185 H 440 V 150 H 455`}
        stroke="#2675d3"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx={objectRight} cy="185" r="3" fill="#2675d3" />
      <g data-testid="scene-object-callout">
        <rect
          x="455"
          y="112"
          width="165"
          height="140"
          rx="10"
          fill="#fff"
          stroke="#cadced"
        />
        <Text x={537} y={138} color="#526b85" size={14} minimumSize={14}>
          OBJECT WIDTH
        </Text>
        <Text x={537} y={170} color="#1761a7" size={18}>
          {display(c.objectM)} m
        </Text>
        <Text x={537} y={203} color="#1761a7" size={18}>
          {display(r.objectPixels, 1)} px
        </Text>
        <Text x={537} y={230} size={14} minimumSize={14}>
          projected width
        </Text>
      </g>
      {c.objectM > r.sceneWidthM && (
        <Text x={537} y={280} color="#a76a25">
          Exceeds the frame
        </Text>
      )}
      <Text x={320} y={369}>
        {display(r.samplingX, 1)} px/m horizontal · {display(r.samplingY, 1)}{" "}
        px/m vertical
      </Text>
      <Text x={320} y={393}>
        Grid is illustrative · object lies on the target plane
      </Text>
    </Board>
  );
}
export function DofDiagram({ config: c }: { config: Configuration }) {
  const r = calculate(c).dof;
  const end = Math.max(
    c.focusM * 2,
    Number.isFinite(r.farM)
      ? Math.min(r.farM * 1.2, c.focusM * 4)
      : c.focusM * 3,
  );
  const x = (m: number) => 60 + Math.min(m / end, 1) * 530;
  const near = x(r.nearM),
    far = Number.isFinite(r.farM) ? x(r.farM) : 590;
  return (
    <Board
      title={`Depth of field from ${display(r.nearM)} m to ${display(r.farM)} m`}
    >
      <rect
        x={near}
        y="90"
        width={Math.max(0, far - near)}
        height="190"
        rx="6"
        fill="#3d8ce0"
        fillOpacity="0.13"
      />
      <line x1="60" x2="590" y1="280" y2="280" stroke="#98acc2" />
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <line
            x1={60 + i * 106}
            x2={60 + i * 106}
            y1="277"
            y2="287"
            stroke="#98acc2"
          />
          <Text x={60 + i * 106} y={305}>
            {display((end * i) / 5, 1)} m
          </Text>
        </g>
      ))}
      {[0.15, 0.4, 0.65, 0.88].map((t) => (
        <g key={t} opacity={t * end >= r.nearM && t * end <= r.farM ? 1 : 0.3}>
          <rect
            x={x(t * end) - 4}
            y="224"
            width="8"
            height="56"
            fill="#72989a"
          />
          <polygon
            points={`${x(t * end)},152 ${x(t * end) - 28},237 ${x(t * end) + 28},237`}
            fill="#56998b"
          />
        </g>
      ))}
      <line
        x1={near}
        x2={near}
        y1="100"
        y2="280"
        stroke="#4694d8"
        strokeDasharray="4 4"
      />
      <line
        x1={far}
        x2={far}
        y1="100"
        y2="280"
        stroke="#4694d8"
        strokeDasharray="4 4"
      />
      <line
        x1={x(c.focusM)}
        x2={x(c.focusM)}
        y1="78"
        y2="280"
        stroke="#1469e8"
        strokeWidth="2"
      />
      <circle cx={x(c.focusM)} cy="280" r="5" fill="#1469e8" />
      <Text x={x(c.focusM)} y={53} color="#1469e8">
        Focus {display(c.focusM)} m
      </Text>
      <Text x={320} y={343}>
        Near {display(r.nearM)} m · Far {display(r.farM)} m · Total{" "}
        {display(r.totalM)} m
      </Text>
      <Text x={320} y={367}>
        Hyperfocal {display(r.hyperfocalM)} m · CoC {display(c.coc, 4)} mm ·
        band may extend beyond this axis
      </Text>
    </Board>
  );
}
