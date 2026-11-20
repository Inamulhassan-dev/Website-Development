import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/format";

/* ------------------------------- Buttons -------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_10px_24px_-12px_rgba(23,105,224,0.9)] hover:bg-brand-dark active:translate-y-px",
  secondary: "bg-white text-ink border border-line hover:bg-surface hover:border-[#d7dfeb]",
  ghost: "bg-transparent text-ink hover:bg-surface",
  danger: "bg-danger text-white hover:bg-[#c23a3a]",
  soft: "bg-brandsoft text-brand hover:bg-[#dbeaff]",
  success: "bg-success text-white hover:bg-[#128c5b]",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
  icon: "h-10 w-10 justify-center",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
    variantClass[variant],
    sizeClass[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  target?: string;
  rel?: string;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/* -------------------------------- Cards --------------------------------- */

export function Card({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return <div id={id} className={cn("rounded-2xl border border-line bg-white shadow-card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-navy">{title}</h3>
        {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-5 sm:px-6", className)}>{children}</div>;
}

/* -------------------------------- Forms --------------------------------- */

const fieldBase =
  "w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink placeholder:text-[#9aa8bd] transition focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none disabled:bg-surface";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-[110px] py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "h-11 appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-[12px] font-medium text-danger">{error}</p> : hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("h-4 w-4 shrink-0 rounded border-line text-brand accent-[#1769e0]", className)}
      {...props}
    />
  );
}

/* -------------------------------- Badges -------------------------------- */

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface text-[#5b6b82] ring-line",
  brand: "bg-brandsoft text-brand ring-[#cfe2ff]",
  success: "bg-[#e9f8f1] text-success ring-[#c7ecda]",
  warning: "bg-[#fdf5e7] text-[#a9741d] ring-[#f4e2bd]",
  danger: "bg-[#fdecec] text-danger ring-[#f6d0d0]",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const map: Record<Tone, string> = {
    neutral: "bg-[#94a3b8]",
    brand: "bg-brand",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  };
  return <span className={cn("h-1.5 w-1.5 rounded-full", map[tone])} />;
}

/* -------------------------------- Tables -------------------------------- */

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full overflow-x-auto scrollbar-thin", className)}>{children}</div>;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn("w-full min-w-[640px] border-collapse text-left text-sm", className)}>{children}</table>;
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("border-b border-line bg-[#fafcff] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted first:pl-5 last:pr-5", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line/70 px-4 py-3.5 align-middle text-[13.5px] first:pl-5 last:pr-5", className)}>{children}</td>;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("transition hover:bg-[#fafcff]", className)}>{children}</tr>;
}

/* ------------------------------- Feedback ------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-muted">{icon}</div> : null}
      <p className="text-sm font-semibold text-navy">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Progress({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "success" | "warning" }) {
  const bg = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-brand";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[#eef2f7]", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", bg)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const iconTone: Record<Tone, string> = {
    neutral: "bg-surface text-muted",
    brand: "bg-brandsoft text-brand",
    success: "bg-[#e9f8f1] text-success",
    warning: "bg-[#fdf5e7] text-warning",
    danger: "bg-[#fdecec] text-danger",
  };
  const body = (
    <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-float">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-muted">{label}</p>
          <p className="mt-1.5 truncate text-[22px] font-semibold tracking-tight text-navy">{value}</p>
          {hint ? <p className="mt-1 text-[12px] text-muted">{hint}</p> : null}
        </div>
        {icon ? <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconTone[tone])}>{icon}</div> : null}
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  const sizes = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-[13px]", lg: "h-14 w-14 text-[16px]" };
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-brandsoft font-semibold text-brand", sizes[size])}>
      {letters || "U"}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-semibold tracking-tight text-navy sm:text-[26px]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function DemoRibbon() {
  return (
    <div className="border-b border-[#f4e2bd] bg-[#fffaf0] px-4 py-1.5 text-center text-[11.5px] font-medium text-[#8a6114]">
      Demonstration environment — payments, rewards and withdrawals are simulated. No real money moves.
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[13.5px] font-medium text-ink sm:text-right">{children}</span>
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-[15px] font-semibold text-navy">{children}</h3>
      {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </div>
  );
}
