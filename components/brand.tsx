import Link from "next/link";
import { cn } from "@/lib/format";

export function Logo({ size = "md", light = false, href = "/" }: { size?: "sm" | "md"; light?: boolean; href?: string }) {
  const box = size === "sm" ? "h-8 w-8 text-[13px]" : "h-9 w-9 text-[14px]";
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Umar Baig home">
      <span
        className={cn(
          "grid place-items-center rounded-[11px] bg-brand font-bold tracking-tight text-white shadow-[0_8px_20px_-10px_rgba(23,105,224,0.9)]",
          box,
        )}
      >
        UB
      </span>
      <span className="leading-tight">
        <span className={cn("block text-[15px] font-semibold tracking-tight", light ? "text-white" : "text-navy")}>Umar Baig</span>
        <span className={cn("block text-[10px] font-medium uppercase tracking-[0.14em]", light ? "text-white/60" : "text-muted")}>
          Private platform
        </span>
      </span>
    </Link>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f4e2bd] bg-[#fffaf0] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9a6b12]">
      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
      Demo
    </span>
  );
}
