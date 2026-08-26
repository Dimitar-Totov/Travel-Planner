"use client";

import type { ReactNode } from "react";
import type { TransferMode } from "@/lib/itinerary";
import type { DraftStop, MoveDirection } from "@/lib/hooks/useCreateGuideForm";
import Field from "@/components/auth/Field";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MapPinIcon,
  TrashIcon,
} from "@/components/icons";
import StopPin from "@/components/destinations/detail/StopPin";
import ListInput from "./ListInput";
import PhotoUploadField from "./PhotoUploadField";
import { SelectField, TextAreaField } from "./FormControls";

/** Same order and labels `TransferConnector` renders. */
const TRANSFER_MODES: { value: TransferMode; label: string }[] = [
  { value: "walk", label: "Walk" },
  { value: "metro", label: "Métro" },
  { value: "bus", label: "Bus" },
  { value: "tram", label: "Tram" },
  { value: "train", label: "Train" },
  { value: "car", label: "Drive" },
  { value: "ferry", label: "Ferry" },
  { value: "bike", label: "Bike" },
  { value: "flight", label: "Flight" },
];

const TRANSFER_MODE_VALUES = new Set<string>(
  TRANSFER_MODES.map((mode) => mode.value),
);

/** `StopRow` renders 1–4 currency symbols, so the editor offers exactly that
 *  plus the "leave it off" case the field is optional for. */
const PRICE_LEVELS = [1, 2, 3, 4];

interface StopEditorProps {
  stop: DraftStop;
  /** 0-based position within its day — drives the pin number and whether the
   *  transfer block applies (a day's first stop has nothing to arrive from). */
  index: number;
  total: number;
  /** The guide's currency symbol, so the price scale previews correctly. */
  currency: string;
  onUpdate: (patch: Partial<Omit<DraftStop, "id">>) => void;
  onMove: (direction: MoveDirection) => void;
  onRemove: () => void;
  onOpenPicker: () => void;
  onSetPhoto: (dataUrl: string) => void;
  onClearPhoto: () => void;
}

