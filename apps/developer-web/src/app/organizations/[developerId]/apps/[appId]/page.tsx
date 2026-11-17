import { EditAppForm } from "@/components/portal";

export const metadata = { title: "App workspace", robots: { index: false, follow: false } };

export default async function AppWorkspacePage({ params }: { params: Promise<{ developerId: string; appId: string }> }) {
  const { developerId, appId } = await params;
  return <EditAppForm developerId={developerId} appId={appId} />;
}
