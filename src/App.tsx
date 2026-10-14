/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { MoreDrawer } from './components/MoreDrawer';
import { Logo } from './components/Logo';
import { Login } from './pages/Login';
import { DailyLedger } from './pages/DailyLedger';
import { TransactionDetail } from './pages/TransactionDetail';
import { DaysRecord } from './pages/DaysRecord';
import { Custodies } from './pages/Custodies';
import { Reports } from './pages/Reports';
import { BankAccountPage } from './pages/BankAccount';
import { Menu } from 'lucide-react';
import { motion } from 'motion/react';

const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-row-reverse">
      {/* Fixed Right Sidebar on Desktop (>= 1024px) */}
      <div className="hidden lg:block fixed top-0 right-0 bottom-0 w-64 z-30">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen w-full lg:mr-64 transition-all">
        {/* Mobile Top Bar (Only visible < 1024px) */}
        <header className="lg:hidden sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 z-30 px-4 py-3 flex items-center justify-between shadow-xs">
          {/* Right side in RTL: Brand Logo */}
          <Logo size="sm" showSubtitle={false} />

          {/* Left side in RTL (فوق يسار): "المزيد" Button - Icon only, white background matching top bar */}
          <button
            onClick={() => setIsMoreDrawerOpen(true)}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 transition-colors shadow-xs active:scale-95"
            title="المزيد من الخيارات"
            aria-label="المزيد"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
        </header>

        {/* Content Container */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile/Tablet Bottom Navigation */}
      <BottomNav />

      {/* Slide-up "المزيد" Drawer */}
      <MoreDrawer isOpen={isMoreDrawerOpen} onClose={() => setIsMoreDrawerOpen(false)} />
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center gap-4 p-4 select-none">
        <motion.div 
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-3"
        >
          <Logo size="lg" showSubtitle={true} />
        </motion.div>
        <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden mt-2">
          <motion.div 
            className="h-full bg-[#315BEB] rounded-full"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
          />
        </div>
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
        <Route path="/bank" element={<BankAccountPage />} />
        <Route path="/custodies" element={<Custodies />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthenticatedLayout>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
