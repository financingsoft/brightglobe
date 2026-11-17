import { AuthForm } from "@/components/portal";

export const metadata = { title: "Create account", robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
