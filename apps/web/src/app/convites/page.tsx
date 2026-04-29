"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiRequest } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth-session";

type MeResponse = {
  user: { id: string; name: string; email: string };
  onboarding: { needsFirstHousehold: boolean };
  larEmDestaque: { id: string; name: string } | null;
};

type InviteItem = {
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

export default function ConvitesPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [larNome, setLarNome] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    const token = session.accessToken;
    setAccessToken(token);
    setUserName(session.user.name ?? "Usuário");
    setUserEmail(session.user.email ?? "...");

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [meResponse, invitesResponse] = await Promise.all([
          apiRequest<MeResponse>("/users/me", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }),
          apiRequest<{ items: InviteItem[] }>("/invites/me?scope=received", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setUserName(meResponse.dados.user.name);
        setUserEmail(meResponse.dados.user.email);
        setLarNome(meResponse.dados.larEmDestaque?.name ?? null);
        setInvites(invitesResponse.dados.items);
      } catch (error) {
        clearSession();
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar convites.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [router]);

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  async function handleAcceptInvite(inviteId: string) {
    if (!accessToken) return;
    try {
      setAcceptingInviteId(inviteId);
      setFeedback(null);
      await apiRequest(`/invites/${inviteId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setInvites((current) =>
        current.map((invite) =>
          invite.id === inviteId
            ? { ...invite, acceptedAt: new Date().toISOString(), status: "ACCEPTED" }
            : invite,
        ),
      );
      setFeedback("Convite aceito com sucesso. O lar já está disponível para você.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível aceitar o convite.");
    } finally {
      setAcceptingInviteId(null);
    }
  }

  return (
    <AppShell
      activeKey="convites"
      larNome={larNome}
      userName={userName || "Usuário"}
      userEmail={userEmail || "..."}
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-indigo-300/50 bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-600 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.14em] text-indigo-100/90">Convites recebidos</p>
          <h1 className="mt-2 text-2xl font-semibold">Aceite convites da sua família</h1>
          <p className="mt-2 text-sm text-indigo-50/95">Sem e-mail por enquanto: aceite direto por aqui com um clique.</p>
        </section>

        {isLoading ? <p className="text-sm text-slate-600 dark:text-slate-300">Carregando convites...</p> : null}
        {errorMessage ? <p className="text-sm text-red-600 dark:text-red-300">{errorMessage}</p> : null}
        {feedback ? <p className="text-sm text-slate-700 dark:text-slate-200">{feedback}</p> : null}

        {!isLoading && !errorMessage ? (
          <section className="space-y-2">
            {invites.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">Você não possui convites recebidos no momento.</p>
            ) : (
              invites.map((invite) => (
                <article key={invite.id} className="rounded-xl border border-slate-200/90 p-3 dark:border-white/10">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{invite.householdName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Papel: {invite.role} • Expira em: {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
                  </p>
                  <div className="mt-2">
                    {invite.status === "PENDING" ? (
                      <button
                        type="button"
                        onClick={() => void handleAcceptInvite(invite.id)}
                        disabled={acceptingInviteId === invite.id}
                        className="inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {acceptingInviteId === invite.id ? "Aceitando..." : "Aceitar convite"}
                      </button>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                          invite.status === "ACCEPTED"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
                        }`}
                      >
                        {invite.status === "ACCEPTED" ? "Convite aceito" : "Convite expirado"}
                      </span>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
