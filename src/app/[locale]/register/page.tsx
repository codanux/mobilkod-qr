import { redirect } from "next/navigation";

const PORTAL = (process.env.NEXT_PUBLIC_PORTAL_URL ?? "").replace(/\/+$/, "");

export default function RegisterPage() {
  redirect(`${PORTAL}/register`);
}
