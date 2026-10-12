/**
 * Login Page Component for Qayd
 */
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EB] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8 flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Decorative background element */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#367C73]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-[#D99A32]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Brand Logo */}
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="w-20 h-20 rounded-2xl bg-[#367C73] flex items-center justify-center shadow-lg mb-6 text-white relative"
        >
          <svg className="w-11 h-11 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h8M6 10h8" />
            <path d="m9 14 2 2 4-4" stroke="#B9E6CF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>

        <h1 className="text-3xl font-bold tracking-tight text-[#142B36] mb-1.5">
          قَيد
        </h1>
        <p className="text-sm font-medium text-slate-500 mb-8">
          كل عملية، في يومها
        </p>

        <div className="w-full space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 text-right">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-2xl bg-white border-2 border-slate-300 hover:border-[#367C73] text-slate-700 font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-3 text-base disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.95H1.14v3.15C3.15 21.36 7.23 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.25c-.25-.72-.38-1.49-.38-2.25s.13-1.53.38-2.25V6.6H1.14C.41 8.08 0 9.74 0 12s.41 3.92 1.14 5.4l4.14-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.64 1.14 6.6l4.14 3.15c.95-2.84 3.6-4.95 6.72-4.95z"/>
            </svg>
            <span>{loading ? 'جاري الاتصال بـ Google...' : 'المتابعة باستخدام Google'}</span>
          </motion.button>
        </div>

        <p className="text-[11px] text-slate-400 mt-6">
          جميع بياناتك المالية مشفرة ومحمية ببروتوكولات الأمان المتقدمة.
        </p>
      </motion.div>
    </div>
  );
};
