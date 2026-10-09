import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  LIMITS,
  calculate,
  display,
  coveragePercent,
  type Configuration,
} from "../lib/optics";
import { SENSORS, OVERLAY_COLORS } from "../lib/presets";
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
      "A labelled pinhole cross-section shows the inverted image and boundary rays. Drawing angles and distances are compressed to keep extreme lenses legible; the reported field of view uses your actual inputs. This is a schematic of infinity-focus framing, not a multi-element lens ray trace.",
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
      "Target width = d × w / f; target height = d × h / f. Right-handed coordinates: +Y up and +Z forward. Looking along +Z, +X points left.",
  },
  {
    id: "preview",
    label: "Image preview",
    title: "Same scene. Different perspective on it.",
    description:
      "A fixed synthetic scene is projected from one camera position, 1.6 m above the ground. Every object has world coordinates and depth. Focal length changes framing through a pinhole projection; the scene is not stretched. Dark corners show the geometric image-circle boundary when coverage is incomplete. Exposure and defocus are not simulated.",
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
function useDiagramLayout() {
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) =>
      setCompact(entries[0].contentRect.width < 480),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, compact };
}
function Board({
  children,
  title,
  width = 640,
  height = 400,
}: {
  children: ReactNode;
  title: string;
  width?: number;
  height?: number;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      className="optical-svg"
      fontFamily="inherit"
      viewBox={`0 0 ${width} ${height}`}
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
            d="M20 0 L0 0 0 20"
            fill="none"
            stroke="var(--diagram-grid)"
            strokeWidth=".7"
          />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="var(--diagram-bg)" />
      <rect width={width} height={height} fill={`url(#grid-${id})`} />
      {children}
    </svg>
  );
}
function Text({
  x,
  y,
  children,
  color = "var(--muted)",
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
  const { ref, compact } = useDiagramLayout();
  const id = useId().replaceAll(":", "");
  const r = calculate(c);
  const selected = SENSORS.filter((sensor) => overlays.includes(sensor.name));
  const scale =
    260 /
    Math.max(
      lensAttached ? c.circle : 0,
      c.width,
      c.height,
      ...selected.map((sensor) => Math.hypot(sensor.width, sensor.height)),
    );
  const cx = compact ? 220 : 245,
    cy = 195,
    w = c.width * scale,
    h = c.height * scale,
    radius = (c.circle * scale) / 2;
  const x = cx - w / 2,
    y = cy - h / 2;
  const detail = lensAttached && c.circle / r.sensorDiagonal > 3;
  return (
    <div className="diagram-content" ref={ref}>
      <Board
        width={compact ? 400 : 640}
        height={compact ? 485 : 420}
        title={
          lensAttached
            ? `Sensor ${display(c.width)} by ${display(c.height)} mm inside ${display(c.circle)} mm image circle; ${r.coverageStatus}`
            : `Camera-only sensor ${display(c.width)} by ${display(c.height)} mm`
        }
      >
        <defs>
          <clipPath id={`circle-${id}`}>
            <circle cx={cx} cy={cy} r={radius} />
          </clipPath>
          <pattern
            id={`hatch-${id}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="var(--danger-bg)" />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="var(--danger)"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <Text
          x={compact ? 200 : 320}
          y={28}
          size={compact ? 15 : 18}
          minimumSize={14}
          color="var(--primary)"
        >
          {lensAttached
            ? `LENS IMAGE CIRCLE · Ø ${display(c.circle)} mm`
            : "CAMERA SENSOR · camera only"}
        </Text>
        {lensAttached && (
          <circle
            data-testid="lens-image-circle"
            cx={cx}
            cy={cy}
            r={radius}
            fill="var(--diagram-tint)"
            fillOpacity=".5"
            stroke="var(--primary)"
            strokeWidth="2"
          />
        )}
        {selected.map((sensor) => (
          <rect
            key={sensor.name}
            data-overlay={sensor.name}
            x={cx - (sensor.width * scale) / 2}
            y={cy - (sensor.height * scale) / 2}
            width={sensor.width * scale}
            height={sensor.height * scale}
            fill="none"
            stroke={OVERLAY_COLORS[SENSORS.indexOf(sensor)]}
            strokeDasharray="5 3"
            strokeWidth="1.5"
          />
        ))}
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={lensAttached ? `url(#hatch-${id})` : "var(--sensor-fill)"}
        />
        {lensAttached && (
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            fill="var(--sensor-fill)"
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
          stroke="var(--primary)"
          strokeWidth="2"
        />
        <path
          d={`M${x} ${y + h} L${x + w} ${y}`}
          stroke="var(--primary)"
          strokeDasharray="5 4"
        />
        <path
          d={`M${x} ${y + h + 5} V350 M${x + w} ${y + h + 5} V350 M${x} 345 v10 M${x} 350 H${x + w} M${x + w} 345 v10`}
          fill="none"
          stroke="var(--muted)"
        />
        <g data-testid="sensor-width-label">
          <Text x={cx} y={373} size={compact ? 16 : 18} minimumSize={14}>
            {display(c.width)} mm wide
          </Text>
        </g>
        <path
          d={`M${compact ? 65 : 82} ${y} H${x - 5} M${compact ? 65 : 82} ${y + h} H${x - 5} M${compact ? 65 : 82} ${y} V${y + h}`}
          stroke="var(--muted)"
          fill="none"
        />
        <g data-testid="sensor-height-label">
          <Text
            x={compact ? 58 : 72}
            y={195}
            anchor="end"
            size={compact ? 15 : 18}
            minimumSize={14}
          >
            {display(c.height)} mm
          </Text>
        </g>
        {!compact && (
          <path
            d={`M${x + w} 195 H413 V180 H430`}
            fill="none"
            stroke="var(--primary)"
          />
        )}
        <g data-testid="sensor-callout">
          <rect
            x={compact ? 15 : 430}
            y={compact ? 405 : 130}
            width={compact ? 370 : 190}
            height={compact ? 58 : 113}
            rx="10"
            fill="var(--surface)"
            stroke="var(--border)"
          />
          <Text
            x={compact ? 105 : 525}
            y={compact ? 439 : 160}
            size={compact ? 16 : 18}
            minimumSize={14}
            color="var(--primary)"
          >
            {c.sensor}
          </Text>
          <Text
            x={compact ? 290 : 525}
            y={compact ? 432 : 195}
            size={compact ? 17 : 20}
            minimumSize={14}
            color="var(--primary)"
          >
            {display(c.width * c.height)} mm²
          </Text>
          <Text
            x={compact ? 290 : 525}
            y={compact ? 451 : 223}
            size={compact ? 13 : 16}
            minimumSize={13}
          >
            active sensor area
          </Text>
        </g>

        <Text
          x={compact ? 200 : 320}
          y={compact ? 393 : 410}
          size={compact ? 14 : 16}
          minimumSize={14}
        >
          Diagonal {display(r.sensorDiagonal)} mm
          {lensAttached
            ? ` · ${coveragePercent(r.coverage)}% area coverage`
            : ""}
        </Text>
      </Board>
      {detail && (
        <div className="sensor-detail-card" data-testid="sensor-detail">
          <svg
            viewBox="0 0 160 90"
            aria-label="Magnified sensor detail"
            role="img"
          >
            <rect
              x={80 - Math.min(140, (70 * c.width) / c.height) / 2}
              y={45 - Math.min(70, (140 * c.height) / c.width) / 2}
              width={Math.min(140, (70 * c.width) / c.height)}
              height={Math.min(70, (140 * c.height) / c.width)}
              fill="var(--sensor-fill)"
              stroke="var(--primary)"
              strokeWidth="2"
            />
          </svg>
          <div>
            <strong>Magnified sensor detail</strong>
            <span>
              {display(c.width)} × {display(c.height)} mm
            </span>
          </div>
        </div>
      )}
      {selected.length > 0 && (
        <div className="overlay-legend">
          {selected.map((sensor) => (
            <span key={sensor.name}>
              <i
                style={{ background: OVERLAY_COLORS[SENSORS.indexOf(sensor)] }}
              />
              {sensor.name}
            </span>
          ))}
        </div>
      )}
    </div>
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
  announcedConfig,
  blades,
  choose,
}: {
  config: Configuration;
  blades: number;
  announcedConfig: Configuration;
  choose: (n: number) => void;
}) {
  const r = calculate(c);
  const id = useId().replaceAll(":", "");
  const [compensated, setCompensated] = useState(false);
  const lightRatio = (2.8 / c.aperture) ** 2;
  const announced = calculate(announcedConfig);
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
              {display(r.relativeLightVs28 * 100)}% light vs f/2.8
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
            preserveAspectRatio="xMidYMid slice"
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
                <rect x="-40" y="-40" width="440" height="280" fill="#8faeca" />
                <rect x="-40" y="128" width="440" height="120" fill="#637d56" />
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
          <div className="aperture-image-stats" aria-hidden="true">
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
      <p className="sr-only" role="status" aria-live="polite">
        f/{display(announcedConfig.aperture)};{" "}
        {display(announced.relativeLightVs28 * 100, 1)}% light relative to
        f/2.8; depth of field {display(announced.dof.nearM)} to{" "}
        {Number.isFinite(announced.dof.farM)
          ? `${display(announced.dof.farM)} metres`
          : "infinity"}
        .
      </p>
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
            <span>{display((2.8 / n) ** 2 * 100, 1)}%</span>
          </button>
        ))}
      </div>
      <p className="diagram-note">
        Same focal length · light percentages below use f/2.8 as reference ·
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
  const { ref, compact } = useDiagramLayout();
  const dimension = axis === "horizontal" ? c.width : c.height;
  const r = calculate(c);
  const sensorX = compact ? 55 : 95,
    lensX = compact ? 175 : 275,
    targetX = compact ? 340 : 535;
  // Explicit schematic scaling keeps extreme focal lengths legible without claiming a physical drawing scale.
  const half =
    12 +
    (compact ? 65 : 85) * (2 / Math.PI) * Math.atan(dimension / (2 * c.focal));
  const targetHalf = (half * (targetX - lensX)) / (lensX - sensorX);
  return (
    <div className="diagram-content" ref={ref}>
      <Board
        width={compact ? 400 : 640}
        height={compact ? 430 : 400}
        title={`${axis} pinhole field-of-view boundary rays`}
      >
        <polygon
          points={`${lensX},200 ${targetX},${200 - targetHalf} ${targetX},${200 + targetHalf}`}
          fill="var(--diagram-tint)"
        />
        <line
          x1={sensorX}
          y1={200 - half}
          x2={targetX}
          y2={200 + targetHalf}
          stroke="var(--primary)"
          strokeWidth="2"
        />
        <line
          x1={sensorX}
          y1={200 + half}
          x2={targetX}
          y2={200 - targetHalf}
          stroke="var(--teal)"
          strokeWidth="2"
        />
        <line
          x1="20"
          y1="200"
          x2={compact ? 380 : 620}
          y2="200"
          stroke="var(--muted)"
          strokeDasharray="5 4"
        />
        <line
          data-testid="ray-sensor"
          x1={sensorX}
          y1={200 - half}
          x2={sensorX}
          y2={200 + half}
          stroke="var(--primary)"
          strokeWidth="6"
        />
        <line
          data-testid="ray-target"
          x1={targetX}
          y1={200 - targetHalf}
          x2={targetX}
          y2={200 + targetHalf}
          stroke="var(--primary)"
          strokeWidth="3"
        />
        <ellipse
          data-testid="ray-lens"
          cx={lensX}
          cy="200"
          rx="10"
          ry="60"
          fill="var(--sensor-fill)"
          stroke="var(--primary)"
        />
        <g data-testid="ray-sensor-label">
          <Text x={sensorX} y={62} size={16} minimumSize={14}>
            Sensor
          </Text>
          <Text x={sensorX} y={82} size={16} minimumSize={14}>
            {display(dimension)} mm
          </Text>
        </g>
        <Text x={lensX} y={32} size={16} minimumSize={14}>
          Optical centre
        </Text>
        <g data-testid="ray-target-label">
          <Text x={targetX} y={62} size={16} minimumSize={14}>
            Target plane
          </Text>
          <Text x={targetX} y={82} size={16} minimumSize={14}>
            {display(c.distanceM)} m
          </Text>
        </g>
        <path
          d={`M${sensorX} 312 v8 M${sensorX} 316 H${lensX} M${lensX} 312 v8`}
          stroke="var(--muted)"
          fill="none"
        />
        <Text x={(sensorX + lensX) / 2} y={338} size={16} minimumSize={14}>
          f = {display(c.focal)} mm
        </Text>
        <Text
          x={compact ? 200 : 450}
          y={compact ? 363 : 350}
          size={16}
          minimumSize={14}
          color="var(--primary)"
        >
          {display(axis === "horizontal" ? r.horizontal : r.vertical, 1)}°{" "}
          {axis} FOV
        </Text>
        <Text
          x={compact ? 200 : 450}
          y={compact ? 385 : 373}
          size={16}
          minimumSize={14}
        >
          Scene{" "}
          {display(axis === "horizontal" ? r.sceneWidthM : r.sceneHeightM)} m
        </Text>
        <Text
          x={compact ? 200 : 320}
          y={compact ? 414 : 395}
          size={compact ? 13 : 16}
          minimumSize={13}
        >
          Schematic · drawing distances independently scaled
        </Text>
      </Board>
    </div>
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
  const { ref, compact } = useDiagramLayout();
  const boardWidth = compact ? 400 : 640;
  const centre = boardWidth / 2;
  const id = useId().replaceAll(":", "");
  const frameW = Math.min(compact ? 340 : 580, (300 * c.width) / c.height),
    frameH = (frameW * c.height) / c.width,
    left = (boardWidth - frameW) / 2,
    top = (400 - frameH) / 2;
  const p = (x: number, y: number, z: number) => [
    centre + ((c.focal * x) / z / c.width) * frameW,
    200 - ((c.focal * (y - 1.6)) / z / c.height) * frameH,
  ];
  const polygon = (points: number[][]) =>
    points.map(([x, y, z]) => p(x, y, z).join(",")).join(" ");
  return (
    <div className="diagram-content" ref={ref}>
      <Board
        width={boardWidth}
        title="Fixed reference scene with world-space pinhole projection"
      >
        <defs>
          <clipPath id={`frame-${id}`}>
            <rect x={left} y={top} width={frameW} height={frameH} rx="5" />
          </clipPath>
          <mask
            id={`vignette-${id}`}
            maskUnits="userSpaceOnUse"
            x={left}
            y={top}
            width={frameW}
            height={frameH}
          >
            <rect
              x={left}
              y={top}
              width={frameW}
              height={frameH}
              fill="white"
            />
            <circle
              cx={centre}
              cy="200"
              r={((c.circle / c.width) * frameW) / 2}
              fill="black"
            />
          </mask>
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
          {calculate(c).coverage < 1 && (
            <rect
              data-testid="preview-vignette"
              x={left}
              y={top}
              width={frameW}
              height={frameH}
              fill="#09131f"
              fillOpacity=".88"
              mask={`url(#vignette-${id})`}
            />
          )}
          {reference && (
            <rect
              x={centre - ((36 / 35 / (c.width / c.focal)) * frameW) / 2}
              y={200 - ((24 / 35 / (c.height / c.focal)) * frameH) / 2}
              width={(36 / 35 / (c.width / c.focal)) * frameW}
              height={(24 / 35 / (c.height / c.focal)) * frameH}
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeDasharray="7 5"
            />
          )}
          <line
            x1={centre - 10}
            x2={centre + 10}
            y1="200"
            y2="200"
            stroke="#fff"
          />
          <line x1={centre} x2={centre} y1="190" y2="210" stroke="#fff" />
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
        <Text x={centre} y={24} size={compact ? 14 : 18} minimumSize={14}>
          {display(c.focal)} mm · {c.sensor} · {display(c.width / c.height)}:1
        </Text>
        <Text x={centre} y={371} size={16} minimumSize={14}>
          {display(calculate(c).horizontal, 1)}° H ×{" "}
          {display(calculate(c).vertical, 1)}° V
        </Text>
        <Text x={centre} y={394} size={13} minimumSize={13}>
          Fixed scene · geometric image-circle vignette
        </Text>
      </Board>
    </div>
  );
}
export function DistanceDiagram({ config: c }: { config: Configuration }) {
  const { ref, compact } = useDiagramLayout();
  const r = calculate(c),
    cx = compact ? 200 : 220,
    cy = compact ? 160 : 185;
  const width = Math.min(
      compact ? 300 : 350,
      ((compact ? 150 : 210) * c.width) / c.height,
    ),
    height = (width * c.height) / c.width;
  const x = cx - width / 2,
    y = cy - height / 2,
    object = (width * c.objectM) / r.sceneWidthM;
  const objectRight = Math.min(x + width, cx + object / 2),
    id = useId().replaceAll(":", "");
  return (
    <div className="diagram-content" ref={ref}>
      <Board
        width={compact ? 400 : 640}
        height={compact ? 445 : 400}
        title={`Scene coverage ${display(r.sceneWidthM)} by ${display(r.sceneHeightM)} metres`}
      >
        <defs>
          <clipPath id={`target-${id}`}>
            <rect x={x} y={y} width={width} height={height} />
          </clipPath>
        </defs>
        <Text
          x={compact ? 200 : 320}
          y={28}
          size={compact ? 15 : 18}
          minimumSize={14}
          color="var(--primary)"
        >
          TARGET PLANE · {display(c.distanceM)} m from camera
        </Text>
        <rect
          data-testid="scene-plane"
          x={x}
          y={y}
          width={width}
          height={height}
          fill="var(--sensor-fill)"
          stroke="var(--primary)"
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
                stroke="var(--diagram-grid)"
              />
              <line
                x1={x}
                x2={x + width}
                y1={y + (height * (i + 1)) / 20}
                y2={y + (height * (i + 1)) / 20}
                stroke="var(--diagram-grid)"
              />
            </g>
          ))}
          <rect
            data-testid="scene-object"
            x={cx - object / 2}
            y={cy - object / 2}
            width={object}
            height={object}
            fill="var(--primary)"
            rx="2"
          />
        </g>
        <path
          d={`M${x} ${y + height + 9} v10 M${x} ${y + height + 14} H${x + width} M${x + width} ${y + height + 9} v10 M${x - 18} ${y} h10 M${x - 13} ${y} V${y + height} M${x - 18} ${y + height} h10`}
          stroke="var(--muted)"
          fill="none"
        />
        <Text
          x={cx}
          y={y + height + 38}
          size={compact ? 16 : 18}
          minimumSize={14}
        >
          {display(r.sceneWidthM)} m wide
        </Text>
        <text
          data-testid="scene-height-label"
          x={x - 28}
          y={cy}
          transform={`rotate(-90 ${x - 28} ${cy})`}
          textAnchor="middle"
          fontSize="16"
          fill="var(--muted)"
        >
          {display(r.sceneHeightM)} m high
        </text>
        <path
          data-testid="scene-object-leader"
          d={
            compact
              ? `M${objectRight} ${cy} H370 V298`
              : `M${objectRight} ${cy} H440 V150 H455`
          }
          fill="none"
          stroke="var(--primary)"
        />
        <g data-testid="scene-object-callout">
          <rect
            x={compact ? 15 : 455}
            y={compact ? 298 : 112}
            width={compact ? 370 : 165}
            height={compact ? 85 : 140}
            rx="10"
            fill="var(--surface)"
            stroke="var(--border)"
          />
          <Text
            x={compact ? 115 : 537}
            y={compact ? 321 : 138}
            size={14}
            minimumSize={14}
          >
            OBJECT WIDTH
          </Text>
          <Text
            x={compact ? 115 : 537}
            y={compact ? 356 : 170}
            size={18}
            color="var(--primary)"
          >
            {display(c.objectM)} m
          </Text>
          <Text
            x={compact ? 295 : 537}
            y={compact ? 335 : 203}
            size={18}
            color="var(--primary)"
          >
            {display(r.objectPixels, 1)} px
          </Text>
          <Text
            x={compact ? 295 : 537}
            y={compact ? 357 : 230}
            size={14}
            minimumSize={14}
          >
            projected width
          </Text>
        </g>
        {c.objectM > r.sceneWidthM && (
          <Text
            x={compact ? 200 : 537}
            y={compact ? 399 : 280}
            size={14}
            minimumSize={14}
            color="var(--warning)"
          >
            Object exceeds the frame
          </Text>
        )}
        <Text
          x={compact ? 200 : 320}
          y={compact ? 418 : 369}
          size={compact ? 13 : 16}
          minimumSize={13}
        >
          {display(r.samplingX, 1)} px/m horizontal · {display(r.samplingY, 1)}{" "}
          px/m vertical
        </Text>
        <Text
          x={compact ? 200 : 320}
          y={compact ? 439 : 393}
          size={13}
          minimumSize={13}
        >
          Square target · object lies on the target plane
        </Text>
      </Board>
    </div>
  );
}
export function DofDiagram({ config: c }: { config: Configuration }) {
  const { ref, compact } = useDiagramLayout();
  const r = calculate(c).dof;
  const end = Math.max(
    c.focusM * 2,
    Number.isFinite(r.farM)
      ? Math.min(r.farM * 1.2, c.focusM * 4)
      : c.focusM * 3,
  );
  const left = compact ? 40 : 60,
    right = compact ? 360 : 590;
  const x = (distance: number) =>
    left + Math.min(distance / end, 1) * (right - left);
  const finiteFar = Number.isFinite(r.farM) && r.farM <= end;
  const near = x(r.nearM),
    far = finiteFar ? x(r.farM) : right;
  const labelX = (distance: number) =>
    Math.max(compact ? 110 : 140, Math.min(compact ? 290 : 510, x(distance)));
  return (
    <div className="diagram-content" ref={ref}>
      <Board
        width={compact ? 400 : 640}
        height={compact ? 440 : 400}
        title={`Depth of field from ${display(r.nearM)} m to ${Number.isFinite(r.farM) ? `${display(r.farM)} m` : "infinity"}`}
      >
        <rect
          x={near}
          y="150"
          width={Math.max(0, far - near)}
          height="130"
          fill="var(--diagram-tint)"
        />
        <line x1={left} x2={right} y1="280" y2="280" stroke="var(--muted)" />
        <line
          x1={near}
          x2={near}
          y1="150"
          y2="280"
          stroke="var(--primary)"
          strokeDasharray="4 4"
        />
        {finiteFar ? (
          <line
            data-testid="dof-far-boundary"
            x1={far}
            x2={far}
            y1="150"
            y2="280"
            stroke="var(--primary)"
            strokeDasharray="4 4"
          />
        ) : (
          <path
            data-testid="dof-continuation"
            d={`M${right - 20} 214 H${right + 8} l-8 -7 M${right + 8} 214 l-8 7`}
            stroke="var(--primary)"
            strokeWidth="2"
            fill="none"
          />
        )}
        <line
          x1={x(c.focusM)}
          x2={x(c.focusM)}
          y1="140"
          y2="280"
          stroke="var(--primary)"
          strokeWidth="2"
        />
        <circle cx={x(c.focusM)} cy="280" r="4" fill="var(--primary)" />
        {r.hyperfocalM <= end && (
          <line
            data-testid="dof-hyperfocal"
            x1={x(r.hyperfocalM)}
            x2={x(r.hyperfocalM)}
            y1="150"
            y2="280"
            stroke="var(--teal)"
            strokeDasharray="2 4"
          />
        )}
        <Text x={labelX(r.nearM)} y={32} size={16} minimumSize={14}>
          Near {display(r.nearM)} m
        </Text>
        <path
          d={`M${labelX(r.nearM)} 37 L${near} 147`}
          stroke="var(--border)"
        />
        <Text
          x={labelX(c.focusM)}
          y={61}
          size={16}
          minimumSize={14}
          color="var(--primary)"
        >
          Focus {display(c.focusM)} m
        </Text>
        <Text x={labelX(r.farM)} y={90} size={16} minimumSize={14}>
          {Number.isFinite(r.farM)
            ? `Far ${r.farM > end ? "→ " : ""}${display(r.farM)} m`
            : "Far → ∞"}
        </Text>
        <Text
          x={labelX(r.hyperfocalM)}
          y={119}
          size={16}
          minimumSize={14}
          color="var(--teal)"
        >
          Hyperfocal {r.hyperfocalM > end ? "→ " : ""}
          {display(r.hyperfocalM)} m
        </Text>
        {Array.from({ length: compact ? 4 : 6 }, (_, i) => {
          const count = compact ? 3 : 5;
          return (
            <g key={i}>
              <line
                x1={left + ((right - left) * i) / count}
                x2={left + ((right - left) * i) / count}
                y1="277"
                y2="287"
                stroke="var(--muted)"
              />
              <Text
                x={left + ((right - left) * i) / count}
                y={307}
                size={14}
                minimumSize={13}
              >
                {display((end * i) / count, 1)} m
              </Text>
            </g>
          );
        })}
        <Text x={compact ? 200 : 320} y={345} size={16} minimumSize={14}>
          Depth of field:{" "}
          {Number.isFinite(r.totalM)
            ? `${display(r.totalM)} m`
            : "extends to infinity"}
        </Text>
        <Text x={compact ? 200 : 320} y={373} size={14} minimumSize={13}>
          CoC {display(c.coc, 4)} mm · arrows continue beyond the axis
        </Text>
      </Board>
    </div>
  );
}
