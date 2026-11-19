import Link from "next/link";
import { cn } from "./cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8", className)}>
      <rect width="64" height="64" rx="14" fill="#4F2FD0" />
      <path d="M14 40h20" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path d="M30 24h20" stroke="#FFE45C" strokeWidth="8" strokeLinecap="round" />
      <path d="M14 24h10M40 40h10" stroke="#fff" strokeOpacity=".55" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink", className)} aria-label="HandoverIQ home">
      <LogoMark />
      <span>
        Handover<span className="mark">IQ</span>
      </span>
    </Link>
  );
}
