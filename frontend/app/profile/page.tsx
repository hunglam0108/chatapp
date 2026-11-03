"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeftIcon, CameraIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authStore } from "@/store/authStore";
import { authApi } from "@/server/auth";
import { uploadFile } from "@/server/upload";
import { resizeImageToSquare } from "@/lib/image";
import { ChangePasswordForm } from "@/components/features/auth/change-password-form";
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

  const rows = [
    { label: "Username", value: user.username },
    { label: "Email", value: user.email },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 md:p-10">
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start")}>
        <ArrowLeftIcon />
        Back to chats
      </Link>

      <section className="flex flex-col items-center gap-4 rounded-2xl bg-card p-6 text-card-foreground shadow-sm">
        <Avatar className="size-24">
          {user.urlAvatar ? <AvatarImage src={user.urlAvatar} alt={user.fullName} /> : null}
          <AvatarFallback className="text-2xl">{initials || "U"}</AvatarFallback>
        </Avatar>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <CameraIcon />
          {uploading ? "Uploading..." : "Change avatar"}
        </Button>

        <DisplayNameForm displayName={user.fullName} />

        <dl className="w-full divide-y text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="truncate font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-base font-semibold">Change password</h2>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
