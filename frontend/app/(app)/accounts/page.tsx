import { Suspense } from "react";
import { AccountsView } from "@/components/accounts/accounts-view";

export const metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsView />
    </Suspense>
  );
}
