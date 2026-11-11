"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { api } from "@/lib/api";
import { DATE_FORMATS, NUMBER_FORMATS, PERIODS, TIMEZONES } from "@/lib/constants";
import { preferencesFormSchema, profileFormSchema, type PreferencesFormValues, type ProfileFormValues } from "@/lib/validations/settings";
import type { Profile } from "@/types/api";

const refreshProfile = (qc: import("@tanstack/react-query").QueryClient) => qc.invalidateQueries();

export function ProfileSection({ profile }: { profile?: Profile }) {
  return (
    <Card id="profile">
      <CardHeader title="Profile" description="How FinTrack addresses you." />
      <CardBody>{profile ? <ProfileForm profile={profile} /> : <Skeleton className="h-28" />}</CardBody>
    </Card>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { display_name: profile.display_name ?? "" },
  });
  const save = useFinanceMutation((v: ProfileFormValues) => api.profile.update({ display_name: v.display_name.trim() || null }), {
    success: "Profile saved",
    invalidate: refreshProfile,
    onSuccess: (p) => form.reset({ display_name: p.display_name ?? "" }),
  });
  return (
    <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Display name" error={form.formState.errors.display_name?.message}>
          <Input {...form.register("display_name")} maxLength={80} />
        </Field>
        <Field label="Email" hint="Managed by your sign-in account.">
          <Input value={profile.email ?? ""} readOnly disabled />
        </Field>
        <Field label="Currency" hint="FinTrack currently supports INR only.">
          <Input value="INR (₹)" readOnly disabled />
        </Field>
      </div>
      <Button type="submit" variant="secondary" size="sm" loading={save.isPending} disabled={!form.formState.isDirty}>
        Save profile
      </Button>
    </form>
  );
}

export function PreferencesSection({ profile }: { profile?: Profile }) {
  return (
    <Card id="preferences">
      <CardHeader title="Preferences" description="Defaults applied across the app." />
      <CardBody>{profile ? <PreferencesForm profile={profile} /> : <Skeleton className="h-40" />}</CardBody>
    </Card>
  );
}

function PreferencesForm({ profile }: { profile: Profile }) {
  const { setTheme } = useTheme();
  const p = profile.preferences;
  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      default_period: p.default_period,
      theme: p.theme,
      date_format: p.date_format,
      number_format: p.number_format,
      timezone: p.timezone,
    },
  });
  const save = useFinanceMutation((v: PreferencesFormValues) => api.profile.update({ preferences: v }), {
    success: "Preferences saved",
    invalidate: refreshProfile,
    onSuccess: (res) => {
      setTheme(res.preferences.theme);
      form.reset({
        default_period: res.preferences.default_period,
        theme: res.preferences.theme,
        date_format: res.preferences.date_format,
        number_format: res.preferences.number_format,
        timezone: res.preferences.timezone,
      });
    },
  });
  const zones = TIMEZONES.includes(p.timezone) ? TIMEZONES : [p.timezone, ...TIMEZONES];
  return (
    <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Default dashboard period">
          <Select {...form.register("default_period")}>
            {PERIODS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Theme">
          <Select {...form.register("theme")}>
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Field>
        <Field label="Time zone" hint="Defines “today” and period boundaries.">
          <Select {...form.register("timezone")}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date format">
          <Select {...form.register("date_format")}>
            {DATE_FORMATS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Number format">
          <Select {...form.register("number_format")}>
            {NUMBER_FORMATS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" variant="secondary" size="sm" loading={save.isPending} disabled={!form.formState.isDirty}>
        Save preferences
      </Button>
    </form>
  );
}