function IconButton({
  label,
  onClick,
  disabled,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white outline-offset-2 outline-brand-500 transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-2 disabled:text-[#c3ced5] lg:h-11 lg:w-11 ${
        danger
          ? "text-muted-2 hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
          : "text-muted-2 hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-700"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * One stop's worth of fields.
 *
 * Everything `GuideStop` can carry is editable here except the coordinates,
 * which are set by clicking a map rather than typed: a stop's `lat`/`lng` are
 * what the reader's map plots, and a mistyped digit puts the pin in the sea
 * with nothing on screen to catch it. The trigger below shows the current pair
 * so the value is still legible, it just isn't hand-editable.
 */
export default function StopEditor({
  stop,
  index,
  total,
  currency,
  onUpdate,
  onMove,
  onRemove,
  onOpenPicker,
  onSetPhoto,
  onClearPhoto,
}: StopEditorProps) {
  const base = `stop-${stop.id}`;
  const heading = stop.name.trim() || `Stop ${index + 1}`;

  function setTransferMode(value: string) {
    if (!TRANSFER_MODE_VALUES.has(value)) {
      onUpdate({ transfer: undefined });
      return;
    }
    onUpdate({
      transfer: {
        mode: value as TransferMode,
        duration: stop.transfer?.duration ?? "",
        distance: stop.transfer?.distance ?? "",
      },
    });
  }

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-[0_10px_26px_-22px_rgba(20,52,78,.55)] sm:p-5 lg:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 lg:gap-3.5">
          <StopPin
            n={index + 1}
            tone={stop.highlight ? "gold" : "brand"}
            size={22}
          />
          <h4 className="min-w-0 truncate text-[15px] font-bold tracking-[-.01em] text-ink lg:text-[20px]">
            {heading}
          </h4>
        </div>

        <div className="flex flex-none items-center gap-1.5 lg:gap-2.5">
          <IconButton
            label={`Move ${heading} up`}
            onClick={() => onMove("up")}
            disabled={index === 0}
          >
            <ArrowUpIcon size={15} />
          </IconButton>
          <IconButton
            label={`Move ${heading} down`}
            onClick={() => onMove("down")}
            disabled={index === total - 1}
          >
            <ArrowDownIcon size={15} />
          </IconButton>
          <IconButton label={`Remove ${heading}`} onClick={onRemove} danger>
            <TrashIcon size={15} />
          </IconButton>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:mt-7 lg:gap-7">
        <Field
          desktopScale
          id={`${base}-name`}
          label="Stop name"
          value={stop.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          placeholder="Sainte-Chapelle"
          autoComplete="off"
        />

        <PhotoUploadField
          id={`${base}-photo`}
          label="Photo (optional)"
          hint="Shown for this stop instead of the placeholder thumbnail."
          values={stop.photo ? [stop.photo] : []}
          onAdd={onSetPhoto}
          onRemove={onClearPhoto}
          max={1}
        />

        <div>
          <span className="text-[13px] font-semibold text-ink lg:text-[16px]">
            Location
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5 lg:mt-2.5 lg:gap-4">
            <button
              type="button"
              onClick={onOpenPicker}
              className="tp-btn-shadow inline-flex items-center gap-2 rounded-full border border-[#d5e2ea] bg-white px-4 py-2.5 text-[13.5px] font-bold text-brand-700 outline-offset-2 outline-brand-500 hover:border-brand-700 hover:bg-brand-700 hover:text-white focus-visible:outline-2 lg:px-6 lg:py-3.5 lg:text-[16px]"
            >
              <MapPinIcon size={17} />
              {stop.placed ? "Change location" : "Set location on map"}
            </button>

            <span
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12.5px] font-bold tabular-nums lg:px-4 lg:py-2.5 lg:text-[15px] ${
                stop.placed
                  ? "bg-success/10 text-success"
                  : "bg-gold-warm/12 text-gold-deep"
              }`}
            >
              {stop.placed
                ? `${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`
                : "Not set"}
            </span>
          </div>
          {!stop.placed && (
            <p className="mt-1.5 text-[12px] text-muted lg:mt-2 lg:text-[14.5px]">
              Until you place it, this stop borrows the previous stop&rsquo;s
              position on the preview map.
            </p>
          )}
        </div>

        <ListInput
          id={`${base}-tags`}
          label="Tags"
          variant="chip"
          values={stop.tags}
          onAdd={(value) => onUpdate({ tags: [...stop.tags, value.trim()] })}
          onRemove={(value) =>
            onUpdate({ tags: stop.tags.filter((tag) => tag !== value) })
          }
          placeholder="Cathedral"
          hint="Short category chips shown under the stop title."
          emptyLabel="No tags yet."
        />

        <ListInput
          id={`${base}-notes`}
          label="Notes"
          variant="line"
          values={stop.notes}
          onAdd={(value) => onUpdate({ notes: [...stop.notes, value.trim()] })}
          onRemove={(value) =>
            onUpdate({ notes: stop.notes.filter((note) => note !== value) })
          }
          placeholder="Book the 9am slot — the queue triples by ten."
          hint="One bullet per line. This is the actual advice."
          emptyLabel="No notes yet."
        />

        <TextAreaField
          id={`${base}-about`}
          label="About (optional)"
          rows={3}
          value={stop.about ?? ""}
          onChange={(event) => onUpdate({ about: event.target.value })}
          placeholder="The longer paragraph shown in the map's stop card."
        />

        <Field
          desktopScale
          id={`${base}-address`}
          label="Address (optional)"
          value={stop.address ?? ""}
          onChange={(event) => onUpdate({ address: event.target.value })}
          placeholder="8 Bd du Palais, 75001 Paris"
          autoComplete="off"
        />

        <div>
          <span className="text-[13px] font-semibold text-ink lg:text-[14px]">
            Price level (optional)
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5 lg:mt-2.5 lg:gap-2.5">
            <button
              type="button"
              onClick={() => onUpdate({ priceLevel: undefined })}
              aria-pressed={stop.priceLevel === undefined}
              className={`tp-chip-shadow rounded-full border px-3.5 py-2 text-[12.5px] font-bold outline-offset-2 outline-brand-500 focus-visible:outline-2 lg:px-5 lg:py-3 lg:text-[15px] ${
                stop.priceLevel === undefined
                  ? "border-brand-500 bg-brand-500/12 text-brand-700"
                  : "border-line bg-white text-muted-2 hover:border-brand-500/40"
              }`}
            >
              None
            </button>
            {PRICE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onUpdate({ priceLevel: level })}
                aria-pressed={stop.priceLevel === level}
                aria-label={`Price level ${level} of 4`}
                className={`tp-chip-shadow rounded-full border px-3.5 py-2 text-[12.5px] font-bold outline-offset-2 outline-brand-500 focus-visible:outline-2 lg:px-5 lg:py-3 lg:text-[15px] ${
                  stop.priceLevel === level
                    ? "border-success bg-success/10 text-success"
                    : "border-line bg-white text-muted-2 hover:border-brand-500/40"
                }`}
              >
                <span aria-hidden="true">
                  {(currency || "€").repeat(level)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-gold-warm/[.07] px-3.5 py-3 ring-1 ring-inset ring-gold-warm/25 lg:gap-3.5 lg:px-5 lg:py-4">
          <input
            type="checkbox"
            checked={stop.highlight ?? false}
            onChange={(event) => onUpdate({ highlight: event.target.checked })}
            className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-gold-warm)] lg:h-5 lg:w-5"
          />
          <span className="text-[13px] leading-[1.5] text-gold-deep lg:text-[16px]">
            <span className="font-bold">Highlight this stop.</span> The
            day&rsquo;s standout — its row and its pin render in gold instead of
            brand blue.
          </span>
        </label>

        {/* A day's first stop has nothing to arrive from, which is exactly the
            rule `DaySection` uses when it decides whether to draw a connector. */}
        {index > 0 && (
          <fieldset className="rounded-2xl border border-line bg-surface-3 p-3.5 lg:p-6">
            <legend className="px-1.5 text-[12.5px] font-bold uppercase tracking-[.08em] text-muted-2 lg:text-[14px]">
              Getting here
            </legend>

            <div className="flex flex-col gap-3.5 sm:flex-row lg:gap-6">
              <div className="sm:w-[38%]">
                <SelectField
                  id={`${base}-transfer-mode`}
                  label="Mode"
                  value={stop.transfer?.mode ?? ""}
                  onChange={(event) => setTransferMode(event.target.value)}
                >
                  <option value="">No transfer shown</option>
                  {TRANSFER_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              {stop.transfer && (
                <>
                  <div className="flex-1">
                    <Field
                      desktopScale
                      id={`${base}-transfer-duration`}
                      label="Duration"
                      value={stop.transfer.duration}
                      onChange={(event) =>
                        onUpdate({
                          transfer: stop.transfer && {
                            ...stop.transfer,
                            duration: event.target.value,
                          },
                        })
                      }
                      placeholder="11 min"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex-1">
                    <Field
                      desktopScale
                      id={`${base}-transfer-distance`}
                      label="Distance"
                      value={stop.transfer.distance}
                      onChange={(event) =>
                        onUpdate({
                          transfer: stop.transfer && {
                            ...stop.transfer,
                            distance: event.target.value,
                          },
                        })
                      }
                      placeholder="0.56 mi"
                      autoComplete="off"
                    />
                  </div>
                </>
              )}
            </div>
          </fieldset>
        )}
      </div>
    </li>
  );
}
