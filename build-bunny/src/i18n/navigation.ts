import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/** Locale-aware Link/redirect/router — use these instead of next/link etc. */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
