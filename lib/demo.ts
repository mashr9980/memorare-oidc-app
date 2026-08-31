import "server-only";

/**
 * True while the app runs against the bundled stand-in provider. Drives a
 * visible notice so nobody mistakes an empty demo account for a broken one.
 */
export function demoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
