"use client";

import { useRef, useState } from "react";
import { CameraIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authStore } from "@/store/authStore";
import { authApi } from "@/server/auth";
import { uploadFile } from "@/server/upload";
import { resizeImageToSquare } from "@/lib/image";
import { DisplayNameForm } from "@/components/features/auth/display-name-form";

export default function ProfilePage() {
  const user = authStore((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // ProtectedRoute chỉ render trang này khi đã có user.
  if (!user) return null;

  const initials = (user.fullName || user.username || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const square = await resizeImageToSquare(file, 256);
      const { url } = await uploadFile(square);
      const updated = await authApi.updateAvatar(url);
      authStore.setState({ user: { ...user, urlAvatar: updated.avatarUrl ?? "" } });
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Could not update avatar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 text-card-foreground shadow-sm">
      <h1 className="mb-4 text-lg font-semibold">Account info</h1>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="relative self-center sm:self-start">
          <Avatar className="size-20">
            {user.urlAvatar ? <AvatarImage src={user.urlAvatar} alt={user.fullName} /> : null}
            <AvatarFallback className="text-xl">{initials || "U"}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            aria-label="Change avatar"
            title="Change avatar"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
          >
            {uploading ? <Loader2Icon className="size-4 animate-spin" /> : <CameraIcon className="size-4" />}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <DisplayNameForm displayName={user.fullName} />
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Username</dt>
              <dd className="truncate font-medium">@{user.username}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate font-medium">{user.email}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
