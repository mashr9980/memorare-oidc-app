"use client";

import { useEffect, useRef, useState } from "react";
import { AVATAR_ACCEPT, AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/lib/avatar-rules";

function messageFor(code: string): string {
  switch (code) {
    case "file_too_large":
      return "That image is over 2MB. Try a smaller one.";
    case "unsupported_image_type":
      return "That file isn't a JPEG, PNG or WebP.";
    case "token_expired":
      return "Your session expired. Sign in again.";
    default:
      return "Upload failed. Please try again.";
  }
}

export default function AvatarUploader({
  initialPicture,
  fallback,
}: {
  initialPicture: string | null;
  fallback: string;
}) {
  const [picture, setPicture] = useState(initialPicture);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function upload(file: File) {
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      setError("Pick a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("That image is over 2MB. Try a smaller one.");
      return;
    }

    setError(null);
    setBusy(true);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const body = new FormData();
      body.append("avatar", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body });
      // A proxy rejecting the body answers with HTML, so never assume JSON.
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? (res.status === 413 ? "file_too_large" : "upload_failed"));
      setPicture(data?.picture ?? null);
    } catch (err) {
      setError(messageFor(err instanceof Error ? err.message : "upload_failed"));
      setPreview(null);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      setPicture(null);
      setPreview(null);
    } catch {
      setError("Couldn't remove the photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? picture;

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt="Your profile photo"
            className={`h-14 w-14 rounded-full border border-[#dce7f9] object-cover transition-opacity ${
              busy ? "opacity-50" : ""
            }`}
          />
        ) : (
          <div
            aria-hidden="true"
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#9dbdf7] to-[#0a5cf5] text-xl font-bold text-white transition-opacity ${
              busy ? "opacity-50" : ""
            }`}
          >
            {fallback}
          </div>
        )}

        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={picture ? "Change profile photo" : "Upload a profile photo"}
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#dce7f9] bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a5cf5] disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>

        <input
          ref={input}
          type="file"
          accept={AVATAR_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      <div className="min-w-0">
        <h1 className="text-lg font-bold text-gray-900">Your profile</h1>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : busy ? (
          <p role="status" className="text-sm text-gray-500">
            Working...
          </p>
        ) : picture ? (
          <button
            type="button"
            onClick={() => void remove()}
            className="text-sm text-gray-500 underline-offset-2 hover:underline"
          >
            Remove photo
          </button>
        ) : (
          <p className="text-sm text-gray-500">JPEG, PNG or WebP. Up to 2MB.</p>
        )}
      </div>
    </div>
  );
}
