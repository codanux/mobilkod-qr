import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except static files and Next.js internals
    "/((?!_next|_vercel|favicon\\.ico|icons\\.svg|firebase-messaging-sw\\.js|.*\\..*).*)",
  ],
};
