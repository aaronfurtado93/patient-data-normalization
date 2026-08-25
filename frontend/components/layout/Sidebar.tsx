import Link from "next/link";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

// Grow this list as more pages land.
const MENU_ITEMS = [
  { label: "Patient Record Processing", href: "/patient-record-processing" },
  { label: "User Guide", href: "/user-guide" },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-10 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />
      <nav
        aria-label="Main menu"
        className="fixed inset-y-0 left-0 z-20 w-64 border-r border-slate-200 bg-white p-4 shadow-lg"
      >
        <ul className="space-y-1">
          {MENU_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className="block rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
