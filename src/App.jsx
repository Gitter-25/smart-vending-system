import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "./layouts/AdminLayout";

import Dashboard from "./pages/admin/Dashboard";
import Inventory from "./pages/admin/Inventory";
import Machine from "./pages/admin/Machine";
import Products from "./pages/admin/Products";
import Reports from "./pages/admin/Reports";
import Settings from "./pages/admin/Settings";
import Students from "./pages/admin/Students";
import Transactions from "./pages/admin/Transactions";
import Login from "./pages/auth/Login";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<AdminLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/students" element={<Students />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/machine" element={<Machine />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}