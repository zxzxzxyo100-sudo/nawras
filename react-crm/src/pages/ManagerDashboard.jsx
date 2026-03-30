import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  ClockIcon, 
  ChartBarIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon 
} from '@heroicons/react/24/outline';

const ManagerDashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [kpiResponse, violationsResponse] = await Promise.all([
        api.get('/kpis/dashboard'),
        api.get('/kpis/30min-response')
      ]);
      
      setKpis(kpiResponse.data);
      setViolations(violationsResponse.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">جاري تحميل لوحة المدير...</p>
        </div>
      </div>
    );
  }

  const response30Min = kpis?.response_rate_30min || 0;
  const satisfactionScore = kpis?.avg_satisfaction_score || 0;
  const retentionRate = kpis?.retention_success_rate || 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          لوحة المدير
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          مؤشرات الأداء الرئيسية (KPIs)
        </p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* 30-Min Response Rate */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <ClockIcon className="w-12 h-12 opacity-80" />
            <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
              اليوم
            </span>
          </div>
          <h3 className="text-4xl font-bold mb-2">{response30Min.toFixed(1)}%</h3>
          <p className="text-blue-100 font-semibold">معدل الرد خلال 30 دقيقة</p>
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-sm">
              {kpis?.calls_within_30min || 0} من {kpis?.total_registrations || 0} مكالمة
            </p>
          </div>
        </div>

        {/* Satisfaction Score */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <ChartBarIcon className="w-12 h-12 opacity-80" />
            <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
              شهري
            </span>
          </div>
          <h3 className="text-4xl font-bold mb-2">{satisfactionScore.toFixed(1)}%</h3>
          <p className="text-green-100 font-semibold">معدل رضا العملاء</p>
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-sm">
              {kpis?.surveys_completed || 0} استبيان مكتمل
            </p>
          </div>
        </div>

        {/* Retention Success Rate */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <ArrowTrendingUpIcon className="w-12 h-12 opacity-80" />
            <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
              شهري
            </span>
          </div>
          <h3 className="text-4xl font-bold mb-2">{retentionRate.toFixed(1)}%</h3>
          <p className="text-orange-100 font-semibold">معدل نجاح الاستعادة</p>
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-sm">
              {kpis?.retention_successes || 0} من {kpis?.retention_attempts || 0} محاولة
            </p>
          </div>
        </div>
      </div>

      {/* State Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          توزيع المتاجر حسب الحالة
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {kpis?.merchants_onboarding || 0}
            </p>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              قيد الاحتضان
            </p>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
              {kpis?.merchants_active || 0}
            </p>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              نشط
            </p>
          </div>
          <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
              {kpis?.merchants_retention || 0}
            </p>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              قيد الاستعادة
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-xl">
            <p className="text-3xl font-bold text-gray-600 dark:text-gray-400 mb-1">
              {kpis?.merchants_cold || 0}
            </p>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              بارد
            </p>
          </div>
        </div>
      </div>

      {/* 30-Min Response Violations */}
      {violations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <ClockIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                تجاوزات مهلة 30 دقيقة
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                متاجر جديدة لم يتم الاتصال بها خلال 30 دقيقة
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 font-bold text-gray-900 dark:text-white">
                    اسم المتجر
                  </th>
                  <th className="text-right py-3 px-4 font-bold text-gray-900 dark:text-white">
                    رقم الهاتف
                  </th>
                  <th className="text-right py-3 px-4 font-bold text-gray-900 dark:text-white">
                    وقت التسجيل
                  </th>
                  <th className="text-right py-3 px-4 font-bold text-gray-900 dark:text-white">
                    مضى (دقيقة)
                  </th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <tr key={v.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      {v.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      {v.phone}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      {new Date(v.registered_at).toLocaleString('ar-SA')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-3 py-1 rounded-full font-bold text-sm">
                        {v.minutes_since_registration} دقيقة
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
