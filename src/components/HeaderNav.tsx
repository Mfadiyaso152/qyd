/**
 * Header Top Navigation Component (Replacing Sidebar)
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  CalendarDays, 
  BookOpen, 
  ShieldCheck, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';

export const HeaderNav: React.FC = () => {
  const { userProfile, logout } = useAuth();

  const navItems = [
    { to: '/', label: 'اليومية', icon: CalendarDays },
    { to: '/days', label: 'سجل الأيام', icon: BookOpen },
    { to: '/custodies', label: 'العُهد', icon: ShieldCheck },
    { to: '/reports', label: 'التقارير', icon: BarChart3 },
    { to: '/settings', label: 'الإعدادات', icon: SettingsIcon },
  ];

  return (
    <header className="bg-[#142B36] text-white border-b border-[#1f3e4d] sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#367C73] flex items-center justify-center shadow-md relative overflow-hidden group">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h8M6 10h8" />
              <path d="m9 14 2 2 4-4" stroke="#B9E6CF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-1.5">
              قَيد
            </h1>
            <p className="text-[11px] text-slate-300 font-medium hidden sm:block">كل عملية، في يومها</p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[#1b3846] p-1.5 rounded-2xl border border-[#274b5c]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `
                  flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all relative
                  ${isActive 
                    ? 'bg-[#367C73] text-white shadow-md font-semibold' 
                    : 'text-slate-300 hover:bg-[#224555] hover:text-white'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-3">
          {userProfile && (
            <div className="hidden sm:flex items-center gap-2.5 bg-[#1b3846] px-3.5 py-2 rounded-2xl border border-[#274b5c]">
              {userProfile.photoURL ? (
                <img 
                  src={userProfile.photoURL} 
                  alt={userProfile.displayName} 
                  className="w-8 h-8 rounded-full object-cover border-2 border-[#367C73]" 
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#367C73] text-white flex items-center justify-center font-bold text-xs">
                  {userProfile.displayName?.[0] || 'ق'}
                </div>
              )}
              <div className="text-right">
                <p className="text-xs font-semibold text-white truncate max-w-[120px]">{userProfile.displayName}</p>
              </div>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => logout()}
            className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};
