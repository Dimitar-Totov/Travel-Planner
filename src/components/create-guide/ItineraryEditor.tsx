"use client";

import type { CreateGuideFormState } from "@/lib/hooks/useCreateGuideForm";
import Field from "@/components/auth/Field";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import CollapsibleSection from "@/components/destinations/detail/CollapsibleSection";
import StopEditor from "./StopEditor";

/**
 * The day-by-day half of the form.
 *
 * Days reuse `CollapsibleSection` — the same disclosure the published guide is
 * read through — so a fourteen-day draft folds down to fourteen headers instead
 * of a wall of inputs, and the editor already looks like the thing it produces.
 *
 * Reordering is button-driven (`ArrowUpIcon`/`ArrowDownIcon`) rather than
 * drag-and-drop: there is no drag library in this app, and a pair of buttons is
 * the only version of "move this" that works from a keyboard and a screen
 * reader without one.
 */
export default function ItineraryEditor({
  form,
}: {
  form: CreateGuideFormState;
}) {
  return (
    <section aria-labelledby="itinerary-editor-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="itinerary-editor-heading"
            className="text-[20px] font-extrabold tracking-[-.024em] text-ink-soft lg:text-[30px]"
          >
            Itinerary
          </h2>
          <p className="mt-1 text-[13.5px] text-muted lg:mt-2 lg:text-[17px]">
            {form.days.length} {form.days.length === 1 ? "day" : "days"} ·{" "}
            {form.stopCount} {form.stopCount === 1 ? "stop" : "stops"}
            {form.unplacedCount > 0 &&
              ` · ${form.unplacedCount} still to place`}
          </p>
        </div>

        <button
          type="button"
          onClick={form.addDay}
          className="tp-btn-shadow inline-flex items-center gap-2 rounded-full bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_12px_24px_-14px_rgba(19,74,111,.9)] outline-offset-2 outline-brand-500 focus-visible:outline-2 lg:px-7 lg:py-3.5 lg:text-[16.5px]"
        >
          <PlusIcon size={17} />
          Add day
        </button>
      </div>

      {form.days.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-line bg-surface-3 px-4 py-8 text-center text-[13.5px] text-muted lg:py-12 lg:text-[17px]">
          No days yet. Add the first one to start the itinerary.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-5 lg:mt-9 lg:gap-8">
          {form.days.map((day, dayIndex) => {
            const label = day.title.trim() || `Day ${dayIndex + 1}`;
            const stopCount = day.stops.length;

            return (
              <CollapsibleSection
                key={day.id}
                id={`edit-day-${day.id}`}
                size="lg"
                title={label}
                subtitle={`${stopCount} ${stopCount === 1 ? "stop" : "stops"}`}
                open={form.isDayOpen(day.id)}
                onToggle={() => form.toggleDay(day.id)}
                action={
                  <div className="ml-3.5 mt-3 flex flex-wrap items-center gap-1.5 sm:ml-4">
                    <button
                      type="button"
                      onClick={() => form.moveDay(day.id, "up")}
                      disabled={dayIndex === 0}
                      className="tp-chip-shadow inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-muted-2 outline-offset-2 outline-brand-500 hover:border-brand-500/40 hover:text-brand-700 focus-visible:outline-2 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-2 disabled:text-[#c3ced5] disabled:hover:text-[#c3ced5] lg:px-4 lg:py-2.5 lg:text-[15px]"
                    >
                      <ArrowUpIcon size={13} />
                      <span className="sr-only sm:not-sr-only">
                        Move {label} up
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => form.moveDay(day.id, "down")}
                      disabled={dayIndex === form.days.length - 1}
                      className="tp-chip-shadow inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-muted-2 outline-offset-2 outline-brand-500 hover:border-brand-500/40 hover:text-brand-700 focus-visible:outline-2 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-2 disabled:text-[#c3ced5] disabled:hover:text-[#c3ced5] lg:px-4 lg:py-2.5 lg:text-[15px]"
                    >
                      <ArrowDownIcon size={13} />
                      <span className="sr-only sm:not-sr-only">
                        Move {label} down
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => form.removeDay(day.id)}
                      className="tp-chip-shadow inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-muted-2 outline-offset-2 outline-brand-500 hover:border-danger/40 hover:bg-danger/8 hover:text-danger focus-visible:outline-2 lg:px-4 lg:py-2.5 lg:text-[15px]"
                    >
                      <TrashIcon size={13} />
                      <span className="sr-only sm:not-sr-only">
                        Remove {label}
                      </span>
                    </button>
                  </div>
                }
              >
                <div className="flex flex-col gap-4 px-3.5 pb-2 pt-4 sm:px-4 lg:gap-7 lg:px-7 lg:pb-4 lg:pt-7">
                  <div className="grid gap-4 sm:grid-cols-2 lg:gap-7">
                    <Field
                      desktopScale
                      id={`edit-day-${day.id}-title`}
                      label="Day title"
                      value={day.title}
                      onChange={(event) =>
                        form.updateDay(day.id, { title: event.target.value })
                      }
                      placeholder="Day 1"
                      hint="Free-form — a range like “Days 8–10” is fine."
                      autoComplete="off"
                    />
                    <Field
                      desktopScale
                      id={`edit-day-${day.id}-summary`}
                      label="Day summary"
                      value={day.summary}
                      onChange={(event) =>
                        form.updateDay(day.id, { summary: event.target.value })
                      }
                      placeholder="Notre Dame and the Eiffel Tower"
                      hint="One line, shown under the day title."
                      autoComplete="off"
                    />
                  </div>

                  {day.stops.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line bg-surface-3 px-4 py-6 text-center text-[13px] text-muted lg:py-10 lg:text-[16px]">
                      No stops in this day yet.
                    </p>
                  ) : (
                    <ul className="flex list-none flex-col gap-3.5 lg:gap-5">
                      {day.stops.map((stop, stopIndex) => (
                        <StopEditor
                          key={stop.id}
                          stop={stop}
                          index={stopIndex}
                          total={day.stops.length}
                          currency={form.currency}
                          onUpdate={(patch) =>
                            form.updateStop(day.id, stop.id, patch)
                          }
                          onMove={(direction) =>
                            form.moveStop(day.id, stop.id, direction)
                          }
                          onRemove={() => form.removeStop(day.id, stop.id)}
                          onOpenPicker={() => form.openPicker(day.id, stop.id)}
                          onSetPhoto={(dataUrl) =>
                            form.setStopPhoto(day.id, stop.id, dataUrl)
                          }
                          onClearPhoto={() =>
                            form.clearStopPhoto(day.id, stop.id)
                          }
                        />
                      ))}
                    </ul>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={() => form.addStop(day.id)}
                      className="tp-btn-shadow inline-flex items-center gap-2 rounded-full border border-[#d5e2ea] bg-white px-4 py-2.5 text-[13.5px] font-bold text-brand-700 outline-offset-2 outline-brand-500 hover:border-brand-700 hover:bg-brand-700 hover:text-white focus-visible:outline-2 lg:px-6 lg:py-3.5 lg:text-[16px]"
                    >
                      <PlusIcon size={17} />
                      Add stop to {label}
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      )}
    </section>
  );
}
