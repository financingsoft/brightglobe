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
import { Canvas, useFrame, useLoader } from "@react-three/fiber/native";
import * as THREE from "three";

// Static requires let Metro bundle every texture into the native app.
// R3F's Native entry point resolves these Metro asset IDs through Expo GL.
const TEXTURES = {
  day: require("../../../assets/earth/earth-day.jpg") as unknown as string,
  night: require("../../../assets/earth/earth-night.jpg") as unknown as string,
  clouds: require("../../../assets/earth/earth-clouds.jpg") as unknown as string,
  normal: require("../../../assets/earth/earth-normal.jpg") as unknown as string,
  specular: require("../../../assets/earth/earth-specular.jpg") as unknown as string
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

  varying vec2 vUv;
  varying vec3 vTangentView;
  varying vec3 vBitangentView;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;
  varying vec3 vSunDirectionView;

  void main() {
    vec3 tangentNormal = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
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

    // Keep the unlit side dark enough for city lights to read naturally.
    vec3 dayLit = dayColor * (0.24 + max(sunFacing, 0.0) * 0.94);
    vec3 nightLit = nightColor * 1.38;
    vec3 surfaceColor = mix(nightLit, dayLit, daylight);

    // Subtle twilight band softens the terminator without washing out night lights.
    float twilight = 1.0 - smoothstep(0.015, 0.22, abs(sunFacing));
    surfaceColor += vec3(0.035, 0.075, 0.12) * twilight * 0.12;

    // Specular mask suppresses highlights on land and leaves them over oceans.
    float oceanMask = texture2D(uSpecularMap, vUv).r;
    vec3 halfDirection = normalize(sunDirection + viewDirection);
    float specular = pow(max(dot(normal, halfDirection), 0.0), 52.0);
    specular *= oceanMask * smoothstep(0.02, 0.24, sunFacing);
    surfaceColor += vec3(0.46, 0.66, 0.92) * specular * 0.34;

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

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vSunDirectionView;

  void main() {
    float sunFacing = dot(normalize(vNormalView), normalize(vSunDirectionView));
    float daylight = smoothstep(-0.2, 0.24, sunFacing);
    float cloudDensity = texture2D(uCloudMap, vUv).r;
    float cloudShape = smoothstep(0.31, 0.74, cloudDensity);

    // Day clouds are bright and soft; night clouds remain faint blue silhouettes.
    float alpha = cloudShape * mix(0.075, 0.36, daylight);
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

function Starfield() {
  const geometry = useMemo(() => {
    const count = 300;
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index / (count - 1)) * 2;
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
  }, []);

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
      <sphereGeometry args={[EARTH_RADIUS, 48, 48]} />
      <meshBasicMaterial color="#123B66" />
    </mesh>
  );
}

function EarthScene() {
  const [dayMap, nightMap, cloudMap, normalMap, specularMap] = useLoader(
    THREE.TextureLoader,
    [
      TEXTURES.day,
      TEXTURES.night,
      TEXTURES.clouds,
      TEXTURES.normal,
      TEXTURES.specular
    ]
  ) as [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture];

  const globeRef = useRef<THREE.Group | null>(null);
  const cloudRef = useRef<THREE.Mesh | null>(null);

  const earthMaterial = useMemo(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    cloudMap.colorSpace = THREE.NoColorSpace;
    normalMap.colorSpace = THREE.NoColorSpace;
    specularMap.colorSpace = THREE.NoColorSpace;

    for (const texture of [dayMap, nightMap, cloudMap, normalMap, specularMap]) {
      texture.anisotropy = 4;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
    }

    return new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayMap },
        uNightMap: { value: nightMap },
        uNormalMap: { value: normalMap },
        uSpecularMap: { value: specularMap },
        uSunDirection: { value: SUN_DIRECTION }
      },
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
      toneMapped: false
    });
  }, [dayMap, nightMap, cloudMap, normalMap, specularMap]);

  const cloudMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCloudMap: { value: cloudMap },
          uSunDirection: { value: SUN_DIRECTION }
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

  useFrame((_state, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);

    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.028;
    }

    if (cloudRef.current) {
      // Clouds drift independently from the solid surface.
      cloudRef.current.rotation.y += delta * 0.034;
    }
  });

  return (
    <group position={EARTH_POSITION}>
      <group ref={globeRef}>
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS, 112, 112]} />
          <primitive object={earthMaterial} attach="material" />
        </mesh>
        <mesh scale={1.047} renderOrder={2}>
          <sphereGeometry args={[EARTH_RADIUS, 80, 80]} />
          <primitive object={atmosphereMaterial} attach="material" />
        </mesh>
      </group>
      <mesh ref={cloudRef} scale={1.019} renderOrder={1}>
        <sphereGeometry args={[EARTH_RADIUS, 88, 88]} />
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

/** Decorative, non-interactive Earth background; all textures are bundled locally. */
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
          camera={{ position: [0, 0, 4.1], fov: 43 }}
          frameloop={shouldAnimate ? "always" : "never"}
          gl={{
            alpha: false,
            antialias: true,
            powerPreference: "low-power"
          }}
        >
          <color attach="background" args={["#030C1A"]} />
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
