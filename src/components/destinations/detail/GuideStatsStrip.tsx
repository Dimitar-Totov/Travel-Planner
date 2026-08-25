interface Stat {
  label: string;
  value: string;
  /** The budget is the number people scan for, so it alone carries brand ink. */
  accent?: boolean;
}

/**
 * Days / Stops / Budget / Best time, under the intro paragraph.
 *
 * Two columns on phones rather than four: at 360px a four-way split leaves
 * roughly 70px per column, which wraps "Best time" onto three lines.
 */
export default function GuideStatsStrip({
  days,
  stopCount,
  currency,
  approxCostEUR,
  bestTime,
}: {
  days: number;
  stopCount: number;
  currency: string;
  approxCostEUR: number;
  bestTime: string;
}) {
  const stats: Stat[] = [
    { label: "Days", value: String(days) },
    { label: "Stops", value: String(stopCount) },
    {
      label: "Budget",
      value: `${currency}${approxCostEUR.toLocaleString()}`,
      accent: true,
    },
    { label: "Best time", value: bestTime },
  ];

  return (
    <dl className="mt-[22px] grid grid-cols-2 gap-x-3 gap-y-4 border-t border-[#eef1f4] pt-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-[11px] font-bold uppercase tracking-[.09em] text-[#8b98a1]">
            {stat.label}
          </dt>
          <dd
            className={`mt-1 text-[19px] font-extrabold tracking-[-.02em] ${
              stat.accent ? "text-brand-700" : "text-ink-soft"
            }`}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
