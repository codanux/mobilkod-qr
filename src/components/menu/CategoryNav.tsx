"use client";
import type { MenuCategory } from "@/types";

interface Props {
  categories: MenuCategory[];
  activeId: string;
  onChange: (id: string) => void;
}

export function CategoryNav({ categories, activeId, onChange }: Props) {
  return (
    <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
      <button
        onClick={() => onChange("all")}
        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeId === "all" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"}`}
      >Tümü</button>
      {categories.map(cat => (
        <button key={cat.id} onClick={() => onChange(cat.id)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${activeId === cat.id ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"}`}>
          {cat.name}
        </button>
      ))}
    </div>
  );
}
