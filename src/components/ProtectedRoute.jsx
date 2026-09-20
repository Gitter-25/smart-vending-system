import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ProtectedRoute() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuthorization = async (currentSession) => {
      if (!currentSession) {
        if (mounted) {
          setSession(null);
          setIsAdmin(false);
          setLoading(false);
        }

        return;
      }

      const { data, error } = await supabase
        .from("admin_profiles")
        .select("id")
        .eq("id", currentSession.user.id)
        .eq("role", "admin")
        .eq("status", "active")
        .maybeSingle();

      if (!mounted) {
        return;
      }

      if (error) {
        console.error(
          "Unable to verify administrator:",
          error.message
        );

        setSession(currentSession);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setSession(currentSession);
      setIsAdmin(Boolean(data));
      setLoading(false);
    };

    const loadSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      await checkAuthorization(currentSession);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        checkAuthorization(currentSession);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm text-slate-500">
            Verifying administrator access...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}