import { useEffect, useId, useState } from "react";
import {
  Aperture,
  Camera,
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
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint?: string;
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
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const n = Number(raw);
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
  name,
}: {
  config: Configuration;
  change: (c: Configuration) => void;
  reset: () => void;
  combine: () => void;
  combined: boolean;
  name: string;
}) {
  const r = calculate(c);
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
    />
  );
  return (
    <aside className="controls" aria-label={`Configuration ${name} settings`}>
      <details className="settings-fold" open>
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
            Representative active dimensions · editable
          </p>
          <div className="field-pair">
            {field("width", "Active width", "mm", 0.01)}
            {field("height", "Active height", "mm", 0.01)}
          </div>
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
      <details className="settings-fold" open>
        <summary>
          <Aperture size={17} /> Lens <ChevronDown size={16} />
        </summary>
        <Card className="settings-card">
          <div className="card-heading">
            <Aperture size={17} />
            <h2>Lens</h2>
            <span className="tag">Rectilinear</span>
          </div>
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
          <p className="input-note">
            Projection: rectilinear / pinhole approximation
          </p>
        </Card>
      </details>
      <Button className="combine" onClick={combine}>
        <Link2 size={16} />
        {combined ? "Camera + lens combined" : "Combine camera + lens"}
      </Button>
      <p className="combine-note">
        {combined
          ? "Combined configuration · all changes update live."
          : "Pair these specifications to explore. Results already update live."}
      </p>
      <details className="settings-fold" open>
        <summary>
          <Crosshair size={17} /> Target scene <ChevronDown size={16} />
        </summary>
        <Card className="settings-card">
          <div className="card-heading">
            <Crosshair size={17} />
            <h2>Target scene</h2>
          </div>
          <div className="field-pair">
            {field("distanceM", "Target distance", "m", 0.1)}
            {field("objectM", "Object width", "m", 0.01)}
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
        </Card>
      </details>
      <Button variant="ghost" className="reset-control" onClick={reset}>
        <RotateCcw size={14} /> Reset configuration {name}
      </Button>
    </aside>
  );
}
