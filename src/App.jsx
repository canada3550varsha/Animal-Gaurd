import { Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import LandingScreen from "./pages/LandingScreen.jsx";
import HomeScreen from "./pages/HomeScreen.jsx";
import RegisterFarmScreen from "./pages/RegisterFarmScreen.jsx";
import FarmDetailScreen from "./pages/FarmDetailScreen.jsx";
import ReportSymptomsScreen from "./pages/ReportSymptomsScreen.jsx";
import VoiceReportScreen from "./pages/VoiceReportScreen.jsx";
import AdminScreen from "./pages/AdminScreen.jsx";
import ArchitectureScreen from "./pages/ArchitectureScreen.jsx";
import WalkthroughScreen from "./pages/WalkthroughScreen.jsx";
import VetDashboardScreen from "./pages/officer/VetDashboardScreen.jsx";
import OfficerCasesScreen from "./pages/officer/OfficerCasesScreen.jsx";
import OfficerMapScreen from "./pages/officer/OfficerMapScreen.jsx";
import OfficerFarmsScreen from "./pages/officer/OfficerFarmsScreen.jsx";
import OfficerSamplesScreen from "./pages/officer/OfficerSamplesScreen.jsx";
import OfficerHealthScreen from "./pages/officer/OfficerHealthScreen.jsx";
import OfficerEscalationsScreen from "./pages/officer/OfficerEscalationsScreen.jsx";
import OfficerImpactScreen from "./pages/officer/OfficerImpactScreen.jsx";
import AdminSurveillanceScreen from "./pages/admin/AdminSurveillanceScreen.jsx";
import CriticalCaseAccessScreen from "./pages/admin/CriticalCaseAccessScreen.jsx";
import LabDashboardScreen from "./pages/lab/LabDashboardScreen.jsx";
import LabSamplesScreen from "./pages/lab/LabSamplesScreen.jsx";
import MyReportsScreen from "./pages/MyReportsScreen.jsx";
import HealthRecordsScreen from "./pages/HealthRecordsScreen.jsx";
import MyAlertsScreen from "./pages/MyAlertsScreen.jsx";
import MyLabResultsScreen from "./pages/MyLabResultsScreen.jsx";
import ProfileScreen from "./pages/ProfileScreen.jsx";

export default function App() {
  const { user, authLoaded } = useApp();

  if (!authLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center text-gray-400">
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  const vetOnly = user?.role === "vet";
  const adminOnly = user?.role === "admin";
  const labOnly = user?.role === "lab";
  const farmerOnly = user?.role === "farmer";

  return (
    <div className="min-h-screen bg-surface">
      <Routes>
        <Route path="/" element={<LandingScreen />} />

        {/* Farmer */}
        <Route path="/owner" element={farmerOnly ? <HomeScreen /> : <Navigate to="/" />} />
        <Route path="/my-reports" element={farmerOnly ? <MyReportsScreen /> : <Navigate to="/" />} />
        <Route path="/health-records" element={farmerOnly ? <HealthRecordsScreen /> : <Navigate to="/" />} />
        <Route path="/my-alerts" element={farmerOnly ? <MyAlertsScreen /> : <Navigate to="/" />} />
        <Route path="/my-lab" element={farmerOnly ? <MyLabResultsScreen /> : <Navigate to="/" />} />
        <Route path="/profile" element={user ? <ProfileScreen /> : <Navigate to="/" />} />
        <Route path="/register-farm" element={user ? <RegisterFarmScreen /> : <Navigate to="/" />} />
        <Route path="/farm/:farmId" element={user ? <FarmDetailScreen /> : <Navigate to="/" />} />
        <Route path="/farm/:farmId/report" element={user ? <ReportSymptomsScreen /> : <Navigate to="/" />} />
        <Route path="/farm/:farmId/voice" element={user ? <VoiceReportScreen /> : <Navigate to="/" />} />
        <Route path="/voice-report" element={user ? <VoiceReportScreen /> : <Navigate to="/" />} />

        {/* Vet */}
        <Route path="/vet" element={vetOnly ? <VetDashboardScreen /> : <Navigate to="/" />} />
        <Route path="/vet/cases" element={vetOnly ? <OfficerCasesScreen /> : <Navigate to="/" />} />
        <Route path="/vet/map" element={vetOnly ? <OfficerMapScreen /> : <Navigate to="/" />} />
        <Route path="/vet/farms" element={vetOnly ? <OfficerFarmsScreen /> : <Navigate to="/" />} />
        <Route path="/vet/samples" element={vetOnly ? <OfficerSamplesScreen /> : <Navigate to="/" />} />
        <Route path="/vet/health" element={vetOnly ? <OfficerHealthScreen /> : <Navigate to="/" />} />
        <Route path="/vet/escalations" element={vetOnly ? <OfficerEscalationsScreen /> : <Navigate to="/" />} />
        <Route path="/vet/impact" element={vetOnly ? <OfficerImpactScreen /> : <Navigate to="/" />} />

        {/* Admin */}
        <Route path="/admin" element={adminOnly ? <AdminSurveillanceScreen /> : <Navigate to="/" />} />
        <Route path="/admin/escalations" element={adminOnly ? <OfficerEscalationsScreen /> : <Navigate to="/" />} />
        <Route path="/admin/audit" element={adminOnly ? <AdminScreen /> : <Navigate to="/" />} />
        <Route path="/admin/critical" element={adminOnly ? <CriticalCaseAccessScreen /> : <Navigate to="/" />} />

        {/* Lab */}
        <Route path="/lab" element={labOnly ? <LabDashboardScreen /> : <Navigate to="/" />} />
        <Route path="/lab/inbox" element={labOnly ? <LabSamplesScreen mode="inbox" title="Laboratory Inbox" subtitle="Referred samples awaiting result" /> : <Navigate to="/" />} />
        <Route path="/lab/results" element={labOnly ? <LabSamplesScreen mode="results" title="Completed Results" subtitle="Results returned to farm records" /> : <Navigate to="/" />} />
        <Route path="/lab/history" element={labOnly ? <LabSamplesScreen mode="history" title="Sample History" subtitle="Full referred-sample record" /> : <Navigate to="/" />} />

        {/* Legacy combined dashboard — now role-split */}
        <Route
          path="/dashboard"
          element={
            user?.role === "vet" ? <Navigate to="/vet" /> : user?.role === "admin" ? <Navigate to="/admin" /> : <Navigate to="/" />
          }
        />

        {/* Demo / info */}
        <Route path="/architecture" element={<ArchitectureScreen />} />
        <Route path="/walkthrough" element={<WalkthroughScreen />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}