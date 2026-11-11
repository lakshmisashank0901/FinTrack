import { Suspense } from "react";
import { BudgetsView } from "@/components/budgets/budgets-view";

export const metadata = { title: "Budgets" };

export default function BudgetsPage() {
  return (
    <Suspense>
      <BudgetsView />
    </Suspense>
  );
}
