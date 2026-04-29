"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiRequest } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth-session";

type MeResponse = {
  user: { id: string; name: string; email: string };
  onboarding: { needsFirstHousehold: boolean };
  larEmDestaque: { id: string; name: string; myRole: "HOST" | "ADMIN" | "EDITOR" | "VIEWER" | null } | null;
};

type AgendaCategory = "CASA" | "SAUDE" | "ESCOLA" | "FINANCEIRO" | "PESSOAL" | "OUTROS";
type AgendaRecurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

type HouseholdMember = {
  id: string;
  role: "HOST" | "ADMIN" | "EDITOR" | "VIEWER";
  user: { id: string; name: string; email: string };
};

type AgendaEvent = {
  id: string;
  title: string;
  description: string | null;
  category: AgendaCategory;
  recurrence: AgendaRecurrence;
  startsAt: string;
  endsAt: string | null;
  reminderMinutes: number | null;
  ownerMember: HouseholdMember;
  participants: HouseholdMember[];
};

type AgendaEventsResponse = {
  items: AgendaEvent[];
  totalCount: number;
  limit: number;
  page: number;
  totalPages: number;
};

const CATEGORIES: Array<{ value: AgendaCategory; label: string }> = [
  { value: "CASA", label: "Casa" },
  { value: "SAUDE", label: "Saúde" },
  { value: "ESCOLA", label: "Escola" },
  { value: "FINANCEIRO", label: "Financeiro" },
  { value: "PESSOAL", label: "Pessoal" },
  { value: "OUTROS", label: "Outros" },
];

const CATEGORY_COLORS: Record<
  AgendaCategory,
  { light: string; dark: string; dot: string; badge: string }
