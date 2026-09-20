import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  Package,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

const initialTransactions = [
  {
    id: 1,
    transactionId: "TXN-000001",
    studentNumber: "2026-0001",
    studentName: "Juan Dela Cruz",
    product: "Bottled Water",
    slot: "A1",
    amount: 20,
    paymentMethod: "Student ID",
    status: "Success",
    date: "Sep 20, 2026",
    time: "10:24 PM",
  },
  {
    id: 2,
    transactionId: "TXN-000002",
    studentNumber: "2026-0002",
    studentName: "Maria Santos",
    product: "Chocolate Bar",
    slot: "A3",
    amount: 35.5,
    paymentMethod: "Student ID",
    status: "Success",
    date: "Sep 20, 2026",
    time: "9:58 PM",
  },
  {
    id: 3,
    transactionId: "TXN-000003",
    studentNumber: "2026-0003",
    studentName: "Carlo Reyes",
    product: "Iced Tea",
    slot: "A2",
    amount: 25,
    paymentMethod: "Student ID",
    status: "Failed",
    date: "Sep 20, 2026",
    time: "9:42 PM",
  },
  {
    id: 4,
    transactionId: "TXN-000004",
    studentNumber: "2026-0001",
    studentName: "Juan Dela Cruz",
    product: "Potato Chips",
    slot: "A4",
    amount: 30.25,
    paymentMethod: "Student ID",
    status: "Success",
    date: "Sep 20, 2026",
    time: "8:51 PM",
  },
  {
    id: 5,
    transactionId: "TXN-000005",
    studentNumber: "2026-0004",
    studentName: "Angela Cruz",
    product: "Orange Juice",
    slot: "B2",
    amount: 30,
    paymentMethod: "Student ID",
    status: "Failed",
    date: "Sep 20, 2026",
    time: "8:30 PM",
  },
  {
    id: 6,
    transactionId: "TXN-000006",
    studentNumber: "2026-0002",
    studentName: "Maria Santos",
    product: "Biscuits",
    slot: "B1",
    amount: 20.5,
    paymentMethod: "Student ID",
    status: "Pending",
    date: "Sep 20, 2026",
    time: "8:12 PM",
  },
];

export default function Transactions() {
  const [transactions] = useState(initialTransactions);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedTransaction, setSelectedTransaction] =
    useState(null);

  const filteredTransactions = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesSearch =
        transaction.transactionId
          .toLowerCase()
          .includes(searchValue) ||
        transaction.studentNumber
          .toLowerCase()
          .includes(searchValue) ||
        transaction.studentName
          .toLowerCase()
          .includes(searchValue) ||
        transaction.product
          .toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        statusFilter === "All" ||
        transaction.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter]);

  const successfulTransactions = transactions.filter(
    (transaction) => transaction.status === "Success"
  );

  const failedTransactions = transactions.filter(
    (transaction) => transaction.status === "Failed"
  );


  const totalSales = successfulTransactions.reduce(
    (total, transaction) => total + transaction.amount,
    0
  );

  return (
    <div>
      {/* Page Heading */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Transactions
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Monitor vending machine purchases and student ID
          payments.
        </p>
      </div>

      {/* Statistics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TransactionStatCard
          title="Total Transactions"
          value={transactions.length}
          description="All recorded transactions"
          icon={CreditCard}
        />

        <TransactionStatCard
          title="Successful"
          value={successfulTransactions.length}
          description="Completed purchases"
          icon={CheckCircle2}
        />

        <TransactionStatCard
          title="Failed"
          value={failedTransactions.length}
          description="Unsuccessful purchases"
          icon={XCircle}
        />

        <TransactionStatCard
          title="Total Sales"
          value={`₱${totalSales.toFixed(2)}`}
          description="From successful transactions"
          icon={Package}
        />
      </div>

      {/* Transactions Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search transaction, student, or product..."
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal
              size={18}
              className="text-slate-400"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="All">
                All statuses
              </option>

              <option value="Success">
                Success
              </option>

              <option value="Failed">
                Failed
              </option>

              <option value="Pending">
                Pending
              </option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">
                  Transaction
                </th>

                <th className="px-6 py-3 font-medium">
                  Student
                </th>

                <th className="px-6 py-3 font-medium">
                  Product
                </th>

                <th className="px-6 py-3 font-medium">
                  Amount
                </th>

                <th className="px-6 py-3 font-medium">
                  Status
                </th>

                <th className="px-6 py-3 font-medium">
                  Date
                </th>

                <th className="px-6 py-3 text-right font-medium">
                  Details
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(
                (transaction) => (
                  <tr
                    key={transaction.id}
                    className="transition hover:bg-slate-50"
                  >
                    {/* Transaction ID */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {transaction.transactionId}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {transaction.paymentMethod}
                      </p>
                    </td>

                    {/* Student */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-700">
                        {transaction.studentName}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {transaction.studentNumber}
                      </p>
                    </td>

                    {/* Product */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-700">
                        {transaction.product}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Slot {transaction.slot}
                      </p>
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      ₱{transaction.amount.toFixed(2)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <TransactionStatusBadge
                        status={transaction.status}
                      />
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">
                        {transaction.date}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {transaction.time}
                      </p>
                    </td>

                    {/* Details */}
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTransaction(
                            transaction
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <div className="px-6 py-14 text-center">
              <CreditCard
                size={34}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 font-medium text-slate-700">
                No transactions found
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Try changing your search or status
                filter.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            Showing {filteredTransactions.length} of{" "}
            {transactions.length} transactions
          </p>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Transaction Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedTransaction.transactionId}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTransaction(null)
                }
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Details */}
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Amount
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    ₱
                    {selectedTransaction.amount.toFixed(
                      2
                    )}
                  </p>
                </div>

                <TransactionStatusBadge
                  status={
                    selectedTransaction.status
                  }
                />
              </div>

              <div className="divide-y divide-slate-100">
                <DetailRow
                  label="Student"
                  value={
                    selectedTransaction.studentName
                  }
                />

                <DetailRow
                  label="Student Number"
                  value={
                    selectedTransaction.studentNumber
                  }
                />

                <DetailRow
                  label="Product"
                  value={selectedTransaction.product}
                />

                <DetailRow
                  label="Vending Slot"
                  value={selectedTransaction.slot}
                />

                <DetailRow
                  label="Payment Method"
                  value={
                    selectedTransaction.paymentMethod
                  }
                />

                <DetailRow
                  label="Date"
                  value={selectedTransaction.date}
                />

                <DetailRow
                  label="Time"
                  value={selectedTransaction.time}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setSelectedTransaction(null)
                }
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionStatCard({
  title,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
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

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function TransactionStatusBadge({ status }) {
  const config = {
    Success: {
      className:
        "bg-green-50 text-green-700",
      icon: CheckCircle2,
    },

    Failed: {
      className:
        "bg-red-50 text-red-700",
      icon: XCircle,
    },

    Pending: {
      className:
        "bg-amber-50 text-amber-700",
      icon: Clock3,
    },
  };

  const current = config[status];
  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${current.className}`}
    >
      <Icon size={13} />
      {status}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="text-right text-sm font-medium text-slate-800">
        {value}
      </span>
    </div>
  );
}