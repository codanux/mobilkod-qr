"use client";
import type { Product } from "@/types";
import { money } from "@/lib/money";

interface Props {
  product: Product;
  onOpen: (p: Product) => void;
}

export function ProductCard({ product, onOpen }: Props) {
  return (
    <button
      onClick={() => onOpen(product)}
      disabled={product.soldOut}
      className="w-full flex items-start gap-3 text-left p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 hover:shadow-sm bg-white dark:bg-zinc-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {product.imageUrl && (
        <img src={product.imageUrl} alt="" width={72} height={72}
          className="w-[72px] h-[72px] rounded-xl object-cover shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 dark:text-zinc-100 text-sm leading-snug">{product.name}</p>
        {product.description && (
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">{product.description}</p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{money.format(product.price)}</p>
          {product.soldOut && <span className="text-[10px] font-semibold text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">Tükendi</span>}
          {!product.soldOut && (product.groups.length > 0 || (product.slots?.length ?? 0) > 0) && (
            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">Seçenek var →</span>
          )}
        </div>
      </div>
    </button>
  );
}
