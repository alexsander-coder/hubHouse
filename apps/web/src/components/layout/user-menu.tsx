"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getSession } from "@/lib/auth-session";

type UserMenuProps = {
  userName: string;
  userEmail: string;
  onLogout: () => void;
};

function initials(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed.length >= 2) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "??";
}

export function UserMenu({ userName, userEmail, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; eventId: string | null; title: string; message: string; isRead: boolean; createdAt: string }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el || el.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    const accessToken = session.accessToken;

    async function loadNotifications() {
      try {
        const response = await apiRequest<{
          unreadCount: number;
          items: Array<{ id: string; eventId: string | null; title: string; message: string; isRead: boolean; createdAt: string }>;
        }>("/users/me/notifications", {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setUnreadCount(response.dados.unreadCount);
        setNotifications(response.dados.items);
      } catch {
        // Falhas de notificação não devem quebrar o menu.
      }
    }

    void loadNotifications();
  }, [open]);

  async function markAllAsRead() {
    const session = getSession();
    if (!session) return;
    try {
      await apiRequest("/users/me/notifications/read-all", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      setUnreadCount(0);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch {
      // Não interrompe o uso do menu.
    }
  }

  async function markOneAsRead(notificationId: string) {
    const session = getSession();
    if (!session) return;
    try {
      await apiRequest(`/users/me/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      // Não interrompe navegação.
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 py-1 pl-1 pr-2 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 text-xs font-bold text-white">
          {initials(userName, userEmail)}
        </span>
        <span className="hidden max-w-[140px] truncate text-left text-sm font-medium text-slate-800 sm:block dark:text-slate-100">
          {userName || userEmail}
        </span>
        <span className="sr-only">Abrir menu do perfil</span>
      </button>
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,340px)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 py-2 shadow-xl backdrop-blur sm:w-[320px] dark:border-white/15 dark:bg-[#0c1220]/95"
        >
          <div className="border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userName}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
          </div>
          <Link
            href="/dashboard"
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            Perfil
          </Link>
          <Link
            href="/dashboard"
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            Configurações
          </Link>
          <div className="my-1 border-t border-slate-200/80 dark:border-white/10" />
          <div className="px-4 py-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Notificações</p>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300"
                  onClick={() => void markAllAsRead()}
                >
                  Marcar todas
                </button>
              ) : null}
            </div>
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {notifications.slice(0, 6).map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.eventId ? `/agenda?eventId=${notification.eventId}` : "/agenda"}
                  onClick={() => {
                    setOpen(false);
                    if (!notification.isRead) void markOneAsRead(notification.id);
                  }}
                  className={`block w-full rounded-lg border px-2 py-1.5 text-left ${
                    notification.isRead
                      ? "border-slate-200/70 bg-slate-50/70 dark:border-white/10 dark:bg-white/5"
                      : "border-cyan-300/60 bg-cyan-50/70 dark:border-cyan-400/40 dark:bg-cyan-500/10"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{notification.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">{notification.message}</p>
                </Link>
              ))}
              {notifications.length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Sem notificações no momento.</p>
              ) : null}
            </div>
          </div>
          <div className="my-1 border-t border-slate-200/80 dark:border-white/10" />
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
