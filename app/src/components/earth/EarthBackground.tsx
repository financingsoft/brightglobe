import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode
} from "react";
import { AppState, StyleSheet, View } from "react-native";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber/native";
import * as Device from "expo-device";
import * as THREE from "three";

type EarthQuality = "low" | "balanced" | "high";

type QualityProfile = {
  fps: number;
  stars: number;
  earthSegments: number;
  cloudSegments: number;
  atmosphereSegments: number;
  anisotropy: number;
  antialias: boolean;
  normalStrength: number;
  specularStrength: number;
  cloudOpacity: number;
};

const QUALITY_PROFILES: Record<EarthQuality, QualityProfile> = {
  low: {
    fps: 20,
    stars: 72,
    earthSegments: 64,
    cloudSegments: 48,
    atmosphereSegments: 48,
    anisotropy: 1,
    antialias: false,
    normalStrength: 0.58,
    specularStrength: 0.2,
    cloudOpacity: 0.72
  },
  balanced: {
    fps: 24,
    stars: 170,
    earthSegments: 88,
    cloudSegments: 72,
    atmosphereSegments: 64,
    anisotropy: 2,
    antialias: false,
    normalStrength: 0.82,
    specularStrength: 0.3,
    cloudOpacity: 0.88
  },
  high: {
    fps: 30,
    stars: 300,
    earthSegments: 120,
    cloudSegments: 96,
    atmosphereSegments: 88,
    anisotropy: 4,
    antialias: true,
    normalStrength: 1,
    specularStrength: 0.34,
    cloudOpacity: 1
  }
};

const MEMORY_GB = Device.totalMemory === null
  ? null
  : Device.totalMemory / (1024 * 1024 * 1024);

/**
 * RAM is a conservative proxy for texture/scene budget, not a direct GPU benchmark.
 * Unknown memory defaults to balanced rather than assuming a high-end device.
 */
function chooseEarthQuality(memoryGb: number | null): EarthQuality {
  if (memoryGb === null) return "balanced";
  if (memoryGb < 4) return "low";
  if (memoryGb >= 8) return "high";
  return "balanced";
}

const EARTH_QUALITY = chooseEarthQuality(MEMORY_GB);
const QUALITY = QUALITY_PROFILES[EARTH_QUALITY];

// Static requires let Metro bundle both quality sets into the native app.
// R3F's Native entry point resolves these Metro asset IDs through Expo GL.
const TEXTURES = {
  standard: [
    require("../../../assets/earth/earth-day.jpg") as unknown as string,
    require("../../../assets/earth/earth-night.jpg") as unknown as string,
    require("../../../assets/earth/earth-clouds.jpg") as unknown as string,
    require("../../../assets/earth/earth-normal.jpg") as unknown as string,
    require("../../../assets/earth/earth-specular.jpg") as unknown as string
  ],
  lowMemory: [
    require("../../../assets/earth/earth-day-1k.jpg") as unknown as string,
    require("../../../assets/earth/earth-night-1k.jpg") as unknown as string,
    require("../../../assets/earth/earth-clouds-1k.jpg") as unknown as string,
    require("../../../assets/earth/earth-normal-1k.jpg") as unknown as string,
    require("../../../assets/earth/earth-specular-1k.jpg") as unknown as string
  ]
} as const;

const EARTH_VERTEX_SHADER = `
  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vTangentView;
  varying vec3 vBitangentView;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;
  varying vec3 vSunDirectionView;

  void main() {
    vUv = uv;

    vec3 localNormal = normalize(normal);
    vec3 localTangent = vec3(position.z, 0.0, -position.x);
    if (dot(localTangent, localTangent) < 0.0001) {
      localTangent = vec3(1.0, 0.0, 0.0);
    }
    localTangent = normalize(localTangent);
    vec3 localBitangent = normalize(cross(localNormal, localTangent));

    vTangentView = normalize(normalMatrix * localTangent);
    vBitangentView = normalize(normalMatrix * localBitangent);
    vNormalView = normalize(normalMatrix * localNormal);

    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDirection = normalize(-modelViewPosition.xyz);

    // The sun is fixed in world space while the Earth rotates underneath it.
    vSunDirectionView = normalize(mat3(viewMatrix) * normalize(uSunDirection));
    gl_Position = projectionMatrix * modelViewPosition;
  }
`;

