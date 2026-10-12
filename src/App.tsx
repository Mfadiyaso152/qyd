/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HeaderNav } from './components/HeaderNav';
import { BottomNav } from './components/BottomNav';
import { Login } from './pages/Login';
import { DailyLedger } from './pages/DailyLedger';
import { TransactionDetail } from './pages/TransactionDetail';
import { DaysRecord } from './pages/DaysRecord';
import { Custodies } from './pages/Custodies';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { motion, AnimatePresence } from 'motion/react';

const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#F7F4EB] flex flex-col">
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
      <BottomNav />
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F4EB] flex flex-col items-center justify-center gap-4">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
          className="w-16 h-16 rounded-3xl bg-[#367C73] flex items-center justify-center text-white shadow-2xl"
        >
          <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h8M6 10h8" />
            <path d="m9 14 2 2 4-4" stroke="#B9E6CF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <p className="text-sm font-semibold text-[#142B36]">جاري التحميل...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <AuthenticatedLayout>
      <Routes>
        <Route path="/" element={<DailyLedger />} />
        <Route path="/transaction/:id" element={<TransactionDetail />} />
        <Route path="/days" element={<DaysRecord />} />
        <Route path="/custodies" element={<Custodies />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthenticatedLayout>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
