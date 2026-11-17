import { AuthForm } from "@/components/portal";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
