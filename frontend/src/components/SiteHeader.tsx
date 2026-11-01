import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-gray-400/30">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
          >
            H
          </span>
          <span className="text-lg font-bold tracking-tight">HANDOVERIQ</span>
        </Link>
      </div>
    </header>
  );
}