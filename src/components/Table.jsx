import { Spinner } from "./ui.jsx";

export function ActionBtn({ danger = false, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`cursor-pointer rounded-md px-2 py-1 text-xs font-semibold hover:bg-mist disabled:opacity-40 ${
        danger ? "text-danger hover:bg-danger-light" : ""
      } ${className}`}
    />
  );
}

/** heads: ["Name", "Status", ...]. The last heading is right-aligned (actions). */
export function Table({ heads, loading, empty = "Nothing here yet.", isEmpty, children }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wider text-ink/45">
            {heads.map((h, i) => (
              <th key={h} className={`px-4 py-3 font-bold ${i === heads.length - 1 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading && (
            <tr>
              <td colSpan={heads.length} className="px-4 py-10 text-center">
                <Spinner className="mx-auto h-5 w-5 text-brand" />
              </td>
            </tr>
          )}
          {!loading && isEmpty && (
            <tr>
              <td colSpan={heads.length} className="px-4 py-10 text-center text-ink/50">
                {empty}
              </td>
            </tr>
          )}
          {!loading && children}
        </tbody>
      </table>
    </div>
  );
}
