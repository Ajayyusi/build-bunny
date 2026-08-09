import { clsx, type ClassValue } from "clsx";

/** Class-name combiner for component variants. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
