import AppShell from "../../components/ui/AppShell.jsx";
import PrivacyNotice from "../../components/ui/PrivacyNotice.jsx";
import { SectionTitle } from "../../components/ui/primitives.jsx";
import SamplePanel from "../../components/SamplePanel.jsx";

export default function OfficerSamplesScreen() {
  return (
    <AppShell title="Lab Referrals" subtitle="Collect samples · refer to district lab · results return to records">
      <div className="space-y-6 max-w-3xl">
        <PrivacyNotice role="vet" compact />
        <section>
          <SectionTitle icon="🧪">Sample collection &amp; referral</SectionTitle>
          <SamplePanel />
        </section>
      </div>
    </AppShell>
  );
}