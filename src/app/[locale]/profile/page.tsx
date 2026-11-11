import { ProfileView } from "@/components/profile/ProfileView";
import { HomeTopBar } from "@/components/layout/HomeTopBar";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bilgilerim | Mobilkod", robots: "noindex" };

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-20">
      <HomeTopBar activeTab="profile" />
      <ProfileView />
    </div>
  );
}
