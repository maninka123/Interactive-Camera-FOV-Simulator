import { useEffect, useRef, useState } from "react";
import {
  AxesHelper,
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { calculate, display, type Configuration } from "../lib/optics";
import { RayDiagram } from "./Diagrams";
import { Button } from "./ui/button";

type Point = [number, number, number];
type Label = {
  element: HTMLSpanElement;
  point: Vector3;
  leader: SVGLineElement;
};
type Runtime = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  objects: Group;
  labels: Label[];
  labelRoot: HTMLDivElement;
  draw: () => void;
};
function disposeObjects(group: Group) {
  group.traverse((object) => {
    if (object instanceof Mesh || object instanceof Line) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
  group.clear();
}
export default function Frustum({
  config: c,
  wireframe,
  theme,
}: {
  config: Configuration;
  wireframe: boolean;
  theme: "light" | "dark";
}) {
  const canvasRoot = useRef<HTMLDivElement>(null),
    labelRoot = useRef<HTMLDivElement>(null),
    runtime = useRef<Runtime | null>(null);
  const [flat, setFlat] = useState(false),
    [failed, setFailed] = useState(false),
    [reset, setReset] = useState(0),
    [showDof, setShowDof] = useState(false);
  const r = calculate(c);
  useEffect(() => {
    if (flat || failed || !canvasRoot.current || !labelRoot.current) return;
    const root = canvasRoot.current;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive camera field of view",
    );
    renderer.domElement.setAttribute("role", "img");
    root.prepend(renderer.domElement);
    const scene = new Scene(),
      camera = new PerspectiveCamera(42, 1, 0.01, 100);
    camera.position.set(7, 5, -6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 1.8);
    controls.minDistance = 0.3;
    controls.maxDistance = 35;
    controls.update();
    const objects = new Group();
    scene.add(objects);
    const labels: Label[] = [];
    const draw = () => {
      renderer.render(scene, camera);
      const { width, height } = root.getBoundingClientRect();
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      labels.forEach(({ element, point, leader }) => {
        const projected = point.clone().project(camera);
        element.hidden =
          projected.z < -1 ||
          projected.z > 1 ||
          Math.abs(projected.x) > 1.2 ||
          Math.abs(projected.y) > 1.2;
        leader.style.display = element.hidden ? "none" : "";
        if (element.hidden) return;
        const anchorX = ((projected.x + 1) * width) / 2,
          anchorY = ((1 - projected.y) * height) / 2,
          w = element.offsetWidth,
          h = element.offsetHeight;
        const candidates = [0, -32, 32, -64, 64, -96, 96, -128, 128]
          .flatMap((dy) => [0, -100, 100].map((dx) => ({
            x: Math.max(w / 2 + 6, Math.min(width - w / 2 - 6, anchorX + dx)),
            y: Math.max(h / 2 + 6, Math.min(height - h / 2 - 6, anchorY + dy)),
          })))
          .sort((a, b) =>
            Math.hypot(a.x - anchorX, a.y - anchorY) -
            Math.hypot(b.x - anchorX, b.y - anchorY));
        const position = candidates.find(({ x, y }) => placed.every((p) =>
          Math.abs(x - p.x) > (w + p.w) / 2 + 5 ||
          Math.abs(y - p.y) > (h + p.h) / 2 + 5)) ?? candidates[0];
        placed.push({ ...position, w, h });
        element.style.left = `${position.x}px`;
        element.style.top = `${position.y}px`;
        leader.setAttribute("x1", String(anchorX));
        leader.setAttribute("y1", String(anchorY));
        leader.setAttribute("x2", String(position.x));
        leader.setAttribute("y2", String(position.y));
      });
    };
    const observer = new ResizeObserver(() => {
      const width = root.clientWidth,
        height = root.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      draw();
    });
    observer.observe(root);
    controls.addEventListener("change", draw);
    runtime.current = {
      renderer,
      scene,
      camera,
      controls,
      objects,
      labels,
      labelRoot: labelRoot.current,
      draw,
    };
    const lost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      observer.disconnect();
      controls.removeEventListener("change", draw);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposeObjects(objects);
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, [flat, failed]);
  useEffect(() => {
    const state = runtime.current;
    if (!state) return;
    const { objects, labels, labelRoot: root } = state;
    disposeObjects(objects);
    labels.length = 0;
    root.replaceChildren();
    const leaders = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    leaders.classList.add("scene-leaders");
    leaders.setAttribute("aria-hidden", "true");
    root.append(leaders);
    state.scene.background = new Color(
      theme === "dark" ? "#121e2e" : "#f8fafd",
    );
    const maxDistance = Math.max(
      c.distanceM,
      showDof
        ? Math.min(
            Number.isFinite(r.dof.farM) ? r.dof.farM : c.focusM * 2,
            c.focusM * 4,
          )
        : 0,
    );
    const unit =
      5 /
      Math.max(
        maxDistance,
        (maxDistance * c.width) / c.focal,
        (maxDistance * c.height) / c.focal,
      );
    const d = c.distanceM * unit,
      w = (r.sceneWidthM * unit) / 2,
      h = (r.sceneHeightM * unit) / 2;
    const corners: Point[] = [
      [-w, h, d],
      [w, h, d],
      [w, -h, d],
      [-w, -h, d],
    ];
    const line = (points: Point[], color: string, loop = false) => {
      const geometry = new BufferGeometry().setFromPoints(
        points.map((p) => new Vector3(...p)),
      );
      const material = new LineBasicMaterial({ color });
      const object = loop
        ? new LineLoop(geometry, material)
        : new Line(geometry, material);
      objects.add(object);
    };
    const label = (text: string, point: Point, kind = "dimension") => {
      const element = document.createElement("span");
      element.className = `scene-label ${kind}`;
      element.textContent = text;
      root.append(element);
      const leader = document.createElementNS("http://www.w3.org/2000/svg", "line");
      leaders.append(leader);
      labels.push({ element, point: new Vector3(...point), leader });
    };
    const plane = (distance: number, color: string) => {
      const z = distance * unit,
        pw = ((distance * c.width) / c.focal) * unit,
        ph = ((distance * c.height) / c.focal) * unit;
      const mesh = new Mesh(
        new PlaneGeometry(pw, ph),
        new MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.12,
          side: DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.position.z = z;
      objects.add(mesh);
      line(
        [
          [-pw / 2, ph / 2, z],
          [pw / 2, ph / 2, z],
          [pw / 2, -ph / 2, z],
          [-pw / 2, -ph / 2, z],
        ],
        color,
        true,
      );
    };
    const grid = new GridHelper(
      12,
      24,
      theme === "dark" ? "#37516c" : "#b7c9dc",
      theme === "dark" ? "#25394e" : "#dce6ee",
    );
    grid.position.set(0, -Math.max(h, 0.8), 3);
    objects.add(grid);
    const body = new Mesh(
      new BoxGeometry(0.55, 0.4, 0.35),
      new MeshBasicMaterial({ color: "#46637e" }),
    );
    body.position.z = -0.28;
    objects.add(body);
    if (!wireframe) {
      const geometry = new BufferGeometry();
      const vertices: number[] = [];
      corners.forEach((p, i) =>
        vertices.push(0, 0, 0, ...p, ...corners[(i + 1) % 4]),
      );
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(vertices, 3),
      );
      objects.add(
        new Mesh(
          geometry,
          new MeshBasicMaterial({
            color: "#2587df",
            transparent: true,
            opacity: 0.13,
            side: DoubleSide,
            depthWrite: false,
          }),
        ),
      );
    }
    corners.forEach((p) => line([[0, 0, 0], p], "#3582cc"));
    plane(c.distanceM, "#278ce5");
    line(
      [
        [0, 0, 0],
        [0, 0, d],
      ],
      "#7999b7",
    );
    objects.add(new AxesHelper(0.9));
    line(
      [
        [-w, -h - 0.15, d],
        [w, -h - 0.15, d],
      ],
      "#7999b7",
    );
    line(
      [
        [w + 0.15, -h, d],
        [w + 0.15, h, d],
      ],
      "#7999b7",
    );
    label(`${display(r.sceneWidthM)} m wide`, [0, -h - 0.3, d]);
    label(`${display(r.sceneHeightM)} m high`, [w + 0.4, 0, d]);
    label(`${display(c.distanceM)} m distance`, [0.25, 0.15, d / 2]);
    label("+Z forward", [0, 0.15, 0.8], "axis");
    if (showDof) {
      plane(r.dof.nearM, "#1da789");
      label(
        `Near ${display(r.dof.nearM)} m`,
        [
          (((-r.dof.nearM * c.width) / c.focal) * unit) / 2,
          0.2,
          r.dof.nearM * unit,
        ],
        "near",
      );
      if (Number.isFinite(r.dof.farM) && r.dof.farM <= maxDistance) {
        plane(r.dof.farM, "#ba8457");
        label(
          `Far ${display(r.dof.farM)} m`,
          [
            (((r.dof.farM * c.width) / c.focal) * unit) / 2,
            0.2,
            r.dof.farM * unit,
          ],
          "far",
        );
      } else {
        line(
          [
            [0, 0, d],
            [0, 0, maxDistance * unit],
          ],
          "#ba8457",
        );
        label(
          Number.isFinite(r.dof.farM)
            ? `Far \u2192 ${display(r.dof.farM)} m beyond view`
            : "Far \u2192 \u221e",
          [0, 0.3, maxDistance * unit],
          "far",
        );
      }
    }
    state.draw();
  }, [c, wireframe, theme, showDof, flat, failed]);
  useEffect(() => {
    const state = runtime.current;
    if (!state) return;
    state.camera.position.set(7, 5, -6);
    state.controls.target.set(0, 0, 1.8);
    state.controls.update();
    state.draw();
  }, [reset]);
  return (
    <div className="frustum-view">
      <div className="view-tools">
        <span>
          {display(r.horizontal, 1)}° H · {display(r.vertical, 1)}° V ·{" "}
          {display(r.diagonal, 1)}° D
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReset((n) => n + 1)}
        >
          Reset view
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setFlat((v) => !v)}>
          {flat ? "Use 3D view" : "Use 2D alternative"}
        </Button>
      </div>
      <label className="check-label dof-plane-toggle">
        <input
          type="checkbox"
          checked={showDof}
          onChange={(e) => setShowDof(e.target.checked)}
        />
        Show depth-of-field planes
      </label>
      {flat || failed ? (
        <div>
          {failed && (
            <p className="diagram-note">
              3D unavailable. Showing the equivalent 2D geometry.
            </p>
          )}
          <RayDiagram config={c} axis="horizontal" />
        </div>
      ) : (
        <div
          className="canvas-wrap"
          ref={canvasRoot}
          role="group"
          aria-label={`3D frustum: ${display(r.sceneWidthM)} by ${display(r.sceneHeightM)} m at ${display(c.distanceM)} m`}
        >
          <div className="scene-labels" ref={labelRoot} />
        </div>
      )}
      <p className="diagram-note">
        Drag to orbit · scroll to zoom · right-drag to pan. Right-handed axes:
        looking forward (+Z), +X points left and +Y up.
      </p>
    </div>
  );
}
