"use client";

// Procedural stage props. No external models or textures are loaded.
import { performerRole, type StageItem } from "@/lib/stage";
import { HologramCharacter } from "./hologram-characters";

/** Stage-palette light color used for scene lighting. */
export const STAGE_LIGHT_BLUE = "#367cfa";

function Guitar({ long }: { long?: boolean }) {
  const neck = long ? 0.85 : 0.65;
  return (
    <group position={[0, 0.55, 0]} rotation={[0, 0, -0.35]}>
      <mesh>
        <boxGeometry args={[0.32, 0.4, 0.06]} />
        <meshStandardMaterial color={long ? "#3b2a1a" : "#8a1520"} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.2 + neck / 2, 0]}>
        <boxGeometry args={[0.05, neck, 0.04]} />
        <meshStandardMaterial color="#2a1d12" />
      </mesh>
      {/* Stand */}
      <mesh position={[0.15, -0.35, 0]} rotation={[0, 0, 0.35]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5]} />
        <meshStandardMaterial color="#555" metalness={0.6} />
      </mesh>
    </group>
  );
}

function Keyboard() {
  return (
    <group>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[1.2, 0.08, 0.35]} />
        <meshStandardMaterial color="#151515" />
      </mesh>
      <mesh position={[0, 0.9, 0.06]}>
        <boxGeometry args={[1.1, 0.02, 0.18]} />
        <meshStandardMaterial color="#eeeeea" />
      </mesh>
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.42, 0]} rotation={[0, 0, x > 0 ? 0.25 : -0.25]}>
          <boxGeometry args={[0.04, 0.85, 0.04]} />
          <meshStandardMaterial color="#555" metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Mic() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.03, 20]} />
        <meshStandardMaterial color="#222" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.5]} />
        <meshStandardMaterial color="#888" metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.52, 0.04]}>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Amplifier() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.8, 0.9, 0.45]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.4, 0.226]}>
        <planeGeometry args={[0.7, 0.6]} />
        <meshStandardMaterial color="#2c2c2c" roughness={1} />
      </mesh>
      <mesh position={[0, 0.8, 0.226]}>
        <planeGeometry args={[0.7, 0.1]} />
        <meshStandardMaterial color="#c9a227" metalness={0.6} />
      </mesh>
    </group>
  );
}

function Drums() {
  const shell = "#7a0d17";
  return (
    <group>
      {/* Riser */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.1, 0.2, 1.8]} />
        <meshStandardMaterial color="#202020" />
      </mesh>
      {/* Kick */}
      <mesh position={[0, 0.5, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.4, 28]} />
        <meshStandardMaterial color={shell} />
      </mesh>
      {/* Snare, toms */}
      {([[-0.45, 0.75, 0.35, 0.18], [0.45, 0.62, 0.1, 0.22], [-0.2, 0.95, 0.05, 0.14], [0.2, 0.95, 0.05, 0.14]] as const).map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <cylinderGeometry args={[r, r, 0.16, 24]} />
          <meshStandardMaterial color={i === 0 ? "#cccccc" : shell} metalness={i === 0 ? 0.5 : 0} />
        </mesh>
      ))}
      {/* Cymbals */}
      {([[-0.75, 1.25, -0.1], [0.75, 1.35, -0.2]] as const).map(([x, y, z], i) => (
        <group key={i}>
          <mesh position={[x, y, z]} rotation={[0.15, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.01, 32]} />
            <meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[x, y / 2 + 0.1, z]}>
            <cylinderGeometry args={[0.012, 0.012, y - 0.2]} />
            <meshStandardMaterial color="#888" metalness={0.7} />
          </mesh>
        </group>
      ))}
      {/* Throne */}
      <mesh position={[0, 0.45, -0.55]}>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 20]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

export function StageProp({ item, reducedMotion, highlighted, seed }: { item: Pick<StageItem, "id" | "kind" | "label">; reducedMotion: boolean; highlighted: boolean; seed: number }) {
  switch (item.kind) {
    case "performer":
      return <HologramCharacter role={performerRole(item) ?? "vocal"} selected={highlighted} reducedMotion={reducedMotion} seed={seed} />;
    case "guitar":
      return <Guitar />;
    case "bass":
      return <Guitar long />;
    case "keyboard":
      return <Keyboard />;
    case "mic":
      return <Mic />;
    case "amplifier":
      return <Amplifier />;
    case "drums":
      return <Drums />;
  }
}
