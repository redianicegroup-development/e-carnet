import { IdentityOnboarding } from "../../../components/IdentityOnboarding";
import { OnboardingFrame } from "../../../components/onboarding/OnboardingChrome";
export const metadata = { title: "Votre identité — Mon E-Carnet", robots: { index: false, follow: false } };
export default function IdentityPage() { return <OnboardingFrame><IdentityOnboarding /></OnboardingFrame>; }
