"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { apiRequest } from "@/lib/api";
import { getSession } from "@/lib/auth-session";

type LoginData = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session?.accessToken) {
      window.location.replace("/dashboard");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await apiRequest<LoginData>("/auth/login", {
        method: "POST",
        body: {
          email,
          password,
        },
      });

      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("cmdmvp_access_token", response.dados.accessToken);
      storage.setItem("cmdmvp_refresh_token", response.dados.refreshToken);
      storage.setItem("cmdmvp_user", JSON.stringify(response.dados.user));

      setSuccessMessage(response.mensagem ?? "Login realizado com sucesso.");
      window.location.replace("/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden px-3 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 opacity-50">
        <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -right-14 top-16 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <section className="relative z-10 grid w-full max-w-6xl overflow-visible rounded-3xl border border-slate-200/90 bg-white/90 shadow-2xl shadow-slate-300/50 backdrop-blur md:grid-cols-2 md:overflow-hidden dark:border-white/15 dark:bg-[#0c1220]/85 dark:shadow-[#020617]/80">
        <div className="hidden flex-col justify-between border-r border-slate-200/90 p-10 md:flex dark:border-white/10">
          <div>
            <p className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-300/30 dark:text-cyan-200">
              Organizador Familiar
            </p>
            <h1 className="mt-6 text-3xl font-semibold leading-tight text-slate-900 lg:text-4xl dark:text-white">
              Sua casa em sincronia.
              <span className="block text-cyan-700 dark:text-cyan-200">Sem caos, sem ruído.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300">
              Centralize rotina, tarefas e convites de membros com uma experiência premium desde o
              primeiro acesso.
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="font-medium text-slate-900 dark:text-white">Controle por lares</p>
              <p className="mt-1 text-xs">Permissões por membro e regras por plano.</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="font-medium text-slate-900 dark:text-white">Segurança forte</p>
              <p className="mt-1 text-xs">Autenticação robusta e validações consistentes.</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8 md:p-10">
          <div className="mx-auto w-full max-w-md">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 md:hidden">
              Organizador Familiar
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">
              Entrar na plataforma
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Acesse sua conta para gerenciar lares, membros e convites.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              {errorMessage ? (
                <p className="rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-950/40 dark:text-red-200">
                  {errorMessage}
                </p>
              ) : null}
              {successMessage ? (
                <p className="rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {successMessage}
                </p>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="voce@exemplo.com"
                  className="h-12 w-full rounded-xl border border-slate-300/80 bg-white px-4 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 transition focus:border-cyan-500/70 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-300/60 dark:focus:bg-white/8"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="Sua senha"
                  className="h-12 w-full rounded-xl border border-slate-300/80 bg-white px-4 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 transition focus:border-cyan-500/70 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-300/60 dark:focus:bg-white/8"
                />
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 bg-white dark:border-white/20 dark:bg-white/10"
                  />
                  Manter conectado
                </label>
                <Link
                  href="/esqueci-senha"
                  className="text-cyan-700 transition hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
                >
                  Esqueci minha senha
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 dark:from-cyan-400 dark:to-indigo-500"
              >
                {isSubmitting ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Ainda não tem conta?{" "}
              <Link
                href="/register"
                className="font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
