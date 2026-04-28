import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function TermsPage() {
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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Termos de Uso</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Última atualização: 27/04/2026. Estes termos regulam o uso do Organizador Familiar em caráter de MVP.
        </p>

        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">1. Aceite</h2>
            <p>
              Ao criar uma conta e utilizar a plataforma, você concorda com estes Termos de Uso e com a Política de
              Privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">2. Uso da plataforma</h2>
            <p>
              O serviço é destinado à organização de lares, membros, convites e rotinas. Você se compromete a fornecer
              informações verdadeiras e a não utilizar o sistema para atividades ilícitas.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">3. Conta e segurança</h2>
            <p>
              Você é responsável pela confidencialidade das suas credenciais. Em caso de suspeita de uso indevido,
              recomendamos alteração imediata da senha e contato com o suporte do projeto.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">4. Limites do plano</h2>
            <p>
              O plano gratuito pode possuir limitações de recursos (ex.: quantidade de lares e membros), conforme regras
              de negócio vigentes no momento do uso.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">5. Disponibilidade e mudanças</h2>
            <p>
              Por se tratar de MVP, funcionalidades podem ser alteradas, removidas ou evoluídas sem aviso prévio, visando
              melhorias de segurança e experiência.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/politica-de-privacidade"
            className="rounded-lg border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-300/40 dark:text-cyan-200 dark:hover:bg-cyan-900/30"
          >
            Ver Política de Privacidade
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
