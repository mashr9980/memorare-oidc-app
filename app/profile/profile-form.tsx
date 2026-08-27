"use client";

import { useState } from "react";

type Status = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

export default function ProfileForm({
  email,
  initialName,
}: {
  email: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "update_failed");
      setName(data.name ?? name);
      setStatus({ kind: "saved", message: "Saved" });
    } catch {
      setStatus({ kind: "error", message: "Couldn't save. Please try again." });
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          readOnly
          disabled
          className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-3.5 text-[15px] text-gray-500"
        />
      </div>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setStatus({ kind: "idle" });
          }}
          placeholder="Your name"
          className="w-full rounded-lg border-2 border-[#3b82f6] bg-white px-4 py-3.5 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#0a5cf5]"
        />
      </div>

      <button
        type="submit"
        disabled={status.kind === "saving" || !name.trim()}
        className="w-full rounded-lg bg-gradient-to-r from-[#9dbdf7] to-[#0a5cf5] py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
      >
        {status.kind === "saving" ? "Saving..." : "Save"}
      </button>

      {status.message && (
        <p
          role="status"
          className={`text-center text-sm ${
            status.kind === "error" ? "text-red-600" : "text-green-700"
          }`}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
