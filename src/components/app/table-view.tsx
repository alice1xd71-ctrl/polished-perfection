import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "./table-skeleton";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { DataCard } from "./data-card";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

export function TableView<T extends Record<string, unknown>>({
  title,
  description,
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyTitle = "No data yet",
  emptyDescription,
  actions,
}: {
  title?: string;
  description?: string;
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: ReactNode;
}) {
  return (
    <DataCard title={title} description={description} actions={actions}>
      {loading ? (
        <TableSkeleton cols={columns.length} />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key} className={c.className}>{c.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DataCard>
  );
}
