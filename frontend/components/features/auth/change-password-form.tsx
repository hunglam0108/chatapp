"use client"

import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authApi } from "@/server/auth"
import { socketStore } from "@/store/socketStore"

type Inputs = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Inputs>()

  const onSubmit = async (data: Inputs) => {
    try {
      await authApi.changePassword(
        data.currentPassword,
        data.newPassword,
        socketStore.getState().socket?.id
      )
      reset()
      toast.success("Password updated")
    } catch (err) {
      setError("currentPassword", {
        message: err instanceof Error && err.message ? err.message : "Could not update password",
      })
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={errors.currentPassword ? true : undefined}>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.currentPassword ? true : undefined}
            {...register("currentPassword", { required: "Please enter your current password" })}
          />
          <FieldError>{errors.currentPassword?.message}</FieldError>
        </Field>
        <Field data-invalid={errors.newPassword ? true : undefined}>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.newPassword ? true : undefined}
            {...register("newPassword", {
              required: "Please enter a new password",
              minLength: { value: 8, message: "Password must be at least 8 characters" },
              validate: (value, form) =>
                value !== form.currentPassword || "New password must be different from the current one",
            })}
          />
          <FieldError>{errors.newPassword?.message}</FieldError>
        </Field>
        <Field data-invalid={errors.confirmPassword ? true : undefined}>
          <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword ? true : undefined}
            {...register("confirmPassword", {
              validate: (value, form) => value === form.newPassword || "Passwords do not match",
            })}
          />
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </Field>
        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Change password"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
