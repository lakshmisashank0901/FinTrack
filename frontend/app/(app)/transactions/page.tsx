import { Suspense } from "react";
import { TransactionsView } from "@/components/transactions/transactions-view";

export const metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsView />
    </Suspense>
  );
}
