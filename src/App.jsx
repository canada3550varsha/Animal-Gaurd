import { Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import LandingScreen from "./pages/LandingScreen.jsx";
import HomeScreen from "./pages/HomeScreen.jsx";
import RegisterFarmScreen from "./pages/RegisterFarmScreen.jsx";
import FarmDetailScreen from "./pages/FarmDetailScreen.jsx";
import ReportSymptomsScreen from "./pages/ReportSymptomsScreen.jsx";
import VoiceReportScreen from "./pages/VoiceReportScreen.jsx";
import DashboardScreen from "./pages/DashboardScreen.jsx";
import AdminScreen from "./pages/AdminScreen.jsx";
import LabScreen from "./pages/LabScreen.jsx";
import ArchitectureScreen from "./pages/ArchitectureScreen.jsx";
import WalkthroughScreen from "./pages/WalkthroughScreen.jsx";

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

  const isOfficer = user && (user.role === "vet" || user.role === "admin");

  return (
    <div className="min-h-screen bg-surface">
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/owner" element={user ? <HomeScreen /> : <Navigate to="/" />} />
        <Route path="/dashboard" element={isOfficer ? <DashboardScreen /> : <Navigate to="/" />} />
        <Route path="/vet" element={isOfficer ? <DashboardScreen /> : <Navigate to="/" />} />
        <Route path="/admin" element={user?.role === "admin" ? <AdminScreen /> : <Navigate to="/" />} />
        <Route path="/lab" element={user?.role === "lab" ? <LabScreen /> : <Navigate to="/" />} />
        <Route path="/architecture" element={<ArchitectureScreen />} />
        <Route path="/walkthrough" element={<WalkthroughScreen />} />
        <Route path="/register-farm" element={user ? <RegisterFarmScreen /> : <Navigate to="/" />} />
        <Route path="/farm/:farmId" element={user ? <FarmDetailScreen /> : <Navigate to="/" />} />
        <Route path="/farm/:farmId/report" element={user ? <ReportSymptomsScreen /> : <Navigate to="/" />} />
        <Route path="/farm/:farmId/voice" element={user ? <VoiceReportScreen /> : <Navigate to="/" />} />
        <Route path="/voice-report" element={user ? <VoiceReportScreen /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}
