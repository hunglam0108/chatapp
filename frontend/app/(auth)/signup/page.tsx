import { SignupForm } from "@/components/features/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex flex-1 w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  );
}
