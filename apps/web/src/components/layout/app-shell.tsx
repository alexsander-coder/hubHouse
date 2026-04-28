"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

type NavItem = {
  key: string;
  label: string;
  href: string;
};

type AppShellProps = {
  activeKey: string;
  /** Nome do lar (anfitrião); quando ausente, usa o produto como título. */
  larNome?: string | null;
  userName: string;
  userEmail: string;
  onLogout: () => void;
  children: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "agenda", label: "Agenda", href: "/agenda" },
  { key: "documentos", label: "Documentos", href: "/documentos" },
  { key: "membros", label: "Membros", href: "/dashboard" },
  { key: "convites", label: "Convites", href: "/dashboard" },
  { key: "plano", label: "Plano", href: "/dashboard" },
  { key: "config", label: "Config", href: "/dashboard" },
];

const MOBILE_ITEMS = NAV_ITEMS.slice(0, 4);

export function AppShell({
  activeKey,
  larNome,
  userName,
  userEmail,
  onLogout,
  children,
}: AppShellProps) {
  const tituloPrincipal = larNome?.trim() || "Organizador Familiar";
  const subtituloMarca = larNome?.trim()
    ? "Organizador Familiar"
    : "Painel";

  return (
    <main className="relative min-h-screen overflow-x-hidden pb-20 md:pb-0">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -right-14 top-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl gap-4 px-3 py-4 sm:px-6 md:gap-6 md:py-6">
        <aside className="hidden w-64 shrink-0 rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-xl backdrop-blur md:flex md:flex-col dark:border-white/15 dark:bg-[#0c1220]/85">
          <div className="px-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{tituloPrincipal}</p>
            <p className="truncate text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {subtituloMarca}
            </p>
          </div>
          <nav className="mt-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = item.key === activeKey;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-cyan-500/15 text-cyan-800 dark:bg-cyan-400/20 dark:text-cyan-100"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:px-5 dark:border-white/15 dark:bg-[#0c1220]/95">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="min-w-0 shrink">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{tituloPrincipal}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtituloMarca}</p>
              </Link>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <UserMenu userName={userName} userEmail={userEmail} onLogout={onLogout} />
              </div>
            </div>
          </header>

          <section className="mt-4 min-w-0 flex-1 rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xl backdrop-blur md:p-6 dark:border-white/15 dark:bg-[#0c1220]/85">
            {children}
          </section>
        </div>
      </div>

      <nav className="fixed inset-x-2 bottom-2 z-20 rounded-2xl border border-slate-200/90 bg-white/95 p-1 shadow-xl backdrop-blur md:hidden dark:border-white/15 dark:bg-[#0c1220]/95">
        <div className="grid grid-cols-4 gap-1">
          {MOBILE_ITEMS.map((item) => {
            const active = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-xl px-2 py-2 text-center text-[11px] font-semibold transition ${
                  active
                    ? "bg-cyan-500/15 text-cyan-800 dark:bg-cyan-400/20 dark:text-cyan-100"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
