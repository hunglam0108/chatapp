"use client"

import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authApi } from "@/server/auth"
import { authStore } from "@/store/authStore"

const MAX_DISPLAY_NAME = 50

type Inputs = { displayName: string }

export function DisplayNameForm({ displayName }: { displayName: string }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Inputs>({ defaultValues: { displayName } })

  const onSubmit = async (data: Inputs) => {
    try {
      const updated = await authApi.updateProfile(data.displayName.trim())
      const user = authStore.getState().user
      if (user) authStore.setState({ user: { ...user, fullName: updated.displayName } })
      reset({ displayName: updated.displayName })
      toast.success("Display name updated")
    } catch (err) {
      setError("displayName", {
        message: err instanceof Error && err.message ? err.message : "Could not update display name",
      })
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="w-full">
      <Field data-invalid={errors.displayName ? true : undefined}>
        <FieldLabel htmlFor="displayName">Display name</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="displayName"
            maxLength={MAX_DISPLAY_NAME}
            aria-invalid={errors.displayName ? true : undefined}
            {...register("displayName", {
              validate: (value) => value.trim().length > 0 || "Please enter a display name",
            })}
          />
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
        <FieldError>{errors.displayName?.message}</FieldError>
      </Field>
    </form>
  )
}
