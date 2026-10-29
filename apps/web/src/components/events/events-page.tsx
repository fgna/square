"use client";
import { useTranslations } from 'next-intl';

import { useEffect, useState } from "react";
import { useFormatters } from "@/lib/use-formatters";
import { useEvents, useRsvp, useCancelRsvp, useRsvpSeries, useCancelSeriesRsvp } from "@/hooks/use-events";
import { toast } from "@/store/toast.store";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  List,
  MapPin,
  Users,
  Video,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  addDays,
} from "date-fns";
import type { CommunityEvent } from "@community/shared";
import { EventProposalsSection } from "@/components/event-proposals/event-proposals-section";
import { AddToCalendar } from "./add-to-calendar";
import { EventDescription } from "./event-description";

function EventCard({
  event,
  highlighted = false,
}: {
  event: CommunityEvent;
  highlighted?: boolean;
}) {
  const t = useTranslations('events');
  const { dateFnsLocale } = useFormatters();
  const { user } = useAuth();
  const rsvp = useRsvp(event.id);
  const cancelRsvp = useCancelRsvp(event.id);
  const rsvpSeries = useRsvpSeries(event.seriesId);
  const cancelSeries = useCancelSeriesRsvp(event.seriesId);

  const userRsvp = event.rsvps?.find((a) => a.userId === user?.id);
  const attendeeCount = event.rsvps?.length ?? 0;

  const handleRsvp = () => {
    if (userRsvp) {
      cancelRsvp.mutate();
    } else {
      rsvp.mutate("GOING");
    }
  };

  const isPending = rsvp.isPending || cancelRsvp.isPending || rsvpSeries.isPending || cancelSeries.isPending;

  // Recurring events: one click for all upcoming dates instead of one per date.
  const handleSeries = () => {
    if (userRsvp) {
      cancelSeries.mutate(undefined, {
        onSuccess: (r) => toast.success(t("seriesCancelled", { count: r.count })),
      });
    } else {
      rsvpSeries.mutate("GOING", {
        onSuccess: (r) =>
          toast.success(
            t("seriesJoined", { count: r.count }),
            r.skippedFull ? t("seriesSkippedFull", { count: r.skippedFull }) : t("seriesCalendarHint"),
          ),
      });
    }
  };
  const startDate = new Date(event.startsAt);

  return (
    <Card
      id={`event-${event.id}`}
      // No overflow-hidden: the "Add to calendar" popover opens below the
      // button at the card's bottom edge and was clipped to nothing.
      className="scroll-mt-24 transition-shadow"
      style={
        highlighted
          ? { boxShadow: "0 0 0 2px var(--theme-primary)" }
          : undefined
      }
    >
      <CardContent className="p-0">
        {/* Date strip */}
        <div
          className="flex items-center gap-4 px-5 py-3"
          style={{ borderBottom: "1px solid var(--theme-border)" }}
        >
          <div
            className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center"
            style={{ background: "rgba(197,168,128,0.12)" }}
          >
            <span
              className="text-lg font-bold leading-none"
              style={{ color: "var(--theme-primary)" }}
            >
              {format(startDate, "d")}
            </span>
            <span
              className="text-xs font-medium uppercase"
              style={{ color: "var(--theme-text-muted)" }}
            >
              {format(startDate, "MMM", { locale: dateFnsLocale })}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3
                className="text-sm font-semibold leading-tight"
                style={{ color: "var(--theme-text)" }}
              >
                {event.title}
              </h3>
              <div className="flex gap-1.5 flex-shrink-0">
                {event.isVirtual && (
                  <Badge
                    style={{
                      background: "rgba(99,102,241,0.15)",
                      borderColor: "rgba(99,102,241,0.3)",
                      color: "#818cf8",
                    }}
                  >
                    <Video size={10} className="mr-1" />
                    {t("online")}
                  </Badge>
                )}
              </div>
            </div>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--theme-text-muted)" }}
            >
              {format(startDate, t("formats.cardDate"), { locale: dateFnsLocale })}
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {event.description && <EventDescription text={event.description} />}

          <div
            className="flex flex-wrap items-center gap-4 text-xs"
            style={{ color: "var(--theme-text-muted)" }}
          >
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {event.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users size={12} />
              {t("attending", { count: attendeeCount })}
            </span>
            {event.maxRsvps && (
              <span className="flex items-center gap-1">
                <span>{t("spotsLeft", { count: event.maxRsvps - attendeeCount })}</span>
              </span>
            )}
          </div>

          {/* Wraps on phones: the series link takes its own line instead of pushing the card wider than the screen. */}
          <div className="flex flex-wrap items-center justify-between gap-y-2 pt-1">
            <div className="flex -space-x-2">
              {event.rsvps?.slice(0, 5).map((attendee) => (
                <div
                  key={attendee.userId}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
                  style={{
                    background: "var(--theme-primary)",
                    color: "var(--theme-background)",
                    borderColor: "var(--theme-card)",
                  }}
                  title={attendee.user?.name}
                >
                  {attendee.user?.name?.[0] ?? "?"}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={userRsvp ? "outline" : "default"}
                onClick={handleRsvp}
                disabled={isPending}
                style={
                  userRsvp
                    ? {
                        borderColor: "var(--theme-primary)",
                        color: "var(--theme-primary)",
                        background: "transparent",
                      }
                    : undefined
                }
              >
                {isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : userRsvp ? (
                  t("cancelRsvp")
                ) : (
                  t("rsvp")
                )}
              </Button>
              <AddToCalendar event={event} />
            </div>
            {event.seriesId && (
              <button
                type="button"
                onClick={handleSeries}
                disabled={isPending}
                className="basis-full text-left text-xs underline"
                style={{ color: "var(--theme-text-muted)" }}
              >
                {userRsvp ? t("seriesCancel") : t("seriesRsvp")}
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarView() {
  const t = useTranslations('events');
  const { dateFnsLocale } = useFormatters();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  // The weeks shown, past days included, instead of the first page of the list.
  const { data: monthData } = useEvents(1, 100, {
    from: calStart.toISOString(),
    to: addDays(calEnd, 1).toISOString(),
  });
  const events: CommunityEvent[] = monthData?.data ?? [];
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsByDay = (day: Date) =>
    events.filter((e) => isSameDay(new Date(e.startsAt), day));

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft size={16} />
        </Button>
        <span
          className="font-semibold text-sm"
          style={{ color: "var(--theme-text)" }}
        >
          {format(currentMonth, t("formats.month"), { locale: dateFnsLocale })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Grid */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: "1px solid var(--theme-border)",
          background: "var(--theme-card)",
        }}
      >
        {/* Day headers */}
        <div className="grid grid-cols-7">
          {t("weekdays").split(",").map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-semibold"
              style={{
                color: "var(--theme-text-muted)",
                borderBottom: "1px solid var(--theme-border)",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayEvents = eventsByDay(day);
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            return (
              <div
                key={idx}
                className="min-h-[80px] p-1.5"
                style={{
                  borderRight:
                    (idx + 1) % 7 !== 0
                      ? "1px solid var(--theme-border)"
                      : undefined,
                  borderBottom:
                    idx < days.length - 7
                      ? "1px solid var(--theme-border)"
                      : undefined,
                  background: today ? "rgba(197,168,128,0.05)" : undefined,
                  opacity: inMonth ? 1 : 0.35,
                }}
              >
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${today ? "font-bold" : ""}`}
                  style={{
                    color: today
                      ? "var(--theme-background)"
                      : "var(--theme-text-muted)",
                    background: today ? "var(--theme-primary)" : "transparent",
                  }}
                >
                  {format(day, "d")}
                </span>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className="text-[10px] px-1.5 py-0.5 rounded truncate"
                      style={{
                        background: "rgba(197,168,128,0.15)",
                        color: "var(--theme-primary)",
                      }}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div
                      className="text-[10px] px-1.5"
                      style={{ color: "var(--theme-text-muted)" }}
                    >
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EventsPage() {
  const t = useTranslations('events');
  const { data, isLoading, error, refetch } = useEvents(1, 50, { when: 'upcoming' });
  const [view, setView] = useState<"list" | "calendar">("list");

  const events: CommunityEvent[] = data?.data ?? [];

  // There is no page per event: links elsewhere (feed strip, assessment) point
  // to /events#event-<id>. The list loads after navigation, so the browser's
  // own jump to the anchor finds nothing — scroll once the card exists.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash.startsWith("event-") || !events.length) return;
    const card = document.getElementById(hash);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightId(hash.slice("event-".length));
  }, [events.length]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ color: "var(--theme-text)" }}
          >
            {t("title")}
          </h2>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--theme-text-muted)" }}
          >
            {t("description")}
          </p>
        </div>
        <div
          className="flex items-center gap-1 p-1 rounded-lg"
          style={{
            background: "var(--theme-card)",
            border: "1px solid var(--theme-border)",
          }}
        >
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background:
                view === "list" ? "var(--theme-primary)" : "transparent",
              color:
                view === "list"
                  ? "var(--theme-background)"
                  : "var(--theme-text-muted)",
            }}
          >
            <List size={13} /> {t("list")}
          </button>
          <button
            onClick={() => setView("calendar")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background:
                view === "calendar" ? "var(--theme-primary)" : "transparent",
              color:
                view === "calendar"
                  ? "var(--theme-background)"
                  : "var(--theme-text-muted)",
            }}
          >
            <Calendar size={13} /> {t("calendar")}
          </button>
        </div>
      </div>

      <EventProposalsSection />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p style={{ color: "var(--theme-danger)" }}>
              {t("failed")}
            </p>
            <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
              {(error as { message?: string })?.message || t("unknownError")}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : view === "calendar" ? (
        <CalendarView />
      ) : !events.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar
              size={40}
              className="mx-auto mb-3"
              style={{ color: "var(--theme-text-muted)" }}
            />
            <p className="font-medium" style={{ color: "var(--theme-text)" }}>
              {t("emptyTitle")}
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--theme-text-muted)" }}
            >
              {t("emptyText")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              highlighted={event.id === highlightId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
