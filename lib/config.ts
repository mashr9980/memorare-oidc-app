import "server-only";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function serverConfig() {
  return {
    authBase: process.env.AUTH_BASE ?? "https://auth.memorare.ai",
    clientId: required("MEMORARE_CLIENT_ID", process.env.MEMORARE_CLIENT_ID),
    clientSecret: required("MEMORARE_CLIENT_SECRET", process.env.MEMORARE_CLIENT_SECRET),
    redirectUri: required("MEMORARE_REDIRECT_URI", process.env.MEMORARE_REDIRECT_URI),
    appUrl: required("APP_URL", process.env.APP_URL),
  };
}
