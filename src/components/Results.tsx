import {
  CheckCircle2,
  AlertTriangle,
  Activity,
  MoveHorizontal,
} from "lucide-react";
import { calculate, display, type Configuration } from "../lib/optics";
import { Card } from "./ui/card";
export function ResultsPanel({
  config: c,
  name,
}: {
  config: Configuration;
  name: string;
}) {
  const r = calculate(c);
  return (
    <aside className="results" aria-label={`Configuration ${name} results`}>
      <Card className="result-card">
        <div className="card-heading">
          <Activity size={17} />
          <h2>Live results</h2>
          <span className="live-dot" />
        </div>
        <p className="eyebrow">NOMINAL FIELD OF VIEW · {name}</p>
        <div className="primary-result">
          <strong data-testid={`horizontal-${name}`}>
            {display(r.horizontal, 1)}
            <span>°</span>
          </strong>
          <span>Horizontal</span>
        </div>
        <div className="angle-pair">
          <div>
            <strong>{display(r.vertical, 1)}°</strong>
            <span>Vertical</span>
          </div>
          <div>
            <strong>{display(r.diagonal, 1)}°</strong>
            <span>Diagonal</span>
          </div>
        </div>
        <div className={`coverage-status ${r.coverage < 1 ? "warning" : ""}`}>
          {r.coverage === 1 ? (
            <CheckCircle2 size={17} />
          ) : (
            <AlertTriangle size={17} />
          )}
          <div>
            <strong>{r.coverageStatus}</strong>
            <span>
              {display(r.coverage * 100, 1)}% of sensor area illuminated
              geometrically
            </span>
          </div>
        </div>
        <dl className="spec-list">
          <div>
            <dt>Sensor diagonal</dt>
            <dd>{display(r.sensorDiagonal)} mm</dd>
          </div>
          <div>
            <dt>Image circle</dt>
            <dd>{display(c.circle)} mm</dd>
          </div>
          <div>
            <dt>Entrance pupil Ø</dt>
            <dd>{display(r.apertureDiameter)} mm</dd>
          </div>
          <div>
            <dt>Light vs f/1</dt>
            <dd>{display(r.relativeLight * 100, 2)}%</dd>
          </div>
        </dl>
      </Card>
      <Card className="result-card">
        <div className="card-heading">
          <MoveHorizontal size={17} />
          <h2>At {display(c.distanceM)} metres</h2>
        </div>
        <div className="scene-dimensions">
          <strong>
            {display(r.sceneWidthM)} <span>×</span> {display(r.sceneHeightM)}
          </strong>
          <span>scene width × height · m</span>
        </div>
        <dl className="spec-list">
          <div>
            <dt>Scene area</dt>
            <dd>{display(r.sceneAreaM2)} m²</dd>
          </div>
          <div>
            <dt>Sampling X / Y</dt>
            <dd>
              {display(r.samplingX, 1)} / {display(r.samplingY, 1)} px/m
            </dd>
          </div>
          <div>
            <dt>{display(c.objectM)} m object</dt>
            <dd>{display(r.objectPixels, 1)} px</dd>
          </div>
          <div>
            <dt>Mean angular X</dt>
            <dd>{display(r.meanAngularX * 1000, 3)} mdeg/px</dd>
          </div>
          <div>
            <dt>Mean angular Y</dt>
            <dd>{display(r.meanAngularY * 1000, 3)} mdeg/px</dd>
          </div>
          <div>
            <dt>Centre angular X</dt>
            <dd>{display(r.centralAngularX * 1000, 3)} mdeg/px</dd>
          </div>
        </dl>
        {c.objectM > r.sceneWidthM && (
          <p className="small-warning">
            Object exceeds the frame width; the pixel estimate is its unclipped
            projection.
          </p>
        )}
      </Card>
      <Card className="model-note">
        <span className="eyebrow">MODEL NOTES</span>
        <p>
          Nominal FOV assumes infinity focus. Aperture changes light and depth
          of field, while geometric FOV stays the same.
        </p>
        <p>
          Image circle coverage alone does not establish real vignetting,
          distortion or sharpness.
        </p>
        {r.finiteImageDistance / c.focal > 1.05 && (
          <p className="small-warning">
            Close focus: the thin-lens image distance is{" "}
            {display(r.finiteImageDistance)} mm. Finite-focus framing may differ
            substantially.
          </p>
        )}
      </Card>
    </aside>
  );
}
