import { useEffect, useId, useState } from "react";
import {
  Aperture,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Unlink2,
  ChevronDown,
  CircleHelp,
  Crosshair,
  Link2,
  RotateCcw,
} from "lucide-react";
import { APERTURES, CIRCLES, FOCALS, SENSORS } from "../lib/presets";
import {
  LIMITS,
  calculate,
  display,
  type Configuration,
  type NumericKey,
} from "../lib/optics";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
  hint,
  readOnly = false,
  onValidityChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint?: string;
  readOnly?: boolean;
  onValidityChange?: (valid: boolean) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    if (document.activeElement?.id !== id) setDraft(null);
  }, [value, id]);
  const invalid =
    draft !== null &&
    (draft.trim() === "" ||
      !Number.isFinite(Number(draft)) ||
      Number(draft) < min ||
      Number(draft) > max ||
      (step === 1 && !Number.isInteger(Number(draft))));
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {hint && (
          <span title={hint} aria-label={hint}>
            <CircleHelp size={12} />
          </span>
        )}
      </label>
      <div className={`input-wrap ${invalid ? "invalid" : ""}`}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={draft ?? value}
          min={min}
          max={max}
          step={step}
          readOnly={readOnly}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const n = Number(raw);
            onValidityChange?.(
              raw.trim() !== "" &&
                Number.isFinite(n) &&
                n >= min &&
                n <= max &&
                (step !== 1 || Number.isInteger(n)),
            );
            if (
              raw !== "" &&
              Number.isFinite(n) &&
              n >= min &&
              n <= max &&
              (step !== 1 || Number.isInteger(n))
            )
              onChange(n);
          }}
          onBlur={() => {
            if (!invalid) setDraft(null);
          }}
        />
        <span>{unit}</span>
      </div>
      {invalid && (
        <small className="field-error" id={`${id}-error`}>
          Enter {min}–{max}
          {step === 1 ? " whole pixels" : ` ${unit}`}.
        </small>
      )}
    </div>
  );
}
function Preset({
  label,
  value,
  options,
  change,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  change: (v: string) => void;
}) {
  const id = useId();
  const [custom, setCustom] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="select-wrap">
        <select
          id={id}
          value={custom ? "Custom" : value}
          onChange={(e) => {
            setCustom(e.target.value === "Custom");
            change(e.target.value);
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value="Custom">Custom</option>
        </select>
        <ChevronDown size={14} />
      </div>
    </div>
  );
}
export function Controls({
  config: c,
  change,
  reset,
  combine,
  combined,
  cameraOnly,
  changeCameraOnly,
  name,
}: {
  config: Configuration;
  change: (c: Configuration) => void;
  reset: () => void;
  combine: () => void;
  combined: boolean;
  cameraOnly: boolean;
  changeCameraOnly: (only: boolean) => void;
  name: string;
}) {
  const r = calculate(c);
  const [dimensionsValid, setDimensionsValid] = useState({
    width: true,
    height: true,
  });
  const custom = c.sensor === "Custom";
  const matchedFormat = SENSORS.find(
    (sensor) =>
      Math.abs(sensor.width - c.width) <= 0.02 &&
      Math.abs(sensor.height - c.height) <= 0.02,
  );
  const closestFormat =
    matchedFormat ??
    SENSORS.reduce((best, sensor) => {
      const distance = (s: typeof sensor) =>
        Math.hypot(Math.log(c.width / s.width), Math.log(c.height / s.height));
      return distance(sensor) < distance(best) ? sensor : best;
    });
  const validDimensions = dimensionsValid.width && dimensionsValid.height;
  const [pane, setPane] = useState("camera");
  const panes = [
    { id: "camera", label: "Camera" },
    { id: "lens", label: "Lens" },
    { id: "scene", label: "Target scene" },
  ];
  const set = (key: NumericKey, value: number) =>
    change({
      ...c,
      [key]: value,
      ...(key === "width" || key === "height" ? { sensor: "Custom" } : {}),
      ...(key === "focal" && c.focusM * 1000 <= value
        ? { focusM: value / 1000 + 0.01 }
        : {}),
    });
  const field = (
    key: NumericKey,
    label: string,
    unit: string,
    step = 0.1,
    hint?: string,
  ) => (
    <Field
      key={`${name}-${key}`}
      label={label}
      value={c[key]}
      onChange={(v) => set(key, v)}
      min={
        key === "focusM"
          ? Math.max(LIMITS[key][0], c.focal / 1000 + 0.0001)
          : LIMITS[key][0]
      }
      max={LIMITS[key][1]}
      step={step}
      unit={unit}
      hint={hint}
      readOnly={(key === "width" || key === "height") && !custom}
      onValidityChange={
        key === "width" || key === "height"
          ? (valid) =>
              setDimensionsValid((states) => ({ ...states, [key]: valid }))
          : undefined
      }
    />
  );
  return (
    <aside className="controls" aria-label={`Configuration ${name} settings`}>
      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Configuration sections"
      >
        {panes.map((item, i) => (
          <button
            key={item.id}
            id={`settings-tab-${name}-${item.id}`}
            role="tab"
            aria-selected={pane === item.id}
            aria-controls={`settings-${name}-${item.id}`}
            tabIndex={pane === item.id ? 0 : -1}
            onClick={() => setPane(item.id)}
            onKeyDown={(e) => {
              const delta =
                e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!delta && e.key !== "Home" && e.key !== "End") return;
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? panes.length - 1
                    : (i + delta + panes.length) % panes.length;
              setPane(panes[next].id);
              document
                .getElementById(`settings-tab-${name}-${panes[next].id}`)
                ?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <details
        className={`settings-fold settings-camera ${pane === "camera" ? "active-settings" : ""}`}
        id={`settings-${name}-camera`}
        open
      >
        <summary>
          <Camera size={17} /> Camera sensor <ChevronDown size={16} />
        </summary>
        <Card className="settings-card">
          <div className="card-heading">
            <Camera size={17} />
            <h2>Camera sensor</h2>
            <span className="tag">{name}</span>
          </div>
          <Preset
            label="Sensor format"
            value={c.sensor}
            options={SENSORS.map((s) => ({ label: s.name, value: s.name }))}
            change={(name) => {
              setDimensionsValid({ width: true, height: true });
              const s = SENSORS.find((s) => s.name === name);
              change(
                s
                  ? {
                      ...c,
                      sensor: name,
                      width: s.width,
                      height: s.height,
                      pixelsX: s.pixelsX,
                      pixelsY: s.pixelsY,
                    }
                  : { ...c, sensor: "Custom" },
              );
            }}
          />
          <p className="input-note">
            {custom
              ? "Drag the sliders or type dimensions."
              : "Preset dimensions · select Custom to edit."}
          </p>
          <div className="field-pair">
            {field("width", "Active width", "mm", 0.01)}
            {field("height", "Active height", "mm", 0.01)}
          </div>
          {custom && (
            <div className="custom-sensor-settings">
              <div className="field-pair">
                <label>
                  Width slider
                  <input
                    className="range"
                    aria-label="Custom sensor width slider"
                    type="range"
                    min={LIMITS.width[0]}
                    max={LIMITS.width[1]}
                    step="0.01"
                    value={c.width}
                    onChange={(e) => {
                      set("width", Number(e.target.value));
                      setDimensionsValid((states) => ({
                        ...states,
                        width: true,
                      }));
                    }}
                  />
                </label>
                <label>
                  Height slider
                  <input
                    className="range"
                    aria-label="Custom sensor height slider"
                    type="range"
                    min={LIMITS.height[0]}
                    max={LIMITS.height[1]}
                    step="0.01"
                    value={c.height}
                    onChange={(e) => {
                      set("height", Number(e.target.value));
                      setDimensionsValid((states) => ({
                        ...states,
                        height: true,
                      }));
                    }}
                  />
                </label>
              </div>
              {validDimensions && (
                <p className="format-match">
                  {matchedFormat ? "Matches format" : "Closest format"}:{" "}
                  <strong>{closestFormat.name}</strong>
                  {matchedFormat ? "" : " (approximate)"}
                </p>
              )}
              <div
                className={`custom-size-status ${validDimensions ? "valid" : "invalid"}`}
                role="status"
              >
                {validDimensions ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                <div>
                  <strong>
                    {validDimensions
                      ? "Supported sensor dimensions"
                      : "Outside the supported size range"}
                  </strong>
                  {!validDimensions && (
                    <p>
                      Enter width and height from 0.1 to 100 mm. Empty, zero and
                      negative dimensions cannot define a sensor.
                    </p>
                  )}
                </div>
              </div>
              {validDimensions && (
                <div
                  className={`custom-size-status ${r.coverage === 1 ? "valid" : "invalid"}`}
                >
                  {r.coverage === 1 ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertTriangle size={16} />
                  )}
                  <div>
                    <strong>
                      {r.coverage === 1
                        ? "Fits the selected lens image circle"
                        : "Selected lens cannot cover this sensor"}
                    </strong>
                    {r.coverage < 1 && (
                      <p>
                        The {display(c.circle)} mm image circle is smaller than
                        the {display(r.sensorDiagonal)} mm sensor diagonal. Use
                        a larger image circle or a smaller sensor.
                      </p>
                    )}
                  </div>
                </div>
              )}
              <p className="custom-sensor-note">
                Geometry only; product availability is not checked.
              </p>
            </div>
          )}
          <div className="derived-row">
            <span>
              Diagonal <b>{display(r.sensorDiagonal)} mm</b>
            </span>
            <span>
              Aspect <b>{display(r.aspect)}:1</b>
            </span>
          </div>
          <details className="advanced-settings">
            <summary>Resolution & pixel size</summary>
            <div className="field-pair">
              {field("pixelsX", "Resolution width", "px", 1)}
              {field("pixelsY", "Resolution height", "px", 1)}
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={c.physicalPixels}
                onChange={(e) =>
                  change({ ...c, physicalPixels: e.target.checked })
                }
              />{" "}
              Resolution is the physical pixel array
            </label>
            <div className="derived-row">
              <span>
                Pixel pitch (derived)
                <b>
                  {r.pitchX === null
                    ? "N/A · output resolution"
                    : `${display(r.pitchX)} × ${display(r.pitchY!)} µm`}
                </b>
              </span>
            </div>
          </details>
        </Card>
      </details>
      <details
        className={`settings-fold settings-lens ${pane === "lens" ? "active-settings" : ""}`}
        id={`settings-${name}-lens`}
        open
      >
        <summary>
          <Aperture size={17} /> Lens <ChevronDown size={16} />
        </summary>
        <Card className="settings-card">
          <div className="card-heading">
            <Aperture size={17} />
            <h2>Lens</h2>
            <span className="tag">Rectilinear</span>
          </div>
          <div className="field-pair">
            <Preset
              label="Focal length preset"
              value={FOCALS.includes(c.focal) ? String(c.focal) : "Custom"}
              options={FOCALS.map((f) => ({
                label: `${f} mm`,
                value: String(f),
              }))}
              change={(v) => {
                if (v !== "Custom") set("focal", Number(v));
              }}
            />
            {field(
              "focal",
              "Focal length",
              "mm",
              0.1,
              "A longer focal length narrows the nominal field of view.",
            )}
          </div>
          <input
            className="range"
            aria-label="Focal length slider"
            type="range"
            min="0.5"
            max={Math.max(100, c.focal)}
            step="0.1"
            value={c.focal}
            onChange={(e) => set("focal", Number(e.target.value))}
          />
          <div className="field-pair">
            <Preset
              label="Aperture preset"
              value={
                APERTURES.includes(c.aperture) ? String(c.aperture) : "Custom"
              }
              options={APERTURES.map((f) => ({
                label: `f/${f}`,
                value: String(f),
              }))}
              change={(v) => {
                if (v !== "Custom") set("aperture", Number(v));
              }}
            />
            {field("aperture", "Aperture", "f/", 0.1)}
          </div>
          <input
            className="range"
            aria-label="Aperture slider"
            type="range"
            min="0.7"
            max="64"
            step="0.1"
            value={c.aperture}
            onChange={(e) => set("aperture", Number(e.target.value))}
          />
          <div className="image-circle-fields">
            <Preset
              label="Image circle preset"
              value={
                CIRCLES.some((s) => s.value === c.circle)
                  ? String(c.circle)
                  : "Custom"
              }
              options={CIRCLES.map((s) => ({
                label: `${s.name} · ${s.value} mm`,
                value: String(s.value),
              }))}
              change={(v) => {
                if (v !== "Custom") set("circle", Number(v));
              }}
            />
            {field(
              "circle",
              "Image circle diameter",
              "mm",
              0.1,
              "Use the measured lens specification. Format equivalents are illustrative, not lens guarantees.",
            )}
          </div>
          <details className="advanced-settings">
            <summary>Focus & depth of field</summary>
            <div className="field-pair">
              {field("focusM", "Focus distance", "m", 0.1)}
              {field(
                "coc",
                "Circle of confusion",
                "mm",
                0.001,
                "Acceptable blur diameter for the approximate depth-of-field model. This does not update automatically with the sensor.",
              )}
            </div>
          </details>
        </Card>
      </details>
      <Button
        className={`combine ${combined ? "is-combined" : ""}`}
        onClick={combine}
        aria-pressed={combined}
        title={
          combined
            ? "Click again to decouple the camera and lens"
            : "Combine the camera and lens"
        }
      >
        {combined ? <Unlink2 size={16} /> : <Link2 size={16} />}
        {combined ? "Camera + lens combined" : "Combine camera + lens"}
      </Button>
      {combined && (
        <label className="camera-view-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={cameraOnly}
            onChange={(e) => changeCameraOnly(e.target.checked)}
          />
          <span>Show camera only</span>
        </label>
      )}
      <p className="combine-note">
        {combined
          ? "Combined configuration · all changes update live."
          : "Pair these specifications to explore. Results already update live."}
      </p>
      <details
        className={`settings-fold settings-scene ${pane === "scene" ? "active-settings" : ""}`}
        id={`settings-${name}-scene`}
        open
      >
        <summary>
          <Crosshair size={17} /> Target scene <ChevronDown size={16} />
        </summary>
        <Card className="settings-card">
          <div className="card-heading">
            <Crosshair size={17} />
            <h2>Target scene</h2>
          </div>
          <div className="field-pair">
            {field(
              "distanceM",
              "Target distance",
              "m",
              0.1,
              "Distance from the camera to the measurement plane. The slider changes this distance.",
            )}
            {field(
              "objectM",
              "Object width",
              "m",
              0.01,
              "Real width of an object on the measurement plane, used to estimate its projected width in pixels.",
            )}
          </div>
          <input
            className="range"
            type="range"
            aria-label="Target distance slider"
            min="0.1"
            max={Math.max(100, c.distanceM)}
            step="0.1"
            value={c.distanceM}
            onChange={(e) => set("distanceM", Number(e.target.value))}
          />
          <p className="scene-help">
            Measures coverage and pixels on an object at this distance.
          </p>
          <details className="advanced-settings scene-explanation">
            <summary>What these settings mean</summary>
            <p>
              <strong>Target distance</strong> places a measurement plane in
              front of the camera. At 10 m, the results show how much width and
              height the camera covers there. The slider changes this distance.
            </p>
            <p>
              <strong>Object width</strong> is the real width of an object on
              that plane. At 1 m, the app estimates how many pixels wide it
              appears.
            </p>
            <p>
              These settings update scene coverage and pixel estimates. They do
              not move the camera in the image preview.
            </p>
          </details>
        </Card>
      </details>
      <Button variant="ghost" className="reset-control" onClick={reset}>
        <RotateCcw size={14} /> Reset configuration {name}
      </Button>
    </aside>
  );
}
