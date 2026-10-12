/**
 * Mobile Bottom Navigation Component
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  CalendarDays, 
  BookOpen, 
  ShieldCheck, 
  BarChart3, 
  Settings as SettingsIcon 
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navItems = [
    { to: '/', label: 'اليومية', icon: CalendarDays },
    { to: '/days', label: 'السجل', icon: BookOpen },
    { to: '/custodies', label: 'العُهد', icon: ShieldCheck },
    { to: '/reports', label: 'التقارير', icon: BarChart3 },
    { to: '/settings', label: 'الإعدادات', icon: SettingsIcon },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#142B36] text-white border-t border-[#1f3e4d] px-2 py-2 flex justify-around items-center z-40 shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `
              flex flex-col items-center py-1 px-3 rounded-lg transition-all
              ${isActive 
                ? 'text-[#B9E6CF] font-bold bg-[#1b3846]' 
                : 'text-slate-300 hover:text-white'
              }
            `}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span className="text-[11px] leading-none">{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};
