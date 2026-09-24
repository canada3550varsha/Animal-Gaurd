import { useNavigate } from "react-router-dom";
import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { Card, SectionTitle } from "../components/ui/primitives.jsx";
import { useApp } from "../context/AppContext.jsx";
import { T } from "../data/i18n.js";

const ROLE_LABEL = {
  farmer: "Livestock Owner",
  vet: "Veterinary Officer",
  admin: "District Admin",
  lab: "Lab Analyst",
};

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, farms, lang } = useApp();
  const role = user?.role || "farmer";

  const initials = (user?.name || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AppShell title={T(lang, "My Profile")} subtitle={T(lang, "Account & privacy")}>
      <div className="space-y-6 max-w-2xl">
        <PrivacyNotice role={role} />

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <span className="w-16 h-16 rounded-2xl bg-primary text-white text-2xl font-bold flex items-center justify-center">
              {initials}
            </span>
            <div>
              <p className="text-xl font-bold text-ink">{user?.name}</p>
              <p className="text-sm text-gray-500">{T(lang, ROLE_LABEL[role] || role)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Role</p>
              <p className="font-semibold text-gray-900">{ROLE_LABEL[role] || role}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">District</p>
              <p className="font-semibold text-gray-900">{user?.district || "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Farms in scope</p>
              <p className="font-semibold text-gray-900">{farms.length}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Data access</p>
              <p className="font-semibold text-gray-900">
                {role === "farmer" ? "Own farms only" : role === "lab" ? "Referred samples only" : role === "admin" ? "Aggregated / de-identified" : "Jurisdiction cases"}
              </p>
            </div>
          </div>
        </Card>

        <section>
          <SectionTitle icon="🔐">Session</SectionTitle>
          <div className="space-y-2">
            <button
              onClick={() => navigate("/")}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800"
            >
              🔄 Switch role / sign out
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}