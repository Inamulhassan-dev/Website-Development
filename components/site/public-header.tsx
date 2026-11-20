"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand";
import { LinkButton } from "@/components/ui/primitives";

const links = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/membership", label: "Membership" },
  { href: "/contact", label: "Contact" },
];

export function PublicHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-[13.5px] font-medium text-[#425470] transition hover:bg-surface hover:text-navy"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <LinkButton href="/dashboard" size="sm">
              Open dashboard
            </LinkButton>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-ink transition hover:bg-surface">
                Sign in
              </Link>
              <LinkButton href="/register" size="sm">
                Join now
              </LinkButton>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <LinkButton href={signedIn ? "/dashboard" : "/register"} size="sm">
            {signedIn ? "Dashboard" : "Join"}
          </LinkButton>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-line bg-white px-5 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-ink transition hover:bg-surface"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-sm font-medium text-ink transition hover:bg-surface"
            >
              Sign in
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
