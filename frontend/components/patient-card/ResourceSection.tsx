import type { ResourceCardItem } from "./types";

type ResourceSectionProps = {
  title: string;
  items: ResourceCardItem[];
  // Excluded section opens by default — that's the point of it, don't make the user hunt for it.
  defaultOpen?: boolean;
};

export default function ResourceSection({ title, items, defaultOpen }: ResourceSectionProps) {
  if (items.length === 0) {
    return null;
  }

  // Quality-of-life: a collapsed section gives no hint that something inside needs attention —
  // surface a warning + count on the summary itself, matching the ⚠ N style already used per-item
  // (see the checklist in MergeView.tsx), so a reviewer doesn't have to expand every section just
  // to find out which ones matter.
  const discrepancyCount = items.reduce((sum, item) => sum + item.discrepancies.length, 0);

  return (
    <details open={defaultOpen} className="mt-3 rounded border border-slate-200">
      <summary className="flex cursor-pointer select-none items-center gap-2 rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <span>
          {title} ({items.length})
        </span>
        {discrepancyCount > 0 && (
          <span className="text-xs font-semibold text-amber-700">
            ⚠ {discrepancyCount} discrepanc{discrepancyCount === 1 ? "y" : "ies"}
          </span>
        )}
      </summary>
      <ul className="space-y-2 px-3 pb-3">
        {items.map((item) => (
          <li
            key={`${item.resource_type}-${item.resource_id}`}
            className={`rounded border p-2 text-sm ${
              item.excluded ? "border-red-100 bg-red-50" : "border-slate-100 bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{item.summary}</span>
              {item.status && <span className="text-xs text-slate-500">{item.status}</span>}
            </div>
            {item.excluded && (
              <p className="mt-1 text-xs font-semibold text-red-700">
                Excluded — not shown as current fact
              </p>
            )}
            {item.discrepancies.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {item.discrepancies.map((d, index) => (
                  <li key={index} className="text-xs text-amber-700">
                    ⚠ {d.message}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
