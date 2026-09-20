import {
  Activity,
  CheckCircle2,
  CreditCard,
  Package,
  PhilippinePeso,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
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

const salesData = [
  {
    day: "Sep 14",
    sales: 120.5,
    transactions: 5,
  },
  {
    day: "Sep 15",
    sales: 185.75,
    transactions: 8,
  },
  {
    day: "Sep 16",
    sales: 95.25,
    transactions: 4,
  },
  {
    day: "Sep 17",
    sales: 230.5,
    transactions: 10,
  },
  {
    day: "Sep 18",
    sales: 175,
    transactions: 7,
  },
  {
    day: "Sep 19",
    sales: 310.75,
    transactions: 13,
  },
  {
    day: "Sep 20",
    sales: 85.75,
    transactions: 6,
  },
];

const productSales = [
  {
    product: "Bottled Water",
    quantity: 18,
    revenue: 360,
  },
  {
    product: "Iced Tea",
    quantity: 14,
    revenue: 350,
  },
  {
    product: "Chocolate Bar",
    quantity: 11,
    revenue: 390.5,
  },
  {
    product: "Potato Chips",
    quantity: 9,
    revenue: 272.25,
  },
  {
    product: "Orange Juice",
    quantity: 7,
    revenue: 210,
  },
];

const transactionStatusData = [
  {
    name: "Success",
    value: 46,
  },
  {
    name: "Failed",
    value: 5,
  },
  {
    name: "Pending",
    value: 2,
  },
];

const chartColors = [
  "#2563eb",
  "#ef4444",
  "#f59e0b",
];

const reportRanges = {
  Today: {
    sales: 85.75,
    transactions: 6,
    itemsSold: 3,
    successfulTransactions: 3,
  },

  "Last 7 Days": {
    sales: 1203.5,
    transactions: 53,
    itemsSold: 49,
    successfulTransactions: 46,
  },

  "Last 30 Days": {
    sales: 5240.75,
    transactions: 218,
    itemsSold: 201,
    successfulTransactions: 194,
  },

  "This Month": {
    sales: 3865.25,
    transactions: 164,
    itemsSold: 151,
    successfulTransactions: 147,
  },
};

export default function Reports() {
  const [dateRange, setDateRange] =
    useState("Last 7 Days");

  const report = reportRanges[dateRange];

  const successRate = useMemo(() => {
    if (report.transactions === 0) {
      return 0;
    }

    return (
      (report.successfulTransactions /
        report.transactions) *
      100
    );
  }, [report]);

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
            Review vending machine sales, products, and
            transaction performance.
          </p>
        </div>

        {/* Date Range */}
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
            onChange={(event) =>
              setDateRange(event.target.value)
            }
            className="min-w-44 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="Today">
              Today
            </option>

            <option value="Last 7 Days">
              Last 7 Days
            </option>

            <option value="Last 30 Days">
              Last 30 Days
            </option>

            <option value="This Month">
              This Month
            </option>
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportStatCard
          title="Total Sales"
          value={`₱${report.sales.toFixed(2)}`}
          description={dateRange}
          icon={PhilippinePeso}
        />

        <ReportStatCard
          title="Transactions"
          value={report.transactions}
          description="Recorded purchases"
          icon={CreditCard}
        />

        <ReportStatCard
          title="Items Sold"
          value={report.itemsSold}
          description="Successfully dispensed"
          icon={ShoppingBag}
        />

        <ReportStatCard
          title="Success Rate"
          value={`${successRate.toFixed(1)}%`}
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
                Daily vending machine sales
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-green-600">
              <TrendingUp size={17} />
              Sales activity
            </div>
          </div>

          <div className="h-80 p-5">
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
                  formatter={(value) => [
                    `₱${Number(value).toFixed(2)}`,
                    "Sales",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                />

                <Bar
                  dataKey="sales"
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
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
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <PieChart>
                  <Pie
                    data={transactionStatusData}
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
            </div>

            {/* Legend */}
            <div className="space-y-3">
              {transactionStatusData.map(
                (item, index) => {
                  const percentage =
                    totalStatusTransactions > 0
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
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
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
              Product performance by quantity sold
            </p>
          </div>

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
                            <Package size={17} />
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {product.product}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              Rank #{index + 1}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-700">
                          {product.quantity} items
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        ₱
                        {product.revenue.toFixed(
                          2
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
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
              value={`₱${report.sales.toFixed(2)}`}
            />

            <SummaryRow
              icon={CreditCard}
              title="Transactions"
              value={report.transactions}
            />

            <SummaryRow
              icon={ShoppingBag}
              title="Items Sold"
              value={report.itemsSold}
            />

            <SummaryRow
              icon={Activity}
              title="Success Rate"
              value={`${successRate.toFixed(1)}%`}
            />
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            <p className="text-xs leading-5 text-slate-400">
              Report values are currently simulated.
              Real-time analytics will be generated
              from transaction records after database
              integration.
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