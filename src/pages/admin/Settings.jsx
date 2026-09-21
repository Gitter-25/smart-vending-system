import {
  Bell,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  Package,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const defaultSettings = {
  machineId: null,
  settingsId: null,

  machineName: "",
  machineLocation: "",

  currency: "PHP",
  lowStockThreshold: 3,

  paymentMethod: "Student ID Card",
  requireActiveCard: true,
  preventNegativeBalance: true,

  lowStockAlerts: true,
  machineOfflineAlerts: true,
  transactionFailureAlerts: true,

  adminName: "",
  adminEmail: "",
};

export default function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [savedSettings, setSavedSettings] =
    useState(defaultSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showSavedMessage, setShowSavedMessage] =
    useState(false);

  const hasChanges = useMemo(
    () =>
      JSON.stringify(settings) !==
      JSON.stringify(savedSettings),
    [settings, savedSettings]
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      /*
       * Get authenticated administrator.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "No authenticated administrator was found."
        );
      }

      /*
       * Load administrator profile.
       */
      const {
        data: adminProfile,
        error: adminError,
      } = await supabase
        .from("admin_profiles")
        .select("id, full_name, role, status")
        .eq("id", user.id)
        .single();

      if (adminError) {
        throw adminError;
      }

      /*
       * Load the vending machine.
       *
       * For the current project we have one machine.
       * Later, this can be changed into multi-machine
       * management if needed.
       */
      const {
        data: machines,
        error: machineError,
      } = await supabase
        .from("machines")
        .select(
          `
            id,
            machine_code,
            name,
            location,
            status
          `
        )
        .order("created_at", {
          ascending: true,
        })
        .limit(1);

      if (machineError) {
        throw machineError;
      }

      const machine = machines?.[0];

      if (!machine) {
        throw new Error(
          "No vending machine record was found."
        );
      }

      /*
       * Load system settings belonging to this machine.
       */
      const {
        data: systemSettings,
        error: settingsError,
      } = await supabase
        .from("system_settings")
        .select(
          `
            id,
            machine_id,
            currency,
            low_stock_threshold,
            require_active_card,
            prevent_negative_balance,
            low_stock_alerts,
            machine_offline_alerts,
            transaction_failure_alerts
          `
        )
        .eq("machine_id", machine.id)
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      const loadedSettings = {
        machineId: machine.id,
        settingsId: systemSettings?.id ?? null,

        machineName: machine.name ?? "",
        machineLocation: machine.location ?? "",

        currency:
          systemSettings?.currency ?? "PHP",

        lowStockThreshold:
          systemSettings?.low_stock_threshold ?? 3,

        paymentMethod: "Student ID Card",

        requireActiveCard:
          systemSettings?.require_active_card ?? true,

        preventNegativeBalance:
          systemSettings?.prevent_negative_balance ??
          true,

        lowStockAlerts:
          systemSettings?.low_stock_alerts ?? true,

        machineOfflineAlerts:
          systemSettings?.machine_offline_alerts ??
          true,

        transactionFailureAlerts:
          systemSettings
            ?.transaction_failure_alerts ?? true,

        adminName:
          adminProfile?.full_name ??
          "Administrator",

        adminEmail: user.email ?? "",
      };

      setSettings(loadedSettings);
      setSavedSettings(loadedSettings);
    } catch (error) {
      console.error(
        "Unable to load settings:",
        error
      );

      setPageError(
        error?.message ||
          "Unable to load system settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (cancelled) {
        return;
      }

      await loadSettings();
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  const updateSetting = (field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));

    setShowSavedMessage(false);
    setSaveError("");
  };

  const handleSave = async () => {
    if (!settings.machineId) {
      setSaveError(
        "The vending machine record could not be identified."
      );
      return;
    }

    const machineName = settings.machineName.trim();
    const machineLocation =
      settings.machineLocation.trim();

    if (!machineName) {
      setSaveError(
        "Machine name cannot be empty."
      );
      return;
    }

    const lowStockThreshold = Number(
      settings.lowStockThreshold
    );

    if (
      !Number.isInteger(lowStockThreshold) ||
      lowStockThreshold < 0 ||
      lowStockThreshold > 100
    ) {
      setSaveError(
        "Low stock threshold must be a whole number from 0 to 100."
      );
      return;
    }

    const adminName = settings.adminName.trim();

    if (!adminName) {
      setSaveError(
        "Administrator name cannot be empty."
      );
      return;
    }

    setSaving(true);
    setSaveError("");
    setShowSavedMessage(false);

    try {
      /*
       * Update machine information.
       */
      const {
        error: machineUpdateError,
      } = await supabase
        .from("machines")
        .update({
          name: machineName,
          location:
            machineLocation || null,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", settings.machineId);

      if (machineUpdateError) {
        throw machineUpdateError;
      }

      /*
       * Save system settings.
       *
       * Upsert allows this to work whether the
       * settings record already exists or not.
       */
      const {
        data: savedSystemSettings,
        error: systemSettingsError,
      } = await supabase
        .from("system_settings")
        .upsert(
          {
            machine_id: settings.machineId,

            currency: settings.currency,

            low_stock_threshold:
              lowStockThreshold,

            require_active_card:
              settings.requireActiveCard,

            prevent_negative_balance:
              settings.preventNegativeBalance,

            low_stock_alerts:
              settings.lowStockAlerts,

            machine_offline_alerts:
              settings.machineOfflineAlerts,

            transaction_failure_alerts:
              settings.transactionFailureAlerts,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "machine_id",
          }
        )
        .select(
          `
            id,
            machine_id,
            currency,
            low_stock_threshold,
            require_active_card,
            prevent_negative_balance,
            low_stock_alerts,
            machine_offline_alerts,
            transaction_failure_alerts
          `
        )
        .single();

      if (systemSettingsError) {
        throw systemSettingsError;
      }

      /*
       * Update administrator display name.
       *
       * Email is intentionally not changed here.
       * Authentication email belongs to Supabase Auth.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Administrator session was lost."
        );
      }

      const {
        error: adminUpdateError,
      } = await supabase
        .from("admin_profiles")
        .update({
          full_name: adminName,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", user.id);

      if (adminUpdateError) {
        throw adminUpdateError;
      }

      const normalizedSettings = {
        ...settings,

        settingsId:
          savedSystemSettings.id,

        machineName,
        machineLocation,

        lowStockThreshold,

        adminName,
      };

      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setShowSavedMessage(true);
    } catch (error) {
      console.error(
        "Unable to save settings:",
        error
      );

      setSaveError(
        error?.message ||
          "Unable to save system settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(savedSettings);
    setShowSavedMessage(false);
    setSaveError("");
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={30}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm text-slate-500">
            Loading system settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Settings
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Configure the vending machine and
            administrative preferences.
          </p>
        </div>

        <div className="flex gap-3">
          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel Changes
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <Save size={17} />
            )}

            {saving
              ? "Saving..."
              : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Page Error */}
      {pageError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">
            {pageError}
          </p>
        </div>
      )}

      {/* Save Error */}
      {saveError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">
            {saveError}
          </p>
        </div>
      )}

      {/* Saved Message */}
      {showSavedMessage && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2
              size={18}
              className="text-green-600"
            />

            <p className="text-sm font-medium text-green-700">
              Settings saved successfully.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {/* General */}
        <SettingsSection
          icon={SettingsIcon}
          title="General Settings"
          description="Basic information about the vending machine."
        >
          <SettingField
            label="Machine Name"
            description="Name displayed throughout the admin system."
          >
            <input
              type="text"
              value={settings.machineName}
              onChange={(event) =>
                updateSetting(
                  "machineName",
                  event.target.value
                )
              }
              disabled={saving}
              className="settings-input"
            />
          </SettingField>

          <SettingField
            label="Machine Location"
            description="Physical location of this vending machine."
          >
            <input
              type="text"
              value={settings.machineLocation}
              onChange={(event) =>
                updateSetting(
                  "machineLocation",
                  event.target.value
                )
              }
              disabled={saving}
              className="settings-input"
            />
          </SettingField>

          <SettingField
            label="Currency"
            description="Currency used for product prices and balances."
          >
            <select
              value={settings.currency}
              onChange={(event) =>
                updateSetting(
                  "currency",
                  event.target.value
                )
              }
              disabled={saving}
              className="settings-input"
            >
              <option value="PHP">
                Philippine Peso (PHP)
              </option>
            </select>
          </SettingField>
        </SettingsSection>

        {/* Inventory */}
        <SettingsSection
          icon={Package}
          title="Inventory Settings"
          description="Configure stock monitoring behavior."
        >
          <SettingField
            label="Low Stock Threshold"
            description="A slot is considered low stock at or below this quantity."
          >
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={settings.lowStockThreshold}
              onChange={(event) =>
                updateSetting(
                  "lowStockThreshold",
                  event.target.value
                )
              }
              disabled={saving}
              className="settings-input"
            />
          </SettingField>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">
              Current rule
            </p>

            <p className="mt-1 text-sm leading-6 text-blue-700">
              Inventory quantities of{" "}
              <strong>
                {settings.lowStockThreshold} or fewer
              </strong>{" "}
              will be considered low stock.
            </p>
          </div>

          <ToggleSetting
            title="Low Stock Alerts"
            description="Enable low-stock alert processing for administrators."
            checked={settings.lowStockAlerts}
            disabled={saving}
            onChange={() =>
              updateSetting(
                "lowStockAlerts",
                !settings.lowStockAlerts
              )
            }
          />
        </SettingsSection>

        {/* Payment */}
        <SettingsSection
          icon={CreditCard}
          title="Payment & Student ID"
          description="Configure student ID card payment rules."
        >
          <SettingField
            label="Payment Method"
            description="Primary cashless payment method."
          >
            <select
              value={settings.paymentMethod}
              disabled
              className="settings-input cursor-not-allowed bg-slate-50"
            >
              <option value="Student ID Card">
                University Student ID Card
              </option>
            </select>
          </SettingField>

          <ToggleSetting
            title="Require Active Card"
            description="Only active student cards can make purchases."
            checked={settings.requireActiveCard}
            disabled={saving}
            onChange={() =>
              updateSetting(
                "requireActiveCard",
                !settings.requireActiveCard
              )
            }
          />

          <ToggleSetting
            title="Prevent Negative Balance"
            description="Reject purchases when the student's balance is insufficient."
            checked={settings.preventNegativeBalance}
            disabled={saving}
            onChange={() =>
              updateSetting(
                "preventNegativeBalance",
                !settings.preventNegativeBalance
              )
            }
          />

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <LockKeyhole
                size={19}
                className="mt-0.5 shrink-0 text-amber-600"
              />

              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Card security
                </p>

                <p className="mt-1 text-sm leading-6 text-amber-700">
                  Student numbers and electronic card
                  UIDs are stored separately. Actual
                  university ID compatibility will be
                  verified with the RFID/NFC hardware
                  during hardware integration.
                </p>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection
          icon={Bell}
          title="System Notifications"
          description="Choose which system conditions should alert administrators."
        >
          <ToggleSetting
            title="Machine Offline"
            description="Enable alerts when the ESP32-S3 stops sending heartbeat messages."
            checked={settings.machineOfflineAlerts}
            disabled={saving}
            onChange={() =>
              updateSetting(
                "machineOfflineAlerts",
                !settings.machineOfflineAlerts
              )
            }
          />

          <ToggleSetting
            title="Transaction Failures"
            description="Enable alerts for failed vending transactions."
            checked={
              settings.transactionFailureAlerts
            }
            disabled={saving}
            onChange={() =>
              updateSetting(
                "transactionFailureAlerts",
                !settings.transactionFailureAlerts
              )
            }
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs leading-5 text-slate-500">
              These preferences are now stored in the
              database. Automated notification delivery
              can be implemented later when the alert
              processing layer is added.
            </p>
          </div>
        </SettingsSection>

        {/* Administrator */}
        <SettingsSection
          icon={User}
          title="Administrator Account"
          description="Administrator profile information."
        >
          <SettingField
            label="Administrator Name"
            description="Name displayed in the admin interface."
          >
            <input
              type="text"
              value={settings.adminName}
              onChange={(event) =>
                updateSetting(
                  "adminName",
                  event.target.value
                )
              }
              disabled={saving}
              className="settings-input"
            />
          </SettingField>

          <SettingField
            label="Email Address"
            description="Authentication email associated with this administrator."
          >
            <input
              type="email"
              value={settings.adminEmail}
              readOnly
              className="settings-input cursor-not-allowed bg-slate-50"
            />
          </SettingField>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">
              Authentication account
            </p>

            <p className="mt-1 text-xs leading-5 text-blue-700">
              Administrator authentication is managed
              by Supabase Auth. Changing the display
              name here does not change the login email.
            </p>
          </div>
        </SettingsSection>

        {/* System Security */}
        <SettingsSection
          icon={ShieldCheck}
          title="System & Security"
          description="Security information for the vending system."
        >
          <SecurityItem
            title="Administrator Authentication"
            status="Protected"
            description="Administrator login is authenticated through Supabase Auth."
          />

          <SecurityItem
            title="Database Access"
            status="Protected"
            description="Database tables are protected using Row Level Security and administrator authorization."
          />

          <SecurityItem
            title="Frontend Credentials"
            status="Protected"
            description="The frontend uses the public Supabase client key while privileged service credentials remain outside the React application."
          />

          <SecurityItem
            title="ESP32-S3 Communication"
            status="Planned"
            description="The physical controller will use authenticated backend communication and will not receive administrator database credentials."
          />

          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="flex gap-3">
              <LockKeyhole
                size={18}
                className="mt-0.5 shrink-0 text-red-600"
              />

              <p className="text-xs leading-5 text-red-700">
                Wi-Fi passwords, private API keys,
                Supabase service-role keys, and device
                credentials must never be placed in
                frontend source code or committed to
                GitHub.
              </p>
            </div>
          </div>
        </SettingsSection>
      </div>

      <style>{`
        .settings-input {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 0.75rem;
          background: white;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: #334155;
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
        }

        .settings-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px #dbeafe;
        }

        .settings-input:disabled,
        .settings-input:read-only {
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-200 px-6 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon size={19} />
        </div>

        <div>
          <h2 className="font-semibold text-slate-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {children}
      </div>
    </section>
  );
}

function SettingField({
  label,
  description,
  children,
}) {
  return (
    <div>
      <div className="mb-2">
        <label className="text-sm font-semibold text-slate-700">
          {label}
        </label>

        <p className="mt-0.5 text-xs text-slate-400">
          {description}
        </p>
      </div>

      {children}
    </div>
  );
}

function ToggleSetting({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-xl border border-slate-200 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-700">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-blue-600" : "bg-slate-300"
        } ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : ""
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function SecurityItem({
  title,
  status,
  description,
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-4 last:border-0">
      <div>
        <p className="text-sm font-semibold text-slate-700">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          {description}
        </p>
      </div>

      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
          status === "Protected"
            ? "bg-green-50 text-green-700"
            : "bg-blue-50 text-blue-700"
        }`}
      >
        {status}
      </span>
    </div>
  );
}