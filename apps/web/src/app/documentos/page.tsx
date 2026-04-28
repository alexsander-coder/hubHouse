"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiRequest } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth-session";

type MeResponse = {
  user: { id: string; name: string; email: string };
  plan: { tier: "FREE" | "PRO" };
  onboarding: { needsFirstHousehold: boolean };
  larEmDestaque: { id: string; name: string } | null;
};

type DocumentCategory = "IDENTIDADE" | "SAUDE" | "ESCOLA" | "FINANCEIRO" | "IMOVEL" | "OUTROS";

type HouseholdMember = {
  id: string;
  role: "HOST" | "ADMIN" | "EDITOR" | "VIEWER";
  user: { id: string; name: string; email: string };
};

type DocumentItem = {
  id: string;
  title: string;
  category: DocumentCategory;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  originalFileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  downloadPath: string;
  ownerMember: HouseholdMember;
};

const CATEGORIES: Array<{ value: DocumentCategory; label: string }> = [
  { value: "IDENTIDADE", label: "Identidade" },
  { value: "SAUDE", label: "Saúde" },
  { value: "ESCOLA", label: "Escola" },
  { value: "FINANCEIRO", label: "Financeiro" },
  { value: "IMOVEL", label: "Imóvel" },
  { value: "OUTROS", label: "Outros" },
];

