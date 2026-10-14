import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  CalendarDays, 
  BookOpen, 
  Building2,
  FolderLock, 
  BarChart3, 
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  className?: string;
  onItemClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '', onItemClick }) => {
  const { userProfile, logout } = useAuth();

  const navItems = [
    { to: '/', label: 'اليومية', icon: CalendarDays },
    { to: '/days', label: 'سجل الأيام', icon: BookOpen },
    { to: '/bank', label: 'حساب البنك', icon: Building2 },
    { to: '/custodies', label: 'العُهد', icon: FolderLock },
    { to: '/reports', label: 'التقارير', icon: BarChart3 },
  ];

  return (
    <aside className={`w-64 bg-white border-l border-slate-100 flex flex-col justify-between p-6 h-screen sticky top-0 select-none ${className}`}>
      {/* Top Brand Logo */}
      <div>
        <div className="pb-8 pt-2">
          <NavLink to="/" onClick={onItemClick}>
            <Logo size="md" showSubtitle={true} />
          </NavLink>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onItemClick}
                className={({ isActive }) => `
                  flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200
                  ${isActive 
                    ? 'bg-[#EEF2FF] text-[#315BEB] shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#17233D]'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? 'scale-105 text-[#315BEB]' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile Section with Logout */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F7F9FC] border border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            {userProfile?.photoURL ? (
              <img 
                src={userProfile.photoURL} 
                alt={userProfile.displayName} 
                className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#315BEB] text-white flex items-center justify-center font-bold text-sm shrink-0">
                {userProfile?.displayName?.[0] || 'ق'}
              </div>
            )}
            <div className="min-w-0 text-right">
              <p className="text-xs font-bold text-[#17233D] truncate">
                {userProfile?.displayName || 'المستخدم'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {userProfile?.email}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            if (onItemClick) onItemClick();
            await logout();
          }}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
};
