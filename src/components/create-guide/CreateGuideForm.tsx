"use client";

import type { CreateGuideFormState } from "@/lib/hooks/useCreateGuideForm";
import Field from "@/components/auth/Field";
import { TextAreaField } from "./FormControls";
import ItineraryEditor from "./ItineraryEditor";
import ListInput from "./ListInput";
import PhotoUploadField from "./PhotoUploadField";

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
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:max-w-[1200px] lg:gap-12 lg:px-12 lg:py-16 xl:max-w-[1360px]">
      <section
        aria-labelledby="basics-heading"
        className="rounded-2xl border border-line bg-white p-5 shadow-[0_18px_40px_-32px_rgba(20,52,78,.7)] sm:p-7 lg:p-12"
      >
        <h2
          id="basics-heading"
          className="text-[20px] font-extrabold tracking-[-.024em] text-ink-soft lg:text-[30px]"
        >
          Basics
        </h2>
        <p className="mt-1 text-[13.5px] text-muted lg:mt-2 lg:text-[17px]">
          The hero, the opening paragraph and the four numbers at the top of the
          guide.
        </p>

        <div className="mt-5 flex flex-col gap-4 lg:mt-8 lg:gap-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              desktopScale
              id="hero-title"
              label="Headline"
              value={form.heroTitle}
              onChange={(event) => form.setHeroTitle(event.target.value)}
              placeholder="Three days in"
              hint="The bold half of the hero headline."
              autoComplete="off"
            />
            <Field
              desktopScale
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
            hint="The short summary the /guides feed shows."
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
              desktopScale
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
              desktopScale
              id="guide-best-time"
              label="Best time"
              value={form.bestTime}
              onChange={(event) => form.setBestTime(event.target.value)}
              placeholder="May"
              hint="One of the four stats in the strip."
              autoComplete="off"
            />
          </div>

          <PhotoUploadField
            id="guide-cover"
            label="Cover photo"
            hint="The hero photo at the top of the guide."
            values={form.coverImage ? [form.coverImage] : []}
            onAdd={form.setCoverImage}
            onRemove={form.clearCoverImage}
            max={1}
          />
        </div>
      </section>

      <section
        aria-labelledby="tips-heading"
        className="rounded-2xl border border-line bg-white p-5 shadow-[0_18px_40px_-32px_rgba(20,52,78,.7)] sm:p-7 lg:p-12"
      >
        <h2
          id="tips-heading"
          className="text-[20px] font-extrabold tracking-[-.024em] text-ink-soft lg:text-[30px]"
        >
          General tips
        </h2>
        <p className="mt-1 text-[13.5px] text-muted lg:mt-2 lg:text-[17px]">
          The bulleted advice that sits above the first day.
        </p>

        <div className="mt-5 lg:mt-8">
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
