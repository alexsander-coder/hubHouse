"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { apiRequest } from "@/lib/api";

type VerifyEmailData = null;

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
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

    setIsSubmitting(true);

    try {
      const response = await apiRequest<VerifyEmailData>("/auth/verify-email", {
        method: "POST",
        body: {
          token: token.trim(),
        },
      });

      setSuccessMessage(response.mensagem ?? "E-mail verificado com sucesso.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível verificar o e-mail.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 opacity-50">
        <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -right-14 top-16 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <section className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-2xl shadow-slate-300/50 backdrop-blur md:grid-cols-2 dark:border-white/15 dark:bg-[#0c1220]/85 dark:shadow-[#020617]/80">
        <div className="hidden flex-col justify-between border-r border-slate-200/90 p-10 md:flex dark:border-white/10">
          <div>
            <p className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:border-cyan-300/30 dark:text-cyan-200">
              Último passo
            </p>
            <h1 className="mt-6 text-3xl font-semibold leading-tight text-slate-900 lg:text-4xl dark:text-white">
              Confirme seu e-mail.
              <span className="block text-cyan-700 dark:text-cyan-200">Ative sua conta.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300">
              No ambiente de desenvolvimento, use o token retornado no cadastro para concluir a validação.
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="font-medium text-slate-900 dark:text-white">Segurança ativa</p>
              <p className="mt-1 text-xs">Sem e-mail verificado, o login não é liberado.</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="font-medium text-slate-900 dark:text-white">Experiência consistente</p>
              <p className="mt-1 text-xs">Mesmo fluxo em dev e produção; muda apenas o canal de entrega.</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 md:p-10">
          <div className="mx-auto w-full max-w-md">
            <p className="text-xs tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400 md:hidden">
              Verificação
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">
              Verificar e-mail
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Cole o token de verificação para ativar sua conta.
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
                <label htmlFor="token" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Token
                </label>
                <textarea
                  id="token"
                  name="token"
                  rows={4}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                  placeholder="Cole aqui o token gerado no cadastro"
                  className="w-full rounded-xl border border-slate-300/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 transition focus:border-cyan-500/70 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-300/60 dark:focus:bg-white/8"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 dark:from-cyan-400 dark:to-indigo-500"
              >
                {isSubmitting ? "Verificando..." : "Verificar e-mail"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              <p>
                Conta já verificada?{" "}
                <Link
                  href="/login"
                  className="font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
                >
                  Entrar
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
