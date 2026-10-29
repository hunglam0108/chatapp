'use client'

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { authStore } from "@/store/authStore"

type Inputs = {
  userAcc: string
  name: string
  email: string
  password: string
  confirmPw: string
}

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Inputs>()
  const { signUp } = authStore();

  const handleSignup = async (data: Inputs) => {
    await signUp({
      userAcc: data.userAcc,
      name: data.name,
      email: data.email,
      password: data.password,
    })
  }

  return (
    <Card {...props} className={cn("w-full rounded-2xl shadow-xl", props.className)}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={handleSubmit(handleSignup)}
          className="space-y-4"
        >
          <FieldGroup>
            <Field data-invalid={errors.userAcc ? true : undefined}>
              <FieldLabel htmlFor="account">User Account Name</FieldLabel>
              <Input
                id="account"
                type="text"
                aria-invalid={errors.userAcc ? true : undefined}
                {...register("userAcc", { required: 'Require field' })}
              />
              <FieldError>{errors.userAcc?.message}</FieldError>
            </Field>
            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input
                id="name"
                type="text"
                aria-invalid={errors.name ? true : undefined}
                {...register("name", { required: 'Require field' })}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                aria-invalid={errors.email ? true : undefined}
                {...register("email", { required: 'Require field' })}
              />
              <FieldError>{errors.email?.message}</FieldError>
            </Field>
            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                aria-invalid={errors.password ? true : undefined}
                {...register("password", {
                  required: 'Require field',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters',
                  },
                })}
              />
              <FieldError>{errors.password?.message}</FieldError>
            </Field>
            <Field data-invalid={errors.confirmPw ? true : undefined}>
              <FieldLabel htmlFor="confirm-password">
                Confirm Password
              </FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                aria-invalid={errors.confirmPw ? true : undefined}
                {...register("confirmPw", {
                  required: 'Require field',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters',
                  },
                  validate: (value: string) => {
                    if (value !== watch('password')) {
                      return "Password must be the same with confirm password !!!";
                    }

                    return true;
                }})}
              />
              <FieldError>{errors.confirmPw?.message}</FieldError>
            </Field>
            <FieldGroup>
              <Field>
                <Button type="submit">Create Account</Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account? <Link href="/signin" className="underline underline-offset-4">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
