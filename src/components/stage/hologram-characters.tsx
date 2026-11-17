"use client";

/**
 * Hologram session members — faceless, minimal anatomy, translucent bodies with a
 * controlled torso wireframe and one emissive chest band. Roles differ by pose,
 * instrument silhouette, Stage-palette hue and the projector-base pattern
 * (readable from the top view). All geometry is procedural (no external assets).
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines } from "@react-three/drei";
import { DoubleSide, type Group } from "three";
import { ROLE_STYLES, type PerformerRole, type RoleStyle } from "@/lib/stage";

interface Props {
  role: PerformerRole;
  selected: boolean;
  reducedMotion: boolean;
  seed: number;
}

function Limb({ position, rotation, length = 0.5, radius = 0.05, color, opacity }: { position: [number, number, number]; rotation: [number, number, number]; length?: number; radius?: number; color: string; opacity: number }) {
  return (
    <group position={position} rotation={rotation}>
      {/* pivot at the joint: shift the capsule down by half its length */}
      <mesh position={[0, -length / 2, 0]}>
        <capsuleGeometry args={[radius, length, 4, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ProjectorBase({ style }: { style: RoleStyle }) {
  const ring = (inner: number, outer: number, segments = 48, opacity = 0.8) => (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <ringGeometry args={[inner, outer, segments]} />
      <meshBasicMaterial color={style.color} transparent opacity={opacity} toneMapped={false} />
    </mesh>
  );
  switch (style.base) {
    case "pulse":
      return <>{ring(0.22, 0.24, 48, 0.5)}{ring(0.31, 0.33, 48, 0.7)}{ring(0.4, 0.42, 48, 0.9)}</>;
    case "ticks":
      return (
        <>
          {ring(0.36, 0.39)}
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, (i * Math.PI) / 4]} position={[0, 0.013, 0]}>
              <planeGeometry args={[0.025, 0.9]} />
              <meshBasicMaterial color={style.color} transparent opacity={0.35} toneMapped={false} />
            </mesh>
          ))}
        </>
      );
    case "double":
      return <>{ring(0.28, 0.31)}{ring(0.4, 0.43)}</>;
    case "hex":
      return <>{ring(0.36, 0.42, 6)}{ring(0.2, 0.22, 6, 0.5)}</>;
    case "square":
      return (
        <group position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[i === 1 ? 0.38 : i === 3 ? -0.38 : 0, i === 0 ? 0.38 : i === 2 ? -0.38 : 0, 0]}>
              <planeGeometry args={[0.78, 0.03]} />
              <meshBasicMaterial color={style.color} transparent opacity={0.85} toneMapped={false} />
            </mesh>
          ))}
        </group>
      );
  }
}

/** Instrument silhouette in the role's accent color (lines + flat body, low poly). */
function HeldInstrument({ role, style }: { role: PerformerRole; style: RoleStyle }) {
  const mat = <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.6} transparent opacity={0.85} toneMapped={false} />;
  if (role === "vocal") {
    return (
      <mesh position={[0.18, 1.42, 0.36]} rotation={[0.9, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.018, 0.16, 10]} />
        {mat}
      </mesh>
    );
  }
  if (role === "guitar" || role === "bass") {
    const neck = role === "bass" ? 0.85 : 0.6;
    return (
      <group position={[0, 0.98, 0.2]} rotation={[0, 0, role === "bass" ? -0.75 : -0.95]}>
        <mesh>
          <boxGeometry args={[0.26, 0.32, 0.04]} />
          {mat}
        </mesh>
        <mesh position={[0, 0.16 + neck / 2, 0]}>
          <boxGeometry args={[0.035, neck, 0.03]} />
          {mat}
        </mesh>
      </group>
    );
  }
  if (role === "drums") {
    return null; // sticks are part of the animated arms
  }
  return null; // keys: hands hover over the keyboard prop
}

