"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Check, Copy, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "./toast";
import { buttonClass } from "./primitives";
import { cn } from "@/lib/format";

/* ------------------------------ Copy button ----------------------------- */

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cn(buttonClass("secondary", "sm"), className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast("Copied to clipboard");
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          toast("Could not access the clipboard. Select and copy manually.", "error");
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </button>
  );
}

/* ------------------------------ Submit button --------------------------- */

export function SubmitButton({
  children,
  pendingLabel = "Please wait…",
  variant = "primary",
  size = "md",
  className,
  disabled,
  name,
  value,
  confirm,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "soft" | "success";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const confirmed = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const submit = () => {
    confirmed.current = true;
    setOpen(false);
    buttonRef.current?.form?.requestSubmit();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type={confirm ? "button" : "submit"}
        name={name}
        value={value}
        disabled={pending || disabled}
        className={buttonClass(variant as never, size as never, className)}
        onClick={
          confirm
            ? (event) => {
                if (confirmed.current) {
                  confirmed.current = false;
                  return;
                }
                event.preventDefault();
                setOpen(true);
              }
            : undefined
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? pendingLabel : children}
      </button>
      {confirm && open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy/35 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true">
          <div className="animate-in w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-float">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fdf5e7] text-warning">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold text-navy">Please confirm</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{confirm}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-muted hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary", "sm")}>
                Cancel
              </button>
              <button type="button" onClick={submit} className={buttonClass(variant === "danger" ? "danger" : "primary", "sm")}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ---------------------------- Password input ---------------------------- */

export function PasswordInput({
  name,
  placeholder,
  autoComplete,
  required,
  minLength,
  id,
  defaultValue,
}: {
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  id?: string;
  defaultValue?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-xl border border-line bg-white px-3.5 pr-11 text-sm text-ink placeholder:text-[#9aa8bd] transition focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none"
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ------------------------------- Toggle --------------------------------- */

export function Toggle({ defaultChecked, name, label }: { defaultChecked?: boolean; name: string; label?: string }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="hidden" name={name} value={on ? "true" : "false"} />
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn("relative h-6 w-11 rounded-full transition", on ? "bg-brand" : "bg-[#d7dfeb]")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
      {label ? <span className="text-[13px] text-ink">{label}</span> : null}
    </label>
  );
}

/* ----------------------------- Collapsible ------------------------------ */

export function Reveal({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 text-left">
        {label}
        <span className="text-[11px] text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

/* --------------------------- Auto-submit select ------------------------- */

export function AutoSubmitForm({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const onChange = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "SELECT") form.requestSubmit();
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);
  return (
    <form ref={ref} className={className}>
      {children}
    </form>
  );
}
