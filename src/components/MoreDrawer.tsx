import React from 'react';
import { LogOut, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface MoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MoreDrawer: React.FC<MoreDrawerProps> = ({ isOpen, onClose }) => {
  const { userProfile, logout } = useAuth();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Drawer Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white rounded-t-3xl border-t border-slate-100 p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#17233D]">حسابي</h3>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-[#F7F9FC] border border-slate-100">
              {userProfile?.photoURL ? (
                <img 
                  src={userProfile.photoURL} 
                  alt={userProfile.displayName} 
                  className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0" 
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#315BEB] text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {userProfile?.displayName?.[0] || 'ق'}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-sm text-[#17233D] truncate">{userProfile?.displayName}</p>
                <p className="text-xs text-slate-400 truncate">{userProfile?.email}</p>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  جلسة آمنة
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <div className="pt-2">
              <button
                onClick={async () => {
                  onClose();
                  await logout();
                }}
                className="flex items-center justify-center gap-2.5 w-full p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 font-semibold text-sm hover:bg-rose-100 transition-all shadow-xs"
              >
                <LogOut className="w-5 h-5 text-rose-600" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
