import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile } from "@/lib/memorare";
import ProfileForm from "./profile-form";
import AvatarUploader from "./avatar-uploader";
import { demoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/");

  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  try {
    profile = await getProfile(session.accessToken);
  } catch (err) {
    if (err instanceof Error && err.message === "token_expired") {
      redirect("/?error=session_expired");
    }
  }

  const email = profile?.email ?? session.email;
  const name = profile?.name ?? session.name ?? "";
  const picture = profile?.picture ?? session.picture ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-10">
      <div className="w-full max-w-[543px] rounded-2xl border border-[#dce7f9] bg-[#eef3fc] px-7 py-8 shadow-sm">
        <div className="mb-7">
          <AvatarUploader
            initialPicture={picture}
            fallback={(name || email || "?").charAt(0).toUpperCase()}
          />
        </div>

        {demoMode() && !name && !picture && (
          <p className="mb-5 rounded-lg border border-[#c9dcfa] bg-[#eaf1fd] px-4 py-3 text-[13px] leading-relaxed text-[#1c3f7c]">
            You&apos;re signed in. This account is new, so there&apos;s nothing saved against it yet.
            Add a name or a photo and it persists to the provider and survives signing out.
          </p>
        )}

        <ProfileForm email={email} initialName={name} />

        <a
          href="/api/auth/logout"
          className="mt-6 block text-center text-sm text-gray-500 underline-offset-2 hover:underline"
        >
          Sign out
        </a>
      </div>
    </main>
  );
}
