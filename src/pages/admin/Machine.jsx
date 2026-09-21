import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Cpu,
  Database,
  Gauge,
  Package,
  Radio,
  RefreshCw,
  Router,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Machine() {
  const [machine, setMachine] = useState(null);
  const [slots, setSlots] = useState([]);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");

  /*
   * Hardware is not connected yet.
   *
   * Later, the ESP32-S3 will update:
   * - machines.status
   * - machines.last_heartbeat
   * - vending_slots.status
   * - machine_events
   *
   * The admin frontend should only display that data.
   */

  const loadMachineData = useCallback(async () => {
    setPageError("");

    try {
      /*
       * Load the first configured vending machine.
       *
       * We use maybeSingle() so the page still works
       * even when no machine has been created yet.
       */
      const { data: machineData, error: machineError } =
        await supabase
          .from("machines")
          .select(
            `
              id,
              machine_code,
              name,
              location,
              status,
              last_heartbeat,
              created_at,
              updated_at
            `
          )
          .order("created_at", {
            ascending: true,
          })
          .limit(1)
          .maybeSingle();

      if (machineError) {
        throw machineError;
      }

      if (!machineData) {
        setMachine(null);
        setSlots([]);
        setEvents([]);
        return;
      }

      /*
       * Load vending slots belonging to this machine.
       *
       * Product information is loaded through the
       * product_id foreign-key relationship.
       */
      const { data: slotData, error: slotError } =
        await supabase
          .from("vending_slots")
          .select(
            `
              id,
              slot_code,
              motor_number,
              quantity,
              capacity,
              status,
              product_id,
              products (
                id,
                name,
                category,
                price,
                status
              )
            `
          )
          .eq("machine_id", machineData.id)
          .order("motor_number", {
            ascending: true,
          });

      if (slotError) {
        throw slotError;
      }

      /*
       * Load the most recent machine events.
       */
      const { data: eventData, error: eventError } =
        await supabase
          .from("machine_events")
          .select(
            `
              id,
              event_type,
              severity,
              message,
              slot_id,
              created_at
            `
          )
          .eq("machine_id", machineData.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(10);

      if (eventError) {
        throw eventError;
      }

      setMachine(machineData);
      setSlots(slotData ?? []);
      setEvents(eventData ?? []);
    } catch (error) {
      console.error("Unable to load machine data:", error);

      setPageError(
        error?.message ||
          "Unable to load vending machine information."
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializeMachinePage() {
      setLoading(true);

      await loadMachineData();

      if (!cancelled) {
        setLoading(false);
      }
    }

    initializeMachinePage();

    return () => {
      cancelled = true;
    };
  }, [loadMachineData]);

  const handleRefreshStatus = async () => {
    setRefreshing(true);

    await loadMachineData();

    setRefreshing(false);
  };

  /*
   * Determine whether the machine should be considered
   * connected.
   *
   * For now this is based on the database status.
   * Later we can also enforce a heartbeat timeout.
   */
  const machineOnline =
    machine?.status?.toLowerCase() === "online";

  const readySlots = useMemo(
    () =>
      slots.filter(
        (slot) =>
          slot.status?.toLowerCase() === "ready"
      ).length,
    [slots]
  );

  const errorSlots = useMemo(
    () =>
      slots.filter(
        (slot) =>
          slot.status?.toLowerCase() === "error"
      ).length,
    [slots]
  );

  const disabledSlots = useMemo(
    () =>
      slots.filter(
        (slot) =>
          slot.status?.toLowerCase() === "disabled"
      ).length,
    [slots]
  );

  const assignedSlots = useMemo(
    () =>
      slots.filter((slot) => slot.product_id).length,
    [slots]
  );

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <RefreshCw
            size={30}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm font-medium text-slate-600">
            Loading machine information...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Machine Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor the vending machine, dispensing slots,
            inventory, and hardware events.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshStatus}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={17}
            className={
              refreshing ? "animate-spin" : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh Status"}
        </button>
      </div>

      {/* Error */}
      {pageError && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <XCircle
            size={20}
            className="mt-0.5 shrink-0 text-red-600"
          />

          <div>
            <p className="text-sm font-semibold text-red-800">
              Unable to load machine information
            </p>

            <p className="mt-1 text-sm text-red-700">
              {pageError}
            </p>
          </div>
        </div>
      )}

      {!machine ? (
        <NoMachineState />
      ) : (
        <>
          {/* Machine Status Banner */}
          <div
            className={`mt-8 rounded-2xl border p-5 ${
              machineOnline
                ? "border-green-200 bg-green-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    machineOnline
                      ? "bg-green-100 text-green-600"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {machineOnline ? (
                    <Wifi size={23} />
                  ) : (
                    <WifiOff size={23} />
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">
                      {machine.name}
                    </h2>

                    <MachineStatusBadge
                      status={machine.status}
                    />
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {machineOnline
                      ? "The machine is reporting an online status."
                      : "Physical ESP32-S3 hardware is not connected yet."}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Machine Code
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {machine.machine_code}
                </p>
              </div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard
              title="ESP32-S3 Controller"
              value={
                machineOnline
                  ? "Connected"
                  : "Not Connected"
              }
              description="Physical controller status"
              icon={Cpu}
              status={
                machineOnline ? "success" : "neutral"
              }
            />

            <StatusCard
              title="Configured Slots"
              value={slots.length}
              description={`${assignedSlots} assigned to products`}
              icon={Package}
              status="success"
            />

            <StatusCard
              title="Ready Slots"
              value={`${readySlots}/${slots.length}`}
              description="Slots marked ready"
              icon={CheckCircle2}
              status="success"
            />

            <StatusCard
              title="Slot Errors"
              value={errorSlots}
              description={
                disabledSlots > 0
                  ? `${disabledSlots} disabled slot${
                      disabledSlots === 1 ? "" : "s"
                    }`
                  : "No disabled slots"
              }
              icon={Activity}
              status={
                errorSlots > 0 ? "error" : "success"
              }
            />
          </div>

          {/* Main Information */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.6fr]">
            {/* Controller Information */}
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="font-semibold text-slate-900">
                  Machine Information
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Database and future hardware information
                </p>
              </div>

              <div className="divide-y divide-slate-100 px-6">
                <InfoRow
                  icon={Cpu}
                  label="Controller"
                  value="ESP32-S3"
                />

                <InfoRow
                  icon={Gauge}
                  label="Firmware"
                  value="Not configured"
                />

                <InfoRow
                  icon={Router}
                  label="Connection"
                  value="Not connected"
                />

                <InfoRow
                  icon={Radio}
                  label="RFID / NFC Reader"
                  value="Not connected"
                />

                <InfoRow
                  icon={Database}
                  label="Database"
                  value="Supabase connected"
                />

                <InfoRow
                  icon={Activity}
                  label="Last Heartbeat"
                  value={formatHeartbeat(
                    machine.last_heartbeat
                  )}
                />

                <InfoRow
                  icon={Package}
                  label="Location"
                  value={
                    machine.location ||
                    "Not specified"
                  }
                />
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
                <p className="text-xs leading-5 text-slate-500">
                  The web application and database are
                  operational. ESP32-S3, RFID/NFC reader,
                  motors, sensors, and other physical
                  hardware will be connected during the
                  hardware integration phase.
                </p>
              </div>
            </div>

            {/* Slots */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="font-semibold text-slate-900">
                  Dispensing Slots
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Database-backed slot and motor
                  configuration
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">
                        Slot
                      </th>

                      <th className="px-6 py-3 font-medium">
                        Product
                      </th>

                      <th className="px-6 py-3 font-medium">
                        Motor
                      </th>

                      <th className="px-6 py-3 font-medium">
                        Stock
                      </th>

                      <th className="px-6 py-3 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {slots.map((slot) => (
                      <tr
                        key={slot.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-6 py-4">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-700">
                            {slot.slot_code}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {slot.products ? (
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {
                                  slot.products
                                    .name
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {
                                  slot.products
                                    .category
                                }
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">
                              No product assigned
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-600">
                            Motor{" "}
                            {slot.motor_number}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {slot.quantity}/
                              {slot.capacity}
                            </p>

                            <StockBar
                              quantity={
                                slot.quantity
                              }
                              capacity={
                                slot.capacity
                              }
                            />
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <SlotStatus
                            status={slot.status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {slots.length === 0 && (
                  <div className="px-6 py-14 text-center">
                    <Package
                      size={34}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 font-medium text-slate-700">
                      No vending slots configured
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Configure slots in the inventory
                      system first.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hardware Integration Notice */}
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <Cpu
                size={21}
                className="mt-0.5 shrink-0 text-blue-600"
              />

              <div>
                <p className="font-semibold text-blue-900">
                  Hardware Integration Pending
                </p>

                <p className="mt-1 max-w-4xl text-sm leading-6 text-blue-700">
                  The database configuration is ready for
                  the vending machine. During the hardware
                  phase, the ESP32-S3 will report
                  heartbeats, machine state, slot errors,
                  RFID/NFC activity, and dispensing events.
                  The final firmware technology will be
                  selected based on the hardware and
                  reliability requirements.
                </p>
              </div>
            </div>
          </div>

          {/* Machine Events */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="font-semibold text-slate-900">
                Recent Machine Events
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Latest events recorded by the vending
                machine system
              </p>
            </div>

            {events.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col justify-between gap-3 px-6 py-4 sm:flex-row sm:items-start"
                  >
                    <div className="flex items-start gap-3">
                      <EventIcon
                        severity={event.severity}
                      />

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatEventType(
                              event.event_type
                            )}
                          </p>

                          <EventSeverityBadge
                            severity={
                              event.severity
                            }
                          />
                        </div>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {event.message}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDateTime(
                        event.created_at
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-14 text-center">
                <Activity
                  size={34}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-3 font-medium text-slate-700">
                  No machine events recorded
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Hardware events will appear here after
                  integration.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NoMachineState() {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
      <Cpu
        size={42}
        className="mx-auto text-slate-300"
      />

      <h2 className="mt-4 text-lg font-semibold text-slate-800">
        No vending machine configured
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Create a machine record in Supabase before
        connecting the ESP32-S3 and vending hardware.
      </p>
    </div>
  );
}

function StatusCard({
  title,
  value,
  description,
  icon: Icon,
  status,
}) {
  const styles = {
    success: "bg-green-50 text-green-600",
    error: "bg-red-50 text-red-600",
    warning: "bg-amber-50 text-amber-600",
    neutral: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            styles[status] ?? styles.neutral
          }`}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon size={17} />
        </div>

        <span className="text-sm text-slate-500">
          {label}
        </span>
      </div>

      <span className="max-w-[55%] text-right text-sm font-semibold text-slate-800">
        {value}
      </span>
    </div>
  );
}

function MachineStatusBadge({ status }) {
  const normalizedStatus =
    status?.toLowerCase() ?? "offline";

  const config = {
    online: {
      label: "Online",
      className:
        "bg-green-100 text-green-700",
    },

    offline: {
      label: "Offline",
      className:
        "bg-slate-200 text-slate-600",
    },

    maintenance: {
      label: "Maintenance",
      className:
        "bg-amber-100 text-amber-700",
    },
  };

  const current =
    config[normalizedStatus] ?? config.offline;

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${current.className}`}
    >
      {current.label}
    </span>
  );
}

function SlotStatus({ status }) {
  const normalizedStatus =
    status?.toLowerCase() ?? "disabled";

  const config = {
    ready: {
      label: "Ready",
      className:
        "bg-green-50 text-green-700",
    },

    error: {
      label: "Error",
      className:
        "bg-red-50 text-red-700",
    },

    disabled: {
      label: "Disabled",
      className:
        "bg-slate-100 text-slate-600",
    },
  };

  const current =
    config[normalizedStatus] ?? config.disabled;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${current.className}`}
    >
      <CircleDot size={12} />
      {current.label}
    </span>
  );
}

function StockBar({ quantity, capacity }) {
  const safeCapacity =
    Number(capacity) > 0 ? Number(capacity) : 1;

  const safeQuantity = Math.max(
    0,
    Number(quantity) || 0
  );

  const percentage = Math.min(
    100,
    (safeQuantity / safeCapacity) * 100
  );

  let barClass = "bg-green-500";

  if (safeQuantity === 0) {
    barClass = "bg-red-500";
  } else if (percentage <= 30) {
    barClass = "bg-amber-500";
  }

  return (
    <div className="mt-2 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${barClass}`}
        style={{
          width: `${percentage}%`,
        }}
      />
    </div>
  );
}

function EventIcon({ severity }) {
  const normalizedSeverity =
    severity?.toLowerCase() ?? "info";

  if (normalizedSeverity === "error") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
        <XCircle size={17} />
      </div>
    );
  }

  if (normalizedSeverity === "warning") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
        <AlertTriangle size={17} />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
      <Activity size={17} />
    </div>
  );
}

function EventSeverityBadge({ severity }) {
  const normalizedSeverity =
    severity?.toLowerCase() ?? "info";

  const config = {
    info: {
      label: "Info",
      className:
        "bg-blue-50 text-blue-700",
    },

    warning: {
      label: "Warning",
      className:
        "bg-amber-50 text-amber-700",
    },

    error: {
      label: "Error",
      className:
        "bg-red-50 text-red-700",
    },
  };

  const current =
    config[normalizedSeverity] ?? config.info;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${current.className}`}
    >
      {current.label}
    </span>
  );
}

function formatHeartbeat(value) {
  if (!value) {
    return "No heartbeat yet";
  }

  return formatDateTime(value);
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEventType(value) {
  if (!value) {
    return "Machine Event";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}