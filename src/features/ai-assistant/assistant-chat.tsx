"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, ArrowUp, Bot, CalendarCheck, CalendarDays, Check, Eraser, Lock, ShieldCheck, Sparkles, X } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { now, formatDate, relativeTime } from "@/lib/dates";
import { validateLeave } from "@/lib/leave";
import { roleLabels } from "@/lib/permissions";
import { cn, uid } from "@/lib/utils";
import type { ChatCard, ChatMessage } from "@/types";
import { Avatar, Badge, Card, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, FadeIn, PageHeader } from "@/components/shared/common";
import { respond, suggestionsFor, type AssistantContext } from "./engine";

const THINK_MS = 700;
const EMPTY: ChatMessage[] = [];

export function AssistantChat() {
  const { user, employee: me, role } = useAuth();
  const data = useHRStore((s) => s.data);
  const messages = useHRStore((s) => (s.currentUserId ? (s.aiChats[s.currentUserId] ?? EMPTY) : EMPTY));
  const append = useHRStore((s) => s.appendChat);
  const updateMessage = useHRStore((s) => s.updateChatMessage);
  const clearChat = useHRStore((s) => s.clearChat);
  const applyLeave = useHRStore((s) => s.applyLeave);
  const [draft, setDraft] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const params = useSearchParams();
  const router = useRouter();
  const consumedQuery = React.useRef(false);

  const ctx = React.useCallback((): AssistantContext => ({ data: useHRStore.getState().data, user, me, role, now: now() }), [user, me, role]);

  const send = React.useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || thinking) return;
      append({ id: uid("msg"), role: "user", text: q, createdAt: now().toISOString() });
      setDraft("");
      setThinking(true);
      setTimeout(() => {
        const reply = respond(q, ctx());
        append({ id: uid("msg"), role: "assistant", text: reply.text, card: reply.card, createdAt: now().toISOString() });
        setThinking(false);
        inputRef.current?.focus();
      }, THINK_MS);
    },
    [append, ctx, thinking],
  );

  // Prompt passed from dashboard shortcuts (?q=…)
  React.useEffect(() => {
    const q = params.get("q");
    if (q && !consumedQuery.current) {
      consumedQuery.current = true;
      router.replace("/ai-assistant");
      send(q);
    }
  }, [params, router, send]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  const confirmLeave = (msg: ChatMessage) => {
    const card = msg.card;
    if (!card || card.kind !== "leave-proposal" || card.status !== "proposed") return;
    const st = useHRStore.getState().data;
    const check = validateLeave({ employeeId: card.employeeId, typeId: card.typeId, startDate: card.startDate, endDate: card.endDate, halfDay: false, types: st.leaveTypes, requests: st.leaveRequests, settings: st.leaveSettings, holidays: st.holidays });
    if (!check.ok) {
      updateMessage(msg.id, { card: { ...card, status: "cancelled" } });
      append({ id: uid("msg"), role: "assistant", text: `I couldn't submit it after all: ${check.error}`, createdAt: now().toISOString() });
      return;
    }
    const req = applyLeave({ employeeId: card.employeeId, typeId: card.typeId, startDate: card.startDate, endDate: card.endDate, halfDay: false, halfDaySession: null, reason: card.reason, attachmentName: null, source: "AI Assistant" });
    updateMessage(msg.id, { card: { ...card, status: "confirmed", requestId: req.id } });
    const manager = st.employees.find((e) => e.id === me.managerId);
    setThinking(true);
    setTimeout(() => {
      append({
        id: uid("msg"),
        role: "assistant",
        text: `Done! Leave request ${req.id} has been submitted and is now pending approval${manager ? ` from ${manager.firstName} ${manager.lastName}` : ""}. I've notified your approver.`,
        card: { kind: "link", title: `Leave request ${req.id}`, description: `${req.days} day(s) · ${formatDate(req.startDate, "d MMM")}${req.endDate !== req.startDate ? ` – ${formatDate(req.endDate, "d MMM")}` : ""} · Pending`, href: "/leave/my", label: "View my leave" },
        createdAt: now().toISOString(),
      });
      setThinking(false);
    }, 450);
    toast.success("Leave request submitted", { description: `${req.id} is pending approval.` });
  };

  const cancelLeave = (msg: ChatMessage) => {
    if (msg.card?.kind !== "leave-proposal") return;
    updateMessage(msg.id, { card: { ...msg.card, status: "cancelled" } });
    append({ id: uid("msg"), role: "assistant", text: "No problem — I didn't submit anything. Let me know if you'd like different dates.", createdAt: now().toISOString() });
  };

  const suggestions = suggestionsFor(role);
  const name = `${me.firstName} ${me.lastName}`;

  return (
    <FadeIn>
      <PageHeader
        title="AI HR Assistant"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Ask questions about leave, attendance, payroll and policies.
            <Badge variant="warning">
              <Sparkles /> Demo AI simulation
            </Badge>
          </span>
        }
        actions={
          <Button variant="outline" onClick={() => setConfirmClear(true)} disabled={!messages.length}>
            <Eraser /> Clear conversation
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="flex h-[calc(100dvh-15rem)] min-h-[480px] flex-col overflow-hidden">
          <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite" data-testid="chat-messages">
            {messages.length === 0 && !thinking ? (
              <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                  <Bot className="size-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Hi {me.firstName}, how can I help?</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">I answer from TechNova&apos;s live HR records and can take simple actions for you, like applying for leave — always with your confirmation.</p>
                <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                  {suggestions.slice(0, 6).map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-subtle dark:bg-subtle">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")} data-testid={`chat-${m.role}`}>
                    {m.role === "assistant" ? (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden>
                        <Bot className="size-4" />
                      </span>
                    ) : (
                      <Avatar name={name} src={me.avatar} seed={me.id} className="size-8 text-xs" />
                    )}
                    <div className={cn("flex max-w-[min(100%,640px)] min-w-0 flex-col gap-2", m.role === "user" && "items-end")}>
                      <div className={cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted text-foreground")}>{m.text}</div>
                      {m.card && <ResultCard card={m.card} onConfirm={() => confirmLeave(m)} onCancel={() => cancelLeave(m)} />}
                      <span className="px-1 text-[11px] text-muted-foreground">{relativeTime(m.createdAt)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {thinking && (
              <div className="flex gap-3" data-testid="typing-indicator" role="status" aria-label="Assistant is typing">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="size-4" />
                </span>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <form
            className="border-t border-border p-3 sm:p-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            {messages.length > 0 && (
              <div className="scrollbar-thin -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {suggestions.slice(0, 4).map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} disabled={thinking} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-xl border border-input bg-surface p-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20 dark:bg-subtle">
              <Textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                rows={1}
                placeholder="Ask about leave, attendance, payslips…"
                aria-label="Message the AI assistant"
                className="max-h-32 min-h-9 resize-none border-0 bg-transparent py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <Button type="submit" size="icon" disabled={!draft.trim() || thinking} aria-label="Send message">
                <ArrowUp />
              </Button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-muted-foreground">Demo simulation — responses are generated by rules over your sample data, not by a live AI model.</p>
          </form>
        </Card>

        <aside className="space-y-6">
          <Card className="p-5">
            <p className="text-sm font-semibold">Suggested questions</p>
            <ul className="mt-3 space-y-1.5" aria-label="Suggested questions">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => send(s)} disabled={thinking} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50">
                    <ArrowRight className="size-3.5 shrink-0" />
                    <span>{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4 text-success" /> Permission aware
            </div>
            <p className="mt-2 text-muted-foreground">
              You&apos;re signed in as <span className="font-medium text-foreground">{roleLabels[role]}</span>. The assistant only reads records this role can access and never shows other people&apos;s salaries.
            </p>
            <div className="mt-4 flex items-center gap-2 font-semibold">
              <Lock className="size-4 text-primary" /> Actions need confirmation
            </div>
            <p className="mt-2 text-muted-foreground">When you ask it to apply for leave, it checks your balance and shows the request first. Nothing is submitted until you confirm.</p>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        tone="destructive"
        icon={Eraser}
        title="Clear this conversation?"
        description="All messages in this chat will be removed. Leave requests you already submitted are not affected."
        confirmLabel="Clear conversation"
        onConfirm={() => {
          clearChat();
          toast.success("Conversation cleared");
        }}
      />
    </FadeIn>
  );
}

function ResultCard({ card, onConfirm, onCancel }: { card: ChatCard; onConfirm: () => void; onCancel: () => void }) {
  const leaveTypes = useHRStore((s) => s.data.leaveTypes);
  if (card.kind === "stats") {
    const tones = { default: "", success: "text-success", warning: "text-warning", danger: "text-destructive" };
    return (
      <div className="w-full rounded-xl border border-border bg-surface p-4 shadow-xs" data-testid="ai-result-card">
        <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {card.items.map((i) => (
            <div key={i.label} className="rounded-lg bg-subtle px-3 py-2">
              <dt className="text-xs text-muted-foreground">{i.label}</dt>
              <dd className={cn("mt-0.5 text-sm font-semibold tabular", tones[i.tone ?? "default"])}>{i.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  if (card.kind === "table") {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-border bg-surface shadow-xs" data-testid="ai-result-card">
        <p className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">{card.title}</p>
        <div className="scrollbar-thin max-h-72 overflow-auto">
          <table className="w-full text-sm">
            {card.columns.length > 1 && (
              <thead className="bg-subtle text-xs text-muted-foreground">
                <tr>
                  {card.columns.map((c) => (
                    <th key={c} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {card.rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-muted-foreground" colSpan={card.columns.length}>
                    Nothing to show.
                  </td>
                </tr>
              ) : (
                card.rows.map((r, i) => (
                  <tr key={i} className="border-t border-border first:border-t-0">
                    {r.map((cell, j) => (
                      <td key={j} className="px-4 py-2 whitespace-nowrap tabular">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {card.link && (
          <Link href={card.link.href} className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm font-medium text-primary hover:bg-subtle">
            {card.link.label} <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    );
  }
  if (card.kind === "link") {
    return (
      <Link href={card.href} className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-xs transition-colors hover:border-primary/40 hover:bg-subtle" data-testid="ai-result-card">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <CalendarCheck className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{card.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{card.description}</span>
        </span>
        <span className="text-sm font-medium text-primary">{card.label}</span>
      </Link>
    );
  }
  const type = leaveTypes.find((t) => t.id === card.typeId);
  return (
    <div className="w-full rounded-xl border border-primary/30 bg-surface shadow-sm" data-testid="ai-leave-proposal">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <CalendarDays className="size-4 text-primary" />
        <p className="flex-1 text-sm font-semibold">Leave request · review before submitting</p>
        {card.status === "confirmed" && <Badge variant="success" dot>Submitted {card.requestId}</Badge>}
        {card.status === "cancelled" && <Badge variant="secondary">Cancelled</Badge>}
      </div>
      <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Leave type</dt>
          <dd className="font-medium">{type?.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Working days</dt>
          <dd className="font-medium tabular">{card.days}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">From</dt>
          <dd className="font-medium tabular">{formatDate(card.startDate, "EEE, d MMM yyyy")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">To</dt>
          <dd className="font-medium tabular">{formatDate(card.endDate, "EEE, d MMM yyyy")}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Reason</dt>
          <dd>{card.reason}</dd>
        </div>
        {card.balanceAfter !== null && (
          <div className="sm:col-span-2 rounded-lg bg-subtle px-3 py-2 text-xs text-muted-foreground">
            Balance after this request: <span className="font-semibold text-foreground tabular">{card.balanceAfter} day(s)</span> of {type?.name.toLowerCase()}
          </div>
        )}
      </dl>
      {card.status === "proposed" && (
        <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X /> Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}>
            <Check /> Confirm and submit
          </Button>
        </div>
      )}
    </div>
  );
}
