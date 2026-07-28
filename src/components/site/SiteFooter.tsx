import Link from "next/link";
import { PlaneIcon } from "@/components/icons";

const COLUMNS: { title: string; links: string[] }[] = [
  { title: "Product", links: ["Itineraries", "Maps", "Flights & hotels", "Checklists"] },
  { title: "Company", links: ["About", "Blog", "Careers"] },
  { title: "Legal", links: ["Privacy", "Terms"] },
];

export default function SiteFooter() {
  return (
    <footer className="bg-[#0f2f47] px-6 pb-[34px] pt-[52px] text-[#a9c4d4] sm:px-12">
      <div className="mx-auto max-w-[1160px]">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="max-w-[280px]">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[linear-gradient(150deg,#5ea8d3,#1c6392)] text-white">
                <PlaneIcon size={16} />
              </span>
              <span className="text-[16px] font-extrabold tracking-[-.02em] text-white">
                Travel Planner
              </span>
            </Link>
            <p className="mt-4 text-[13.5px] leading-[1.6] text-[#8fb0c3]">
              One sentence in. A complete, bookable trip out.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-16 gap-y-8">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <div className="text-[12px] font-bold uppercase tracking-[.08em] text-[#dcebf3]">
                  {col.title}
                </div>
                <div className="mt-[15px] flex flex-col gap-2.5 text-[14px]">
                  {col.links.map((l) => (
                    <a key={l} href="#" className="text-[#a9c4d4] hover:text-white">
                      {l}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-9 border-t border-white/10 pt-5 text-[12.5px] text-[#7fa0b4]">
          © 2026 Travel Planner. Built for people who&rsquo;d rather be packing.
        </div>
      </div>
    </footer>
  );
}
