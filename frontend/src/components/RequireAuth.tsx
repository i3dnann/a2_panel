import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts";
import { LoadingScreen } from "./LoadingScreen";

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
