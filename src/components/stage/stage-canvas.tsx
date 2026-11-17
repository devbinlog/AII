"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { Plane, Vector3 } from "three";
import {
  CAMERA_VIEWS,
  FOOTPRINT,
  ORBIT_LIMITS,
  STAGE_BOUNDS,
  clampTarget,
  isMovable,
  type CameraView,
  type StageItem,
  type StageLayout,
  type Vec3,
} from "@/lib/stage";
import { HOLOGRAM_BLUE, StageProp } from "./stage-objects";

interface ControlsLike {
  target: Vector3;
  enabled: boolean;
  update: () => void;
  addEventListener: (type: "change", fn: () => void) => void;
  removeEventListener: (type: "change", fn: () => void) => void;
}

export interface StageCanvasProps {
  layout: StageLayout;
  selectedId: string | null;
  /** Bumping `nonce` re-applies the view even if it did not change (Reset camera). */
  view: { name: CameraView; nonce: number };
  reducedMotion: boolean;
  onSelect: (id: string | null) => void;
  /** Live drag update (no history step). */
  onDrag: (id: string, position: Vec3) => void;
  onDragStart: (id: string) => void;
  onDragEnd: (id: string) => void;
  onCameraChange?: (camera: { position: Vec3; target: Vec3 }) => void;
}

const FLOOR = new Plane(new Vector3(0, 1, 0), 0);

/** Animates the camera to the requested view and keeps panning near the stage. */
function CameraRig({ view, reducedMotion, onCameraChange }: Pick<StageCanvasProps, "view" | "reducedMotion" | "onCameraChange">) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const goal = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;

  useEffect(() => {
    const v = CAMERA_VIEWS[view.name];
    const target = new Vector3(...v.target);
    const position = new Vector3(...v.position);
    // Narrow (phone) viewports see less horizontally: back the camera off so the whole stage fits.
    if (view.name !== "top") {
      const k = Math.max(1, 1.5 / aspectRef.current);
      position.sub(target).multiplyScalar(k).add(target);
    }
    goal.current = { position, target };
    if (reducedMotion && controls) {
      camera.position.copy(goal.current.position);
      controls.target.copy(goal.current.target);
      controls.update();
      goal.current = null;
    }
  }, [view, reducedMotion, camera, controls]);

  useEffect(() => {
    if (!controls) return;
    const report = () => {
      const t = clampTarget([controls.target.x, controls.target.y, controls.target.z]);
      if (t[0] !== controls.target.x || t[1] !== controls.target.y || t[2] !== controls.target.z) controls.target.set(...t);
      onCameraChange?.({
        position: [camera.position.x, camera.position.y, camera.position.z].map((n) => Math.round(n * 100) / 100) as Vec3,
        target: t.map((n) => Math.round(n * 100) / 100) as Vec3,
      });
    };
    controls.addEventListener("change", report);
    report();
    return () => controls.removeEventListener("change", report);
  }, [controls, camera, onCameraChange]);

  useFrame((_, delta) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.pow(0.0005, delta); // frame-rate independent ease
    camera.position.lerp(g.position, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.position) < 0.01 && controls.target.distanceTo(g.target) < 0.01) {
      camera.position.copy(g.position);
      controls.target.copy(g.target);
      controls.update();
      goal.current = null;
    }
  });
  return null;
}

function StagePlatform() {
  const w = STAGE_BOUNDS.halfWidth * 2;
  const d = STAGE_BOUNDS.halfDepth * 2;
  return (
    <group>
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[w + 0.4, 0.5, d + 0.4]} />
        <meshStandardMaterial color="#141414" roughness={0.9} />
      </mesh>
      <Grid
        position={[0, 0.002, 0]}
        args={[w, d]}
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#2a2a2a"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#3d3d3d"
        fadeDistance={60}
      />
      {/* Stage edge: the movement boundary */}
      {(
        [
          [0, STAGE_BOUNDS.halfDepth, w, 0.04],
          [0, -STAGE_BOUNDS.halfDepth, w, 0.04],
          [STAGE_BOUNDS.halfWidth, 0, 0.04, d],
          [-STAGE_BOUNDS.halfWidth, 0, 0.04, d],
        ] as const
      ).map(([x, z, sw, sd], i) => (
        <mesh key={i} position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[sw, sd]} />
          <meshBasicMaterial color="#e8192c" transparent opacity={0.7} />
        </mesh>
      ))}
      {/* Audience marker (downstage) */}
      <mesh position={[0, 0.006, STAGE_BOUNDS.halfDepth + 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.6, 0.06]} />
        <meshBasicMaterial color="#5c5c5c" />
      </mesh>
    </group>
  );
}