export function HologramCharacter({ role, selected, reducedMotion, seed }: Props) {
  const style = ROLE_STYLES[role];
  const bob = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const opacity = selected ? 0.72 : 0.5;
  const seated = role === "drums";

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime() + seed;
    if (bob.current) bob.current.position.y = Math.sin(t * 1.6) * 0.025;
    if (seated && armL.current && armR.current) {
      armL.current.rotation.x = -1.0 + Math.max(0, Math.sin(t * 6)) * 0.35;
      armR.current.rotation.x = -1.0 + Math.max(0, Math.sin(t * 6 + Math.PI)) * 0.35;
    }
  });

  const torsoY = seated ? 0.95 : 1.15;
  const headY = seated ? 1.45 : 1.65;
  const shoulderY = torsoY + 0.2;

  // Arm poses per role: [left, right] rotations at the shoulder
  const arms: Record<PerformerRole, [[number, number, number], [number, number, number]]> = {
    vocal: [[0, 0, 0.15], [-1.25, 0, -0.15]],
    guitar: [[-0.9, 0, -0.5], [-0.6, 0, 0.4]],
    bass: [[-0.7, 0, -0.6], [-0.6, 0, 0.35]],
    drums: [[-1.0, 0, 0.25], [-1.0, 0, -0.25]],
    keys: [[-1.35, 0, 0.12], [-1.35, 0, -0.12]],
  };
  const [lRot, rRot] = arms[role];

  return (
    <group scale={style.scale}>
      <ProjectorBase style={style} />
      {/* faint light column */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 1.9, 24, 1, true]} />
        <meshBasicMaterial color={style.color} transparent opacity={selected ? 0.1 : 0.05} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>

      <group ref={bob}>
        {/* Legs */}
        {seated ? (
          <>
            <Limb position={[-0.1, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]} length={0.42} radius={0.065} color={style.color} opacity={opacity} />
            <Limb position={[0.1, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]} length={0.42} radius={0.065} color={style.color} opacity={opacity} />
            <Limb position={[-0.1, 0.55, 0.42]} rotation={[0, 0, 0]} length={0.48} radius={0.06} color={style.color} opacity={opacity} />
            <Limb position={[0.1, 0.55, 0.42]} rotation={[0, 0, 0]} length={0.48} radius={0.06} color={style.color} opacity={opacity} />
          </>
        ) : (
          <>
            <Limb position={[-0.1, 0.85, 0]} rotation={[0, 0, role === "guitar" || role === "bass" ? 0.08 : 0.03]} length={0.72} radius={0.07} color={style.color} opacity={opacity} />
            <Limb position={[0.1, 0.85, 0]} rotation={[0, 0, role === "guitar" || role === "bass" ? -0.08 : -0.03]} length={0.72} radius={0.07} color={style.color} opacity={opacity} />
          </>
        )}

        {/* Torso with controlled wireframe */}
        <mesh position={[0, torsoY, 0]}>
          <capsuleGeometry args={[0.17, 0.42, 6, 14]} />
          <meshStandardMaterial color={style.color} emissive={style.color} emissiveIntensity={0.35} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
          {selected && <Outlines thickness={0.02} color="#f2efe8" />}
        </mesh>
        <mesh position={[0, torsoY, 0]}>
          <capsuleGeometry args={[0.175, 0.42, 3, 8]} />
          <meshBasicMaterial color={style.color} wireframe transparent opacity={0.22} toneMapped={false} />
        </mesh>
        {/* Emissive chest band */}
        <mesh position={[0, torsoY + 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.012, 6, 32]} />
          <meshBasicMaterial color={style.accent} toneMapped={false} />
        </mesh>

        {/* Arms (pivot at shoulder) */}
        <group ref={armL} position={[-0.24, shoulderY, 0]} rotation={lRot}>
          <Limb position={[0, 0, 0]} rotation={[0, 0, 0]} length={0.5} color={style.color} opacity={opacity} />
          {seated && (
            <mesh position={[0, -0.62, 0.05]} rotation={[0.4, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.38, 6]} />
              <meshBasicMaterial color={style.accent} toneMapped={false} />
            </mesh>
          )}
        </group>
        <group ref={armR} position={[0.24, shoulderY, 0]} rotation={rRot}>
          <Limb position={[0, 0, 0]} rotation={[0, 0, 0]} length={0.5} color={style.color} opacity={opacity} />
          {seated && (
            <mesh position={[0, -0.62, 0.05]} rotation={[0.4, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.38, 6]} />
              <meshBasicMaterial color={style.accent} toneMapped={false} />
            </mesh>
          )}
        </group>

        {/* Faceless head */}
        <mesh position={[0, headY, 0]} scale={[1, 1.15, 1]}>
          <sphereGeometry args={[0.13, 20, 16]} />
          <meshStandardMaterial color={style.color} emissive={style.color} emissiveIntensity={0.5} transparent opacity={Math.min(0.9, opacity + 0.12)} depthWrite={false} toneMapped={false} />
          {selected && <Outlines thickness={0.02} color="#f2efe8" />}
        </mesh>

        <HeldInstrument role={role} style={style} />
      </group>
    </group>
  );
}
