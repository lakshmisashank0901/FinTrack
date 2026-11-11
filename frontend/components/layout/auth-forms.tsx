"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase/client";
import {
  forgotSchema,
  loginSchema,
  resetSchema,
  signupSchema,
  type ForgotValues,
  type LoginValues,
  type ResetValues,
  type SignupValues,
} from "@/lib/validations/auth";

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-[13px] text-fg-subtle">{subtitle}</p> : null}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-negative-soft px-3 py-2 text-xs text-negative">
      {message}
    </p>
  );
}

function Notice({ message }: { message: string }) {
  return <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">{message}</p>;
}

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard");

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword(v);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      return;
    }
    router.replace(safeNext(params.get("next")));
    router.refresh();
  });

  return (
    <>
      <Heading title="Welcome back" subtitle="Sign in to your FinTrack account." />
      {params.get("expired") ? <Notice message="Your session expired. Please sign in again." /> : null}
      {params.get("error") === "link" ? <Notice message="That link is invalid or has expired." /> : null}
      {params.get("reset") ? <Notice message="Password updated. Sign in with your new password." /> : null}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Email" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register("password")} />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-xs text-fg-muted hover:text-fg">
            Forgot password?
          </Link>
        </div>
        <FormError message={error} />
        <Button type="submit" variant="primary" className="w-full" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-5 text-center text-xs text-fg-subtle">
        New to FinTrack?{" "}
        <Link href="/signup" className="font-medium text-fg hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { display_name: "", email: "", password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const { data, error } = await getSupabase().auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: v.display_name ? { display_name: v.display_name } : undefined,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
    } else {
      setSentTo(v.email);
    }
  });

  if (sentTo) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-accent" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">Check your email</h1>
        <p className="mt-1 text-[13px] text-fg-muted">
          We sent a confirmation link to <span className="font-medium text-fg">{sentTo}</span>. Open it to activate your account.
        </p>
        <Link href="/login" className="mt-5 inline-block text-xs font-medium text-fg hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <Heading title="Create your account" subtitle="Start tracking in under a minute." />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Name" error={formState.errors.display_name?.message} optional>
          <Input autoComplete="name" {...register("display_name")} />
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Password" error={formState.errors.password?.message} hint="At least 8 characters with a letter and a number.">
          <Input type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label="Confirm password" error={formState.errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register("confirm")} />
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" className="w-full" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-5 text-center text-xs text-fg-subtle">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-fg hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const { error } = await getSupabase().auth.resetPasswordForEmail(v.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) setError(error.message);
    else setSent(true);
  });

  return (
    <>
      <Heading title="Reset your password" subtitle="We'll email you a link to choose a new password." />
      {sent ? (
        <Notice message="If an account exists for that email, a reset link is on its way." />
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Email" error={formState.errors.email?.message}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </Field>
          <FormError message={error} />
          <Button type="submit" variant="primary" className="w-full" loading={formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-xs">
        <Link href="/login" className="font-medium text-fg hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setError("This reset link has expired. Request a new one.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) {
      setError(error.message);
      return;
    }
    await supabase.auth.signOut();
    router.replace("/login?reset=1");
  });
  return (
    <>
      <Heading title="Choose a new password" />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="New password" error={formState.errors.password?.message} hint="At least 8 characters with a letter and a number.">
          <Input type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label="Confirm password" error={formState.errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register("confirm")} />
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" className="w-full" loading={formState.isSubmitting}>
          Update password
        </Button>
      </form>
      <p className="mt-5 text-center text-xs">
        <Link href="/forgot-password" className="font-medium text-fg hover:underline">
          Request a new link
        </Link>
      </p>
    </>
  );
}
