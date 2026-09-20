import { useRef, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleDot,
  Cpu,
  Gauge,
  Radio,
  RefreshCw,
  Router,
  TestTube2,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

const initialSlots = [
  {
    id: "A1",
    product: "Bottled Water",
    motor: "Motor 1",
    status: "Ready",
  },
  {
    id: "A2",
    product: "Iced Tea",
    motor: "Motor 2",
    status: "Ready",
  },
  {
    id: "A3",
    product: "Chocolate Bar",
    motor: "Motor 3",
    status: "Error",
  },
  {
    id: "A4",
    product: "Potato Chips",
    motor: "Motor 4",
    status: "Ready",
  },
  {
    id: "B1",
    product: "Biscuits",
    motor: "Motor 5",
    status: "Ready",
  },
  {
    id: "B2",
    product: "Orange Juice",
    motor: "Motor 6",
    status: "Ready",
  },
];

const initialEvents = [
  {
    id: 1,
    type: "success",
    title: "Machine heartbeat received",
    description: "ESP32 controller responded successfully.",
    time: "10:38 PM",
  },
  {
    id: 2,
    type: "success",
    title: "RFID/NFC reader ready",
    description: "Student ID card reader is available.",
    time: "10:37 PM",
  },
  {
    id: 3,
    type: "error",
    title: "Slot A3 motor error",
    description: "Motor 3 did not respond during diagnostics.",
    time: "10:32 PM",
  },
  {
    id: 4,
    type: "success",
    title: "Controller connected",
    description: "ESP32 established a connection to the system.",
    time: "10:30 PM",
  },
];

export default function Machine() {
  const [machineOnline, setMachineOnline] = useState(true);
  const [readerOnline] = useState(true);
  const [slots, setSlots] = useState(initialSlots);
  const [events, setEvents] = useState(initialEvents);
  const nextEventId = useRef(100);


  const [testingSlot, setTestingSlot] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const readySlots = slots.filter(
    (slot) => slot.status === "Ready"
  ).length;

  const errorSlots = slots.filter(
    (slot) => slot.status === "Error"
  ).length;

  const addEvent = (event) => {
  const id = nextEventId.current;
  nextEventId.current += 1;

  const newEvent = {
    ...event,
    id,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  setEvents((current) => [newEvent, ...current].slice(0, 8));
};

  const handleRefreshStatus = () => {
    addEvent({
      type: "success",
      title: "Machine status refreshed",
      description:
        "Latest simulated controller status was requested.",
    });
  };

  const handleConnectionToggle = () => {
    const nextStatus = !machineOnline;

    setMachineOnline(nextStatus);

    addEvent({
      type: nextStatus ? "success" : "warning",
      title: nextStatus
        ? "Controller connected"
        : "Controller disconnected",
      description: nextStatus
        ? "ESP32 simulated connection has been restored."
        : "ESP32 simulated connection has been disabled.",
    });
  };

  const handleTestSlot = (slot) => {
    if (!machineOnline) {
      addEvent({
        type: "error",
        title: `${slot.id} test failed`,
        description:
          "Cannot test the slot while the ESP32 controller is offline.",
      });

      return;
    }

    setTestingSlot(slot.id);

    setTimeout(() => {
      setTestingSlot(null);

      addEvent({
        type:
          slot.status === "Ready" ? "success" : "error",
        title: `${slot.id} diagnostic completed`,
        description:
          slot.status === "Ready"
            ? `${slot.motor} responded successfully.`
            : `${slot.motor} reported a simulated hardware error.`,
      });
    }, 900);
  };

  const resetSlotError = (slotId) => {
    setSlots((currentSlots) =>
      currentSlots.map((slot) =>
        slot.id === slotId
          ? { ...slot, status: "Ready" }
          : slot
      )
    );

    addEvent({
      type: "success",
      title: `${slotId} status reset`,
      description:
        "The simulated motor error has been cleared.",
    });

    setSelectedSlot(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Machine Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor the vending machine controller,
            card reader, and dispensing slots.
          </p>
        </div>

        <button
          onClick={handleRefreshStatus}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw size={17} />
          Refresh Status
        </button>
      </div>

      {/* Machine Status Banner */}
      <div
        className={`mt-8 rounded-2xl border p-5 ${
          machineOnline
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                machineOnline
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {machineOnline ? (
                <Wifi size={23} />
              ) : (
                <WifiOff size={23} />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">
                  SmartVend Machine 01
                </h2>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    machineOnline
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {machineOnline ? "Online" : "Offline"}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {machineOnline
                  ? "Controller is connected and responding."
                  : "Controller is currently disconnected."}
              </p>
            </div>
          </div>

          {/* Temporary Simulation */}
          <button
            onClick={handleConnectionToggle}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {machineOnline
              ? "Simulate Offline"
              : "Simulate Online"}
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="ESP32 Controller"
          value={machineOnline ? "Online" : "Offline"}
          description="MicroPython controller"
          icon={Cpu}
          status={machineOnline ? "success" : "error"}
        />

        <StatusCard
          title="RFID / NFC Reader"
          value={readerOnline ? "Ready" : "Offline"}
          description="Student ID reader"
          icon={Radio}
          status={readerOnline ? "success" : "error"}
        />

        <StatusCard
          title="Ready Slots"
          value={`${readySlots}/${slots.length}`}
          description="Dispensing motors ready"
          icon={CheckCircle2}
          status="success"
        />

        <StatusCard
          title="Hardware Errors"
          value={errorSlots}
          description="Slots requiring attention"
          icon={Activity}
          status={errorSlots > 0 ? "error" : "success"}
        />
      </div>

      {/* Device Information */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              Controller Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              ESP32 device and network information
            </p>
          </div>

          <div className="divide-y divide-slate-100 px-6">
            <InfoRow
              icon={Cpu}
              label="Controller"
              value="ESP32"
            />

            <InfoRow
              icon={Gauge}
              label="Firmware"
              value="MicroPython"
            />

            <InfoRow
              icon={Router}
              label="Connection"
              value="Wi-Fi"
            />

            <InfoRow
              icon={Wifi}
              label="IP Address"
              value={
                machineOnline
                  ? "192.168.1.120"
                  : "Unavailable"
              }
            />

            <InfoRow
              icon={Activity}
              label="Last Heartbeat"
              value={
                machineOnline
                  ? "Just now"
                  : "Not available"
              }
            />
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <p className="text-xs leading-5 text-slate-500">
              Device information is currently simulated.
              The ESP32 will later send real status data
              using MicroPython developed in Thonny.
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
              Monitor motors assigned to vending slots
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
                    Status
                  </th>

                  <th className="px-6 py-3 text-right font-medium">
                    Action
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
                        {slot.id}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {slot.product}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {slot.motor}
                    </td>

                    <td className="px-6 py-4">
                      <SlotStatus status={slot.status} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() =>
                            handleTestSlot(slot)
                          }
                          disabled={
                            testingSlot === slot.id
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <TestTube2 size={14} />

                          {testingSlot === slot.id
                            ? "Testing..."
                            : "Test"}
                        </button>

                        {slot.status === "Error" && (
                          <button
                            onClick={() =>
                              setSelectedSlot(slot)
                            }
                            className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Machine Events */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="font-semibold text-slate-900">
            Recent Machine Events
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Controller, reader, and motor activity
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start justify-between gap-4 px-6 py-4"
            >
              <div className="flex items-start gap-3">
                <EventIcon type={event.type} />

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {event.title}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {event.description}
                  </p>
                </div>
              </div>

              <span className="shrink-0 text-xs text-slate-400">
                {event.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Resolve Error Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Resolve Slot Error
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedSlot.id} ·{" "}
                  {selectedSlot.motor}
                </p>
              </div>

              <button
                onClick={() => setSelectedSlot(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={19} />
              </button>
            </div>

            <div className="p-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <Zap
                    size={19}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />

                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Simulated hardware error
                    </p>

                    <p className="mt-1 text-sm leading-6 text-amber-700">
                      Resetting this status only changes
                      the frontend simulation. Later,
                      hardware errors must be verified by
                      the ESP32 before they are marked as
                      resolved.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() =>
                    setSelectedSlot(null)
                  }
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  onClick={() =>
                    resetSlotError(selectedSlot.id)
                  }
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Reset Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  const isSuccess = status === "success";

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
            isSuccess
              ? "bg-green-50 text-green-600"
              : "bg-red-50 text-red-600"
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

      <span className="text-right text-sm font-semibold text-slate-800">
        {value}
      </span>
    </div>
  );
}

function SlotStatus({ status }) {
  const isReady = status === "Ready";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isReady
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      <CircleDot size={12} />
      {status}
    </span>
  );
}

function EventIcon({ type }) {
  if (type === "error") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
        <X size={17} />
      </div>
    );
  }

  if (type === "warning") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
        <Activity size={17} />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600">
      <CheckCircle2 size={17} />
    </div>
  );
}