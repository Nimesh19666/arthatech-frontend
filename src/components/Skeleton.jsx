/** Grey pulsing placeholders shown while a page loads. */
export const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-lg bg-ink/10 ${className}`} aria-hidden />;

export function CardsSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-white p-5">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-3 h-4 w-1/4" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="hidden h-20 sm:block" />
            <Skeleton className="hidden h-20 sm:block" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ count = 5 }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="w-1/2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

/** For inside a <tbody>: renders table rows */
export function TableRowsSkeleton({ cols, count = 5 }) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={i}>
      <td colSpan={cols} className="px-4 py-4">
        <Skeleton className="h-5 w-full" />
      </td>
    </tr>
  ));
}
