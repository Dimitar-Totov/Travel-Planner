"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { useCreateGuideForm } from "@/lib/hooks/useCreateGuideForm";
import { usePublishGuide } from "@/lib/hooks/usePublishGuide";
import { EyeIcon, SpinnerIcon, UploadIcon } from "@/components/icons";
import CreateGuideForm from "./CreateGuideForm";
import CreateGuidePreview from "./CreateGuidePreview";
import LocationPickerModal from "./LocationPickerModal";
import PublishStatus from "./PublishStatus";

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
 * Publish is wired to the real API, but only as a button and a label — the
 * whole flow (pre-flight, photo uploads, `POST /api/guides`, every failure
 * case) lives in `lib/hooks/usePublishGuide.ts`, and everything it has to say
 * back is rendered by `PublishStatus`. That panel sits *inside* this sticky
 * block on purpose: the button can be pressed at any scroll position, so a
 * result left in document flow would land off-screen.
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
  const publish = usePublishGuide();
  const [mode, setMode] = useState<Mode>("edit");
  // Edit lives in normal document flow (window scroll), and swapping to
  // Preview unmounts it entirely, so the browser has nothing to remember the
  // scroll position by. Stash it on the way out and restore it once Edit is
  // back in the DOM, before paint, so the switch doesn't visibly jump to top.
  const editScrollY = useRef(0);

  const changeMode = (next: Mode) => {
    if (mode === "edit" && next !== mode) {
      editScrollY.current = window.scrollY;
    }
    setMode(next);
  };

  useLayoutEffect(() => {
    if (mode === "edit") {
      window.scrollTo(0, editScrollY.current);
    }
  }, [mode]);

  const previewing = mode === "preview";

  // Kept short — the row under the bar carries the detail (and the running
  // photo count), so the button doesn't reflow the whole header as it works.
  const publishLabel =
    publish.phase === "uploading"
      ? "Uploading…"
      : publish.phase === "saving"
        ? "Saving…"
        : "Publish";

  // The preview renders `GuideHero`, which owns the page's `<h1>`. Two of them
  // would compete in a screen reader's document outline, so the bar's title
  // steps down to plain text while that is on screen.
  const barTitle = previewing ? (
    <p className="text-[17px] font-extrabold tracking-[-.02em] text-ink lg:text-[23px]">
      Create a guide
    </p>
  ) : (
    <h1 className="text-[17px] font-extrabold tracking-[-.02em] text-ink lg:text-[23px]">
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

      <div className="sticky top-0 z-30 flex-none border-b border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-3.5 sm:px-8 lg:px-12 lg:py-7">
          <div className="min-w-0">
            {barTitle}
            <p className="mt-0.5 text-[12.5px] text-muted lg:mt-1 lg:text-[15.5px]">
              {form.days.length} {form.days.length === 1 ? "day" : "days"} ·{" "}
              {form.stopCount} {form.stopCount === 1 ? "stop" : "stops"} · draft
              kept in this tab only
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 lg:gap-4">
            <div
              role="group"
              aria-label="Editing mode"
              className="inline-flex rounded-full bg-surface-2 p-1 lg:p-1.5"
            >
              {MODES.map((item) => {
                const active = mode === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => changeMode(item.value)}
                    aria-pressed={active}
                    className={`tp-chip-shadow inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold outline-offset-2 outline-brand-500 focus-visible:outline-2 lg:px-6 lg:py-3 lg:text-[16.5px] ${
                      active
                        ? "bg-white text-brand-700 shadow-[0_6px_16px_-10px_rgba(20,52,78,.8)]"
                        : "text-[#68767f] hover:text-brand-700"
                    }`}
                  >
                    {item.value === "preview" && <EyeIcon size={16} />}
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Deliberately not disabled when the draft is incomplete or has
                unplaced stops: `usePublishGuide` explains what's wrong, which a
                greyed-out button with a tooltip cannot. */}
            <button
              type="button"
              onClick={() => publish.publish(form)}
              disabled={publish.pending}
              aria-busy={publish.pending}
              className={`tp-btn inline-flex items-center gap-2 rounded-full bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_16px_30px_-16px_rgba(15,58,88,.9)] outline-offset-2 outline-brand-500 focus-visible:outline-2 lg:px-7 lg:py-3.5 lg:text-[17px] ${
                publish.pending ? "cursor-wait opacity-80" : ""
              }`}
            >
              {publish.pending ? (
                <SpinnerIcon size={17} />
              ) : (
                <UploadIcon size={17} />
              )}
              {publishLabel}
            </button>
          </div>
        </div>

        <PublishStatus
          phase={publish.phase}
          uploaded={publish.uploaded}
          photoTotal={publish.photoTotal}
          failure={publish.failure}
          published={publish.published}
          onDismiss={publish.dismiss}
        />
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
