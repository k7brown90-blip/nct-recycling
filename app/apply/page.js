import ApplyForm from "./ApplyForm";
import { getActiveAgreement } from "@/lib/agreement-templates";

export const metadata = { title: "Reseller Buyer Application — NCT Recycling" };
export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const agreement = await getActiveAgreement("reseller");
  return <ApplyForm agreement={agreement} />;
}
