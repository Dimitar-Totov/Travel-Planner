"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { useCreateGuideForm } from "@/lib/hooks/useCreateGuideForm";
import { EyeIcon, UploadIcon } from "@/components/icons";
import CreateGuideForm from "./CreateGuideForm";
import CreateGuidePreview from "./CreateGuidePreview";
import LocationPickerModal from "./LocationPickerModal";

type Mode = "edit" | "preview";

const MODES: { value: Mode; label: string }[] = [
  { value: "edit", label: "Edit" },
  { value: "preview", label: "Preview" },
];

interface CreateGuidePageShellProps {
  /** `SiteNav`, passed as a slot so it stays a server component and keeps
   *  reading the session on the server. */
  nav: ReactNode;
  /** `SiteFooter`, same reason. In Preview it is threaded further down into
   *  `ItineraryDetailView`, which only shows it below `lg`. */
  footer: ReactNode;
}

/**
 * The `/create-guide` client boundary: the draft, the Edit/Preview switch, and
 * the header bar both modes share.
 *
 * The two modes are mutually exclusive branches on purpose. Preview mounts a
 * MapLibre map (through `ItineraryDetailView`) and Edit can mount the location
 * picker's map, and this app holds a standing rule that exactly one WebGL map
 * context is alive at a time — the picker is additionally gated on `mode` here
 * so no future edit can leave both on screen together.
 *
 * `lg:h-screen lg:overflow-hidden` is applied only while previewing. It is what
 * lets the split pane below own the viewport (the same class the real guide
 * route puts on its page wrapper), and it would trap the form's own scrolling
 * if it were left on in Edit.
 */
export default function CreateGuidePageShell({
  nav,
  footer,
}: CreateGuidePageShellProps) {
  const form = useCreateGuideForm();
  const [mode, setMode] = useState<Mode>("edit");

  const previewing = mode === "preview";

  // The preview renders `GuideHero`, which owns the page's `<h1>`. Two of them
  // would compete in a screen reader's document outline, so the bar's title
  // steps down to plain text while that is on screen.
  const barTitle = previewing ? (
    <p className="text-[17px] font-extrabold tracking-[-.02em] text-ink lg:text-[19px]">
      Create a guide
    </p>
  ) : (
    <h1 className="text-[17px] font-extrabold tracking-[-.02em] text-ink lg:text-[19px]">
      Create a guide
    </h1>
  );

  return (
    <div
      className={`flex min-h-screen flex-col ${
        previewing ? "bg-white lg:h-screen lg:overflow-hidden" : "bg-surface-2"
      }`}
    >
      {nav}

      <div className="flex flex-none flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line bg-white px-5 py-3.5 sm:px-8 lg:px-10 lg:py-5">
        <div className="min-w-0">
          {barTitle}
          <p className="mt-0.5 text-[12.5px] text-muted lg:text-[13.5px]">
            {form.days.length} {form.days.length === 1 ? "day" : "days"} ·{" "}
            {form.stopCount} {form.stopCount === 1 ? "stop" : "stops"} · draft
            kept in this tab only
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 lg:gap-3">
          <div
            role="group"
            aria-label="Editing mode"
            className="inline-flex rounded-full bg-surface-2 p-1"
          >
            {MODES.map((item) => {
              const active = mode === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMode(item.value)}
                  aria-pressed={active}
                  className={`tp-chip-shadow inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold outline-offset-2 outline-brand-500 focus-visible:outline-2 lg:px-5 lg:py-2.5 lg:text-[14.5px] ${
                    active
                      ? "bg-white text-brand-700 shadow-[0_6px_16px_-10px_rgba(20,52,78,.8)]"
                      : "text-[#68767f] hover:text-brand-700"
                  }`}
                >
                  {item.value === "preview" && <EyeIcon size={14} />}
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* There is no guides-write API and no guide model — nothing to POST
              to. Genuinely `disabled` with the reason in the tooltip, the same
              way `GuideAuthorBar`'s Comments and `GuideMap`'s Export are, rather
              than a button that fakes a success it can't deliver. */}
          <button
            type="button"
            disabled
            title="Publishing isn't built yet — guides are still a static, hardcoded list"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-[14px] font-bold text-[#a3b0b8] lg:px-6 lg:py-3 lg:text-[15px]"
          >
            <UploadIcon size={15} /> Publish
          </button>
        </div>
      </div>

      {previewing ? (
        <CreateGuidePreview form={form} footer={footer} />
      ) : (
        <>
          <main className="flex-1">
            <CreateGuideForm form={form} />
          </main>
          {footer}
        </>
      )}

      <AnimatePresence>
        {!previewing && form.pickerTarget && (
          <LocationPickerModal
            days={form.days}
            heroAccent={form.heroAccent}
            target={form.pickerTarget}
            onCancel={form.closePicker}
            onConfirm={form.confirmPickedLocation}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
