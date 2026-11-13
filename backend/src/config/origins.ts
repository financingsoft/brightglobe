export function parseOrigins(value: string): string[] {
  return [...new Set(value.split(",").map((origin) => origin.trim()).filter(Boolean))];
}

export function buildTrustedOrigins(configuredOrigins: string, nodeEnv: string): string[] {
  const nativeOrigins = ["brightglobe://"];
  const developmentOrigins = nodeEnv === "development"
    ? ["exp://", "exp://**", "exp://192.168.*.*:*/**"]
    : [];
  return [...new Set([...parseOrigins(configuredOrigins), ...nativeOrigins, ...developmentOrigins])];
}

export function isAllowedOrigin(origin: string, configuredOrigins: string, nodeEnv: string): boolean {
  if (parseOrigins(configuredOrigins).includes(origin) || origin === "brightglobe://") return true;
  return nodeEnv === "development" && origin.startsWith("exp://");
}
