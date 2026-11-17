import { CreateOrganizationForm } from "@/components/portal";

export const metadata = { title: "Create organization", robots: { index: false, follow: false } };

export default function NewOrganizationPage() {
  return <CreateOrganizationForm />;
}
