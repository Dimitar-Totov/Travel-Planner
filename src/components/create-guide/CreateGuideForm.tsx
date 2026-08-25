"use client";

import type { CreateGuideFormState } from "@/lib/hooks/useCreateGuideForm";
import Field from "@/components/auth/Field";
import { TextAreaField } from "./FormControls";
import ItineraryEditor from "./ItineraryEditor";
import ListInput from "./ListInput";
import { isSupportedCoverImage } from "./coverImage";

/**
 * The authoring form: everything a `GuideItinerary` carries, in the order a
 * guide is actually written — what the trip is, then the advice, then the days.
 *
 * Inputs are the shared `Field` primitive from the auth group (same radius,
 * same focus ring, same label/hint/error chrome), with `TextAreaField` and
 * `SelectField` from `FormControls` filling the two gaps it doesn't cover.
 */
export default function CreateGuideForm({
  form,
}: {
  form: CreateGuideFormState;
}) {
  const coverError =
    form.coverImage.trim() !== "" && !isSupportedCoverImage(form.coverImage)
      ? "Only images.unsplash.com URLs (or a path from this site) can be rendered."
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:max-w-[1040px] lg:gap-10 lg:px-10 lg:py-14 xl:max-w-[1160px]">
      <section
        aria-labelledby="basics-heading"
        className="rounded-2xl border border-line bg-white p-5 shadow-[0_18px_40px_-32px_rgba(20,52,78,.7)] sm:p-7 lg:p-9"
      >
        <h2
          id="basics-heading"
          className="text-[20px] font-extrabold tracking-[-.024em] text-ink-soft lg:text-[24px]"
        >
          Basics
        </h2>
        <p className="mt-1 text-[13.5px] text-muted lg:mt-1.5 lg:text-[15px]">
          The hero, the opening paragraph and the four numbers at the top of the
          guide.
        </p>

        <div className="mt-5 flex flex-col gap-4 lg:mt-6 lg:gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="hero-title"
              label="Headline"
              value={form.heroTitle}
              onChange={(event) => form.setHeroTitle(event.target.value)}
              placeholder="Three days in"
              hint="The bold half of the hero headline."
              autoComplete="off"
            />
            <Field
              id="hero-accent"
              label="Headline accent"
              value={form.heroAccent}
              onChange={(event) => form.setHeroAccent(event.target.value)}
              placeholder="old Lisbon"
              hint="Rendered in the serif italic, right after the headline."
              autoComplete="off"
            />
          </div>

          <ListInput
            id="guide-tags"
            label="Tags"
            variant="chip"
            values={form.tags}
            onAdd={form.addTag}
            onRemove={form.removeTag}
            placeholder="Walkable"
            hint="Pills over the hero photo."
            emptyLabel="No tags yet."
          />

          <TextAreaField
            id="guide-blurb"
            label="Blurb"
            rows={2}
            value={form.blurb}
            onChange={(event) => form.setBlurb(event.target.value)}
            placeholder="One or two lines for the guide's card in the feed."
            hint="The short summary the /destinations feed shows."
          />

          <TextAreaField
            id="guide-intro"
            label="Intro"
            rows={5}
            value={form.intro}
            onChange={(event) => form.setIntro(event.target.value)}
            placeholder="Your opening paragraph — why this trip, and who it suits."
            hint="Shown under the byline, above the stats."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="guide-currency"
              label="Currency symbol"
              value={form.currency}
              onChange={(event) => form.setCurrency(event.target.value)}
              placeholder="€"
              maxLength={3}
              hint="Used by the budget stat and every price level."
              autoComplete="off"
            />
            <Field
              id="guide-best-time"
              label="Best time"
              value={form.bestTime}
              onChange={(event) => form.setBestTime(event.target.value)}
              placeholder="May"
              hint="One of the four stats in the strip."
              autoComplete="off"
            />
          </div>

          <Field
            id="guide-cover"
            label="Cover image URL"
            type="url"
            inputMode="url"
            value={form.coverImage}
            onChange={(event) => form.setCoverImage(event.target.value)}
            placeholder="https://images.unsplash.com/photo-…"
            hint="Leave blank to use the default cover."
            error={coverError}
            autoComplete="off"
          />
        </div>
      </section>

      <section
        aria-labelledby="tips-heading"
        className="rounded-2xl border border-line bg-white p-5 shadow-[0_18px_40px_-32px_rgba(20,52,78,.7)] sm:p-7 lg:p-9"
      >
        <h2
          id="tips-heading"
          className="text-[20px] font-extrabold tracking-[-.024em] text-ink-soft lg:text-[24px]"
        >
          General tips
        </h2>
        <p className="mt-1 text-[13.5px] text-muted lg:mt-1.5 lg:text-[15px]">
          The bulleted advice that sits above the first day.
        </p>

        <div className="mt-5 lg:mt-6">
          <ListInput
            id="general-tips-input"
            label="Add a tip"
            variant="line"
            values={form.generalTips}
            onAdd={form.addGeneralTip}
            onRemove={form.removeGeneralTip}
            placeholder="Buy the 72-hour transport pass at the airport."
            emptyLabel="No tips yet."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-[0_18px_40px_-32px_rgba(20,52,78,.7)] sm:p-7 lg:p-9">
        <ItineraryEditor form={form} />
      </section>
    </div>
  );
}
