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

  return (
    <details open={defaultOpen} className="mt-3 rounded border border-slate-200">
      <summary className="cursor-pointer select-none rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {title} ({items.length})
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
