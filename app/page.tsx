import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { COOKIE } from "@/lib/cookies";
import { demoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  email_required: "Enter your email to continue.",
  state_mismatch: "That login attempt expired. Please try again.",
  missing_params: "That login attempt expired. Please try again.",
  exchange_failed: "We couldn't complete the sign in. Please try again.",
  auth_failed: "We couldn't complete the sign in. Please try again.",
  auth_cancelled: "Sign in was cancelled.",
  server_misconfigured: "Sign in is unavailable right now.",
  nonce_mismatch: "That login attempt expired. Please try again.",
  subject_mismatch: "We couldn't verify that sign in. Please try again.",
};

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/profile");

  const { error } = await searchParams;

  // Try the provider's SSO session once before showing the form, so a visitor
  // already signed in to another Memorare app never sees this screen.
  const jar = await cookies();
  if (!error && !jar.get(COOKIE.ssoTried)) redirect("/api/auth/sso");

  const message = error ? ERRORS[error] ?? "Something went wrong. Please try again." : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-10">
      <div className="w-full max-w-[543px] rounded-2xl border border-[#dce7f9] bg-[#eef3fc] px-7 py-8 shadow-sm">
        {demoMode() && (
          <div className="mb-5 rounded-lg border border-[#c9dcfa] bg-[#eaf1fd] px-4 py-3 text-[13px] leading-relaxed text-[#1c3f7c]">
            <strong className="font-semibold">Demo mode.</strong> Memorare hasn&apos;t issued client
            credentials yet, so sign in runs against a stand-in built from their API docs. Any email
            works and no code is emailed. The OAuth flow, PKCE, token exchange and profile calls are
            all real, and a new email starts with an empty profile.
          </div>
        )}

        {message && (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {message}
          </p>
        )}

        <form action="/api/auth/login" method="POST" className="space-y-5">
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Enter your email"
            className="w-full rounded-lg border-2 border-[#3b82f6] bg-white px-4 py-3.5 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#0a5cf5]"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-[#9dbdf7] to-[#0a5cf5] py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-95"
          >
            Continue with email
          </button>
        </form>

        <p className="my-5 text-center text-[15px] text-gray-500">OR</p>

        <form action="/api/auth/login" method="POST">
          <input type="hidden" name="idp" value="google" />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white py-3.5 text-[15px] text-gray-800 transition-colors hover:bg-gray-50"
          >
            <GoogleLogo />
            Continue with Google
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-gray-500">
          By continuing, you agree to the terms of service and privacy policy.
        </p>
      </div>
    </main>
  );
}
