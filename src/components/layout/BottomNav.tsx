"use client";
import { useTranslations } from "next-intl";
import { Home, ClipboardList, User, UtensilsCrossed } from "lucide-react";

interface Props {
  activeTab: "menu" | "orders" | "profile";
  onTabChange: (tab: "menu" | "orders" | "profile") => void;
  directory?: boolean;
}

export function BottomNav({ activeTab, onTabChange, directory }: Props) {
  const t = useTranslations("Nav");
  const tabs = directory
    ? [
        { key: "menu" as const, label: t("restaurants"), Icon: Home },
        { key: "orders" as const, label: t("orders"), Icon: ClipboardList },
        { key: "profile" as const, label: t("profile"), Icon: User },
      ]
    : [
        { key: "menu" as const, label: t("menu"), Icon: UtensilsCrossed },
        { key: "orders" as const, label: t("orders"), Icon: ClipboardList },
        { key: "profile" as const, label: t("profile"), Icon: User },
      ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 sm:hidden">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => onTabChange(key)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${activeTab === key ? "text-zinc-900 dark:text-zinc-100" : "text-slate-400 dark:text-zinc-500"}`}>
            <Icon size={18} strokeWidth={activeTab === key ? 2.5 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
