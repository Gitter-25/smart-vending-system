import {
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Package,
  RefreshCw,
  ShoppingCart,
  Users,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [todaySales, setTodaySales] = useState(0);
  const [todayTransactions, setTodayTransactions] =
    useState(0);

  const [productCount, setProductCount] = useState(0);
  const [activeProductCount, setActiveProductCount] =
    useState(0);

  const [studentCount, setStudentCount] = useState(0);
  const [activeStudentCount, setActiveStudentCount] =
    useState(0);

  const [lowStockCount, setLowStockCount] = useState(0);

  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setPageError("");

      try {
        /*
         * Start of today.
         *
         * This creates the timestamp using the browser's
         * current local date and converts it to UTC for
         * comparison with Supabase timestamptz values.
         */
        const startOfToday = new Date();

        startOfToday.setHours(0, 0, 0, 0);

        const startOfTodayIso =
          startOfToday.toISOString();

        /*
         * Run independent dashboard queries together.
         */
        const [
          todayTransactionsResult,
          productsResult,
          studentsResult,
          slotsResult,
          recentTransactionsResult,
        ] = await Promise.all([
          supabase
            .from("vending_transactions")
            .select("id, amount, status")
            .eq("status", "success")
            .gte("created_at", startOfTodayIso),

          supabase
            .from("products")
            .select("id, status"),

          supabase
            .from("students")
            .select("id, status"),

          supabase
            .from("vending_slots")
            .select(
              "id, quantity, capacity, product_id"
            ),

          supabase
            .from("vending_transactions")
            .select(`
              id,
              transaction_code,
              product_name,
              amount,
              payment_method,
              status,
              created_at,
              students (
                student_number,
                full_name
              )
            `)
            .order("created_at", {
              ascending: false,
            })
            .limit(5),
        ]);

        /*
         * Check query errors.
         */
        const queryError =
          todayTransactionsResult.error ||
          productsResult.error ||
          studentsResult.error ||
          slotsResult.error ||
          recentTransactionsResult.error;

        if (queryError) {
          throw queryError;
        }

        /*
         * Today's successful transactions.
         */
        const successfulToday =
          todayTransactionsResult.data ?? [];

        const salesToday = successfulToday.reduce(
          (total, transaction) =>
            total + Number(transaction.amount || 0),
          0
        );

        setTodaySales(salesToday);

        setTodayTransactions(
          successfulToday.length
        );

        /*
         * Products.
         */
        const products =
          productsResult.data ?? [];

        setProductCount(products.length);

        setActiveProductCount(
          products.filter(
            (product) =>
              product.status === "active"
          ).length
        );

        /*
         * Students.
         */
        const students =
          studentsResult.data ?? [];

        setStudentCount(students.length);

        setActiveStudentCount(
          students.filter(
            (student) =>
              student.status === "active"
          ).length
        );

        /*
         * Low-stock slots.
         *
         * Only count slots that actually have
         * a product assigned.
         *
         * This follows the same rule as the
         * Inventory page:
         *
         * quantity <= 30% capacity
         */
        const slots = slotsResult.data ?? [];

        const lowStockSlots = slots.filter(
          (slot) => {
            if (!slot.product_id) {
              return false;
            }

            const threshold = Math.ceil(
              slot.capacity * 0.3
            );

            return (
              slot.quantity > 0 &&
              slot.quantity <= threshold
            );
          }
        );

        setLowStockCount(
          lowStockSlots.length
        );

        /*
         * Recent transactions.
         */
        const formattedTransactions = (
          recentTransactionsResult.data ?? []
        ).map((transaction) => ({
          id: transaction.id,

          transactionId:
            transaction.transaction_code,

          student:
            transaction.students
              ?.student_number ?? "Unknown",

          studentName:
            transaction.students?.full_name ??
            "Unknown Student",

          product:
            transaction.product_name,

          amount: Number(
            transaction.amount || 0
          ),

          method:
            transaction.payment_method ===
            "student_id"
              ? "Student ID"
              : transaction.payment_method,

          status:
            transaction.status === "success"
              ? "Success"
              : transaction.status === "failed"
                ? "Failed"
                : transaction.status ===
                    "pending"
                  ? "Pending"
                  : transaction.status ===
                      "refunded"
                    ? "Refunded"
                    : transaction.status,

          createdAt:
            transaction.created_at,
        }));

        setTransactions(
          formattedTransactions
        );
      } catch (error) {
        console.error(
          "Unable to load dashboard:",
          error
        );

        setPageError(
          "Unable to load dashboard data. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = [
    {
      title: "Today's Sales",
      value: `₱${todaySales.toFixed(2)}`,
      subtitle: `${todayTransactions} successful ${
        todayTransactions === 1
          ? "transaction"
          : "transactions"
      }`,
      icon: ShoppingCart,
    },

    {
      title: "Products",
      value: productCount,
      subtitle: `${activeProductCount} active ${
        activeProductCount === 1
          ? "product"
          : "products"
      }`,
      icon: Package,
    },

    {
      title: "Registered Students",
      value: studentCount,
      subtitle: `${activeStudentCount} active ${
        activeStudentCount === 1
          ? "student"
          : "students"
      }`,
      icon: Users,
    },

    {
      title: "Low Stock",
      value: lowStockCount,
      subtitle:
        lowStockCount > 0
          ? "Needs attention"
          : "Stock levels are healthy",
      icon: AlertTriangle,
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center">
        <div className="text-center">
          <RefreshCw
            size={30}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm text-slate-500">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Monitor your vending machine operations
          and activity.
        </p>
      </div>

      {/* Page Error */}
      {pageError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError}
        </div>
      )}

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

      {/* Main Dashboard Content */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Recent Transactions */}
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

            <button
              type="button"
              onClick={() =>
                navigate("/transactions")
              }
              className="flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
            >
              View all

              <ArrowUpRight size={16} />
            </button>
          </div>

          {transactions.length > 0 ? (
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
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {transactions.map(
                    (transaction) => (
                      <tr
                        key={transaction.id}
                        className="transition hover:bg-slate-50"
                      >
                        {/* Transaction */}
                        <td className="px-6 py-4">
                          <p className="max-w-[180px] truncate text-sm font-medium text-slate-800">
                            {
                              transaction.transactionId
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {transaction.method}
                          </p>
                        </td>

                        {/* Student */}
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-700">
                            {transaction.student}
                          </p>

                          <p className="mt-1 max-w-[150px] truncate text-xs text-slate-400">
                            {
                              transaction.studentName
                            }
                          </p>
                        </td>

                        {/* Product */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                          {transaction.product}
                        </td>

                        {/* Amount */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-800">
                          ₱
                          {transaction.amount.toFixed(
                            2
                          )}
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-6 py-4">
                          <DashboardStatusBadge
                            status={
                              transaction.status
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <CreditCard
                size={34}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 font-medium text-slate-700">
                No transactions yet
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Completed vending purchases will
                appear here.
              </p>
            </div>
          )}
        </div>

        {/* Machine Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Machine Status
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Current hardware integration
              </p>
            </div>

            <WifiOff
              className="text-slate-400"
              size={22}
            />
          </div>

          {/*
           * Hardware is intentionally marked as
           * not connected.
           *
           * We should not show "online" until the
           * ESP32-S3 heartbeat is actually connected.
           */}
          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />

              <p className="font-medium text-slate-700">
                Hardware Not Connected
              </p>
            </div>

            <p className="mt-2 text-sm leading-5 text-slate-500">
              The web application and database are
              operational. ESP32-S3 integration will
              be added during the hardware phase.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <StatusRow
              label="ESP32-S3 Controller"
              value="Not connected"
            />

            <StatusRow
              label="ID Card Reader"
              value="Not connected"
            />

            <StatusRow
              label="Dispenser"
              value="Not connected"
            />

            <StatusRow
              label="Database"
              value="Connected"
              success
            />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex items-start gap-2 text-sm leading-5 text-slate-500">
              <CreditCard
                size={17}
                className="mt-0.5 shrink-0"
              />

              <span>
                Student ID payment backend is ready
                for future ESP32-S3 and RFID/NFC
                integration.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardStatusBadge({ status }) {
  const styles = {
    Success:
      "bg-green-50 text-green-700",

    Failed:
      "bg-red-50 text-red-700",

    Pending:
      "bg-amber-50 text-amber-700",

    Refunded:
      "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

function StatusRow({
  label,
  value,
  success = false,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span
        className={`text-right text-sm font-medium ${
          success
            ? "text-green-700"
            : "text-slate-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}