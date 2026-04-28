"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { apiRequest } from "@/lib/api";

type RegisterData = {
  userId: string;
  verificationTokenForDev: string;
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationTokenForDev, setVerificationTokenForDev] = useState<string | null>(null);

  const verifyEmailLink = useMemo(() => {
    if (!verificationTokenForDev) {
      return "/verify-email";
    }

    return `/verify-email?token=${encodeURIComponent(verificationTokenForDev)}`;
  }, [verificationTokenForDev]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setVerificationTokenForDev(null);

    if (password !== passwordConfirm) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest<RegisterData>("/auth/register", {
        method: "POST",
        body: {
          name,
          email,
          password,
        },
      });

      setSuccessMessage(response.mensagem ?? "Conta criada com sucesso.");
      setVerificationTokenForDev(response.dados.verificationTokenForDev);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível criar a conta.");
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

      <section className="relative z-10 grid w-full max-w-6xl overflow-visible md:overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-2xl shadow-slate-300/50 backdrop-blur md:grid-cols-2 dark:border-white/15 dark:bg-[#0c1220]/85 dark:shadow-[#020617]/80">
        <div className="hidden flex-col justify-between border-r border-slate-200/90 p-10 md:flex dark:border-white/10">
          <div>
            <p className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:border-cyan-300/30 dark:text-cyan-200">
              Comece em minutos
            </p>
            <h1 className="mt-6 text-3xl font-semibold leading-tight text-slate-900 lg:text-4xl dark:text-white">
              Um espaço só seu.
              <span className="block text-cyan-700 dark:text-cyan-200">Convites com controle.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300">
              Crie sua conta e organize lares com limites claros por plano, permissões por membro e
              segurança desde o primeiro passo.
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="font-medium text-slate-900 dark:text-white">Planos transparentes</p>
              <p className="mt-1 text-xs">Free com limites claros; upgrade quando fizer sentido.</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="font-medium text-slate-900 dark:text-white">Privacidade em primeiro lugar</p>
              <p className="mt-1 text-xs">Sem dados bancários sensíveis neste MVP.</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8 md:p-10">
          <div className="mx-auto w-full max-w-md">
            <p className="text-xs tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400 md:hidden">
              Cadastro
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">
              Criar conta
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Preencha os dados para começar. Você poderá criar seu primeiro lar depois do login.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              {errorMessage ? (
                <p className="rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-950/40 dark:text-red-200">
                  {errorMessage}
                </p>
              ) : null}
              {successMessage ? (
                <div className="space-y-3 rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 break-words dark:border-emerald-400/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <p>{successMessage}</p>
                  <Link
                    href={verifyEmailLink}
                    className="inline-flex rounded-lg border border-emerald-500/50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-300/40 dark:text-emerald-100 dark:hover:bg-emerald-900/60"
                  >
                    Verificar e-mail agora
                  </Link>
                </div>
              ) : null}
              {verificationTokenForDev ? (
                <p className="rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-xs text-amber-800 break-all dark:border-amber-300/40 dark:bg-amber-950/40 dark:text-amber-200">
                  Token de verificação (modo dev): <span className="font-semibold">{verificationTokenForDev}</span>
                </p>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Nome completo
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  placeholder="Seu nome"
                  className="h-12 w-full rounded-xl border border-slate-300/80 bg-white px-4 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 transition focus:border-cyan-500/70 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-300/60 dark:focus:bg-white/8"
                />
              </div>

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
                  Confirmar senha
                </label>
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  required
                  placeholder="Repita a senha"
                  className="h-12 w-full rounded-xl border border-slate-300/80 bg-white px-4 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 transition focus:border-cyan-500/70 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-300/60 dark:focus:bg-white/8"
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  required
                  className="mt-1 h-4 w-4 rounded border-slate-300 bg-white dark:border-white/20 dark:bg-white/10"
                />
                <span>
                  Li e aceito os{" "}
                  <Link
                    href="/termos-de-uso"
                    className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-200"
                  >
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link
                    href="/politica-de-privacidade"
                    className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-200"
                  >
                    Política de Privacidade
                  </Link>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 dark:from-cyan-400 dark:to-indigo-500"
              >
                {isSubmitting ? "Criando conta..." : "Criar conta"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Já tem conta?{" "}
              <Link
                href="/login"
                className="font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
              >
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}


