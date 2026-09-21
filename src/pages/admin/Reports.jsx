import {
  Activity,
  CheckCircle2,
  CreditCard,
  Package,
  PhilippinePeso,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../../lib/supabase";

const chartColors = [
  "#2563eb",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
];

const dateRangeOptions = [
  "Today",
  "Last 7 Days",
  "Last 30 Days",
  "This Month",
];

function getStartDate(dateRange) {
  const now = new Date();

  if (dateRange === "Today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (dateRange === "Last 7 Days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (dateRange === "Last 30 Days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (dateRange === "This Month") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
  }

  return null;
}

function formatChartDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatCurrency(value) {
  return `₱${Number(value || 0).toFixed(2)}`;
}

function buildSalesData(
  transactions,
  dateRange
) {
  const successfulTransactions =
    transactions.filter(
      (transaction) =>
        transaction.status === "success"
    );

  const startDate = getStartDate(dateRange);
  const now = new Date();

  if (!startDate) {
    return [];
  }

  const dailyMap = new Map();

  const currentDate = new Date(startDate);

  while (currentDate <= now) {
    const dateKey = [
      currentDate.getFullYear(),
      String(
        currentDate.getMonth() + 1
      ).padStart(2, "0"),
      String(currentDate.getDate()).padStart(
        2,
        "0"
      ),
    ].join("-");

    dailyMap.set(dateKey, {
      day: formatChartDate(currentDate),
      sales: 0,
      transactions: 0,
    });

    currentDate.setDate(
      currentDate.getDate() + 1
    );
  }

  successfulTransactions.forEach(
    (transaction) => {
      const transactionDate = new Date(
        transaction.created_at
      );

      const dateKey = [
        transactionDate.getFullYear(),
        String(
          transactionDate.getMonth() + 1
        ).padStart(2, "0"),
        String(
          transactionDate.getDate()
        ).padStart(2, "0"),
      ].join("-");

      const dayData = dailyMap.get(dateKey);

      if (!dayData) {
        return;
      }

      dayData.sales += Number(
        transaction.amount || 0
      );

      dayData.transactions += 1;
    }
  );

  return Array.from(dailyMap.values()).map(
    (item) => ({
      ...item,
      sales: Number(item.sales.toFixed(2)),
    })
  );
}

function buildProductSales(transactions) {
  const productMap = new Map();

  transactions
    .filter(
      (transaction) =>
        transaction.status === "success"
    )
    .forEach((transaction) => {
      const productName =
        transaction.product_name ||
        "Unknown Product";

      const existing =
        productMap.get(productName) || {
          product: productName,
          quantity: 0,
          revenue: 0,
        };

      existing.quantity += 1;
      existing.revenue += Number(
        transaction.amount || 0
      );

      productMap.set(productName, existing);
    });

  return Array.from(productMap.values())
    .map((product) => ({
      ...product,
      revenue: Number(
        product.revenue.toFixed(2)
      ),
    }))
    .sort((a, b) => {
      if (b.quantity !== a.quantity) {
        return b.quantity - a.quantity;
      }

      return b.revenue - a.revenue;
    });
}

function buildTransactionStatusData(
  transactions
) {
  const statusCounts = {
    Success: 0,
    Failed: 0,
    Pending: 0,
    Refunded: 0,
  };

  transactions.forEach((transaction) => {
    if (transaction.status === "success") {
      statusCounts.Success += 1;
    } else if (
      transaction.status === "failed"
    ) {
      statusCounts.Failed += 1;
    } else if (
      transaction.status === "pending"
    ) {
      statusCounts.Pending += 1;
    } else if (
      transaction.status === "refunded"
    ) {
      statusCounts.Refunded += 1;
    }
  });

  return Object.entries(statusCounts)
    .map(([name, value]) => ({
      name,
      value,
    }))
    .filter((item) => item.value > 0);
}

export default function Reports() {
  const [dateRange, setDateRange] =
    useState("Last 7 Days");

  const [transactions, setTransactions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  useEffect(() => {
  let ignore = false;

  const loadReportData = async () => {
    try {
      const startDate = getStartDate(dateRange);

      let query = supabase
        .from("vending_transactions")
        .select(
          `
            id,
            transaction_code,
            product_name,
            amount,
            status,
            created_at,
            completed_at,
            product_id
          `
        )
        .order("created_at", {
          ascending: true,
        });

      if (startDate) {
        query = query.gte(
          "created_at",
          startDate.toISOString()
        );
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (!ignore) {
        setTransactions(data || []);
        setPageError("");
        setLoading(false);
      }
    } catch (error) {
      console.error(
        "Unable to load report data:",
        error
      );

      if (!ignore) {
        setTransactions([]);
        setPageError(
          error.message ||
            "Unable to load report data."
        );
        setLoading(false);
      }
    }
  };

  loadReportData();

  return () => {
    ignore = true;
  };
}, [dateRange]);

  const successfulTransactions =
    useMemo(
      () =>
        transactions.filter(
          (transaction) =>
            transaction.status === "success"
        ),
      [transactions]
    );

  const totalSales = useMemo(
    () =>
      successfulTransactions.reduce(
        (total, transaction) =>
          total +
          Number(transaction.amount || 0),
        0
      ),
    [successfulTransactions]
  );

  const itemsSold =
    successfulTransactions.length;

  const successRate = useMemo(() => {
    if (transactions.length === 0) {
      return 0;
    }

    return (
      (successfulTransactions.length /
        transactions.length) *
      100
    );
  }, [
    transactions,
    successfulTransactions,
  ]);

  const salesData = useMemo(
    () =>
      buildSalesData(
        transactions,
        dateRange
      ),
    [transactions, dateRange]
  );

  const productSales = useMemo(
    () => buildProductSales(transactions),
    [transactions]
  );

  const transactionStatusData =
    useMemo(
      () =>
        buildTransactionStatusData(
          transactions
        ),
      [transactions]
    );

  const totalStatusTransactions =
    transactionStatusData.reduce(
      (total, item) => total + item.value,
      0
    );

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Reports & Analytics
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Review vending machine sales,
            products, and transaction
            performance.
          </p>
        </div>

        <div>
          <label
            htmlFor="report-range"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400"
          >
            Report period
          </label>

          <select
            id="report-range"
            value={dateRange}
            onChange={(event) => {
  setLoading(true);
  setDateRange(event.target.value);
}}
            disabled={loading}
            className="min-w-44 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dateRangeOptions.map(
              (option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Error */}
      {pageError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError}
        </div>
      )}

      {/* Statistics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportStatCard
          title="Total Sales"
          value={
            loading
              ? "..."
              : formatCurrency(totalSales)
          }
          description={dateRange}
          icon={PhilippinePeso}
        />

        <ReportStatCard
          title="Transactions"
          value={
            loading
              ? "..."
              : transactions.length
          }
          description="Recorded purchases"
          icon={CreditCard}
        />

        <ReportStatCard
          title="Items Sold"
          value={
            loading ? "..." : itemsSold
          }
          description="Successfully dispensed"
          icon={ShoppingBag}
        />

        <ReportStatCard
          title="Success Rate"
          value={
            loading
              ? "..."
              : `${successRate.toFixed(1)}%`
          }
          description="Successful transactions"
          icon={CheckCircle2}
        />
      </div>

      {/* Main Charts */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        {/* Sales Overview */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Sales Overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Daily successful vending
                machine sales
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-green-600">
              <TrendingUp size={17} />
              Live transaction data
            </div>
          </div>

          <div className="h-80 p-5">
            {loading ? (
              <ChartLoading />
            ) : salesData.length === 0 ? (
              <ChartEmptyState />
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={salesData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#64748b",
                      fontSize: 12,
                    }}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#64748b",
                      fontSize: 12,
                    }}
                    tickFormatter={(value) =>
                      `₱${value}`
                    }
                  />

                  <Tooltip
                    formatter={(
                      value,
                      name
                    ) => {
                      if (name === "sales") {
                        return [
                          formatCurrency(
                            value
                          ),
                          "Sales",
                        ];
                      }

                      return [value, name];
                    }}
                    contentStyle={{
                      borderRadius: "12px",
                      border:
                        "1px solid #e2e8f0",
                    }}
                  />

                  <Bar
                    dataKey="sales"
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Transaction Status */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              Transaction Status
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Payment result distribution
            </p>
          </div>

          <div className="p-5">
            <div className="h-52">
              {loading ? (
                <ChartLoading />
              ) : transactionStatusData.length ===
                0 ? (
                <ChartEmptyState />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <PieChart>
                    <Pie
                      data={
                        transactionStatusData
                      }
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {transactionStatusData.map(
                        (entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={
                              chartColors[
                                index %
                                  chartColors.length
                              ]
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {!loading &&
              transactionStatusData.length >
                0 && (
                <div className="space-y-3">
                  {transactionStatusData.map(
                    (item, index) => {
                      const percentage =
                        totalStatusTransactions >
                        0
                          ? (item.value /
                              totalStatusTransactions) *
                            100
                          : 0;

                      return (
                        <div
                          key={item.name}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  chartColors[
                                    index %
                                      chartColors.length
                                  ],
                              }}
                            />

                            <span className="text-sm text-slate-600">
                              {item.name}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-semibold text-slate-800">
                              {item.value}
                            </span>

                            <span className="ml-2 text-xs text-slate-400">
                              {percentage.toFixed(
                                1
                              )}
                              %
                            </span>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Top Selling Products */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              Top Selling Products
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Product performance by
              successful purchases
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-52 items-center justify-center px-6 py-12 text-sm text-slate-400">
              Loading product analytics...
            </div>
          ) : productSales.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Package
                size={34}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 font-medium text-slate-700">
                No product sales yet
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Successful vending purchases
                will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">
                      Product
                    </th>

                    <th className="px-6 py-3 font-medium">
                      Sold
                    </th>

                    <th className="px-6 py-3 text-right font-medium">
                      Revenue
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {productSales.map(
                    (product, index) => (
                      <tr
                        key={product.product}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <Package
                                size={17}
                              />
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {
                                  product.product
                                }
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                Rank #
                                {index + 1}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-700">
                            {
                              product.quantity
                            }{" "}
                            {product.quantity ===
                            1
                              ? "item"
                              : "items"}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            product.revenue
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Report Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              Report Summary
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Current vending performance
            </p>
          </div>

          <div className="space-y-5 p-6">
            <SummaryRow
              icon={PhilippinePeso}
              title="Sales"
              value={
                loading
                  ? "..."
                  : formatCurrency(
                      totalSales
                    )
              }
            />

            <SummaryRow
              icon={CreditCard}
              title="Transactions"
              value={
                loading
                  ? "..."
                  : transactions.length
              }
            />

            <SummaryRow
              icon={ShoppingBag}
              title="Items Sold"
              value={
                loading
                  ? "..."
                  : itemsSold
              }
            />

            <SummaryRow
              icon={Activity}
              title="Success Rate"
              value={
                loading
                  ? "..."
                  : `${successRate.toFixed(
                      1
                    )}%`
              }
            />
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            <p className="text-xs leading-5 text-slate-400">
              Analytics are generated from
              vending transaction records stored
              in Supabase for the selected report
              period.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportStatCard({
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

function SummaryRow({
  icon: Icon,
  title,
  value,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon size={18} />
        </div>

        <span className="text-sm font-medium text-slate-600">
          {title}
        </span>
      </div>

      <span className="text-sm font-bold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function ChartLoading() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading analytics...
    </div>
  );
}

function ChartEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <Activity
        size={32}
        className="text-slate-300"
      />

      <p className="mt-3 text-sm font-medium text-slate-600">
        No transaction data
      </p>

      <p className="mt-1 text-xs text-slate-400">
        No vending transactions were recorded
        during this period.
      </p>
    </div>
  );
}