"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiRequest } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth-session";

type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  };
  plan: {
    tier: "FREE" | "PRO";
    limits: {
      households: number;
      membersPerHousehold: number;
      participationHouseholds: number;
    };
  };
  onboarding: {
    householdCount: number;
    participationCount: number;
    needsFirstHousehold: boolean;
  };
  larEmDestaque: {
    id: string;
    name: string;
    myRole: "HOST" | "ADMIN" | "EDITOR" | "VIEWER" | null;
    membersCount: number;
  } | null;
};

type PriorityItem = {
  title: string;
  description: string;
  tone: "critical" | "warning" | "success";
};

type HouseholdListItem = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  members: Array<{
    id: string;
    userId: string;
    role: "HOST" | "ADMIN" | "EDITOR" | "VIEWER";
  }>;
};

type InviteActivityItem = {
  id: string;
  householdId: string;
  householdName: string;
  email: string;
  role: "HOST" | "ADMIN" | "EDITOR" | "VIEWER";
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
};

export default function DashboardPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [headerName, setHeaderName] = useState("");
  const [headerEmail, setHeaderEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<MeResponse | null>(null);
  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [inviteActivity, setInviteActivity] = useState<InviteActivityItem[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [householdFeedback, setHouseholdFeedback] = useState<string | null>(null);
  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "EDITOR" | "VIEWER">("VIEWER");
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    setHeaderName(session.user.name ?? "");
    setHeaderEmail(session.user.email ?? "");
    const accessTokenFromSession = session.accessToken;
    setAccessToken(accessTokenFromSession);

    async function loadMe() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const meResponse = await apiRequest<MeResponse>("/users/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessTokenFromSession}`,
          },
        });

        const householdFilter = meResponse.dados.larEmDestaque?.id;
        const [householdsResponse, invitesResponse] = await Promise.all([
          apiRequest<{ items: HouseholdListItem[] }>("/households/me", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessTokenFromSession}`,
            },
          }),
          apiRequest<{ items: InviteActivityItem[] }>(
            householdFilter ? `/invites/me?householdId=${householdFilter}` : "/invites/me",
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessTokenFromSession}`,
              },
            },
          ),
        ]);

        setData(meResponse.dados);
        setHeaderName(meResponse.dados.user.name);
        setHeaderEmail(meResponse.dados.user.email);
        setHouseholds(householdsResponse.dados.items);
        setInviteActivity(invitesResponse.dados.items);
      } catch (error) {
        clearSession();
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar seu painel.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadMe();
  }, [router]);

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  async function refreshMeData() {
    if (!accessToken) {
      return;
    }

    const meResponse = await apiRequest<MeResponse>("/users/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const householdFilter = meResponse.dados.larEmDestaque?.id;
    const [householdsResponse, invitesResponse] = await Promise.all([
      apiRequest<{ items: HouseholdListItem[] }>("/households/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
      apiRequest<{ items: InviteActivityItem[] }>(
        householdFilter ? `/invites/me?householdId=${householdFilter}` : "/invites/me",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
    ]);

    setData(meResponse.dados);
    setHeaderName(meResponse.dados.user.name);
    setHeaderEmail(meResponse.dados.user.email);
    setHouseholds(householdsResponse.dados.items);
    setInviteActivity(invitesResponse.dados.items);
  }

  async function handleCreateHousehold() {
    if (!accessToken || !householdName.trim()) {
      return;
    }

    try {
      setIsCreatingHousehold(true);
      setHouseholdFeedback(null);
      await apiRequest("/households", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { name: householdName.trim() },
      });
      setHouseholdName("");
      setHouseholdFeedback("Lar criado com sucesso.");
      await refreshMeData();
    } catch (error) {
      setHouseholdFeedback(error instanceof Error ? error.message : "Não foi possível criar o lar.");
    } finally {
      setIsCreatingHousehold(false);
    }
  }

  async function handleInviteMember() {
    if (!accessToken || !data?.larEmDestaque?.id || !inviteEmail.trim()) {
      return;
    }

    try {
      setIsInviting(true);
      setInviteFeedback(null);
      await apiRequest(`/invites/households/${data.larEmDestaque.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          email: inviteEmail.trim(),
          role: inviteRole,
        },
      });
      setInviteEmail("");
      setInviteRole("VIEWER");
      setInviteFeedback("Convite enviado com sucesso.");
    } catch (error) {
      setInviteFeedback(error instanceof Error ? error.message : "Não foi possível enviar o convite.");
    } finally {
      setIsInviting(false);
    }
  }

  function getPriorityItems(payload: MeResponse): PriorityItem[] {
    const items: PriorityItem[] = [];

    if (payload.onboarding.needsFirstHousehold) {
      items.push({
        title: "Criar o primeiro lar",
        description: "Sem isso você não consegue convidar membros nem iniciar a organização.",
        tone: "critical",
      });
    }

    if (!payload.user.emailVerified) {
      items.push({
        title: "Validar e-mail da conta",
        description: "A confirmação de e-mail protege sua conta e evita bloqueios futuros.",
        tone: "warning",
      });
    }

    if (payload.plan.tier === "FREE" && payload.onboarding.householdCount >= payload.plan.limits.households) {
      items.push({
        title: "Limite do plano atingido",
        description: "Seu plano atual chegou ao limite de lares. Upgrade libera novos espaços.",
        tone: "warning",
      });
    }

    if (items.length === 0) {
      items.push({
        title: "Tudo sob controle",
        description: "Seu painel está saudável e pronto para novas ações.",
        tone: "success",
      });
    }

    return items;
  }

  const priorityItems = data ? getPriorityItems(data) : [];
  const checklist = data
    ? [
        {
          label: "Criar primeiro lar",
          done: !data.onboarding.needsFirstHousehold,
        },
        {
          label: "Validar e-mail da conta",
          done: data.user.emailVerified,
        },
        {
          label: "Escolher plano ideal para sua família",
          done: data.plan.tier === "PRO",
        },
      ]
    : [];
  const completedChecklistCount = checklist.filter((item) => item.done).length;
  const completionPercentage = checklist.length ? Math.round((completedChecklistCount / checklist.length) * 100) : 0;
  const principalActionLabel = data?.onboarding.needsFirstHousehold
    ? "Criar meu primeiro lar"
    : "Convidar membros para o lar";
  const roleLabel: Record<"HOST" | "ADMIN" | "EDITOR" | "VIEWER", string> = {
    HOST: "Anfitrião",
    ADMIN: "Administrador",
    EDITOR: "Editor",
    VIEWER: "Visualizador",
  };
  const myRole = data?.larEmDestaque?.myRole ?? null;
  const canInvite = myRole === "HOST";
  const canCreateHousehold = data ? data.onboarding.householdCount < data.plan.limits.households : false;
  const recentActivity = inviteActivity.slice(0, 6).map((invite) => {
    const dateRef = invite.acceptedAt ?? invite.createdAt;
    const parsedDate = new Date(dateRef);
    const formattedDate = Number.isNaN(parsedDate.getTime())
      ? dateRef
      : parsedDate.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

    const statusLabel =
      invite.status === "ACCEPTED"
        ? "Aceito"
        : invite.status === "EXPIRED"
          ? "Expirado"
          : "Pendente";

    return {
      id: invite.id,
      title: `${invite.email} • ${invite.householdName}`,
      description: `Papel: ${invite.role} • Status: ${statusLabel}`,
      dateLabel: formattedDate,
      status: invite.status,
    };
  });

  return (
    <AppShell
      activeKey="dashboard"
      larNome={data?.larEmDestaque?.name}
      userName={headerName || "Usuário"}
      userEmail={headerEmail || "..."}
      onLogout={handleLogout}
    >
      <div className="space-y-6 md:space-y-8">
        <section className="rounded-3xl border border-cyan-300/60 bg-gradient-to-br from-cyan-500 via-cyan-600 to-indigo-700 p-5 text-white shadow-lg shadow-cyan-600/20 md:p-7">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-100/90">Painel estratégico</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            {data?.larEmDestaque?.name || "Seu centro de controle da família"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-cyan-50/95 md:text-base">
            {data?.onboarding.needsFirstHousehold
              ? "Comece pelo básico para ativar toda a experiência: crie um lar e convide quem mora com você."
              : "Acompanhe prioridades, limites e próximos passos em uma única visão para decidir rápido."}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => {
                if (data?.onboarding.needsFirstHousehold) {
                  const element = document.getElementById("create-household-form");
                  element?.scrollIntoView({ behavior: "smooth", block: "center" });
                  return;
                }

                const element = document.getElementById("invite-member-form");
                element?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50"
            >
              {principalActionLabel}
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Ver recomendações
            </button>
          </div>
        </section>

        {isLoading ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100/80 dark:border-white/10 dark:bg-white/5"
              />
            ))}
          </section>
        ) : null}

        {errorMessage ? (
          <section className="rounded-2xl border border-red-300/70 bg-red-50/90 p-4 dark:border-red-400/40 dark:bg-red-950/40">
            <p className="text-sm font-medium text-red-700 dark:text-red-200">{errorMessage}</p>
            <Link
              href="/login"
              className="mt-3 inline-flex rounded-lg border border-red-400/50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-300/40 dark:text-red-200 dark:hover:bg-red-900/60"
            >
              Fazer login novamente
            </Link>
          </section>
        ) : null}

        {!isLoading && data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Plano atual</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{data.plan.tier}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Capacidade de lares: {data.plan.limits.households}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Lares ativos</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{data.onboarding.householdCount}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Participações: {data.onboarding.participationCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Membros por lar</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                  {data.larEmDestaque?.membersCount ?? data.plan.limits.membersPerHousehold}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {data.larEmDestaque ? `No lar em destaque` : "Conforme seu plano atual"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Progresso inicial</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{completionPercentage}%</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {completedChecklistCount}/{checklist.length} etapas concluídas
                </p>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Prioridades de hoje</h2>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    {priorityItems.length} item(ns)
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {priorityItems.map((item) => {
                    const toneClass =
                      item.tone === "critical"
                        ? "border-red-300/80 bg-red-50/90 text-red-700 dark:border-red-400/40 dark:bg-red-950/40 dark:text-red-200"
                        : item.tone === "warning"
                          ? "border-amber-300/80 bg-amber-50/90 text-amber-700 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-200"
                          : "border-emerald-300/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-950/40 dark:text-emerald-200";

                    return (
                      <div key={item.title} className={`rounded-xl border px-3 py-2 ${toneClass}`}>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs opacity-95">{item.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Checklist de ativação</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Feche as etapas para destravar todo potencial do app.
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${completionPercentage}%` }} />
                </div>
                <ul className="mt-3 space-y-2">
                  {checklist.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center justify-between rounded-lg border border-slate-200/90 px-3 py-2 text-sm dark:border-white/10"
                    >
                      <span className="text-slate-700 dark:text-slate-200">{item.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          item.done
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                        }`}
                      >
                        {item.done ? "Concluído" : "Pendente"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Atividade recente</h2>
                {myRole ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    Seu papel: {roleLabel[myRole]}
                  </span>
                ) : null}
              </div>
              {recentActivity.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {recentActivity.map((item) => (
                    <li key={item.id} className="rounded-xl border border-slate-200/90 px-3 py-2 dark:border-white/10">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                      <p
                        className={`mt-0.5 text-xs ${
                          item.status === "ACCEPTED"
                            ? "text-emerald-600 dark:text-emerald-300"
                            : item.status === "EXPIRED"
                              ? "text-red-600 dark:text-red-300"
                              : "text-amber-600 dark:text-amber-300"
                        }`}
                      >
                        {item.description}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{item.dateLabel}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Ainda não há atividades registradas. Crie seu primeiro lar para iniciar o histórico.
                </p>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div
                id="create-household-form"
                className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Criar novo lar</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Defina um nome claro para facilitar a organização e convites.
                </p>
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={householdName}
                    onChange={(event) => setHouseholdName(event.target.value)}
                    placeholder="Ex: Casa Silva"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleCreateHousehold}
                    disabled={isCreatingHousehold || !householdName.trim() || !canCreateHousehold}
                    className="inline-flex rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingHousehold ? "Criando..." : "Criar lar"}
                  </button>
                  {!canCreateHousehold ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Limite de lares do plano atingido. Faça upgrade para criar novos lares.
                    </p>
                  ) : null}
                  {householdFeedback ? (
                    <p className="text-xs text-slate-600 dark:text-slate-300">{householdFeedback}</p>
                  ) : null}
                </div>
              </div>

              <div
                id="invite-member-form"
                className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Convidar membro</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Convide por e-mail para o lar em destaque: {data.larEmDestaque?.name || "não definido"}.
                </p>
                <div className="mt-3 space-y-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                  />
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as "ADMIN" | "EDITOR" | "VIEWER")}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="EDITOR">Editor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleInviteMember}
                    disabled={isInviting || !inviteEmail.trim() || !data.larEmDestaque?.id || !canInvite}
                    className="inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isInviting ? "Enviando..." : "Enviar convite"}
                  </button>
                  {!canInvite ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Somente o anfitrião pode convidar membros neste momento.
                    </p>
                  ) : null}
                  {inviteFeedback ? <p className="text-xs text-slate-600 dark:text-slate-300">{inviteFeedback}</p> : null}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
