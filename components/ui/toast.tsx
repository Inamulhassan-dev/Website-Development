"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

/** Fire a toast from any client component. */
export function toast(message: string, tone: ToastTone = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ub:toast", { detail: { message, tone } }));
}

function ToastViewport() {
  const params = useSearchParams();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone?: ToastTone }>).detail;
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev.slice(-2), { id, message: detail.message, tone: detail.tone ?? "success" }]);
      window.setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 5200);
    };
    window.addEventListener("ub:toast", onToast);
    return () => window.removeEventListener("ub:toast", onToast);
  }, []);

  useEffect(() => {
    const success = params.get("toast");
    const error = params.get("error");
    const message = success ?? error;
    if (!message) return;
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, message, tone: error ? "error" : "success" }]);
    window.setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 5200);
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    url.searchParams.delete("error");
    url.searchParams.delete("tone");
    window.history.replaceState({}, "", url.toString());
  }, [params]);

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className="animate-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border border-line bg-white px-4 py-3 shadow-float"
        >
          {item.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          ) : item.tone === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          )}
          <p className="flex-1 text-[13px] font-medium leading-snug text-ink">{item.message}</p>
          <button
            aria-label="Dismiss"
            onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
            className="text-muted transition hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Toaster() {
  return (
    <Suspense fallback={null}>
      <ToastViewport />
    </Suspense>
  );
}
