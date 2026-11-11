"use client";
import { useRouter } from "@/i18n/navigation";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

interface Props { token: string; activeTab: "orders" | "profile"; shop?: string }

export function TokenPageNav({ token, activeTab, shop }: Props) {
  const router = useRouter();
  const nav = (tab: "menu" | "orders" | "profile") => {
    if (tab === "menu") router.push({ pathname: "/[token]", params: { token } });
    else if (tab === "orders") router.push({ pathname: "/orders" });
    else router.push({ pathname: "/profile" });
  };
  return (
    <>
      <TopBar shop={shop} activeTab={activeTab} onTabChange={nav} />
      <BottomNav activeTab={activeTab} onTabChange={nav} />
    </>
  );
}
