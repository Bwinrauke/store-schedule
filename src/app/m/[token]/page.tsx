import { redirect } from "next/navigation";

/** The old secret link. Managers now pick their store and enter its PIN. */
export default function OldManagerLink() {
  redirect("/stores");
}
