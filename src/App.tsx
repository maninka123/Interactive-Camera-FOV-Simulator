import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Aperture,
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  Copy,
  ExternalLink,
  Focus,
  GitCompareArrows,
  Link2,
  Maximize,
  Scan,
  SlidersHorizontal,
} from "lucide-react";
import { Controls } from "./components/Controls";
import { ResultsPanel } from "./components/Results";
import {
  ApertureDiagram,
  CoverageDiagram,
  DistanceDiagram,
  DofDiagram,
  MODES,
  PreviewDiagram,
  RayDiagram,
  useAnimatedConfig,
  type Mode,
} from "./components/Diagrams";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { DEFAULT, calculate, display, type Configuration } from "./lib/optics";
import {
  download,
  downloadDiagram,
  exportResults,
  readSession,
  shareUrl,
  toCsv,
  toJson,
} from "./lib/sharing";
const Frustum = lazy(() => import("./components/Frustum"));
const icons = {
  coverage: Scan,
  aperture: Aperture,
  rays: Focus,
  frustum: Box,
  preview: Maximize,
  distance: SlidersHorizontal,
  dof: Focus,
};

function ComparisonTable({ a, b }: { a: Configuration; b: Configuration }) {
  const ra = calculate(a),
    rb = calculate(b);
  const rows = [
    [
      "Camera / lens",
      `${a.sensor} · ${display(a.focal)} mm`,
      `${b.sensor} · ${display(b.focal)} mm`,
    ],
    [
      "H / V / D FOV",
      `${display(ra.horizontal, 1)}° / ${display(ra.vertical, 1)}° / ${display(ra.diagonal, 1)}°`,
      `${display(rb.horizontal, 1)}° / ${display(rb.vertical, 1)}° / ${display(rb.diagonal, 1)}°`,
    ],
    [
      "Scene width × height",
      `${display(ra.sceneWidthM)} × ${display(ra.sceneHeightM)} m`,
      `${display(rb.sceneWidthM)} × ${display(rb.sceneHeightM)} m`,
    ],
    [
      "Aperture / light vs f/1",
      `f/${a.aperture} · ${display(ra.relativeLight * 100)}%`,
      `f/${b.aperture} · ${display(rb.relativeLight * 100)}%`,
    ],
    [
      "Sensor coverage",
      `${display(ra.coverage * 100, 1)}% · ${ra.coverageStatus}`,
      `${display(rb.coverage * 100, 1)}% · ${rb.coverageStatus}`,
    ],
    [
      "Object projection",
      `${display(ra.objectPixels, 1)} px`,
      `${display(rb.objectPixels, 1)} px`,
    ],
    [
      "Depth of field",
      `${display(ra.dof.nearM)}–${display(ra.dof.farM)} m`,
      `${display(rb.dof.nearM)}–${display(rb.dof.farM)} m`,
    ],
  ];
  return (
    <div className="comparison-table">
      <table>
        <caption>Configuration comparison</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">A</th>
            <th scope="col">B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              <th scope="row">{row[0]}</th>
              <td>{row[1]}</td>
              <td>{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function App() {
  const [initial] = useState(() => readSession(window.location.search));
  const [a, setA] = useState(initial.a),
    [b, setB] = useState(initial.b),
    [compare, setCompare] = useState(initial.compare);
  const [editing, setEditing] = useState<"A" | "B">("A"),
    [mode, setMode] = useState<Mode>("coverage");
  const [combined, setCombined] = useState(
    initial.combined ?? { A: false, B: false },
  );
  const [cameraOnly, setCameraOnly] = useState(
    initial.cameraOnly ?? { A: false, B: false },
  );
  const [overlays, setOverlays] = useState<string[]>([]),
    [blades, setBlades] = useState(8),
    [axis, setAxis] = useState<"horizontal" | "vertical">("horizontal"),
    [wireframe, setWireframe] = useState(false),
    [reference, setReference] = useState(true);
  const [notice, setNotice] = useState(""),
    [copyFallback, setCopyFallback] = useState("");
  const [showSettings, setShowSettings] = useState(false),
    [direct, setDirect] = useState(false);
  const board = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspace = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () =>
      setFullscreen(document.fullscreenElement === workspace.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const aa = useAnimatedConfig(a, direct),
    bb = useAnimatedConfig(b, direct);
  const active = editing === "A" ? a : b,
    setActive = editing === "A" ? setA : setB;
  const session = { a, b, compare, combined, cameraOnly },
    info = cameraOnly[editing]
      ? {
          ...MODES[0],
          title: "The camera sensor on its own.",
          description:
            "Inspect the active sensor dimensions and pixel array before adding the lens. A sensor alone does not determine field of view or scene coverage.",
          equation:
            "Sensor diagonal = √(width² + height²). Physical pixel pitch = sensor dimension / physical pixel count.",
        }
      : MODES.find((m) => m.id === mode)!;
  const toast = (message: string) => {
    setNotice(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 4000);
  };
  const copy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(message);
    } catch {
      setCopyFallback(value);
      toast("Select and copy the text below.");
    }
  };
  const view = (config: Configuration, name: "A" | "B") => {
    if (cameraOnly[name])
      return (
        <CoverageDiagram
          config={config}
          overlays={overlays}
          lensAttached={false}
        />
      );
    switch (mode) {
      case "coverage":
        return <CoverageDiagram config={config} overlays={overlays} />;
      case "aperture":
        return (
          <ApertureDiagram
            config={config}
            blades={blades}
            choose={(value) =>
              (name === "A" ? setA : setB)((c) => ({ ...c, aperture: value }))
            }
          />
        );
      case "rays":
        return <RayDiagram config={config} axis={axis} />;
      case "frustum":
        return (
          <Suspense
            fallback={<div className="loading">Loading 3D laboratory…</div>}
          >
            <Frustum config={config} wireframe={wireframe} />
          </Suspense>
        );
      case "preview":
        return <PreviewDiagram config={config} reference={reference} />;
      case "distance":
        return <DistanceDiagram config={config} />;
      case "dof":
        return <DofDiagram config={config} />;
    }
  };
  return (
    <>
      <a className="skip-link" href="#laboratory">
        Skip to visualisation
      </a>
      <header className="app-header">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-symbol">
            <Aperture size={24} />
          </span>
          <span>
            Optical Explorer<small>CAMERA & LENS LABORATORY</small>
          </span>
        </a>
        <nav aria-label="App actions">
          <span className="local-badge">
            <span /> Runs in your browser
          </span>
          <Button
            variant={compare ? "default" : "outline"}
            onClick={() => {
              setCompare((v) => !v);
              setEditing("A");
              if (cameraOnly.A) setMode("coverage");
            }}
          >
            <GitCompareArrows size={16} />
            {compare ? "Exit comparison" : "Compare"}
          </Button>
          <Button
            variant="outline"
            onClick={() => copy(shareUrl(session), "Configuration link copied")}
          >
            <Link2 size={16} />
            Share
          </Button>
          <a
            className="repo-link"
            href="https://github.com/maninka123/Interactive-Camera-FOV-Simulator"
            target="_blank"
            rel="noreferrer"
            title="Open the source repository"
            aria-label="Open the source repository"
          >
            <ExternalLink size={18} />
          </a>
        </nav>
      </header>
      <main className="workspace-main" ref={workspace}>
        <details className="intro-disclosure">
          <summary>About the optical explorer</summary>
          <section className="intro">
            <div>
              <p className="eyebrow">
                <span className="blue-dash" /> AN INTERACTIVE OPTICS LAB
              </p>
              <h1>
                A little change.
                <br className="mobile-break" /> A different field of view.
              </h1>
              <p>
                Explore how your sensor and lens shape what you see. Change a
                setting. Watch the geometry respond.
              </p>
            </div>
            <div className="intro-detail">
              <span>01 — CONFIGURE</span>
              <span>02 — EXPLORE</span>
              <span>03 — COMPARE</span>
            </div>
          </section>
        </details>
        {compare && (
          <div className="compare-toolbar">
            <div
              className="segmented"
              aria-label="Choose configuration to edit"
            >
              <Button
                variant={editing === "A" ? "default" : "ghost"}
                onClick={() => {
                  setEditing("A");
                  if (cameraOnly.A) setMode("coverage");
                }}
              >
                Edit A
              </Button>
              <Button
                variant={editing === "B" ? "default" : "ghost"}
                onClick={() => {
                  setEditing("B");
                  if (cameraOnly.B) setMode("coverage");
                }}
              >
                Edit B
              </Button>
            </div>
            <p>Independent settings. Shared optical models.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setB({ ...a });
                setCombined((states) => ({ ...states, B: states.A }));
                setCameraOnly((states) => ({ ...states, B: states.A }));
                toast("Configuration A copied to B");
              }}
            >
              <Copy size={14} />
              Copy A <ArrowRight size={13} /> B
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setA({ ...DEFAULT });
                setB({ ...DEFAULT, focal: 50 });
                setEditing("A");
                setCombined({ A: false, B: false });
                setCameraOnly({ A: false, B: false });
              }}
            >
              Reset comparison
            </Button>
          </div>
        )}
        <div className="mobile-config-bar">
          <div>
            <strong>
              {active.sensor} · {active.focal} mm
            </strong>
            <span>
              {cameraOnly[editing]
                ? `${display(active.width)} × ${display(active.height)} mm · camera only`
                : `f/${active.aperture} · ${display(calculate(active).horizontal, 1)}° horizontal`}
            </span>
          </div>
          <Button
            variant={showSettings ? "default" : "outline"}
            aria-expanded={showSettings}
            aria-controls="configuration-panel"
            onClick={() => setShowSettings((v) => !v)}
          >
            <SlidersHorizontal size={16} />
            {showSettings ? "Done" : "Adjust settings"}
          </Button>
        </div>
        <div
          className={`lab-layout ${compare ? "comparing" : ""} ${showSettings ? "settings-open" : ""}`}
        >
          <div
            className="configuration-panel"
            id="configuration-panel"
            onPointerDownCapture={(e) => {
              if ((e.target as HTMLInputElement).type === "range")
                setDirect(true);
            }}
            onPointerUpCapture={() => setDirect(false)}
            onPointerCancelCapture={() => setDirect(false)}
            onKeyDownCapture={(e) => {
              if ((e.target as HTMLInputElement).type === "range")
                setDirect(true);
            }}
            onKeyUpCapture={() => setDirect(false)}
          >
            <Controls
              key={editing}
              name={editing}
              config={active}
              change={setActive}
              reset={() => {
                setActive({ ...DEFAULT });
                setCombined((states) => ({ ...states, [editing]: false }));
                setCameraOnly((states) => ({ ...states, [editing]: false }));
              }}
              combined={combined[editing]}
              cameraOnly={cameraOnly[editing]}
              changeCameraOnly={(only) => {
                setCameraOnly((states) => ({ ...states, [editing]: only }));
                setMode("coverage");
              }}
              combine={() => {
                const next = !combined[editing];
                setCombined((states) => ({ ...states, [editing]: next }));
                setCameraOnly((states) => ({ ...states, [editing]: !next }));
                setMode("coverage");
                toast(
                  next
                    ? `Configuration ${editing}: camera and lens combined.`
                    : `Configuration ${editing}: lens decoupled. Showing the camera sensor.`,
                );
              }}
            />
          </div>
          <div className="centre">
            <Card className="visualisation" id="laboratory">
              <div className="visual-header">
                <div>
                  <span className="eyebrow">THE OPTICAL WORKBENCH</span>
                  <h2>
                    {compare
                      ? "Compare configurations."
                      : "See the relationship."}
                  </h2>
                </div>
                <div className="workbench-actions">
                  <span className="live-label">
                    <span /> Live
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="fullscreen-button"
                    onClick={async () => {
                      try {
                        if (document.fullscreenElement)
                          await document.exitFullscreen();
                        else await workspace.current?.requestFullscreen();
                      } catch {
                        toast("Full screen is unavailable in this browser.");
                      }
                    }}
                  >
                    <Maximize size={15} />{" "}
                    {fullscreen ? "Exit full screen" : "Full screen"}
                  </Button>
                </div>
              </div>
              {!compare && (
                <details className="experiment-disclosure">
                  <summary>Examples</summary>
                  <div className="experiment-bar">
                    <span>Try an experiment</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setA({ ...DEFAULT, focal: 16, aperture: 4 });
                        setCombined((states) => ({ ...states, A: true }));
                        setCameraOnly((states) => ({ ...states, A: false }));
                        setMode("preview");
                        toast("Wide-angle lens: see more of the same scene.");
                      }}
                    >
                      Wider view
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setA({ ...DEFAULT, circle: 29 });
                        setCombined((states) => ({ ...states, A: true }));
                        setCameraOnly((states) => ({ ...states, A: false }));
                        setMode("coverage");
                        toast(
                          "Smaller image circle: inspect the uncovered sensor corners.",
                        );
                      }}
                    >
                      Sensor vs lens
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setA({
                          ...DEFAULT,
                          focal: 85,
                          aperture: 1.4,
                          focusM: 3,
                        });
                        setMode("dof");
                        setCombined((states) => ({ ...states, A: true }));
                        setCameraOnly((states) => ({ ...states, A: false }));
                        toast(
                          "Portrait example: see the smaller acceptable-sharpness region.",
                        );
                      }}
                    >
                      Shallow focus
                    </Button>
                  </div>
                </details>
              )}
              <div
                className="mode-tabs"
                role="tablist"
                aria-label="Visualisation modes"
              >
                {MODES.map((m, i) => {
                  const Icon = icons[m.id];
                  return (
                    <button
                      key={m.id}
                      id={`tab-${m.id}`}
                      role="tab"
                      aria-selected={mode === m.id}
                      disabled={cameraOnly[editing] && m.id !== "coverage"}
                      aria-controls="diagram-panel"
                      tabIndex={mode === m.id ? 0 : -1}
                      onClick={() => setMode(m.id)}
                      onKeyDown={(e) => {
                        if (cameraOnly[editing]) return;
                        const delta =
                          e.key === "ArrowRight"
                            ? 1
                            : e.key === "ArrowLeft"
                              ? -1
                              : 0;
                        const n =
                          e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? MODES.length - 1
                              : (i + delta + MODES.length) % MODES.length;
                        if (delta || e.key === "Home" || e.key === "End") {
                          e.preventDefault();
                          setMode(MODES[n].id);
                          document
                            .getElementById(`tab-${MODES[n].id}`)
                            ?.focus();
                        }
                      }}
                    >
                      <Icon size={15} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <div className="diagram-controls">
                {mode === "coverage" && (
                  <>
                    <span>Overlay formats</span>
                    {['1/2.3"', '1/1.8"', '1"', "APS-C", "Full Frame"].map(
                      (s) => (
                        <label className="overlay-check" key={s}>
                          <input
                            type="checkbox"
                            checked={overlays.includes(s)}
                            onChange={(e) =>
                              setOverlays((items) =>
                                e.target.checked
                                  ? [...items, s]
                                  : items.filter((x) => x !== s),
                              )
                            }
                          />
                          {s}
                        </label>
                      ),
                    )}
                  </>
                )}
                {mode === "aperture" && (
                  <>
                    <label htmlFor="blades">Iris blades</label>
                    <select
                      id="blades"
                      value={blades}
                      onChange={(e) => setBlades(Number(e.target.value))}
                    >
                      <option value="6">6 blades</option>
                      <option value="8">8 blades</option>
                    </select>
                    <span>Geometric light · equal transmission</span>
                  </>
                )}
                {mode === "rays" && (
                  <>
                    <label htmlFor="axis">Cross-section</label>
                    <select
                      id="axis"
                      value={axis}
                      onChange={(e) => setAxis(e.target.value as typeof axis)}
                    >
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical">Vertical</option>
                    </select>
                    <span>Nominal infinity-focus approximation</span>
                  </>
                )}
                {mode === "frustum" && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={wireframe}
                      onChange={(e) => setWireframe(e.target.checked)}
                    />{" "}
                    Wireframe only
                  </label>
                )}
                {mode === "preview" && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={reference}
                      onChange={(e) => setReference(e.target.checked)}
                    />{" "}
                    Show reference frame · full frame, 35 mm
                  </label>
                )}
                {mode === "distance" && (
                  <span>
                    Change target distance and object width in settings.
                  </span>
                )}
                {mode === "dof" && (
                  <span>
                    Open “Focus & depth of field” in lens settings to adjust
                    focus and blur criterion.
                  </span>
                )}
              </div>
              <div
                id="diagram-panel"
                role="tabpanel"
                aria-labelledby={`tab-${mode}`}
                className={`diagram-panel ${compare ? "split" : ""}`}
                ref={board}
                tabIndex={-1}
              >
                <div className="diagram-a">
                  {compare && (
                    <div className="config-caption">
                      <b>A</b>
                      {a.sensor} · {a.focal} mm · f/{a.aperture}
                    </div>
                  )}
                  {view(aa, "A")}
                </div>
                {compare && (
                  <div className="diagram-b">
                    <div className="config-caption">
                      <b>B</b>
                      {b.sensor} · {b.focal} mm · f/{b.aperture}
                    </div>
                    {view(bb, "B")}
                  </div>
                )}
              </div>
              <div className="diagram-footer">
                <span>
                  <span className="legend-dot" />
                  {mode === "coverage"
                    ? "Active sensor"
                    : "Current optical configuration"}
                </span>
                <span>
                  {mode === "coverage"
                    ? "Centred geometry · dimensions in mm"
                    : "Idealised educational model"}
                </span>
              </div>
              <div className="learning">
                <details className="view-explanation">
                  <summary>About this view</summary>
                  <h3>{info.title}</h3>
                  <p>{info.description}</p>
                  <details>
                    <summary>
                      How it works <span>Equations & assumptions</span>
                    </summary>
                    <p className="equation">{info.equation}</p>
                    <p>
                      Real lenses may have distortion, focus breathing,
                      transmission losses and nonuniform illumination. Nominal
                      FOV and geometric coverage do not measure actual image
                      quality. Pixel sampling is not a guarantee of resolved
                      detail.
                    </p>
                  </details>
                </details>
              </div>
            </Card>
            <Card className="export-card">
              <div>
                <ArrowDownToLine size={19} />
                <div>
                  <h3>Take your experiment with you.</h3>
                  <p>Export results or share a reproducible configuration.</p>
                </div>
              </div>
              <div className="export-actions">
                {compare && !cameraOnly.A && !cameraOnly.B && (
                  <details className="comparison-details">
                    <summary>Compare all results</summary>
                    <ComparisonTable a={a} b={b} />
                  </details>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cameraOnly.A || (compare && cameraOnly.B)}
                  onClick={() =>
                    copy(
                      toJson(exportResults(session)),
                      "Configuration and results copied",
                    )
                  }
                >
                  Copy details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cameraOnly.A || (compare && cameraOnly.B)}
                  onClick={() =>
                    download(
                      "optical-results.json",
                      toJson(exportResults(session)),
                      "application/json",
                    )
                  }
                >
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cameraOnly.A || (compare && cameraOnly.B)}
                  onClick={() =>
                    download("optical-results.csv", toCsv(session), "text/csv")
                  }
                >
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const svg = board.current?.querySelector("svg.optical-svg");
                    if (svg) downloadDiagram(svg as SVGSVGElement);
                    else
                      toast(
                        "SVG export is available in the sensor, ray, preview, scene and depth-of-field views.",
                      );
                  }}
                >
                  Diagram SVG
                </Button>
              </div>
            </Card>
            {copyFallback && (
              <Card className="clipboard-fallback">
                <label htmlFor="copy-value">Copy this text</label>
                <textarea
                  id="copy-value"
                  value={copyFallback}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <Button variant="ghost" onClick={() => setCopyFallback("")}>
                  Close
                </Button>
              </Card>
            )}
          </div>
          <ResultsPanel
            name={editing}
            config={active}
            cameraOnly={cameraOnly[editing]}
          />
        </div>
      </main>
      <footer className="app-footer">
        <span>
          <Aperture size={15} />
          Camera & Lens Optical Explorer
        </span>
        <span>Local calculations. No account. Just optics.</span>
        <a
          href="https://maninka123.github.io/Interactive-Camera-FOV-Simulator/#guide"
          target="_blank"
          rel="noreferrer"
        >
          Documentation <ExternalLink size={12} />
        </a>
      </footer>
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice && (
          <>
            <Check size={16} />
            {notice}
          </>
        )}
      </div>
    </>
  );
}
