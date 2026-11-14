interface ServiceFetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  STAGING_BACKEND: ServiceFetcher;
}

const STAGING_PREFIX = "/staging";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url);

    if (incoming.pathname === "/health/live") {
      return Response.json({ service: "brightglobe-api-gateway", status: "ok" });
    }

    if (incoming.pathname !== STAGING_PREFIX && !incoming.pathname.startsWith(STAGING_PREFIX + "/")) {
      return Response.json({
        error: {
          code: "UNKNOWN_API_ENVIRONMENT",
          message: "The requested API environment does not exist."
        }
      }, { status: 404 });
    }

    const upstream = new URL(request.url);
    upstream.protocol = "https:";
    upstream.hostname = "brightglobe-staging.internal";
    upstream.port = "";
    upstream.pathname = incoming.pathname.slice(STAGING_PREFIX.length) || "/";

    const forwarded = new Request(upstream, request);
    return env.STAGING_BACKEND.fetch(forwarded);
  }
};
