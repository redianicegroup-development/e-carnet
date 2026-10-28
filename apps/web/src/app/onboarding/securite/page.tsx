import { RecoverySetup } from "../../../components/RecoverySetup";
import { OnboardingFrame } from "../../../components/onboarding/OnboardingChrome";

export const metadata = { title: "Sécuriser votre compte — Mon E-Carnet", robots: { index: false, follow: false } };

export default function RecoverySetupPage() {
  return <OnboardingFrame><RecoverySetup /></OnboardingFrame>;
}
