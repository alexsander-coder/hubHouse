"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { apiRequest } from "@/lib/api";

type ResetPasswordData = null;

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (token.trim().length < 20) {
      setErrorMessage("Informe um token válido.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest<ResetPasswordData>("/auth/reset-password", {
        method: "POST",
        body: {
          token: token.trim(),
          password,
        },
      });

      setSuccessMessage(response.mensagem ?? "Senha redefinida com sucesso.");
      setPassword("");
      setPasswordConfirm("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível redefinir a senha.");
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

      <section className="relative z-10 w-full max-w-xl rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-2xl shadow-slate-300/50 backdrop-blur sm:p-8 dark:border-white/15 dark:bg-[#0c1220]/85 dark:shadow-[#020617]/80">
        <p className="text-xs tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Atualização de credencial</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">Redefinir senha</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Informe o token e a nova senha para concluir a recuperação da conta.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
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
            <label htmlFor="token" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Token de redefinição
            </label>
            <textarea
              id="token"
              name="token"
              rows={4}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
              placeholder="Cole aqui o token recebido"
              className="w-full rounded-xl border border-slate-300/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 transition focus:border-cyan-500/70 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-300/60 dark:focus:bg-white/8"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Nova senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="Mínimo 12 caracteres, letras maiúsculas, minúsculas, número e símbolo"
              className="h-12 w-full rounded-xl border border-slate-300/80 bg-white px-4 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 transition focus:border-cyan-500/70 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-300/60 dark:focus:bg-white/8"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="passwordConfirm" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Confirmar nova senha
            </label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              required
              placeholder="Repita a nova senha"
              className="h-12 w-full rounded-xl border border-slate-300/80 bg-white px-4 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 transition focus:border-cyan-500/70 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-300/60 dark:focus:bg-white/8"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 dark:from-cyan-400 dark:to-indigo-500"
          >
            {isSubmitting ? "Redefinindo..." : "Redefinir senha"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Já redefiniu?{" "}
          <Link
            href="/login"
            className="font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
          >
            Voltar ao login
          </Link>
        </p>
      </section>
    </main>
  );
}
