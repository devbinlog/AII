"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
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
  performerRole,
  ROLE_STYLES,
  placeLabels,
  type CameraView,
  type LabelInput,
  type StageItem,
  type Vec3,
} from "@/lib/stage";
import { STAGE_LIGHT_BLUE, StageProp } from "./stage-objects";

interface ControlsLike {
  target: Vector3;
  enabled: boolean;
  update: () => void;
  addEventListener: (type: "change", fn: () => void) => void;
  removeEventListener: (type: "change", fn: () => void) => void;
}

interface StageCanvasCommon {
  /** Items to render (a draft layout in the editor, a published snapshot in the viewer). */
  items: StageItem[];
  selectedId: string | null;
  /** Bumping `nonce` re-applies the view even if it did not change (Reset camera). */
  view: { name: CameraView; nonce: number };
  reducedMotion: boolean;
  onSelect: (id: string | null) => void;
  onCameraChange?: (camera: { position: Vec3; target: Vec3 }) => void;
  /** Floating name tags over members (and the selected item). */
  showLabels?: boolean;
}

interface EditHandlers {
  /** Live drag update (no history step). */
  onDrag: (id: string, position: Vec3) => void;
  onDragStart: (id: string) => void;
  onDragEnd: (id: string) => void;
}

/**
 * "edit": object dragging (Studio editor). "view": camera controls + selection only
 * (public viewer) — no drag handlers are attached at all.
 */
export type StageCanvasProps = StageCanvasCommon & ({ mode: "edit" } & EditHandlers | { mode: "view" });

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
        <meshStandardMaterial color="#0d1c2c" roughness={0.9} />
      </mesh>
      <Grid
        position={[0, 0.002, 0]}
        args={[w, d]}
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#173049"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#26496c"
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
          <meshBasicMaterial color="#e44942" transparent opacity={0.75} />
        </mesh>
      ))}
      {/* Audience marker (downstage) */}
      <mesh position={[0, 0.006, STAGE_BOUNDS.halfDepth + 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.6, 0.06]} />
        <meshBasicMaterial color="#2b4058" />
      </mesh>
      {/* Center axis marker: X (stage width) in Stone, Z (toward audience) in Cyan */}
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 0.02]} />
        <meshBasicMaterial color="#a7a5a0" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.008, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.02, 0.6]} />
        <meshBasicMaterial color="#38d9f2" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.07, 0.09, 24]} />
        <meshBasicMaterial color="#f2efe8" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

