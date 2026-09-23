import AppShell from "../../components/ui/AppShell.jsx";
import PrivacyNotice from "../../components/ui/PrivacyNotice.jsx";
import { SectionTitle } from "../../components/ui/primitives.jsx";
import EscalationPanel from "../../components/EscalationPanel.jsx";
import { useOfficerData } from "./useOfficerData.js";

export default function OfficerEscalationsScreen() {
  const o = useOfficerData();

  return (
    <AppShell title="Case Escalations" subtitle="Referral ladder — district officer → dispensary → hospital">
      <div className="space-y-6 max-w-3xl">
        <PrivacyNotice role="vet" compact />
        <section>
          <SectionTitle icon="🔺">Referral ladder</SectionTitle>
          <EscalationPanel clusters={o.clusters} />
        </section>
      </div>
    </AppShell>
  );
}