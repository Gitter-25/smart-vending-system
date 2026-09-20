import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShoppingBag,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
  event.preventDefault();
  setError("");

  const cleanEmail = email.trim();

  if (!cleanEmail || !password) {
    setError("Please enter your email and password.");
    return;
  }

  try {
    setLoading(true);

    // Step 1: Authenticate with Supabase
    const {
      data: authData,
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (signInError || !authData.user) {
      setError("Invalid email or password.");
      return;
    }

    // Step 2: Verify that the user is an active administrator
    const {
      data: adminProfile,
      error: adminError,
    } = await supabase
      .from("admin_profiles")
      .select("id, role, status")
      .eq("id", authData.user.id)
      .eq("role", "admin")
      .eq("status", "active")
      .maybeSingle();

    // Step 3: Reject authenticated users without admin access
    if (adminError || !adminProfile) {
      await supabase.auth.signOut();

      setError(
        "Administrator access is required."
      );

      return;
    }

    // Step 4: Authorized administrator
    navigate("/dashboard", {
      replace: true,
    });
  } catch (error) {
    console.error("Login error:", error);

    // Avoid leaving a partial session behind
    await supabase.auth.signOut();

    setError(
      "Unable to sign in right now. Please try again."
    );
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left branding panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
            <ShoppingBag size={22} />
          </div>

          <div>
            <p className="text-xl font-bold">
              SmartVend
            </p>

            <p className="text-sm text-slate-400">
              Smart Vending Management System
            </p>
          </div>
        </div>

        <div className="max-w-lg">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            IoT-Based Vending
          </p>

          <h1 className="text-5xl font-bold leading-tight">
            Manage your vending machine from one place.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-400">
            Monitor products, inventory, student ID
            transactions, sales, and machine activity
            through a centralized administration
            dashboard.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          Smart Vending Machine Administration
        </p>
      </div>

      {/* Login section */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ShoppingBag size={20} />
            </div>

            <p className="text-xl font-bold text-slate-900">
              SmartVend
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Admin Login
            </h2>

            <p className="mt-2 text-slate-500">
              Sign in to access the vending machine
              dashboard.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email address
              </label>

              <div className="relative">
                <Mail
                  size={19}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="admin@example.com"
                  autoComplete="email"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={19}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-12 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(
                    event.target.checked
                  )
                }
                disabled={loading}
                className="h-4 w-4 rounded border-slate-300 accent-blue-600"
              />

              Remember me
            </label>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {loading && (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              )}

              {loading
                ? "Signing in..."
                : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            Authorized administrators only.
          </p>
        </div>
      </div>
    </div>
  );
}