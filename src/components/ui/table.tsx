"use client";

import { ReactNode } from "react";

interface TableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyField: keyof T;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function Table<T>({ columns, data, keyField, onRowClick, emptyMessage = "No data" }: TableProps<T>) {
  return (
    <div className="surface rounded-[var(--radius-xl)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] ${col.className || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--color-text-tertiary)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={String(item[keyField])}
                  onClick={() => onRowClick?.(item)}
                  className={`
                    border-b border-[var(--color-border)] last:border-0
                    transition-colors duration-fast
                    ${onRowClick ? "cursor-pointer hover:bg-[var(--color-accent-subtle)]" : "hover:bg-[rgb(var(--color-bg-secondary))]"}
                  `}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3.5 ${col.className || ""}`}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
