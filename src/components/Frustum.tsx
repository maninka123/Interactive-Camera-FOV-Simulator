import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";
import { calculate, display, type Configuration } from "../lib/optics";
import { RayDiagram } from "./Diagrams";
import { Button } from "./ui/button";

type Point = [number, number, number];
function Scene({
  config: c,
  wireframe,
  reset,
}: {
  config: Configuration;
  wireframe: boolean;
  reset: number;
}) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.position.set(7, 5, -6);
    camera.lookAt(0, 0, 1.8);
  }, [camera, reset]);
  const r = calculate(c);
  const unit = 5 / Math.max(c.distanceM, r.sceneWidthM, r.sceneHeightM);
  const w = (r.sceneWidthM * unit) / 2,
    h = (r.sceneHeightM * unit) / 2,
    d = c.distanceM * unit;
  const corners: Point[] = [
    [-w, h, d],
    [w, h, d],
    [w, -h, d],
    [-w, -h, d],
  ];
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const points: number[] = [];
    const vertices = [
      [-w, h, d],
      [w, h, d],
      [w, -h, d],
      [-w, -h, d],
    ];
    for (let i = 0; i < 4; i++)
      points.push(0, 0, 0, ...vertices[i], ...vertices[(i + 1) % 4]);
    g.setAttribute("position", new Float32BufferAttribute(points, 3));
    g.computeVertexNormals();
    return g;
  }, [w, h, d]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 8, -3]} intensity={2} />
      <gridHelper
        args={[12, 24, "#b7c9dc", "#dce6ee"]}
        position={[0, -Math.max(h, 0.8), 3]}
      />
      <mesh position={[0, 0, -0.28]}>
        <boxGeometry args={[0.55, 0.4, 0.35]} />
        <meshStandardMaterial color="#364c66" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.06]}>
        <cylinderGeometry args={[0.13, 0.16, 0.3, 24]} />
        <meshStandardMaterial color="#5c83ae" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.04]} />
        <meshBasicMaterial color="#10a3c4" />
      </mesh>
      {!wireframe && (
        <mesh geometry={geometry}>
          <meshBasicMaterial
            color="#2587df"
            opacity={0.13}
            transparent
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {corners.map((p, i) => (
        <Line key={i} points={[[0, 0, 0], p]} color="#3582cc" lineWidth={1.5} />
      ))}
      <Line points={[...corners, corners[0]]} color="#1469e8" lineWidth={2} />
      <mesh position={[0, 0, d]}>
        <planeGeometry args={[2 * w, 2 * h]} />
        <meshBasicMaterial
          color="#62b7ed"
          opacity={0.14}
          transparent
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Line
        points={[
          [0, 0, 0],
          [0, 0, d],
        ]}
        color="#7b96b4"
        dashed
        dashSize={0.08}
        gapSize={0.07}
      />
      <axesHelper args={[0.9]} />
      <OrbitControls
        key={reset}
        makeDefault
        target={[0, 0, 1.8]}
        minDistance={0.3}
        maxDistance={35}
      />
    </>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Frustum({
  config,
  wireframe,
}: {
  config: Configuration;
  wireframe: boolean;
}) {
  const [reset, setReset] = useState(0),
    [flat, setFlat] = useState(false);
  const r = calculate(config);
  const fallback = (
    <div>
      <p className="diagram-note">
        3D unavailable here. The 2D alternative shows the same optical geometry.
      </p>
      <RayDiagram config={config} axis="horizontal" />
    </div>
  );
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
          onClick={() => setReset((v) => v + 1)}
        >
          Reset view
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setFlat((v) => !v)}>
          {flat ? "Use 3D view" : "Use 2D alternative"}
        </Button>
      </div>
      {flat ? (
        <RayDiagram config={config} axis="horizontal" />
      ) : (
        <SceneBoundary fallback={fallback}>
          <div
            className="canvas-wrap"
            role="img"
            aria-label={`3D frustum: ${display(r.sceneWidthM)} by ${display(r.sceneHeightM)} m at ${display(config.distanceM)} m`}
          >
            <Canvas
              camera={{ position: [7, 5, -6], fov: 42 }}
              dpr={[1, 1.5]}
              fallback={fallback}
              gl={{ antialias: true }}
            >
              <color attach="background" args={["#f8fafd"]} />
              <Scene config={config} wireframe={wireframe} reset={reset} />
            </Canvas>
          </div>
        </SceneBoundary>
      )}
      <p className="diagram-note">
        Target: {display(r.sceneWidthM)} × {display(r.sceneHeightM)} m at{" "}
        {display(config.distanceM)} m · drag to orbit · scroll to zoom ·
        right-drag to pan
      </p>
    </div>
  );
}
