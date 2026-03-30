import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { 
  HomeIcon, 
  ChartBarIcon, 
  UserGroupIcon,
  BellIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline';

const Sidebar = () => {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    { path: '/dashboard', icon: HomeIcon, label: 'لوحة التحكم', badge: null },
    { path: '/manager', icon: ChartBarIcon, label: 'لوحة المدير', badge: null },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-lg transition-colors duration-200">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-2xl">🦅</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">النورس</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">نظام إدارة المتاجر</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${active 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              <Icon className="w-6 h-6" />
              <span className="font-semibold">{item.label}</span>
              {item.badge && (
                <span className="mr-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle & User Info */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
        >
          {isDark ? (
            <>
              <SunIcon className="w-6 h-6 text-yellow-500" />
              <span className="font-semibold text-gray-700 dark:text-gray-300">الوضع النهاري</span>
            </>
          ) : (
            <>
              <MoonIcon className="w-6 h-6 text-blue-600" />
              <span className="font-semibold text-gray-700 dark:text-gray-300">الوضع الليلي</span>
            </>
          )}
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">
            س
          </div>
          <div className="flex-1">
            <p className="font-bold">سيف الموظف</p>
            <p className="text-xs text-blue-100">موظف مبيعات</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
