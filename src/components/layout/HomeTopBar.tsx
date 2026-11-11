"use client";
import { useRouter } from "@/i18n/navigation";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

interface Props { activeTab?: "menu" | "orders" | "profile" }

export function HomeTopBar({ activeTab = "menu" }: Props) {
  const router = useRouter();
  const nav = (tab: "menu" | "orders" | "profile") => {
    if (tab === "orders") router.push({ pathname: "/orders" });
    else if (tab === "profile") router.push({ pathname: "/profile" });
    else router.push("/");
  };
  return (
    <>
      <TopBar directory={true} activeTab={activeTab} onTabChange={nav} />
      <BottomNav directory={true} activeTab={activeTab} onTabChange={nav} />
    </>
  );
}
