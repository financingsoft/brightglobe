export function parseOrigins(value: string): string[] {
  return [...new Set(value.split(",").map((origin) => origin.trim()).filter(Boolean))];
}

export function buildTrustedOrigins(configuredOrigins: string, nodeEnv: string): string[] {
  const nativeOrigins = ["brightglobe://", "brightglobe://auth"];
  const developmentOrigins = nodeEnv === "development"
    ? ["exp://", "exp://**", "exp://192.168.*.*:*/**"]
    : [];
  return [...new Set([...parseOrigins(configuredOrigins), ...nativeOrigins, ...developmentOrigins])];
}

export function isAllowedOrigin(origin: string, configuredOrigins: string, nodeEnv: string): boolean {
  if (parseOrigins(configuredOrigins).includes(origin) || origin === "brightglobe://" || origin === "brightglobe://auth") return true;
  return nodeEnv === "development" && origin.startsWith("exp://");
}

/**
 * Resolves a browser Origin or an explicitly identified native-app request.
 * Native requests still sign the canonical HTTPS API domain in the wallet
 * challenge; this marker only supplies the app-origin context.
 */
export function resolveAllowedRequestOrigin(
  origin: string | undefined,
  nativeClient: string | undefined,
  configuredOrigins: string,
  nodeEnv: string
): string | null {
  if (origin && isAllowedOrigin(origin, configuredOrigins, nodeEnv)) return origin;
  if (!origin && nativeClient === "native") return "brightglobe://auth";
  return null;
}
