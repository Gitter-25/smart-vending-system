import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

function formatPaymentMethod(method) {
  if (!method) {
    return "Unknown";
  }

  const labels = {
    student_id: "Student ID",
  };

  return (
    labels[method] ||
    method
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatStatus(status) {
  if (!status) {
    return "Pending";
  }

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1).toLowerCase()
  );
}

function formatTransactionDate(dateValue) {
  if (!dateValue) {
    return {
      date: "—",
      time: "—",
    };
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "—",
      time: "—",
    };
  }

  return {
    date: date.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),

    time: date.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [
    selectedTransaction,
    setSelectedTransaction,
  ] = useState(null);

  useEffect(() => {
    const loadTransactions = async () => {
      setLoading(true);
      setPageError("");

      const { data, error } = await supabase
        .from("vending_transactions")
        .select(`
          id,
          transaction_code,
          student_id,
          card_id,
          machine_id,
          slot_id,
          product_id,
          product_name,
          amount,
          payment_method,
          status,
          failure_reason,
          created_at,
          completed_at,
          students (
            id,
            student_number,
            full_name
          ),
          student_cards (
            id,
            card_uid
          ),
          machines (
            id,
            machine_code,
            name
          ),
          vending_slots (
            id,
            slot_code,
            motor_number
          )
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "Unable to load transactions:",
          error
        );

        setPageError(
          "Unable to load transactions. Please try again."
        );

        setLoading(false);
        return;
      }

      const formattedTransactions = (
        data ?? []
      ).map((transaction) => {
        const dateInfo = formatTransactionDate(
          transaction.created_at
        );

        const completedDateInfo =
          formatTransactionDate(
            transaction.completed_at
          );

        return {
          id: transaction.id,

          transactionId:
            transaction.transaction_code,

          studentId: transaction.student_id,

          studentNumber:
            transaction.students?.student_number ??
            "Unknown",

          studentName:
            transaction.students?.full_name ??
            "Unknown Student",

          cardUid:
            transaction.student_cards?.card_uid ??
            "—",

          product:
            transaction.product_name ??
            "Unknown Product",

          slot:
            transaction.vending_slots?.slot_code ??
            "—",

          motorNumber:
            transaction.vending_slots
              ?.motor_number ?? null,

          machineCode:
            transaction.machines?.machine_code ??
            "—",

          machineName:
            transaction.machines?.name ??
            "Unknown Machine",

          amount: Number(
            transaction.amount ?? 0
          ),

          paymentMethod: formatPaymentMethod(
            transaction.payment_method
          ),

          status: formatStatus(
            transaction.status
          ),

          failureReason:
            transaction.failure_reason || "",

          date: dateInfo.date,
          time: dateInfo.time,

          completedDate:
            transaction.completed_at
              ? completedDateInfo.date
              : "—",

          completedTime:
            transaction.completed_at
              ? completedDateInfo.time
              : "—",

          createdAt: transaction.created_at,
          completedAt:
            transaction.completed_at,
        };
      });

      setTransactions(formattedTransactions);
      setLoading(false);
    };

    loadTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return transactions.filter(
      (transaction) => {
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
            .includes(searchValue) ||
          transaction.cardUid
            .toLowerCase()
            .includes(searchValue) ||
          transaction.machineCode
            .toLowerCase()
            .includes(searchValue);

        const matchesStatus =
          statusFilter === "All" ||
          transaction.status ===
            statusFilter;

        return (
          matchesSearch && matchesStatus
        );
      }
    );
  }, [
    transactions,
    search,
    statusFilter,
  ]);

  const successfulTransactions =
    transactions.filter(
      (transaction) =>
        transaction.status === "Success"
    );

  const failedTransactions =
    transactions.filter(
      (transaction) =>
        transaction.status === "Failed"
    );

  const totalSales =
    successfulTransactions.reduce(
      (total, transaction) =>
        total + transaction.amount,
      0
    );

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <RefreshCw
            size={28}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm text-slate-500">
            Loading transactions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Heading */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Transactions
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Monitor vending machine purchases and
          student ID payments.
        </p>
      </div>

      {/* Page Error */}
      {pageError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError}
        </div>
      )}

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
          value={
            successfulTransactions.length
          }
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
          {/* Search */}
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

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              size={18}
              className="text-slate-400"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
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

              <option value="Refunded">
                Refunded
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
                    {/* Transaction */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {
                          transaction.transactionId
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {
                          transaction.paymentMethod
                        }
                      </p>
                    </td>

                    {/* Student */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-700">
                        {transaction.studentName}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {
                          transaction.studentNumber
                        }
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
                      ₱
                      {transaction.amount.toFixed(
                        2
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <TransactionStatusBadge
                        status={
                          transaction.status
                        }
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

          {/* Empty State */}
          {filteredTransactions.length ===
            0 && (
            <div className="px-6 py-14 text-center">
              <CreditCard
                size={34}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 font-medium text-slate-700">
                No transactions found
              </p>

              <p className="mt-1 text-sm text-slate-400">
                {transactions.length === 0
                  ? "No vending transactions have been recorded yet."
                  : "Try changing your search or status filter."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            Showing{" "}
            {filteredTransactions.length} of{" "}
            {transactions.length} transactions
          </p>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Transaction Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {
                    selectedTransaction.transactionId
                  }
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
              {/* Amount and Status */}
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
                  label="Card UID"
                  value={
                    selectedTransaction.cardUid
                  }
                />

                <DetailRow
                  label="Product"
                  value={
                    selectedTransaction.product
                  }
                />

                <DetailRow
                  label="Vending Slot"
                  value={
                    selectedTransaction.slot
                  }
                />

                <DetailRow
                  label="Motor"
                  value={
                    selectedTransaction.motorNumber
                      ? `Motor ${selectedTransaction.motorNumber}`
                      : "—"
                  }
                />

                <DetailRow
                  label="Machine"
                  value={
                    selectedTransaction.machineName
                  }
                />

                <DetailRow
                  label="Machine Code"
                  value={
                    selectedTransaction.machineCode
                  }
                />

                <DetailRow
                  label="Payment Method"
                  value={
                    selectedTransaction.paymentMethod
                  }
                />

                <DetailRow
                  label="Created Date"
                  value={
                    selectedTransaction.date
                  }
                />

                <DetailRow
                  label="Created Time"
                  value={
                    selectedTransaction.time
                  }
                />

                <DetailRow
                  label="Completed Date"
                  value={
                    selectedTransaction.completedDate
                  }
                />

                <DetailRow
                  label="Completed Time"
                  value={
                    selectedTransaction.completedTime
                  }
                />

                {selectedTransaction.failureReason && (
                  <DetailRow
                    label="Failure Reason"
                    value={
                      selectedTransaction.failureReason
                    }
                    danger
                  />
                )}
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
      className: "bg-red-50 text-red-700",
      icon: XCircle,
    },

    Pending: {
      className:
        "bg-amber-50 text-amber-700",
      icon: Clock3,
    },

    Refunded: {
      className:
        "bg-purple-50 text-purple-700",
      icon: RefreshCw,
    },
  };

  const current =
    config[status] ?? config.Pending;

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

function DetailRow({
  label,
  value,
  danger = false,
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span
        className={`max-w-[65%] text-right text-sm font-medium ${
          danger
            ? "text-red-600"
            : "text-slate-800"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}