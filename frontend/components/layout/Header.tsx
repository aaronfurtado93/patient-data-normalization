import Link from "next/link";

type HeaderProps = {
  onMenuClick: () => void;
};

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Toggle menu"
        className="rounded p-2 text-slate-700 hover:bg-slate-100"
      >
        <span className="mb-1 block h-0.5 w-6 bg-current" />
        <span className="mb-1 block h-0.5 w-6 bg-current" />
        <span className="block h-0.5 w-6 bg-current" />
      </button>
      {/* Title doubles as the home button — click to return to the Dashboard from any page. */}
      <Link href="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
        Centauri Clinical Snapshot
      </Link>
    </header>
  );
}
