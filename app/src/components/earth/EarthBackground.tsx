import { Component, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { Canvas, useFrame, useLoader } from "@react-three/fiber/native";
import * as THREE from "three";

// Static require() calls let Metro bundle the textures into the native app.
// R3F's Native entry point patches TextureLoader to resolve Expo asset IDs.
const TEXTURES = {
  day: require("../../../assets/earth/earth-day.jpg") as unknown as string,
  night: require("../../../assets/earth/earth-night.jpg") as unknown as string,
  clouds: require("../../../assets/earth/earth-clouds.jpg") as unknown as string
} as const;

const EARTH_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormalView;

  void main() {
    vUv = uv;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EARTH_FRAGMENT_SHADER = `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vNormalView;

  void main() {
    vec3 normal = normalize(vNormalView);
    float sunFacing = dot(normal, normalize(uSunDirection));
    float daylight = smoothstep(-0.16, 0.16, sunFacing);

    vec3 dayColor = texture2D(uDayMap, vUv).rgb;
    vec3 nightColor = texture2D(uNightMap, vUv).rgb;

    float directLight = max(sunFacing, 0.0);
    dayColor *= 0.34 + directLight * 0.92;

    // The night texture contributes city lights only on the dark side.
    vec3 surfaceColor = mix(nightColor * 1.35, dayColor, daylight);
    gl_FragColor = vec4(surfaceColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CLOUD_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormalView;

  void main() {
    vUv = uv;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT_SHADER = `
  uniform sampler2D uCloudMap;
  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vNormalView;

  void main() {
    float sunFacing = dot(normalize(vNormalView), normalize(uSunDirection));
    float daylight = smoothstep(-0.18, 0.28, sunFacing);
    float cloudDensity = texture2D(uCloudMap, vUv).r;
    float cloudShape = smoothstep(0.34, 0.76, cloudDensity);

    // Clouds are a separate translucent shell, not baked into the land map.
    float alpha = cloudShape * mix(0.16, 0.48, daylight);
    vec3 cloudColor = mix(
      vec3(0.16, 0.24, 0.38),
      vec3(0.88, 0.94, 1.0),
      daylight
    );

    gl_FragColor = vec4(cloudColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX_SHADER = `
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDirection = normalize(-modelViewPosition.xyz);
    gl_Position = projectionMatrix * modelViewPosition;
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = `
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    float facing = max(
      dot(normalize(vNormalView), normalize(vViewDirection)),
      0.0
    );
    float rim = pow(1.0 - facing, 2.7);
    gl_FragColor = vec4(vec3(0.12, 0.48, 1.0), rim * 0.58);
  }
`;

function Starfield() {
  const geometry = useMemo(() => {
    const count = 260;
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = index * 2.399963;

      positions[index * 3] = Math.cos(angle) * radius * 8.5;
      positions[index * 3 + 1] = y * 8.5;
      positions[index * 3 + 2] = Math.sin(angle) * radius * 8.5;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    return nextGeometry;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#B7D6FF"
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.72}
        depthWrite={false}
      />
    </points>
  );
}

function LoadingEarth() {
  return (
    <mesh position={[0.62, 0, 0]}>
      <sphereGeometry args={[1.12, 48, 48]} />
      <meshBasicMaterial color="#123B66" />
    </mesh>
  );
}

function EarthScene() {
  const [dayMap, nightMap, cloudMap] = useLoader(THREE.TextureLoader, [
    TEXTURES.day,
    TEXTURES.night,
    TEXTURES.clouds
  ]) as [THREE.Texture, THREE.Texture, THREE.Texture];

  const globeRef = useRef<THREE.Group | null>(null);
  const cloudRef = useRef<THREE.Mesh | null>(null);

  const earthMaterial = useMemo(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    cloudMap.colorSpace = THREE.NoColorSpace;

    for (const texture of [dayMap, nightMap, cloudMap]) {
      texture.anisotropy = 4;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
    }

    return new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayMap },
        uNightMap: { value: nightMap },
        uSunDirection: {
          value: new THREE.Vector3(-0.62, 0.24, 0.92).normalize()
        }
      },
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
      toneMapped: false
    });
  }, [dayMap, nightMap, cloudMap]);

  const cloudMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCloudMap: { value: cloudMap },
          uSunDirection: {
            value: new THREE.Vector3(-0.62, 0.24, 0.92).normalize()
          }
        },
        vertexShader: CLOUD_VERTEX_SHADER,
        fragmentShader: CLOUD_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        toneMapped: false
      }),
    [cloudMap]
  );

  const atmosphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ATMOSPHERE_VERTEX_SHADER,
        fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        toneMapped: false
      }),
    []
  );

  useEffect(
    () => () => {
      earthMaterial.dispose();
      cloudMaterial.dispose();
      atmosphereMaterial.dispose();
    },
    [atmosphereMaterial, cloudMaterial, earthMaterial]
  );

  useFrame((_state, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);

    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.032;
    }

    if (cloudRef.current) {
      // A slightly faster angular speed creates independent cloud movement.
      cloudRef.current.rotation.y += delta * 0.037;
    }
  });

  return (
    <group position={[0.62, 0, 0]}>
      <group ref={globeRef}>
        <mesh>
          <sphereGeometry args={[1.12, 96, 96]} />
          <primitive object={earthMaterial} attach="material" />
        </mesh>
        <mesh scale={1.04}>
          <sphereGeometry args={[1.12, 64, 64]} />
          <primitive object={atmosphereMaterial} attach="material" />
        </mesh>
      </group>
      <mesh ref={cloudRef} scale={1.018}>
        <sphereGeometry args={[1.12, 72, 72]} />
        <primitive object={cloudMaterial} attach="material" />
      </mesh>
    </group>
  );
}

type EarthErrorBoundaryState = {
  hasError: boolean;
};

class EarthErrorBoundary extends Component<
  { children: ReactNode },
  EarthErrorBoundaryState
> {
  state: EarthErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): EarthErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.warn("[BrightGlobe] Earth background could not be rendered.", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorFallback}>
          <View style={styles.errorOrb} />
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Decorative, non-interactive Earth background for the Home hero card.
 * All textures are bundled with the app, so rendering works offline.
 */
export function EarthBackground({ active = true }: { active?: boolean }) {
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === "active");
  const shouldAnimate = active && appIsActive;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppIsActive(nextState === "active");
    });

    return () => subscription.remove();
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <EarthErrorBoundary>
        <Canvas
          style={styles.canvas}
          camera={{ position: [0, 0, 4.35], fov: 39 }}
          frameloop={shouldAnimate ? "always" : "never"}
          gl={{
            alpha: false,
            antialias: true,
            powerPreference: "low-power"
          }}
        >
          <color attach="background" args={["#061426"]} />
          <Starfield />
          <Suspense fallback={<LoadingEarth />}>
            <EarthScene />
          </Suspense>
        </Canvas>
      </EarthErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1
  },
  errorFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#061426",
    alignItems: "center",
    justifyContent: "center"
  },
  errorOrb: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: "rgba(92, 169, 255, 0.8)",
    backgroundColor: "#123B66",
    shadowColor: "#288AFF",
    shadowOpacity: 0.7,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12
  }
});
