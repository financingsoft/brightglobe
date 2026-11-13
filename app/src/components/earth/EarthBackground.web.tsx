import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ErrorInfo,
  type ReactNode
} from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

const TEXTURES = [
  require("../../../assets/earth/earth-day.jpg") as unknown as string,
  require("../../../assets/earth/earth-night.jpg") as unknown as string,
  require("../../../assets/earth/earth-clouds.jpg") as unknown as string,
  require("../../../assets/earth/earth-normal.jpg") as unknown as string,
  require("../../../assets/earth/earth-specular.jpg") as unknown as string
];

// Place the terminator across the visible hemisphere so the first frame shows
// both sunlit terrain and the night-side city lights.
const SUN_DIRECTION = new THREE.Vector3(0.98, 0.18, 0.22).normalize();
const EARTH_RADIUS = 1.18;
const EARTH_POSITION: [number, number, number] = [0, 0.015, 0];

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

function Starfield() {
  const geometry = useMemo(() => {
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index / Math.max(count - 1, 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = index * 2.399963;
      positions[index * 3] = Math.cos(angle) * radius * 8.6;
      positions[index * 3 + 1] = y * 8.6;
      positions[index * 3 + 2] = Math.sin(angle) * radius * 8.6;
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return result;
  }, []);

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
  const [dayMap, nightMap, cloudMap, normalMap, specularMap] = useLoader(
    THREE.TextureLoader,
    TEXTURES
  ) as [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture];

  const renderer = useThree((state) => state.gl);
  const globeRef = useRef<THREE.Group | null>(null);
  const cloudRef = useRef<THREE.Mesh | null>(null);
  const invalidate = useThree((state) => state.invalidate);
  const frameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const earthMaterial = useMemo(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    cloudMap.colorSpace = THREE.NoColorSpace;
    normalMap.colorSpace = THREE.NoColorSpace;
    specularMap.colorSpace = THREE.NoColorSpace;

    const anisotropy = Math.max(
      1,
      Math.min(4, renderer.capabilities.getMaxAnisotropy())
    );
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
        uNormalStrength: { value: 0.82 },
        uSpecularStrength: { value: 0.3 }
      },
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
      toneMapped: false
    });
  }, [dayMap, nightMap, cloudMap, normalMap, specularMap, renderer]);

  const cloudMaterial = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: {
        uCloudMap: { value: cloudMap },
        uSunDirection: { value: SUN_DIRECTION },
        uCloudOpacity: { value: 0.88 }
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
    () => new THREE.ShaderMaterial({
      uniforms: { uSunDirection: { value: SUN_DIRECTION } },
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
    [earthMaterial, cloudMaterial, atmosphereMaterial]
  );

  useEffect(() => {
    if (active) invalidate();
    return () => {
      if (frameTimer.current !== null) {
        clearTimeout(frameTimer.current);
        frameTimer.current = null;
      }
    };
  }, [active, invalidate]);

  // Demand rendering caps browser work at 30 FPS instead of rendering an
  // always-on 60 FPS canvas for a decorative background.
  useFrame((_state, delta) => {
    if (!active) return;

    const frameDelta = Math.min(delta, 0.05);
    if (globeRef.current) globeRef.current.rotation.y += frameDelta * 0.028;
    if (cloudRef.current) cloudRef.current.rotation.y += frameDelta * 0.034;

    if (frameTimer.current === null) {
      frameTimer.current = setTimeout(() => {
        frameTimer.current = null;
        if (active) invalidate();
      }, 1000 / 30);
    }
  });

  return (
    <group position={EARTH_POSITION}>
      <group ref={globeRef}>
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
          <primitive object={earthMaterial} attach="material" />
        </mesh>
        <mesh scale={1.047} renderOrder={2}>
          <sphereGeometry args={[EARTH_RADIUS, 72, 72]} />
          <primitive object={atmosphereMaterial} attach="material" />
        </mesh>
      </group>
      <mesh ref={cloudRef} scale={1.019} renderOrder={1}>
        <sphereGeometry args={[EARTH_RADIUS, 72, 72]} />
        <primitive object={cloudMaterial} attach="material" />
      </mesh>
    </group>
  );
}

type BoundaryState = { hasError: boolean };

class WebEarthErrorBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.warn("[BrightGlobe] Web Earth background failed.", error);
  }

  render() {
    if (this.state.hasError) {
      return <View style={styles.fallback}><View style={styles.orb} /></View>;
    }
    return this.props.children;
  }
}

/** Browser renderer for the same bundled Earth artwork used by the native app. */
export function EarthBackground({ active = true }: { active?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <WebEarthErrorBoundary>
        <Canvas
          style={styles.canvas}
          camera={{ position: [0, 0, 4.1], fov: 43 }}
          frameloop={active ? "demand" : "never"}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        >
          <Starfield />
          <Suspense fallback={<LoadingEarth />}>
            <EarthScene active={active} />
          </Suspense>
        </Canvas>
      </WebEarthErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  fallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#030C1A",
    alignItems: "center",
    justifyContent: "center"
  },
  orb: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: "rgba(92, 169, 255, 0.8)",
    backgroundColor: "#123B66"
  }
});
