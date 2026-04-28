import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function PrivacyPage() {
  return (
    <main className="relative flex min-h-screen items-start justify-center overflow-x-hidden px-3 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 opacity-50">
        <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -right-14 top-16 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <section className="relative z-10 w-full max-w-4xl rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-2xl shadow-slate-300/50 backdrop-blur sm:p-8 dark:border-white/15 dark:bg-[#0c1220]/85 dark:shadow-[#020617]/80">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Última atualização: 27/04/2026. Esta política descreve como tratamos dados pessoais no Organizador Familiar.
        </p>

        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">1. Dados coletados</h2>
            <p>
              Coletamos dados de cadastro (nome, e-mail e credenciais), informações de lares e metadados técnicos mínimos
              necessários para autenticação e segurança.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">2. Finalidade do uso</h2>
            <p>
              Os dados são utilizados para criação de conta, controle de acesso, operação das funcionalidades da plataforma
              e prevenção de abuso.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">3. Compartilhamento</h2>
            <p>
              Não comercializamos dados pessoais. O compartilhamento ocorre apenas quando necessário para operação técnica,
              cumprimento legal ou defesa de direitos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">4. Armazenamento e segurança</h2>
            <p>
              Adotamos medidas técnicas compatíveis com o estágio MVP, incluindo práticas de autenticação segura e proteção
              de credenciais.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">5. Direitos do titular</h2>
            <p>
              Você pode solicitar atualização, correção ou exclusão de dados, conforme aplicável, por meio dos canais de
              suporte do projeto.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/termos-de-uso"
            className="rounded-lg border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-300/40 dark:text-cyan-200 dark:hover:bg-cyan-900/30"
          >
            Ver Termos de Uso
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Voltar ao cadastro
          </Link>
        </div>
      </section>
    </main>
  );
}