export default function DocumentosPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [larNome, setLarNome] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<"FREE" | "PRO">("FREE");
  const [needsFirstHousehold, setNeedsFirstHousehold] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalDocumentsCount, setTotalDocumentsCount] = useState(0);
  const [members, setMembers] = useState<HouseholdMember[]>([]);

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | "TODAS">("TODAS");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("TODOS");
  const [organizarPorMembro, setOrganizarPorMembro] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<DocumentCategory>("IDENTIDADE");
  const [newOwnerMemberId, setNewOwnerMemberId] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);

  const freeLimit = 4;
  const documentsLimit = planTier === "FREE" ? freeLimit : 200;
  const usagePercentage = planTier === "FREE" ? Math.min(100, Math.round((totalDocumentsCount / freeLimit) * 100)) : 0;

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    const accessTokenFromSession = session.accessToken;
    setAccessToken(accessTokenFromSession);
    setUserName(session.user.name ?? "Usuário");
    setUserEmail(session.user.email ?? "...");

    async function loadBase() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const meResponse = await apiRequest<MeResponse>("/users/me", {
          method: "GET",
          headers: { Authorization: `Bearer ${accessTokenFromSession}` },
        });

        setUserName(meResponse.dados.user.name);
        setUserEmail(meResponse.dados.user.email);
        setPlanTier(meResponse.dados.plan.tier);
        setNeedsFirstHousehold(meResponse.dados.onboarding.needsFirstHousehold);
        setLarNome(meResponse.dados.larEmDestaque?.name ?? null);
        setHouseholdId(meResponse.dados.larEmDestaque?.id ?? null);
      } catch (error) {
        clearSession();
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar documentos.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadBase();
  }, [router]);

  useEffect(() => {
    if (!accessToken || !householdId) {
      setDocuments([]);
      setMembers([]);
      setTotalDocumentsCount(0);
      return;
    }

    async function loadDocuments() {
      setErrorMessage(null);

      try {
        const queryParams = new URLSearchParams();
        if (selectedCategory !== "TODAS") queryParams.set("category", selectedCategory);
        if (selectedMemberId !== "TODOS") queryParams.set("ownerMemberId", selectedMemberId);
        if (query.trim()) queryParams.set("search", query.trim());

        const [membersResponse, docsResponse] = await Promise.all([
          apiRequest<{ items: HouseholdMember[] }>(`/documents/households/${householdId}/members`, {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          apiRequest<{ items: DocumentItem[]; totalCount: number }>(
            `/documents/households/${householdId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          ),
        ]);

        setMembers(membersResponse.dados.items);
        setDocuments(docsResponse.dados.items);
        setTotalDocumentsCount(docsResponse.dados.totalCount);

        if (!newOwnerMemberId && membersResponse.dados.items.length > 0) {
          setNewOwnerMemberId(membersResponse.dados.items[0].id);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar a biblioteca documental.");
      }
    }

    void loadDocuments();
  }, [accessToken, householdId, selectedCategory, selectedMemberId, query, newOwnerMemberId]);

  const groupedDocuments = useMemo(() => {
    if (!organizarPorMembro) {
      return [] as Array<{ title: string; items: DocumentItem[] }>;
    }

    const map = new Map<string, { title: string; items: DocumentItem[] }>();
    for (const document of documents) {
      const title = document.ownerMember.user.name;
      if (!map.has(title)) {
        map.set(title, { title, items: [] });
      }
      map.get(title)?.items.push(document);
    }

    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [documents, organizarPorMembro]);

  async function reloadDocuments() {
    if (!accessToken || !householdId) return;

    const queryParams = new URLSearchParams();
    if (selectedCategory !== "TODAS") queryParams.set("category", selectedCategory);
    if (selectedMemberId !== "TODOS") queryParams.set("ownerMemberId", selectedMemberId);
    if (query.trim()) queryParams.set("search", query.trim());

    const docsResponse = await apiRequest<{ items: DocumentItem[]; totalCount: number }>(
      `/documents/households/${householdId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    setDocuments(docsResponse.dados.items);
    setTotalDocumentsCount(docsResponse.dados.totalCount);
  }

  async function handleCreateDocument() {
    if (!accessToken || !householdId || !newTitle.trim() || !newOwnerMemberId || !newFile) {
      return;
    }

    try {
      setIsCreatingDocument(true);
      setCreateFeedback(null);

      const formData = new FormData();
      formData.append("title", newTitle.trim());
      formData.append("category", newCategory);
      formData.append("ownerMemberId", newOwnerMemberId);
      if (newNotes.trim()) formData.append("notes", newNotes.trim());
      if (newExpiresAt) formData.append("expiresAt", new Date(`${newExpiresAt}T00:00:00`).toISOString());
      formData.append("file", newFile);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/documents/households/${householdId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        let message = "Não foi possível cadastrar documento.";
        try {
          const payload = (await response.json()) as { mensagem?: string };
          if (payload?.mensagem) message = payload.mensagem;
        } catch {
          // ignorar parse de erro
        }
        throw new Error(message);
      }

      setNewTitle("");
      setNewNotes("");
      setNewExpiresAt("");
      setNewFile(null);
      setCreateFeedback("Documento cadastrado com sucesso.");
      await reloadDocuments();
    } catch (error) {
      setCreateFeedback(error instanceof Error ? error.message : "Não foi possível cadastrar documento.");
    } finally {
      setIsCreatingDocument(false);
    }
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  function formatDate(value: string | null): string {
    if (!value) return "Sem validade";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatBytes(value: number | null): string {
    if (!value || value <= 0) return "-";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function handleOpenPdf(document: DocumentItem) {
    if (!accessToken) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}${document.downloadPath}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error("Não foi possível abrir o PDF.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível abrir o PDF.");
    }
  }

  return (
    <AppShell
      activeKey="documentos"
      larNome={larNome}
      userName={userName || "Usuário"}
      userEmail={userEmail || "..."}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-emerald-300/60 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-5 text-white md:p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-100/90">Armazenamento de documentos</p>
          <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Acesso rápido aos arquivos da família</h1>
          <p className="mt-2 max-w-2xl text-sm text-emerald-50/95">
            Pesquisa inteligente, dono do documento e validade para achar qualquer arquivo em segundos.
          </p>
        </section>

        {isLoading ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100/80 dark:border-white/10 dark:bg-white/5"
              />
            ))}
          </section>
        ) : null}

        {errorMessage ? (
          <section className="rounded-2xl border border-red-300/70 bg-red-50/90 p-4 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-950/40 dark:text-red-200">
            {errorMessage}
          </section>
        ) : null}

        {!isLoading ? (
          <>
            <section className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
              <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Uso do armazenamento</h2>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                    Plano {planTier}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {planTier === "FREE"
                    ? `${totalDocumentsCount}/${documentsLimit} documentos utilizados no plano FREE`
                    : `${totalDocumentsCount} documentos utilizados`}
                </p>
                {planTier === "FREE" ? (
                  <>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${usagePercentage}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Limite inicial gratuito: até 4 documentos por lar.</p>
                  </>
                ) : null}
              </article>

              <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Novo documento</h2>
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="Ex: RG da Maria"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={newCategory}
                      onChange={(event) => setNewCategory(event.target.value as DocumentCategory)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newOwnerMemberId}
                      onChange={(event) => setNewOwnerMemberId(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                    >
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="date"
                    value={newExpiresAt}
                    onChange={(event) => setNewExpiresAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                  />
                  <textarea
                    value={newNotes}
                    onChange={(event) => setNewNotes(event.target.value)}
                    placeholder="Observações opcionais"
                    className="h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                  />
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setNewFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleCreateDocument}
                    disabled={isCreatingDocument || !newTitle.trim() || !newOwnerMemberId || !newFile || needsFirstHousehold}
                    className="inline-flex rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingDocument ? "Salvando..." : "Cadastrar documento"}
                  </button>
                  {createFeedback ? <p className="text-xs text-slate-600 dark:text-slate-300">{createFeedback}</p> : null}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por título ou observações"
                  className="min-w-56 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setOrganizarPorMembro((value) => !value)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    organizarPorMembro
                      ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200"
                      : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  Organizar por membro
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("TODAS")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedCategory === "TODAS"
                      ? "bg-cyan-500/15 text-cyan-800 dark:bg-cyan-400/20 dark:text-cyan-100"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  Todas
                </button>
                {CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => setSelectedCategory(category.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedCategory === category.value
                        ? "bg-cyan-500/15 text-cyan-800 dark:bg-cyan-400/20 dark:text-cyan-100"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <select
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                >
                  <option value="TODOS">Todos os membros</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.user.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 dark:border-white/10 dark:bg-white/5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Biblioteca documental</h2>

              {needsFirstHousehold ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Crie seu primeiro lar para começar a anexar documentos.</p>
              ) : documents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Nenhum documento encontrado com os filtros atuais.</p>
              ) : organizarPorMembro ? (
                <div className="mt-4 space-y-4">
                  {groupedDocuments.map((group) => (
                    <div key={group.title}>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{group.title}</h3>
                      <div className="mt-2 space-y-2">
                        {group.items.map((document) => (
                          <article key={document.id} className="rounded-xl border border-slate-200/90 p-3 dark:border-white/10">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{document.title}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Categoria: {CATEGORIES.find((item) => item.value === document.category)?.label ?? document.category} •
                              Validade: {formatDate(document.expiresAt)} • Tamanho: {formatBytes(document.sizeBytes)}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleOpenPdf(document)}
                              className="mt-1 inline-flex text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-300"
                            >
                              Abrir PDF
                            </button>
                            {document.notes ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{document.notes}</p> : null}
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {documents.map((document) => (
                    <article key={document.id} className="rounded-xl border border-slate-200/90 p-3 dark:border-white/10">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{document.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {document.ownerMember.user.name} • {CATEGORIES.find((item) => item.value === document.category)?.label ?? document.category}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenPdf(document)}
                        className="mt-1 inline-flex text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-300"
                      >
                        Abrir PDF
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
