import type { ComponentType, SVGProps } from "react";
import type { StopTransfer, TransferMode } from "@/lib/guideItineraries";
import {
  BikeIcon,
  BusIcon,
  CarIcon,
  FerryIcon,
  MetroIcon,
  PlaneIcon,
  TrainIcon,
  TramIcon,
  WalkIcon,
} from "@/components/icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const MODE_ICON: Record<TransferMode, IconComponent> = {
  walk: WalkIcon,
  metro: MetroIcon,
  bus: BusIcon,
  tram: TramIcon,
  train: TrainIcon,
  car: CarIcon,
  ferry: FerryIcon,
  bike: BikeIcon,
  flight: PlaneIcon,
};

/** Only shown for non-walking legs — "12 min · 0.62 mi" already reads as a
 *  walk, and the label would be noise on the majority of connectors. */
const MODE_LABEL: Record<TransferMode, string> = {
  walk: "walk",
  metro: "métro",
  bus: "bus",
  tram: "tram",
  train: "train",
  car: "drive",
  ferry: "ferry",
  bike: "bike",
  flight: "flight",
};

/* The rule between two stops. A walk is a hairline in the neutral line colour;
   anything you have to board is twice as thick, twice the dash period and
   brand blue — so the eye can skim a day and see where the ground changes
   without reading a single word. */
const DASH_WALK =
  "repeating-linear-gradient(90deg,#dde4e9 0 5px,transparent 5px 10px)";
const DASH_RIDE =
  "repeating-linear-gradient(90deg,#bcd8e9 0 7px,transparent 7px 14px)";

/**
 * How you get from the previous stop to this one. Rendered between two
 * `StopRow`s, never before the first stop of a day.
 */
export default function TransferConnector({
  transfer,
}: {
  transfer: StopTransfer;
}) {
  const Icon = MODE_ICON[transfer.mode];
  const walking = transfer.mode === "walk";

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 sm:px-4">
      <span
        className={`inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full ${
          walking ? "bg-surface text-muted-2" : "bg-brand-500/12 text-brand-500"
        }`}
      >
        <Icon size={12} />
      </span>
      <span
        className={`flex-none text-[11.5px] tracking-[.01em] sm:text-[12px] ${
          walking ? "font-semibold text-muted-2" : "font-bold text-brand-500"
        }`}
      >
        {transfer.duration} · {transfer.distance}
        {!walking && ` · ${MODE_LABEL[transfer.mode]}`}
      </span>
      <span
        aria-hidden="true"
        className={`min-w-0 flex-1 ${walking ? "h-px" : "h-0.5"}`}
        style={{ background: walking ? DASH_WALK : DASH_RIDE }}
      />
    </div>
  );
}
