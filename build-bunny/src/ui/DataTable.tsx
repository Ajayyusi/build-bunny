import type { ReactNode } from "react";

import { cn } from "./cn";

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Logical alignment — "end" for numeric columns (flips in RTL). */
  align?: "start" | "end";
  className?: string;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  /** Stable row identity; falls back to the array index. */
  rowKey?: (row: Row, index: number) => string;
  /** Localized message rendered when rows is empty (honest empty state). */
  emptyMessage: ReactNode;
  /** Keeps the header visible; the wrapper then scrolls vertically too. */
  stickyHeader?: boolean;
  className?: string;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  stickyHeader = false,
  className,
}: DataTableProps<Row>) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border-token bg-surface-raised",
        stickyHeader && "max-h-[70vh] overflow-y-auto",
        className,
      )}
    >
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "border-b border-border-token bg-surface-sunken px-4 py-3 text-start text-xs font-semibold text-ink-muted",
                  stickyHeader && "sticky top-0 z-10",
                  column.align === "end" && "text-end",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-ink-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey ? rowKey(row, index) : index}
                className="border-b border-border-token last:border-b-0 hover:bg-surface-sunken/50"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 text-ink",
                      column.align === "end" && "text-end",
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
