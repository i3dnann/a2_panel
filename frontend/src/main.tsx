import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { AuthProvider, ToastProvider, useAuth } from "./contexts";
import { Layout } from "./components/Layout";
import { LoadingScreen } from "./components/LoadingScreen";
import { RequireAuth } from "./components/RequireAuth";
import { ToastViewport } from "./components/ui";
import { DashboardPage } from "./pages/Dashboard";
import { Base44PreviewPage } from "./pages/Base44Preview";
import { LoginPage } from "./pages/Login";
import {
  InventoryPage,
  JobsGangsPage,
  LivePlayersPage,
  MoneyPage,
  PlayerProfilePage,
  PlayerSearchPage
} from "./pages/Players";
import {
  AnnouncementsPage,
  BansPage,
  DiscordPage,
  LiveViewPage,
  LogsPage,
  NotFoundPage,
  ReportsPage,
  SettingsPage,
  StaffPage,
  UnauthorizedPage,
  VehiclesPage,
  WarningsPage
} from "./pages/Management";

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/base44-preview" element={<Base44PreviewPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="players/live" element={<LivePlayersPage />} />
                <Route path="players/search" element={<PlayerSearchPage />} />
                <Route path="players/:id" element={<PlayerProfilePage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="bans" element={<BansPage />} />
                <Route path="warnings" element={<WarningsPage />} />
                <Route path="vehicles" element={<VehiclesPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="money" element={<MoneyPage />} />
                <Route path="jobs-gangs" element={<JobsGangsPage />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="discord" element={<DiscordPage />} />
                <Route path="live-view" element={<LiveViewPage />} />
                <Route path="logs" element={<LogsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
                <Route path="unauthorized" element={<UnauthorizedPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <ToastViewport />
      </AuthProvider>
    </ToastProvider>
  </StrictMode>
);
