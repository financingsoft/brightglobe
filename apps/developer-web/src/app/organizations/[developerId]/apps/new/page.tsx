import { CreateAppForm } from "@/components/portal";

export const metadata = { title: "Create app", robots: { index: false, follow: false } };

export default async function NewAppPage({ params }: { params: Promise<{ developerId: string }> }) {
  const { developerId } = await params;
  return <CreateAppForm developerId={developerId} />;
}
