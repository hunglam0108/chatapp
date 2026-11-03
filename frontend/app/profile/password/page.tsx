import { ChangePasswordForm } from "@/components/features/auth/change-password-form";

export default function ChangePasswordPage() {
  return (
    <section className="rounded-2xl bg-card p-5 text-card-foreground shadow-sm">
      <h1 className="mb-1 text-lg font-semibold">Change password</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Other devices will be signed out after the password changes.
      </p>
      <div className="max-w-sm">
        <ChangePasswordForm />
      </div>
    </section>
  );
}
