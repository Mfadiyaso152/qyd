import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  CalendarDays, 
  Building2,
  FolderLock, 
  BarChart3
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navItems = [
    { to: '/', label: 'اليومية', icon: CalendarDays },
    { to: '/bank', label: 'حساب البنك', icon: Building2 },
    { to: '/custodies', label: 'العُهد', icon: FolderLock },
    { to: '/reports', label: 'التقارير', icon: BarChart3 },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 z-40 px-3 py-2 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `
              flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 min-w-[56px] min-h-[44px]
              ${isActive 
                ? 'text-[#315BEB] font-bold' 
                : 'text-slate-500 hover:text-[#17233D]'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-[#EEF2FF]' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] leading-tight mt-0.5">{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
