import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["tr", "en"],
  defaultLocale: "tr",
  localePrefix: "as-needed",
  pathnames: {
    "/": "/",
    "/register": {
      tr: "/kayit",
      en: "/register",
    },
    "/orders": {
      tr: "/siparisler",
      en: "/orders",
    },
    "/profile": {
      tr: "/profil",
      en: "/profile",
    },
    "/profile/addresses": {
      tr: "/profil/adresler",
      en: "/profile/addresses",
    },
    "/[token]": "/[token]",
    "/[token]/orders": {
      tr: "/[token]/siparisler",
      en: "/[token]/orders",
    },
    "/[token]/profile": {
      tr: "/[token]/profil",
      en: "/[token]/profile",
    },
  },
});

export type Locale = (typeof routing.locales)[number];
export type Pathnames = keyof typeof routing.pathnames;
