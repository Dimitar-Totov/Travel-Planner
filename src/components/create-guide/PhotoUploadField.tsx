"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { CloseIcon, UploadIcon } from "@/components/icons";
import {
  ImageTooLargeError,
  UnsupportedImageTypeError,
  readImageFile,
} from "./imageUpload";

interface PhotoUploadFieldProps {
  /** Stem for the file input's id and its hint/error ids. */
  id: string;
  label: string;
  hint?: string;
  values: string[];
  onAdd: (dataUrl: string) => void;
  onRemove: (dataUrl: string) => void;
  /** Caps how many photos this field holds. Omit for an unbounded gallery. */
  max?: number;
}

/**
 * The one photo-upload control on `/create-guide` — used both for the single
 * cover photo (`max={1}`) and the unbounded "More photos" gallery below it.
 *
 * There is no uploads API yet (same as everywhere else on this page — the
 * whole draft is in-memory only), so a picked file is read straight into a
 * `data:image/...` string via `readImageFile` and stored as if it were any
 * other draft field. `next/image` special-cases `data:` sources as
 * always-unoptimized, so these thumbnails render exactly like a real photo
 * would once uploads exist for real.
 */
export default function PhotoUploadField({
  id,
  label,
  hint,
  values,
  onAdd,
  onRemove,
  max,
}: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | undefined>();
  const atLimit = max !== undefined && values.length >= max;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  async function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Clears the input so picking the same file again still fires a change.
    event.target.value = "";
    if (files.length === 0) return;

    const room = max !== undefined ? max - values.length : files.length;

    for (const file of files.slice(0, room)) {
      try {
        onAdd(await readImageFile(file));
        setError(undefined);
      } catch (cause) {
        if (cause instanceof ImageTooLargeError) {
          setError(`"${file.name}" is over the 5MB limit.`);
        } else if (cause instanceof UnsupportedImageTypeError) {
          setError(`"${file.name}" isn't an image.`);
        } else {
          setError(`"${file.name}" couldn't be read.`);
        }
      }
    }
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="text-[13px] font-semibold text-ink lg:text-[16px]"
      >
        {label}
      </label>

      <div className="mt-1.5 flex flex-wrap gap-2.5 lg:mt-2.5 lg:gap-3">
        {values.map((value, index) => (
          <div
            key={value}
            className="group relative h-24 w-24 flex-none overflow-hidden rounded-[10px] border border-line bg-surface-3 lg:h-28 lg:w-28"
          >
            <Image
              src={value}
              alt=""
              fill
              sizes="112px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(value)}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0b2438]/70 text-white outline-offset-2 outline-white transition-colors hover:bg-danger focus-visible:outline-2"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        ))}

        {!atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 flex-none flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line bg-surface-3 text-muted-2 outline-offset-2 outline-brand-500 transition-colors hover:border-brand-500 hover:text-brand-700 focus-visible:outline-2 lg:h-28 lg:w-28"
          >
            <UploadIcon size={18} />
            <span className="text-[11px] font-semibold lg:text-[12.5px]">
              Upload
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        multiple={max === undefined || max - values.length > 1}
        onChange={onFilesSelected}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className="sr-only"
      />

      {hint && !error && (
        <p
          id={hintId}
          className="mt-1.5 text-[12px] text-muted lg:mt-2 lg:text-[14.5px]"
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-[12.5px] font-medium text-danger lg:mt-2 lg:text-[15px]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