/** Dashed Signal-red ring marking items that can never move (amps, drums). */
function LockedMarker({ radius }: { radius: number }) {
  return (
    <group position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i}>
          <ringGeometry args={[radius + 0.04, radius + 0.08, 6, 1, (i * Math.PI) / 6, Math.PI / 12]} />
          <meshBasicMaterial color="#e44942" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

type LabelRefs = MutableRefObject<Map<string, HTMLSpanElement>>;

/**
 * Projects label anchors to screen space every frame and positions DOM tags in an
 * overlay outside the canvas (no per-label React roots). Overlapping tags are
 * resolved in screen space by `placeLabels` — selected first, then nearest — so
 * stage objects themselves never move. DOM is only written when a tag changes.
 */
function LabelProjector({ items, selectedId, labelRefs }: { items: StageItem[]; selectedId: string | null; labelRefs: LabelRefs }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new Vector3(), []);
  const sizes = useRef(new Map<string, { w: number; h: number }>());
  useFrame(() => {
    const inputs: LabelInput[] = [];
    for (const item of items) {
      const el = labelRefs.current.get(item.id);
      if (!el) continue;
      v.set(item.position[0], item.kind === "performer" ? 2.15 : 1.4, item.position[2]).project(camera);
      if (!(v.z < 1 && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05)) continue;
      let m = sizes.current.get(item.id);
      if (!m || m.w === 0) {
        m = { w: el.offsetWidth, h: el.offsetHeight };
        sizes.current.set(item.id, m);
      }
      inputs.push({ id: item.id, x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, depth: v.z, width: m.w, height: m.h, selected: item.id === selectedId });
    }
    const placed = new Map(placeLabels(inputs, size).map((p) => [p.id, p]));
    for (const item of items) {
      const el = labelRefs.current.get(item.id);
      if (!el) continue;
      const p = placed.get(item.id);
      const state = p ? p.state : "offscreen";
      const key = p && state !== "hidden" ? `${state}|${Math.round(p.x)}|${Math.round(p.y)}` : state;
      // Key lives on the element, so a remounted tag is always re-positioned.
      if (el.dataset.labelKey === key) continue;
      el.dataset.labelKey = key;
      el.dataset.labelState = state;
      if (!p || state === "hidden") {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";
      el.style.transform = `translate(-50%, -50%) translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    }
  });
  return null;
}

function labelColor(item: StageItem): string {
  const role = performerRole(item);
  return role ? ROLE_STYLES[role].color : isMovable(item) ? "#a7a5a0" : "#e44942";
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
} & Pick<StageCanvasCommon, "onSelect"> & EditHandlers) {
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
      <StageProp item={item} reducedMotion={reducedMotion} highlighted={selected} seed={seed} />
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
      {!movable && <LockedMarker radius={r} />}
      {selected && item.kind !== "performer" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[r + 0.1, r + 0.15, 48]} />
          <meshBasicMaterial color="#f2efe8" />
        </mesh>
      )}
    </group>
  );
}

/** Read-only item: click/tap selects for the info panel; never moves. */
function ViewItem({ item, selected, reducedMotion, seed, onSelect }: { item: StageItem; selected: boolean; reducedMotion: boolean; seed: number; onSelect: (id: string) => void }) {
  const gl = useThree((s) => s.gl);
  const r = FOOTPRINT[item.kind];
  return (
    <group position={item.position} rotation={[0, item.rotationY, 0]}>
      <StageProp item={item} reducedMotion={reducedMotion} highlighted={selected} seed={seed} />
      <mesh
        position={[0, 0.9, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(item.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          gl.domElement.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          gl.domElement.style.cursor = "";
        }}
      >
        <cylinderGeometry args={[Math.max(r, 0.35), Math.max(r, 0.35), 1.9, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selected && item.kind !== "performer" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[r + 0.1, r + 0.15, 48]} />
          <meshBasicMaterial color="#f2efe8" />
        </mesh>
      )}
    </group>
  );
}

export function StageCanvas(props: StageCanvasProps) {
  const { items, selectedId, view, reducedMotion, onSelect, onCameraChange, showLabels = false } = props;
  const initial = CAMERA_VIEWS[view.name];
  const labelRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const labelled = items.filter((i) => i.id === selectedId || (showLabels && i.kind === "performer"));
  return (
    <div className="absolute inset-0">
    <Canvas
      camera={{ position: initial.position, fov: 45, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
      style={{ touchAction: "none" }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#08131f"]} />
      <fog attach="fog" args={["#08131f", 25, 60]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 6]} intensity={1.1} />
      <spotLight position={[0, 9, 6]} angle={0.6} penumbra={0.6} intensity={18} color={STAGE_LIGHT_BLUE} />
      <StagePlatform />
      {items.map((item, i) =>
        props.mode === "edit" ? (
          <DraggableItem
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            reducedMotion={reducedMotion}
            seed={i * 1.37}
            onSelect={onSelect}
            onDrag={props.onDrag}
            onDragStart={props.onDragStart}
            onDragEnd={props.onDragEnd}
          />
        ) : (
          <ViewItem key={item.id} item={item} selected={item.id === selectedId} reducedMotion={reducedMotion} seed={i * 1.37} onSelect={onSelect} />
        )
      )}
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
      <LabelProjector items={labelled} selectedId={selectedId} labelRefs={labelRefs} />
    </Canvas>
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {labelled.map((item) => (
        <span
          key={item.id}
          data-label-id={item.id}
          ref={(el) => {
            if (el) labelRefs.current.set(item.id, el);
            else labelRefs.current.delete(item.id);
          }}
          className="absolute left-0 top-0 whitespace-nowrap px-1.5 py-0.5 text-[11px] font-mono uppercase tracking-wider text-[#f2efe8]"
          style={{ background: "rgba(8,19,31,0.86)", border: `1px solid ${labelColor(item)}`, visibility: "hidden", zIndex: item.id === selectedId ? 1 : 0 }}
        >
          {item.label}
          {!isMovable(item) ? " · locked" : ""}
        </span>
      ))}
    </div>
    </div>
  );
}
