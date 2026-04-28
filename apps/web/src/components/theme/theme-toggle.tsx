"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-full border-0 bg-transparent text-slate-600 dark:text-slate-300"
      aria-label={isDark ? "Usar tema claro" : "Usar tema escuro"}
      role="switch"
      aria-checked={isDark}
    >
      <span className="relative h-[26px] w-[46px] rounded-full border border-slate-300/90 bg-gradient-to-r from-slate-200 to-slate-300/90 shadow-inner dark:border-white/10 dark:from-slate-600 dark:to-slate-700">
        <span className="pointer-events-none absolute inset-[3px] flex items-center justify-between">
          <SunIcon
            className={`h-[11px] w-[11px] shrink-0 text-amber-500 transition-opacity duration-200 ${
              isDark ? "opacity-25" : "opacity-100"
            }`}
          />
          <MoonIcon
            className={`h-[11px] w-[11px] shrink-0 text-indigo-200 transition-opacity duration-200 ${
              isDark ? "opacity-100" : "opacity-25"
            }`}
          />
        </span>
        <span
          className={`absolute left-[3px] top-[3px] z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/[0.06] transition-transform duration-200 ease-out dark:bg-slate-100 dark:ring-white/20 ${
            isDark ? "translate-x-5" : "translate-x-0"
          }`}
        >
          {isDark ? (
            <MoonIcon className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-700" />
          ) : (
            <SunIcon className="h-2.5 w-2.5 text-amber-500" />
          )}
        </span>
      </span>
    </button>
  );
}
