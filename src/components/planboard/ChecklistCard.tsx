import type { ChecklistItem } from "@/lib/types";
import { CheckIcon } from "@/components/icons";

export default function ChecklistCard({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="flex-1 rounded-2xl border border-line bg-white p-[15px]">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] font-bold text-ink">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf2f8] text-[#1c5b83]">
            <CheckIcon size={13} />
          </span>
          Travel checklist
        </span>
        <span className="text-[11px] font-bold text-[#1c5b83]">
          {done} / {total}
        </span>
      </div>

      <div className="mb-[13px] h-[5px] overflow-hidden rounded-full bg-[#eaeef2]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#2f7fb0,#164e73)]"
          style={{ width: `${pct}%`, animation: "pb-grow 1.1s ease-out both" }}
        />
      </div>

      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-[9px] py-[5px]">
            <span
              className="inline-flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] text-white"
              style={{
                border: `1.5px solid ${item.done ? "#1c5b83" : "#cbd4da"}`,
                background: item.done ? "#1c5b83" : "transparent",
              }}
            >
              {item.done && <CheckIcon size={10} strokeWidth={3.2} />}
            </span>
            <span
              className="text-[12.5px]"
              style={{
                color: item.done ? "#9aa5ac" : "#2b3a44",
                textDecoration: item.done ? "line-through" : "none",
              }}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
