"use client";

import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/hooks/queries";
import { errorMessage } from "@/lib/api";
import { CategoriesSection } from "./categories-section";
import { DataSection } from "./data-section";
import { PreferencesSection, ProfileSection } from "./profile-section";

export function SettingsView() {
  const profile = useProfile();
  return (
    <>
      <PageHeader title="Settings" description="Profile, preferences, categories and your data." />
      <div className="space-y-4">
        {profile.error ? (
          <Card>
            <ErrorState message={errorMessage(profile.error)} onRetry={() => profile.refetch()} />
          </Card>
        ) : (
          <>
            <ProfileSection profile={profile.data} />
            <PreferencesSection profile={profile.data} />
          </>
        )}
        <CategoriesSection />
        <DataSection />
      </div>
    </>
  );
}
