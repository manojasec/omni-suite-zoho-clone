"use client";

import * as React from "react";
import {
  buildMonthGrid,
  weekdayLabels,
  type CalendarCell,
  type CalendarEvent,
} from "./calendar";

export type CalendarViewProps<T = unknown> = {
  year: number;
  /** 1-12 */
  month: number;
  events: CalendarEvent<T>[];
  weekStartsOn?: number;
  locale?: string;
  /** Click handler for a day cell. Receives the cell & native event. */
  onDayClick?: (cell: CalendarCell<T>, e: React.MouseEvent) => void;
  /** Click handler for an event chip. */
  onEventClick?: (event: CalendarEvent<T>, e: React.MouseEvent) => void;
  /** Maximum chips per cell before showing "+N more". */
  maxChipsPerCell?: number;
};

/**
 * Reusable month-grid calendar. Renders as a 7×6 grid using CSS grid; works
 * inside any container. Pure component — caller owns state for the visible
 * month and supplies the events.
 */
export function CalendarView<T = unknown>(props: CalendarViewProps<T>) {
  const {
    year,
    month,
    events,
    weekStartsOn = 1,
    locale = "en-US",
    onDayClick,
    onEventClick,
    maxChipsPerCell = 3,
  } = props;

  const cells = React.useMemo(
    () => buildMonthGrid<T>({ year, month, events, weekStartsOn }),
    [year, month, events, weekStartsOn],
  );
  const labels = React.useMemo(
    () => weekdayLabels(weekStartsOn, locale),
    [weekStartsOn, locale],
  );

  return (
    <div className="rounded-lg border bg-background" role="grid" aria-label="calendar">
      <div className="grid grid-cols-7 border-b text-xs text-muted-foreground">
        {labels.map((lbl) => (
          <div key={lbl} className="px-2 py-2 text-center font-medium">
            {lbl}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const visibleEvents = cell.events.slice(0, maxChipsPerCell);
          const overflow = cell.events.length - visibleEvents.length;
          return (
            <div
              key={cell.iso}
              role="gridcell"
              aria-label={cell.iso}
              onClick={(e) => onDayClick?.(cell, e)}
              className={[
                "min-h-[96px] border-b border-r p-1 text-xs transition-colors",
                cell.inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                onDayClick ? "cursor-pointer hover:bg-accent/50" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="flex items-center justify-between px-1 py-0.5">
                <span
                  className={
                    cell.isToday
                      ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
                      : "text-[11px]"
                  }
                >
                  {Number(cell.iso.slice(8, 10))}
                </span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {visibleEvents.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(ev, e);
                      }}
                      className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-white hover:opacity-90"
                      style={{ backgroundColor: ev.color ?? "#0F172A" }}
                      title={ev.title}
                    >
                      {ev.title}
                    </button>
                  </li>
                ))}
                {overflow > 0 ? (
                  <li className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    +{overflow} more
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
