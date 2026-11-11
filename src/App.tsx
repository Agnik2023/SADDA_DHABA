import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./context/ToastContext";
import { CartProvider } from "./context/CartContext";
import { StaffAuthProvider } from "./context/StaffAuthContext";
import { CustomerApp } from "./components/customer/CustomerApp";
import { OrderStatusPage } from "./components/customer/OrderStatusPage";
import { AdminDashboard } from "./components/admin/AdminDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CartProvider>
          <StaffAuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<CustomerApp />} />
                <Route path="/order" element={<OrderStatusPage />} />
                <Route path="/admin/*" element={<AdminDashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </StaffAuthProvider>
        </CartProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
