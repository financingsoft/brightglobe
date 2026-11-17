import { OrganizationWorkspace } from "@/components/portal";

export const metadata = { title: "Organization workspace", robots: { index: false, follow: false } };

export default async function OrganizationPage({
  params
}: {
  params: Promise<{ developerId: string }>;
}) {
  const { developerId } = await params;
  return <OrganizationWorkspace developerId={developerId} />;
}
