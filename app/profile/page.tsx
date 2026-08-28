import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile } from "@/lib/memorare";
import ProfileForm from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/");
  const profile = await getProfile(session.accessToken).catch(() => null);

  const email = profile?.email ?? session.email;
  const name = profile?.name ?? session.name ?? "";
  const picture = profile?.picture ?? session.picture ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-10">
      <div className="w-full max-w-[543px] rounded-2xl border border-[#dce7f9] bg-[#eef3fc] px-7 py-8 shadow-sm">
        <div className="mb-7 flex items-center gap-4">
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={picture}
              alt=""
              className="h-14 w-14 rounded-full border border-[#dce7f9] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#9dbdf7] to-[#0a5cf5] text-xl font-bold text-white">
              {(name || email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-gray-900">Your profile</h1>
            <p className="text-sm text-gray-500">Signed in</p>
          </div>
        </div>

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
