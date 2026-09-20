import {
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Package,
  ShoppingCart,
  Users,
  Wifi,
} from "lucide-react";

const stats = [
  {
    title: "Today's Sales",
    value: "₱1,250",
    subtitle: "32 transactions",
    icon: ShoppingCart,
  },
  {
    title: "Products",
    value: "24",
    subtitle: "6 product types",
    icon: Package,
  },
  {
    title: "Registered Students",
    value: "128",
    subtitle: "With registered IDs",
    icon: Users,
  },
  {
    title: "Low Stock",
    value: "4",
    subtitle: "Needs attention",
    icon: AlertTriangle,
  },
];

const transactions = [
  {
    id: "TXN-001",
    student: "2024-0001",
    product: "Bottled Water",
    amount: "₱20.00",
    method: "Student ID",
    status: "Success",
  },
  {
    id: "TXN-002",
    student: "2024-0012",
    product: "Chocolate Bar",
    amount: "₱35.00",
    method: "Student ID",
    status: "Success",
  },
  {
    id: "TXN-003",
    student: "2024-0028",
    product: "Potato Chips",
    amount: "₱30.00",
    method: "Student ID",
    status: "Success",
  },
  {
    id: "TXN-004",
    student: "2024-0041",
    product: "Iced Tea",
    amount: "₱25.00",
    method: "Student ID",
    status: "Failed",
  },
];

export default function Dashboard() {
  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Monitor your vending machine operations and activity.
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {stat.title}
                  </p>

                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon size={21} />
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                {stat.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      {/* Main dashboard content */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Transactions */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="font-semibold text-slate-900">
                Recent Transactions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Latest vending machine purchases
              </p>
            </div>

            <button className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
              View all
              <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Transaction</th>
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Product</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-800">
                      {transaction.id}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {transaction.student}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {transaction.product}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-800">
                      {transaction.amount}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          transaction.status === "Success"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Machine status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Machine Status
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Current system status
              </p>
            </div>

            <Wifi className="text-green-600" size={22} />
          </div>

          <div className="mt-6 rounded-xl bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />

              <p className="font-medium text-green-700">
                Machine Online
              </p>
            </div>

            <p className="mt-2 text-sm text-green-700/70">
              All systems operating normally.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <StatusRow label="ESP32 Controller" value="Simulated" />
            <StatusRow label="ID Card Reader" value="Simulated" />
            <StatusRow label="Dispenser" value="Ready" />
            <StatusRow label="Database" value="Not connected" />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CreditCard size={17} />
              Student ID payment ready for future integration
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>

      <span className="text-sm font-medium text-slate-800">
        {value}
      </span>
    </div>
  );
}