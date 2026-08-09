import { notFound } from "next/navigation";

// Unmatched paths inside a valid locale render the localized not-found page
// (static routes always win over this catch-all).
export default function CatchAllPage() {
  notFound();
}
