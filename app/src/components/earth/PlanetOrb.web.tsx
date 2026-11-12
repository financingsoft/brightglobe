import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Stars() {
  const geometry = useMemo(() => {
    const count = 95;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = i * 2.399963;
      positions[i * 3] = Math.cos(angle) * radius * 4.3;
      positions[i * 3 + 1] = y * 4.3;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 4.3;
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#C8A8FF" size={0.018} transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

function Planet() {
  const group = useRef<THREE.Group | null>(null);
  useFrame((_state, delta) => {
    if (group.current) group.current.rotation.y += Math.min(delta, 0.05) * 0.045;
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1.12, 88, 88]} />
        <meshStandardMaterial
          color="#8241C7"
          emissive="#40116F"
          emissiveIntensity={0.48}
          roughness={0.72}
          metalness={0.1}
        />
      </mesh>
      <mesh scale={1.018}>
        <sphereGeometry args={[1.12, 72, 72]} />
        <meshBasicMaterial
          color="#C78DFF"
          side={THREE.BackSide}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={0.985} rotation={[0.24, 0, -0.3]}>
        <sphereGeometry args={[1.12, 48, 48]} />
        <meshBasicMaterial
          color="#9F63D9"
          wireframe
          transparent
          opacity={0.055}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function PlanetOrb() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 0, 3.45], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      >
        <color attach="background" args={["#1B0D2A"]} />
        <ambientLight intensity={1.2} />
        <pointLight position={[-3, 2, 4]} color="#D59AFF" intensity={3.3} />
        <pointLight position={[3, -1, 2]} color="#5988FF" intensity={1.5} />
        <Stars />
        <Planet />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 }
});
