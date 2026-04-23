import { redirect } from "next/navigation";

export const metadata = { title: "Reseller Store Redirect" };

export default function ResellerBookingsPage() {
  redirect("/reseller/store");
}