function DraggableItem({
  item,
  selected,
  reducedMotion,
  seed,
  onSelect,
  onDrag,
  onDragStart,
  onDragEnd,
}: {
  item: StageItem;
  selected: boolean;
  reducedMotion: boolean;
  seed: number;
} & Pick<StageCanvasProps, "onSelect" | "onDrag" | "onDragStart" | "onDragEnd">) {
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const gl = useThree((s) => s.gl);
  const drag = useRef<{ offset: Vector3; pointerId: number; moving: boolean } | null>(null);
  const hit = useMemo(() => new Vector3(), []);
  const movable = isMovable(item);

  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(item.id);
    // Pressing any stage item never orbits the camera; only movable items drag.
    const onFloor = e.ray.intersectPlane(FLOOR, hit);
    const moving = movable && onFloor !== null;
    drag.current = { offset: moving ? new Vector3(item.position[0] - hit.x, 0, item.position[2] - hit.z) : new Vector3(), pointerId: e.pointerId, moving };
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    if (controls) controls.enabled = false;
    if (moving) {
      gl.domElement.style.cursor = "grabbing";
      onDragStart(item.id);
    }
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || !d.moving || e.pointerId !== d.pointerId || !e.ray.intersectPlane(FLOOR, hit)) return;
    e.stopPropagation();
    onDrag(item.id, [hit.x + d.offset.x, 0, hit.z + d.offset.z]);
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    e.stopPropagation();
    drag.current = null;
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    if (controls) controls.enabled = true;
    gl.domElement.style.cursor = "";
    if (d.moving) onDragEnd(item.id);
  };

  const r = FOOTPRINT[item.kind];
  return (
    <group position={item.position} rotation={[0, item.rotationY, 0]}>
      <StageProp kind={item.kind} reducedMotion={reducedMotion} highlighted={selected} seed={seed} />
      {/* Generous invisible hit target (bigger than the mark) */}
      <mesh
        position={[0, 0.9, 0]}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={(e) => {
          e.stopPropagation();
          gl.domElement.style.cursor = movable ? "grab" : "not-allowed";
        }}
        onPointerOut={() => {
          if (!drag.current) gl.domElement.style.cursor = "";
        }}
        userData={{ stageItemId: item.id }}
      >
        <cylinderGeometry args={[Math.max(r, 0.35), Math.max(r, 0.35), 1.9, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[r + 0.08, r + 0.14, 48]} />
          <meshBasicMaterial color={movable ? "#f5f5f0" : "#e8192c"} />
        </mesh>
      )}
    </group>
  );
}

export function StageCanvas(props: StageCanvasProps) {
  const { layout, selectedId, view, reducedMotion, onSelect, onCameraChange } = props;
  const initial = CAMERA_VIEWS[view.name];
  return (
    <Canvas
      camera={{ position: initial.position, fov: 45, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
      style={{ touchAction: "none" }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#0a0a0a"]} />
      <fog attach="fog" args={["#0a0a0a", 25, 60]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 6]} intensity={1.1} />
      <spotLight position={[0, 9, 6]} angle={0.6} penumbra={0.6} intensity={18} color={HOLOGRAM_BLUE} />
      <StagePlatform />
      {layout.items.map((item, i) => (
        <DraggableItem
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          reducedMotion={reducedMotion}
          seed={i * 1.37}
          onSelect={props.onSelect}
          onDrag={props.onDrag}
          onDragStart={props.onDragStart}
          onDragEnd={props.onDragEnd}
        />
      ))}
      <OrbitControls
        makeDefault
        target={initial.target}
        enablePan
        enableZoom
        enableDamping={!reducedMotion}
        minDistance={ORBIT_LIMITS.minDistance}
        maxDistance={ORBIT_LIMITS.maxDistance}
        maxPolarAngle={ORBIT_LIMITS.maxPolarAngle}
        screenSpacePanning={false}
      />
      <CameraRig view={view} reducedMotion={reducedMotion} {...(onCameraChange ? { onCameraChange } : {})} />
    </Canvas>
  );
}
