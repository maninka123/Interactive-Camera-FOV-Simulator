import {
  CheckCircle2,
  AlertTriangle,
  Activity,
  MoveHorizontal,
  Camera,
} from "lucide-react";
import { calculate, display, type Configuration } from "../lib/optics";
import { Card } from "./ui/card";
export function ResultsPanel({
  config: c,
  name,
  cameraOnly = false,
}: {
  config: Configuration;
  name: string;
  cameraOnly?: boolean;
}) {
  const r = calculate(c);
  if (cameraOnly)
    return (
      <aside
        className="results"
        aria-label={`Configuration ${name} camera-only results`}
      >
        <Card className="result-card">
          <div className="card-heading">
            <Camera size={17} />
            <h2>Camera only</h2>
          </div>
          <p className="eyebrow">SENSOR · {name}</p>
          <div className="scene-dimensions">
            <strong>
              {display(c.width)} × {display(c.height)}
            </strong>
            <span>active width × height · mm</span>
          </div>
          <dl className="spec-list">
            <div>
              <dt>Format</dt>
              <dd>{c.sensor}</dd>
            </div>
            <div>
              <dt>Sensor diagonal</dt>
              <dd>{display(r.sensorDiagonal)} mm</dd>
            </div>
            <div>
              <dt>Active area</dt>
              <dd>{display(c.width * c.height)} mm²</dd>
            </div>
            <div>
              <dt>Aspect ratio</dt>
              <dd>{display(r.aspect)}:1</dd>
            </div>
          </dl>
        </Card>
        <Card className="result-card">
          <div className="card-heading">
            <h2>Sensor pixels</h2>
          </div>
          <div className="scene-dimensions">
            <strong>
              {c.pixelsX} × {c.pixelsY}
            </strong>
            <span>
              {c.physicalPixels ? "physical pixel array" : "output resolution"}
            </span>
          </div>
          <dl className="spec-list">
            <div>
              <dt>Physical pixel pitch</dt>
              <dd>
                {r.pitchX === null
                  ? "N/A · output resolution"
                  : `${display(r.pitchX)} × ${display(r.pitchY!)} µm`}
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="model-note">
          <p>
            Combine the camera and lens to see field of view, image-circle
            coverage and scene measurements.
          </p>
        </Card>
      </aside>
    );
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
            <span>{display(r.coverage * 100, 1)}% illuminated sensor area</span>
          </div>
        </div>
        <details className="result-details">
          <summary>Lens & sensor metrics</summary>
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
        </details>
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
        </dl>
        <details className="result-details">
          <summary>Angular sampling</summary>
          <dl className="spec-list">
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
        </details>
        {c.objectM > r.sceneWidthM && (
          <p className="small-warning">
            Object exceeds the frame width; the pixel estimate is its unclipped
            projection.
          </p>
        )}
      </Card>
      <Card className="model-note">
        <details>
          <summary>Model notes</summary>
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
              {display(r.finiteImageDistance)} mm. Finite-focus framing may
              differ substantially.
            </p>
          )}
        </details>
      </Card>
    </aside>
  );
}
