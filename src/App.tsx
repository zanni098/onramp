import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Loader } from 'lucide-react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Webhooks from './pages/Webhooks';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Checkout from './pages/Checkout';
import Success from './pages/Success';
import { useAuth } from './lib/auth';

// Synchronous auth guard: decides before the protected tree ever renders,
// so there is no flash of dashboard content for signed-out visitors.
const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="animate-spin text-accent" size={32} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/checkout/:productId" element={<Checkout />} />
        <Route path="/success" element={<Success />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/webhooks" element={<Webhooks />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
