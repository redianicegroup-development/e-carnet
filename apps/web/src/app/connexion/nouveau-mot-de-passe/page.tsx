import { PasswordChangeRequired } from "../../../components/auth/PasswordChangeRequired";

export const metadata = { title: "Choisir votre mot de passe — Mon E‑Carnet", robots: { index: false, follow: false } };

export default function NewPasswordPage() {
  return <PasswordChangeRequired />;
}
