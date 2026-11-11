"use client";

import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useTransactions } from "@/hooks/queries";
import { errorMessage } from "@/lib/api";

export function RecentTransactionsCard() {
  const q = useTransactions({ page: 1, page_size: 8, sort: "date", order: "desc" });
  const { openCreate } = useTransactionDialog();
  return (
    <Card>
      <CardHeader
        title="Recent transactions"
        action={
          <Link href="/transactions">
            <Button size="sm" variant="ghost">
              View all
            </Button>
          </Link>
        }
      />
      <CardBody>
        {q.isLoading ? (
          <SkeletonRows rows={5} />
        ) : q.error ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions yet"
            description="Record your first income or expense to start tracking."
            action={
              <Button variant="primary" size="sm" onClick={() => openCreate()}>
                Add transaction
              </Button>
            }
          />
        ) : (
          <TransactionTable items={q.data.items} dense />
        )}
      </CardBody>
    </Card>
  );
}