> = {
  CASA: {
    light: "border-cyan-300/80 bg-cyan-50/80 text-cyan-700",
    dark: "dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-200",
    dot: "bg-cyan-500",
    badge: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
  },
  SAUDE: {
    light: "border-emerald-300/80 bg-emerald-50/80 text-emerald-700",
    dark: "dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  },
  ESCOLA: {
    light: "border-indigo-300/80 bg-indigo-50/80 text-indigo-700",
    dark: "dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200",
    dot: "bg-indigo-500",
    badge: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200",
  },
  FINANCEIRO: {
    light: "border-amber-300/80 bg-amber-50/80 text-amber-700",
    dark: "dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  },
  PESSOAL: {
    light: "border-pink-300/80 bg-pink-50/80 text-pink-700",
    dark: "dark:border-pink-400/30 dark:bg-pink-500/10 dark:text-pink-200",
    dot: "bg-pink-500",
    badge: "bg-pink-500/15 text-pink-800 dark:text-pink-200",
  },
  OUTROS: {
    light: "border-slate-300/80 bg-slate-50/80 text-slate-700",
    dark: "dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-200",
    dot: "bg-slate-500",
    badge: "bg-slate-500/15 text-slate-800 dark:text-slate-200",
  },
};

const RECURRENCE_OPTIONS: Array<{ value: AgendaRecurrence; label: string }> = [
  { value: "NONE", label: "Sem repetição" },
  { value: "DAILY", label: "Diário" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
];

const REMINDER_OPTIONS = [
  { value: 0, label: "Sem lembrete" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 dia antes" },
];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toLocalDateTimeInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AgendaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedEventId = searchParams.get("eventId");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [larNome, setLarNome] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [needsFirstHousehold, setNeedsFirstHousehold] = useState(false);
  const [myRole, setMyRole] = useState<"HOST" | "ADMIN" | "EDITOR" | "VIEWER" | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<AgendaEvent[]>([]);
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const [eventsLimit, setEventsLimit] = useState(40);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineTotalPages, setTimelineTotalPages] = useState(1);

  const [selectedCategory, setSelectedCategory] = useState<AgendaCategory | "TODAS">("TODAS");
  const [selectedMemberId, setSelectedMemberId] = useState("TODOS");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(monthKey(new Date()));
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");
  const [pendingRangeStartKey, setPendingRangeStartKey] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ startKey: string; endKey: string } | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<AgendaCategory>("CASA");
  const [newOwnerMemberId, setNewOwnerMemberId] = useState("");
  const [newParticipantMemberIds, setNewParticipantMemberIds] = useState<string[]>([]);
  const [newRecurrence, setNewRecurrence] = useState<AgendaRecurrence>("NONE");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [newReminderMinutes, setNewReminderMinutes] = useState(15);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);
  const [pulseEventId, setPulseEventId] = useState<string | null>(null);
  const [nowInputMin, setNowInputMin] = useState(() => toLocalDateTimeInputValue(new Date()));

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
        setLarNome(meResponse.dados.larEmDestaque?.name ?? null);
        setHouseholdId(meResponse.dados.larEmDestaque?.id ?? null);
        setMyRole(meResponse.dados.larEmDestaque?.myRole ?? null);
        setNeedsFirstHousehold(meResponse.dados.onboarding.needsFirstHousehold);
      } catch (error) {
        clearSession();
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar a agenda.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadBase();
  }, [router]);

  useEffect(() => {
    setTimelinePage(1);
  }, [selectedCategory, selectedMemberId, startDateFilter, endDateFilter]);

  useEffect(() => {
    if (!highlightedEventId || timelineEvents.length === 0) return;
    const targetExists = timelineEvents.some((event) => event.id === highlightedEventId);
    if (!targetExists) return;

    const timer = window.setTimeout(() => {
      const element = document.getElementById(`timeline-event-${highlightedEventId}`);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setPulseEventId(highlightedEventId);
      window.setTimeout(() => setPulseEventId((current) => (current === highlightedEventId ? null : current)), 1800);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [highlightedEventId, timelineEvents]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowInputMin(toLocalDateTimeInputValue(new Date()));
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!accessToken || !householdId) {
      setMembers([]);
      setEvents([]);
      setTimelineEvents([]);
      return;
    }

    async function loadAgenda() {
      setErrorMessage(null);

      try {
        const params = new URLSearchParams();
        if (selectedCategory !== "TODAS") params.set("category", selectedCategory);
        if (selectedMemberId !== "TODOS") params.set("ownerMemberId", selectedMemberId);
        if (startDateFilter) params.set("startsAt", new Date(`${startDateFilter}T00:00:00`).toISOString());
        if (endDateFilter) params.set("endsAt", new Date(`${endDateFilter}T23:59:59`).toISOString());
        const timelineParams = new URLSearchParams(params);
        if (highlightedEventId) timelineParams.set("eventId", highlightedEventId);
        timelineParams.set("page", String(timelinePage));
        timelineParams.set("limit", "10");
        const allEventsParams = new URLSearchParams(params);
        allEventsParams.set("page", "1");
        allEventsParams.set("limit", "200");

        const [membersResponse, timelineResponse, allEventsResponse] = await Promise.all([
          apiRequest<{ items: HouseholdMember[] }>(`/agenda/households/${householdId}/members`, {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          apiRequest<AgendaEventsResponse>(
            `/agenda/households/${householdId}${timelineParams.toString() ? `?${timelineParams.toString()}` : ""}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          ),
          apiRequest<AgendaEventsResponse>(
            `/agenda/households/${householdId}${allEventsParams.toString() ? `?${allEventsParams.toString()}` : ""}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          ),
        ]);

        setMembers(membersResponse.dados.items);
        setTimelineEvents(timelineResponse.dados.items);
        setTimelinePage(timelineResponse.dados.page);
        setTimelineTotalPages(timelineResponse.dados.totalPages);
        setEvents(allEventsResponse.dados.items);
        setTotalEventsCount(allEventsResponse.dados.totalCount);
        setEventsLimit(allEventsResponse.dados.limit);

        if (!newOwnerMemberId && membersResponse.dados.items.length > 0) {
          const defaultMemberId = membersResponse.dados.items[0].id;
          setNewOwnerMemberId(defaultMemberId);
          setNewParticipantMemberIds([defaultMemberId]);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar eventos.");
      }
    }

    void loadAgenda();
  }, [accessToken, householdId, selectedCategory, selectedMemberId, startDateFilter, endDateFilter, newOwnerMemberId, timelinePage, highlightedEventId]);

  const quickStats = useMemo(() => {
    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(now.getDate() + 7);

    const todayCount = events.filter((event) => {
      const date = new Date(event.startsAt);
      return date.toDateString() === now.toDateString();
    }).length;

    const nextSevenDaysCount = events.filter((event) => {
      const date = new Date(event.startsAt);
      return date >= now && date <= weekAhead;
    }).length;

    const urgentCount = events.filter((event) => new Date(event.startsAt) < now).length;

    return [
      { label: "Hoje", value: String(todayCount), helper: "eventos planejados" },
      { label: "Próx. 7 dias", value: String(nextSevenDaysCount), helper: "compromissos no radar" },
      {
        label: "Pendências",
        value: String(needsFirstHousehold ? 1 : urgentCount),
        helper: needsFirstHousehold ? "crie o primeiro lar" : "itens vencidos",
      },
    ];
  }, [events, needsFirstHousehold]);

  const monthDays = useMemo(() => {
    const [yearRaw, monthRaw] = calendarMonth.split("-");
    const year = Number(yearRaw);
    const monthIndex = Number(monthRaw) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return [] as Array<{ date: Date; inMonth: boolean }>;

    const firstDay = new Date(year, monthIndex, 1);
    const startWeekDay = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(year, monthIndex, 1 - startWeekDay);

    return Array.from({ length: 42 }).map((_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return { date, inMonth: date.getMonth() === monthIndex };
    });
  }, [calendarMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of events) {
      const date = new Date(event.startsAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const dayCategoryMap = useMemo(() => {
    const map = new Map<string, AgendaCategory>();
    for (const event of events) {
      const date = new Date(event.startsAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, event.category);
      }
    }
    return map;
  }, [events]);

  const dayEventsPreviewMap = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const event of events) {
      const date = new Date(event.startsAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const current = map.get(key) ?? [];
      current.push(event);
      map.set(key, current);
    }
    return map;
  }, [events]);

  const canCreateEvent = !needsFirstHousehold && totalEventsCount < eventsLimit;
  const canManageEvents = myRole !== null && myRole !== "VIEWER";
  const usagePercentage = Math.min(100, Math.round((totalEventsCount / eventsLimit) * 100));
  useEffect(() => {
    if (canManageEvents) return;
    if (editingEventId) {
      setEditingEventId(null);
      setCreateFeedback(null);
    }
  }, [canManageEvents, editingEventId]);

  const weekDays = useMemo(() => {
    const base = new Date(selectedCalendarDate);
    const weekStart = new Date(base);
    const day = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return date;
    });
  }, [selectedCalendarDate]);

  const weekEventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const dayDate of weekDays) {
      const key = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
      map.set(key, []);
    }

    for (const event of events) {
      const date = new Date(event.startsAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (map.has(key)) {
        map.get(key)?.push(event);
      }
    }

    return map;
  }, [events, weekDays]);

  const dayEvents = useMemo(() => {
    const date = selectedCalendarDate;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return dayEventsPreviewMap.get(key) ?? [];
  }, [dayEventsPreviewMap, selectedCalendarDate]);

  const groupedTimeline = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const weekAhead = new Date(now);
    weekAhead.setDate(now.getDate() + 7);

    const groups: Record<string, AgendaEvent[]> = {
      Pendentes: [],
      Hoje: [],
      Amanhã: [],
      "Próximos 7 dias": [],
      "Futuro": [],
    };

    for (const event of timelineEvents) {
      const date = new Date(event.startsAt);
      if (date < now) groups.Pendentes.push(event);
      else if (date.toDateString() === now.toDateString()) groups.Hoje.push(event);
      else if (date.toDateString() === tomorrow.toDateString()) groups.Amanhã.push(event);
      else if (date <= weekAhead) groups["Próximos 7 dias"].push(event);
      else groups.Futuro.push(event);
    }

    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [timelineEvents]);

  async function reloadEvents() {
    if (!accessToken || !householdId) return;

    const params = new URLSearchParams();
    if (selectedCategory !== "TODAS") params.set("category", selectedCategory);
    if (selectedMemberId !== "TODOS") params.set("ownerMemberId", selectedMemberId);
    if (startDateFilter) params.set("startsAt", new Date(`${startDateFilter}T00:00:00`).toISOString());
    if (endDateFilter) params.set("endsAt", new Date(`${endDateFilter}T23:59:59`).toISOString());

    const timelineParams = new URLSearchParams(params);
    if (highlightedEventId) timelineParams.set("eventId", highlightedEventId);
    timelineParams.set("page", String(timelinePage));
    timelineParams.set("limit", "10");
    const allEventsParams = new URLSearchParams(params);
    allEventsParams.set("page", "1");
    allEventsParams.set("limit", "200");

    const [timelineResponse, allEventsResponse] = await Promise.all([
      apiRequest<AgendaEventsResponse>(`/agenda/households/${householdId}?${timelineParams.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      apiRequest<AgendaEventsResponse>(`/agenda/households/${householdId}?${allEventsParams.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    setTimelineEvents(timelineResponse.dados.items);
    setTimelinePage(timelineResponse.dados.page);
    setTimelineTotalPages(timelineResponse.dados.totalPages);
    setEvents(allEventsResponse.dados.items);
    setTotalEventsCount(allEventsResponse.dados.totalCount);
    setEventsLimit(allEventsResponse.dados.limit);
  }

  function clearHighlightedEvent() {
    router.replace("/agenda");
  }

  async function handleCreateEvent() {
    if (!accessToken || !householdId || !newTitle.trim() || !newOwnerMemberId || !newStartsAt || newParticipantMemberIds.length === 0) {
      return;
    }
    if (!editingEventId && !canCreateEvent) {
      return;
    }

    try {
      setIsCreatingEvent(true);
      setCreateFeedback(null);
      const startsAtDate = new Date(newStartsAt);
      if (startsAtDate.getTime() < Date.now()) {
        setCreateFeedback("Não é permitido criar eventos com data/horário no passado.");
        return;
      }
      if (newEndsAt) {
        const endsAtDate = new Date(newEndsAt);
        if (endsAtDate.getTime() < startsAtDate.getTime()) {
          setCreateFeedback("A data final não pode ser anterior ao início do evento.");
          return;
        }
      }

      await apiRequest(
        editingEventId ? `/agenda/households/${householdId}/events/${editingEventId}` : `/agenda/households/${householdId}`,
        {
          method: editingEventId ? "PATCH" : "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            title: newTitle.trim(),
            description: newDescription.trim() || undefined,
            category: newCategory,
            recurrence: newRecurrence,
            startsAt: startsAtDate.toISOString(),
            endsAt: newEndsAt ? new Date(newEndsAt).toISOString() : undefined,
            reminderMinutes: newReminderMinutes === 0 ? undefined : newReminderMinutes,
            ownerMemberId: newOwnerMemberId,
            participantMemberIds: newParticipantMemberIds,
          },
        },
      );

      setNewTitle("");
      setNewDescription("");
      setNewEndsAt("");
      setNewParticipantMemberIds(newOwnerMemberId ? [newOwnerMemberId] : []);
      setEditingEventId(null);
      setCreateFeedback(editingEventId ? "Evento atualizado com sucesso." : "Evento criado com sucesso.");
      await reloadEvents();
    } catch (error) {
      setCreateFeedback(error instanceof Error ? error.message : "Não foi possível salvar o evento.");
    } finally {
      setIsCreatingEvent(false);
    }
  }

  function handleEditEvent(event: AgendaEvent) {
    setEditingEventId(event.id);
    setNewTitle(event.title);
    setNewDescription(event.description ?? "");
    setNewCategory(event.category);
    setNewOwnerMemberId(event.ownerMember.id);
    setNewParticipantMemberIds(event.participants.map((participant) => participant.id));
    setNewRecurrence(event.recurrence);
    const startDate = new Date(event.startsAt);
    const endDate = event.endsAt ? new Date(event.endsAt) : null;
    setNewStartsAt(new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setNewEndsAt(endDate ? new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
    setNewReminderMinutes(event.reminderMinutes ?? 0);
    setCreateFeedback("Modo edição ativado.");
  }

  function handleCancelEdit() {
    setEditingEventId(null);
    setNewTitle("");
    setNewDescription("");
    setNewEndsAt("");
    setNewParticipantMemberIds(newOwnerMemberId ? [newOwnerMemberId] : []);
    setCreateFeedback("Edição cancelada.");
  }

  function toggleParticipant(memberId: string) {
    setNewParticipantMemberIds((current) => {
      if (current.includes(memberId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== memberId);
      }
      return [...current, memberId];
    });
  }

  async function handleDeleteEvent(eventId: string) {
    if (!accessToken || !householdId) return;
    if (!window.confirm("Deseja realmente remover este evento?")) return;

    try {
      await apiRequest(`/agenda/households/${householdId}/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setCreateFeedback("Evento removido com sucesso.");
      await reloadEvents();
    } catch (error) {
      setCreateFeedback(error instanceof Error ? error.message : "Não foi possível remover o evento.");
    }
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function shiftMonth(step: number) {
    const [yearRaw, monthRaw] = calendarMonth.split("-");
    const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
    date.setMonth(date.getMonth() + step);
    setCalendarMonth(monthKey(date));
  }

  function handleSelectCalendarDay(date: Date, inMonth: boolean) {
    if (!canManageEvents) return;
    if (!inMonth) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (date.getTime() < todayStart.getTime()) {
      setCreateFeedback("Não é possível selecionar dias anteriores ao atual para novo evento.");
      return;
    }
    setSelectedCalendarDate(new Date(date));
    const clickedKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    if (!pendingRangeStartKey) {
      setPendingRangeStartKey(clickedKey);
      setSelectedRange({ startKey: clickedKey, endKey: clickedKey });
      const startDate = new Date(date);
      startDate.setHours(9, 0, 0, 0);
      const startIso = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setNewStartsAt(startIso);
      setNewEndsAt("");
      return;
    }

    const start = pendingRangeStartKey <= clickedKey ? pendingRangeStartKey : clickedKey;
    const end = pendingRangeStartKey <= clickedKey ? clickedKey : pendingRangeStartKey;
    setSelectedRange({ startKey: start, endKey: end });
    setPendingRangeStartKey(null);

    const startDate = new Date(`${start}T09:00:00`);
    const endDate = new Date(`${end}T18:00:00`);
    const startIso = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const endIso = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setNewStartsAt(startIso);
    setNewEndsAt(endIso);
  }

  function formatMonthLabel(key: string): string {
    const [yearRaw, monthRaw] = key.split("-");
    const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
    if (Number.isNaN(date.getTime())) {
      return key;
    }
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  function isEventExpired(event: AgendaEvent): boolean {
    const now = new Date();
    const referenceDate = event.endsAt ? new Date(event.endsAt) : new Date(event.startsAt);
    return referenceDate.getTime() < now.getTime();
  }

  return (
    <AppShell
      activeKey="agenda"
      larNome={larNome}
      userName={userName || "Usuário"}
      userEmail={userEmail || "..."}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-indigo-300/50 bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-600 p-5 text-white md:p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-indigo-100/90">Agenda compartilhada</p>
          <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Tudo o que importa, no tempo certo</h1>
          <p className="mt-2 max-w-2xl text-sm text-indigo-50/95">
            Calendário premium com programação da casa e destaque visual nos dias com eventos.
          </p>
        </section>

        {isLoading ? (
          <section className="grid gap-3 sm:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100/80 dark:border-white/10 dark:bg-white/5" />
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
            <section className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
                {quickStats.map((item) => (
                  <article
                    key={item.label}
                    className="min-w-[165px] shrink-0 snap-start rounded-xl border border-slate-200/90 bg-white/90 p-3 sm:min-w-0 sm:shrink sm:rounded-2xl sm:p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="mt-1.5 text-xl font-semibold leading-none text-slate-900 sm:mt-2 sm:text-2xl dark:text-white">{item.value}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.helper}</p>
                  </article>
                ))}
                <article className="min-w-[165px] shrink-0 snap-start rounded-xl border border-slate-200/90 bg-white/90 p-3 sm:min-w-0 sm:shrink sm:rounded-2xl sm:p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Uso da agenda</p>
                  <p className="mt-1.5 text-xl font-semibold leading-none text-slate-900 sm:mt-2 sm:text-2xl dark:text-white">
                    {totalEventsCount}
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/{eventsLimit}</span>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 sm:h-2 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${usagePercentage}%` }} />
                  </div>
                </article>
            </section>
            {highlightedEventId ? (
              <section className="flex items-center justify-between rounded-xl border border-cyan-300/60 bg-cyan-50/80 px-3 py-2 text-xs text-cyan-800 dark:border-cyan-400/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                <p>Evento acessado via notificação.</p>
                <button type="button" onClick={clearHighlightedEvent} className="font-semibold underline underline-offset-2">
                  Voltar para visão completa
                </button>
              </section>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Calendário mensal</h2>
                  <div className="flex w-full items-center gap-1 rounded-lg bg-slate-100 p-1 sm:w-auto dark:bg-white/10">
                    <button
                      type="button"
                      onClick={() => setCalendarView("month")}
                      className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition sm:flex-none ${
                        calendarView === "month" ? "bg-white text-slate-800 dark:bg-[#0f172a] dark:text-white" : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      Mês
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarView("week")}
                      className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition sm:flex-none ${
                        calendarView === "week" ? "bg-white text-slate-800 dark:bg-[#0f172a] dark:text-white" : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      Semana
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarView("day")}
                      className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition sm:flex-none ${
                        calendarView === "day" ? "bg-white text-slate-800 dark:bg-[#0f172a] dark:text-white" : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      Dia
                    </button>
                  </div>
                  <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
                    <button
                      type="button"
                      onClick={() => shiftMonth(-1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-white/10"
                      aria-label="Mês anterior"
                    >
                      ◀
                    </button>
                    <p className="min-w-0 flex-1 text-center text-sm font-medium capitalize text-slate-700 sm:min-w-36 sm:flex-none dark:text-slate-200">
                      {formatMonthLabel(calendarMonth)}
                    </p>
                    <button
                      type="button"
                      onClick={() => shiftMonth(1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-white/10"
                      aria-label="Próximo mês"
                    >
                      ▶
                    </button>
                  </div>
                </div>
                {calendarView === "month" ? (
                <div className="mt-3 grid grid-cols-7 gap-1 overflow-x-hidden text-[11px] text-slate-500 dark:text-slate-400">
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                    <div key={day} className="px-2 py-1 text-center font-semibold">{day}</div>
                  ))}
                  {monthDays.map(({ date, inMonth }) => {
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                    const eventsCount = eventsByDay.get(key) ?? 0;
                    const dayEvents = dayEventsPreviewMap.get(key) ?? [];
                    const dayCategory = dayCategoryMap.get(key);
                    const categoryColor = dayCategory ? CATEGORY_COLORS[dayCategory] : null;
                    const today = new Date();
                    const isToday =
                      date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear();
                    const isInsideSelectedRange =
                      selectedRange && key >= selectedRange.startKey && key <= selectedRange.endKey;
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const isPastDay = date.getTime() < todayStart.getTime();
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => handleSelectCalendarDay(date, inMonth)}
                        disabled={!inMonth || !canManageEvents || isPastDay}
                        className={`group relative min-h-14 min-w-0 rounded-lg border px-1 py-1 sm:px-1.5 ${
                          inMonth
                            ? `${categoryColor?.light ?? "border-slate-200/80 bg-white"} ${categoryColor?.dark ?? "dark:border-white/10 dark:bg-white/5"} ${
                                isToday ? "ring-2 ring-indigo-500/60 ring-offset-1 dark:ring-indigo-400/70 dark:ring-offset-[#0f172a]" : ""
                              }`
                            : "border-transparent bg-slate-100/70 opacity-60 dark:bg-white/5"
                        } ${isInsideSelectedRange ? "ring-2 ring-cyan-400/60 dark:ring-cyan-300/50" : ""} ${
                          inMonth && canManageEvents && !isPastDay ? "cursor-pointer transition hover:scale-[1.01]" : "cursor-default"
                        }`}
                      >
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">{date.getDate()}</p>
                        {eventsCount > 0 ? (
                          <span
                            className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${categoryColor?.badge ?? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"}`}
                          >
                            {eventsCount} evt
                          </span>
                        ) : null}
                        {eventsCount > 0 ? (
                          <div className="mt-1 hidden space-y-0.5 text-left md:block">
                            {dayEvents.slice(0, 2).map((event) => (
                              <p key={event.id} className="truncate text-[10px] text-slate-600 dark:text-slate-300">
                                • {event.title}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        {eventsCount > 0 ? (
                          <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-56 rounded-lg border border-slate-200/90 bg-white p-2 text-left text-[11px] shadow-xl group-hover:md:block dark:border-white/10 dark:bg-[#111827]">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{eventsCount} evento(s)</p>
                            <div className="mt-1 space-y-1">
                              {dayEvents.slice(0, 4).map((event) => (
                                <p key={event.id} className="truncate text-slate-600 dark:text-slate-300">
                                  • {event.title}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                ) : null}

                {calendarView === "week" ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {weekDays.map((date) => {
                      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      const list = weekEventsByDay.get(key) ?? [];
                      return (
                        <div key={key} className="rounded-xl border border-slate-200/90 p-3 dark:border-white/10">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                          </p>
                          {list.length === 0 ? (
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Sem eventos</p>
                          ) : (
                            <div className="mt-1 space-y-1">
                              {list.slice(0, 3).map((event) => (
                                <p key={event.id} className="truncate text-[11px] text-slate-600 dark:text-slate-300">• {event.title}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {calendarView === "day" ? (
                  <div className="mt-3 rounded-xl border border-slate-200/90 p-3 dark:border-white/10">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {selectedCalendarDate.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {dayEvents.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Sem eventos nesse dia.</p>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {dayEvents.map((event) => (
                          <p key={event.id} className="text-xs text-slate-600 dark:text-slate-300">
                            • {event.title} ({formatDateTime(event.startsAt)})
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {CATEGORIES.map((category) => (
                    <span
                      key={category.value}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    >
                      <span className={`h-2 w-2 rounded-full ${CATEGORY_COLORS[category.value].dot}`} />
                      {category.label}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Dica: clique em um dia para definir início. Clique em outro para fechar intervalo e preencher início/fim do evento.
                </p>
              </article>

              <article className="min-w-0 rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Novo evento</h2>
                  {!canManageEvents ? (
                    <span className="rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-200">
                      Modo visualização
                    </span>
                  ) : null}
                </div>
                {!canManageEvents ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Seu perfil atual permite acompanhar eventos, mas não criar, editar ou excluir.
                  </p>
                ) : null}
                {canManageEvents ? (
                  <div className="mt-3 space-y-2">
                    <input disabled={!canManageEvents} type="text" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Ex: Consulta pediatra" className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111827] dark:text-white" />
                    <textarea disabled={!canManageEvents} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Detalhes (opcional)" className="h-20 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111827] dark:text-white" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select disabled={!canManageEvents} value={newCategory} onChange={(event) => setNewCategory(event.target.value as AgendaCategory)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111827] dark:text-white">
                        {CATEGORIES.map((category) => (<option key={category.value} value={category.value}>{category.label}</option>))}
                      </select>
                      <select
                        disabled={!canManageEvents}
                        value={newOwnerMemberId}
                        onChange={(event) => {
                          const nextOwnerId = event.target.value;
                          setNewOwnerMemberId(nextOwnerId);
                          setNewParticipantMemberIds((current) =>
                            current.includes(nextOwnerId) ? current : [...current, nextOwnerId],
                          );
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111827] dark:text-white"
                      >
                        {members.map((member) => (<option key={member.id} value={member.id}>{member.user.name}</option>))}
                      </select>
                    </div>
                    <div className="rounded-xl border border-slate-300/80 bg-white/70 p-2 dark:border-white/15 dark:bg-[#111827]">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Participantes do evento</p>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {members.map((member) => (
                          <label key={member.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                            <input
                              disabled={!canManageEvents}
                              type="checkbox"
                              checked={newParticipantMemberIds.includes(member.id)}
                              onChange={() => toggleParticipant(member.id)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 disabled:cursor-not-allowed"
                            />
                            <span className={member.id === newOwnerMemberId ? "font-semibold" : ""}>{member.user.name}</span>
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        O responsável principal também pode ter outros participantes.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input disabled={!canManageEvents} min={nowInputMin} type="datetime-local" value={newStartsAt} onChange={(event) => setNewStartsAt(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111827] dark:text-white" />
                      <input disabled={!canManageEvents} min={newStartsAt || nowInputMin} type="datetime-local" value={newEndsAt} onChange={(event) => setNewEndsAt(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111827] dark:text-white" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select disabled={!canManageEvents} value={newRecurrence} onChange={(event) => setNewRecurrence(event.target.value as AgendaRecurrence)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111827] dark:text-white">
                        {RECURRENCE_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                      </select>
                      <select disabled={!canManageEvents} value={newReminderMinutes} onChange={(event) => setNewReminderMinutes(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111827] dark:text-white">
                        {REMINDER_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={handleCreateEvent} disabled={!canManageEvents || isCreatingEvent || !newTitle.trim() || !newOwnerMemberId || !newStartsAt || newParticipantMemberIds.length === 0 || (!editingEventId && !canCreateEvent)} className="inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                        {isCreatingEvent ? "Salvando..." : editingEventId ? "Salvar alterações" : "Criar evento"}
                      </button>
                      {editingEventId ? (
                        <button type="button" onClick={handleCancelEdit} className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200">
                          Cancelar edição
                        </button>
                      ) : null}
                    </div>
                    {!editingEventId && !canCreateEvent ? <p className="text-xs text-amber-700 dark:text-amber-300">Limite do plano FREE atingido para eventos da agenda.</p> : null}
                    {createFeedback ? <p className="text-xs text-slate-600 dark:text-slate-300">{createFeedback}</p> : null}
                  </div>
                ) : null}
              </article>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
              <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Filtros rápidos</h2>
                <div className="mt-3 space-y-2">
                  <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as AgendaCategory | "TODAS")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white">
                    <option value="TODAS">Todas as categorias</option>
                    {CATEGORIES.map((category) => (<option key={category.value} value={category.value}>{category.label}</option>))}
                  </select>
                  <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white">
                    <option value="TODOS">Todos os membros</option>
                    {members.map((member) => (<option key={member.id} value={member.id}>{member.user.name}</option>))}
                  </select>
                  <input type="date" value={startDateFilter} onChange={(event) => setStartDateFilter(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white" />
                  <input type="date" value={endDateFilter} onChange={(event) => setEndDateFilter(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 dark:border-white/15 dark:bg-[#111827] dark:text-white" />
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Linha do tempo da agenda</h2>
                {needsFirstHousehold ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Crie o primeiro lar para começar a registrar eventos compartilhados.</p>
                ) : timelineEvents.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Nenhum evento encontrado com os filtros atuais.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {groupedTimeline.map(([groupTitle, groupEvents]) => (
                      <div key={groupTitle} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{groupTitle}</p>
                        {groupEvents.map((event) => (
                          (() => {
                            const expired = isEventExpired(event);
                            return (
                          <article
                            id={`timeline-event-${event.id}`}
                            key={event.id}
                            className={`rounded-xl border p-3 ${
                              highlightedEventId === event.id
                                ? "border-cyan-400/70 bg-cyan-50/60 ring-1 ring-cyan-300/70 dark:border-cyan-400/50 dark:bg-cyan-500/10"
                                : expired
                                  ? "border-red-300/80 bg-red-50/70 dark:border-red-400/40 dark:bg-red-950/20"
                                  : "border-slate-200/90 dark:border-white/10"
                            } ${pulseEventId === event.id ? "animate-pulse" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">{event.title}</p>
                              {expired ? (
                                <span className="rounded-full border border-red-300/80 bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-700 dark:border-red-400/40 dark:bg-red-950/50 dark:text-red-200">
                                  Expirado
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.ownerMember.user.name} • {CATEGORIES.find((item) => item.value === event.category)?.label ?? event.category} • {formatDateTime(event.startsAt)}</p>
                            {expired ? (
                              <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
                                A data e hora marcadas já passaram e este evento expirou.
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recorrência: {RECURRENCE_OPTIONS.find((item) => item.value === event.recurrence)?.label ?? event.recurrence}{event.reminderMinutes ? ` • Lembrete: ${event.reminderMinutes} min` : ""}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Participantes: {event.participants.map((participant) => participant.user.name).join(", ")}
                            </p>
                            {event.description ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{event.description}</p> : null}
                            {canManageEvents ? (
                              <div className="mt-2 flex items-center gap-2">
                                <button type="button" onClick={() => handleEditEvent(event)} className="inline-flex rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200">
                                  Editar
                                </button>
                                <button type="button" onClick={() => void handleDeleteEvent(event.id)} className="inline-flex rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 dark:border-red-400/30 dark:text-red-300">
                                  Excluir
                                </button>
                              </div>
                            ) : null}
                          </article>
                            );
                          })()
                        ))}
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-200/80 pt-3 text-xs dark:border-white/10">
                      <button
                        type="button"
                        disabled={timelinePage <= 1}
                        onClick={() => setTimelinePage((current) => Math.max(1, current - 1))}
                        className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-700 disabled:opacity-50 dark:border-white/15 dark:text-slate-200"
                      >
                        Página anterior
                      </button>
                      <p className="text-slate-500 dark:text-slate-400">Página {timelinePage} de {timelineTotalPages}</p>
                      <button
                        type="button"
                        disabled={timelinePage >= timelineTotalPages}
                        onClick={() => setTimelinePage((current) => Math.min(timelineTotalPages, current + 1))}
                        className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-700 disabled:opacity-50 dark:border-white/15 dark:text-slate-200"
                      >
                        Próxima página
                      </button>
                    </div>
                  </div>
                )}
              </article>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