const EARTH_FRAGMENT_SHADER = `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uSpecularMap;
  uniform float uNormalStrength;
  uniform float uSpecularStrength;

  varying vec2 vUv;
  varying vec3 vTangentView;
  varying vec3 vBitangentView;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;
  varying vec3 vSunDirectionView;

  void main() {
    vec3 normalSample = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
    vec3 tangentNormal = normalize(vec3(
      normalSample.xy * uNormalStrength,
      mix(1.0, normalSample.z, uNormalStrength)
    ));
    vec3 normal = normalize(
      vTangentView * tangentNormal.x +
      vBitangentView * tangentNormal.y +
      vNormalView * tangentNormal.z
    );

    vec3 sunDirection = normalize(vSunDirectionView);
    vec3 viewDirection = normalize(vViewDirection);
    float sunFacing = dot(normal, sunDirection);
    float daylight = smoothstep(-0.19, 0.12, sunFacing);

    vec3 dayColor = texture2D(uDayMap, vUv).rgb;
    vec3 nightColor = texture2D(uNightMap, vUv).rgb;

    vec3 dayLit = dayColor * (0.24 + max(sunFacing, 0.0) * 0.94);
    vec3 nightLit = nightColor * 1.38;
    vec3 surfaceColor = mix(nightLit, dayLit, daylight);

    float twilight = 1.0 - smoothstep(0.015, 0.22, abs(sunFacing));
    surfaceColor += vec3(0.035, 0.075, 0.12) * twilight * 0.12;

    // Specular mask suppresses highlights on land and leaves them over oceans.
    float oceanMask = texture2D(uSpecularMap, vUv).r;
    vec3 halfDirection = normalize(sunDirection + viewDirection);
    float specular = pow(max(dot(normal, halfDirection), 0.0), 52.0);
    specular *= oceanMask * smoothstep(0.02, 0.24, sunFacing);
    surfaceColor += vec3(0.46, 0.66, 0.92) * specular * uSpecularStrength;

    gl_FragColor = vec4(surfaceColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CLOUD_VERTEX_SHADER = `
  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vSunDirectionView;

  void main() {
    vUv = uv;
    vNormalView = normalize(normalMatrix * normal);
    vSunDirectionView = normalize(mat3(viewMatrix) * normalize(uSunDirection));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT_SHADER = `
  uniform sampler2D uCloudMap;
  uniform float uCloudOpacity;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vSunDirectionView;

  void main() {
    float sunFacing = dot(normalize(vNormalView), normalize(vSunDirectionView));
    float daylight = smoothstep(-0.2, 0.24, sunFacing);
    float cloudDensity = texture2D(uCloudMap, vUv).r;
    float cloudShape = smoothstep(0.31, 0.74, cloudDensity);

    float alpha = cloudShape * mix(0.075, 0.36, daylight) * uCloudOpacity;
    vec3 cloudColor = mix(
      vec3(0.10, 0.19, 0.34),
      vec3(0.88, 0.94, 1.0),
      daylight
    );

    gl_FragColor = vec4(cloudColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX_SHADER = `
  uniform vec3 uSunDirection;

  varying vec3 vNormalView;
  varying vec3 vViewDirection;
  varying vec3 vSunDirectionView;

  void main() {
    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDirection = normalize(-modelViewPosition.xyz);
    vSunDirectionView = normalize(mat3(viewMatrix) * normalize(uSunDirection));
    gl_Position = projectionMatrix * modelViewPosition;
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = `
  varying vec3 vNormalView;
  varying vec3 vViewDirection;
  varying vec3 vSunDirectionView;

  void main() {
    vec3 normal = normalize(vNormalView);
    vec3 viewDirection = normalize(vViewDirection);
    float facing = max(dot(normal, viewDirection), 0.0);
    float rim = pow(1.0 - facing, 3.25);

    float sunFacing = dot(normal, normalize(vSunDirectionView));
    float sunlitRim = smoothstep(-0.42, 0.52, sunFacing);

    vec3 nightBlue = vec3(0.055, 0.20, 0.48);
    vec3 dayBlue = vec3(0.12, 0.55, 1.0);
    vec3 atmosphereColor = mix(nightBlue, dayBlue, sunlitRim);
    float atmosphereAlpha = rim * mix(0.24, 0.52, sunlitRim);

    gl_FragColor = vec4(atmosphereColor, atmosphereAlpha);
  }
`;

const SUN_DIRECTION = new THREE.Vector3(-0.62, 0.24, 0.92).normalize();
const EARTH_RADIUS = 1.18;
const EARTH_POSITION: [number, number, number] = [0.92, 0.015, 0];

function Starfield({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index / Math.max(count - 1, 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = index * 2.399963;

      positions[index * 3] = Math.cos(angle) * radius * 8.6;
      positions[index * 3 + 1] = y * 8.6;
      positions[index * 3 + 2] = Math.sin(angle) * radius * 8.6;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    return nextGeometry;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#B7D6FF"
        size={0.015}
        sizeAttenuation
        transparent
        opacity={0.62}
        depthWrite={false}
      />
    </points>
  );
}

function LoadingEarth() {
  return (
    <mesh position={EARTH_POSITION}>
      <sphereGeometry args={[EARTH_RADIUS, 40, 40]} />
      <meshBasicMaterial color="#123B66" />
    </mesh>
  );
}

function EarthScene({ active }: { active: boolean }) {
  const textureSources: string[] = EARTH_QUALITY === "low"
    ? [...TEXTURES.lowMemory]
    : [...TEXTURES.standard];
  const [dayMap, nightMap, cloudMap, normalMap, specularMap] = useLoader(
    THREE.TextureLoader,
    textureSources
  ) as [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture];

  const renderer = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const globeRef = useRef<THREE.Group | null>(null);
  const cloudRef = useRef<THREE.Mesh | null>(null);
  const frameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const earthMaterial = useMemo(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    cloudMap.colorSpace = THREE.NoColorSpace;
    normalMap.colorSpace = THREE.NoColorSpace;
    specularMap.colorSpace = THREE.NoColorSpace;

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const anisotropy = Math.max(1, Math.min(QUALITY.anisotropy, maxAnisotropy));

    for (const texture of [dayMap, nightMap, cloudMap, normalMap, specularMap]) {
      texture.anisotropy = anisotropy;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
    }

    return new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayMap },
        uNightMap: { value: nightMap },
        uNormalMap: { value: normalMap },
        uSpecularMap: { value: specularMap },
        uSunDirection: { value: SUN_DIRECTION },
        uNormalStrength: { value: QUALITY.normalStrength },
        uSpecularStrength: { value: QUALITY.specularStrength }
      },
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
      toneMapped: false
    });
  }, [dayMap, nightMap, cloudMap, normalMap, specularMap, renderer]);

  const cloudMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCloudMap: { value: cloudMap },
          uSunDirection: { value: SUN_DIRECTION },
          uCloudOpacity: { value: QUALITY.cloudOpacity }
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
        uniforms: {
          uSunDirection: { value: SUN_DIRECTION }
        },
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

  // Demand rendering caps actual scene renders instead of updating at 60 Hz and
  // merely slowing the rotation. Route blur/background transitions cancel timers.
  useEffect(() => {
    if (active) invalidate();
    return () => {
      if (frameTimer.current !== null) {
        clearTimeout(frameTimer.current);
        frameTimer.current = null;
      }
    };
  }, [active, invalidate]);

  useFrame((_state, frameDelta) => {
    if (!active) return;

    const delta = Math.min(frameDelta, 0.05);
    if (globeRef.current) globeRef.current.rotation.y += delta * 0.028;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.034;

    if (frameTimer.current === null) {
      frameTimer.current = setTimeout(() => {
        frameTimer.current = null;
        if (active) invalidate();
      }, 1000 / QUALITY.fps);
    }
  });

  return (
    <group position={EARTH_POSITION}>
      <group ref={globeRef}>
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS, QUALITY.earthSegments, QUALITY.earthSegments]} />
          <primitive object={earthMaterial} attach="material" />
        </mesh>
        <mesh scale={1.047} renderOrder={2}>
          <sphereGeometry args={[EARTH_RADIUS, QUALITY.atmosphereSegments, QUALITY.atmosphereSegments]} />
          <primitive object={atmosphereMaterial} attach="material" />
        </mesh>
      </group>
      <mesh ref={cloudRef} scale={1.019} renderOrder={1}>
        <sphereGeometry args={[EARTH_RADIUS, QUALITY.cloudSegments, QUALITY.cloudSegments]} />
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

/** Adaptive, non-interactive Earth background; all textures are bundled locally. */
export function EarthBackground({ active = true }: { active?: boolean }) {
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState !== "background" && AppState.currentState !== "inactive"
  );
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
          camera={{ position: [0, 0, 4.1], fov: 43 }}
          frameloop={shouldAnimate ? "demand" : "never"}
          gl={{
            alpha: false,
            antialias: QUALITY.antialias,
            powerPreference: "low-power"
          }}
        >
          <color attach="background" args={["#030C1A"]} />
          <Starfield count={QUALITY.stars} />
          <Suspense fallback={<LoadingEarth />}>
            <EarthScene active={shouldAnimate} />
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
    backgroundColor: "#030C1A",
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
