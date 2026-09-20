import {
  Bell,
  CreditCard,
  LockKeyhole,
  Package,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
} from "lucide-react";
import { useState } from "react";

const initialSettings = {
  machineName: "SmartVend Machine 01",
  machineLocation: "University Campus",
  currency: "PHP",
  lowStockThreshold: 3,
  paymentMethod: "Student ID Card",
  requireActiveCard: true,
  preventNegativeBalance: true,
  lowStockAlerts: true,
  machineOfflineAlerts: true,
  transactionFailureAlerts: true,
  adminName: "Administrator",
  adminEmail: "admin@smartvend.local",
};

export default function Settings() {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] =
    useState(initialSettings);
  const [showSavedMessage, setShowSavedMessage] =
    useState(false);

  const hasChanges =
    JSON.stringify(settings) !==
    JSON.stringify(savedSettings);

  const updateSetting = (field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));

    setShowSavedMessage(false);
  };

  const handleSave = () => {
    setSavedSettings(settings);
    setShowSavedMessage(true);
  };

  const handleReset = () => {
    setSettings(savedSettings);
    setShowSavedMessage(false);
  };

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
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel Changes
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Save size={17} />
            Save Settings
          </button>
        </div>
      </div>

      {/* Saved Message */}
      {showSavedMessage && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck
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
              min="1"
              max="100"
              step="1"
              value={settings.lowStockThreshold}
              onChange={(event) =>
                updateSetting(
                  "lowStockThreshold",
                  Number(event.target.value)
                )
              }
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
              will be marked as low stock.
            </p>
          </div>

          <ToggleSetting
            title="Low Stock Alerts"
            description="Notify administrators when inventory reaches the low-stock threshold."
            checked={settings.lowStockAlerts}
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
              onChange={(event) =>
                updateSetting(
                  "paymentMethod",
                  event.target.value
                )
              }
              className="settings-input"
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
                  UIDs will remain separate records.
                  Actual university ID compatibility
                  will be verified with the RFID/NFC
                  hardware later.
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
            description="Alert when the ESP32 stops sending heartbeat messages."
            checked={settings.machineOfflineAlerts}
            onChange={() =>
              updateSetting(
                "machineOfflineAlerts",
                !settings.machineOfflineAlerts
              )
            }
          />

          <ToggleSetting
            title="Transaction Failures"
            description="Alert administrators about failed vending transactions."
            checked={
              settings.transactionFailureAlerts
            }
            onChange={() =>
              updateSetting(
                "transactionFailureAlerts",
                !settings.transactionFailureAlerts
              )
            }
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs leading-5 text-slate-500">
              Notifications are currently interface
              settings only. Backend alert processing
              will be added during database and ESP32
              integration.
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
              className="settings-input"
            />
          </SettingField>

          <SettingField
            label="Email Address"
            description="Email associated with the administrator account."
          >
            <input
              type="email"
              value={settings.adminEmail}
              onChange={(event) =>
                updateSetting(
                  "adminEmail",
                  event.target.value
                )
              }
              className="settings-input"
            />
          </SettingField>

          <button
            type="button"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Change Password
          </button>

          <p className="text-xs leading-5 text-slate-400">
            Password management will be connected to
            the authentication system later.
          </p>
        </SettingsSection>

        {/* System Security */}
        <SettingsSection
          icon={ShieldCheck}
          title="System & Security"
          description="Security information for the vending system."
        >
          <SecurityItem
            title="Frontend Credentials"
            status="Protected"
            description="Sensitive credentials will not be stored directly in React source code."
          />

          <SecurityItem
            title="ESP32 Communication"
            status="Planned"
            description="The MicroPython controller will communicate through authenticated backend requests."
          />

          <SecurityItem
            title="Database Security"
            status="Planned"
            description="Database permissions and access policies will be configured during backend integration."
          />

          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="flex gap-3">
              <LockKeyhole
                size={18}
                className="mt-0.5 shrink-0 text-red-600"
              />

              <p className="text-xs leading-5 text-red-700">
                Wi-Fi passwords, private API keys,
                database service keys, and device
                credentials must never be placed in
                frontend source code or committed to
                GitHub.
              </p>
            </div>
          </div>
        </SettingsSection>
      </div>

      {/* Local CSS for repeated input styling */}
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
        onClick={onChange}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-blue-600" : "bg-slate-300"
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