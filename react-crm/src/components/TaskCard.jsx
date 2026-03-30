import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CallModal from './CallModal';
import { 
  PhoneIcon, 
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const TaskCard = ({ task, onComplete }) => {
  const [showCallModal, setShowCallModal] = useState(false);

  const priorityColors = {
    critical: 'border-red-500 bg-red-50 dark:bg-red-900/10',
    high: 'border-orange-500 bg-orange-50 dark:bg-orange-900/10',
    normal: 'border-blue-500 bg-blue-50 dark:bg-blue-900/10',
    low: 'border-gray-500 bg-gray-50 dark:bg-gray-900/10'
  };

  const priorityBadges = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    normal: 'bg-blue-500 text-white',
    low: 'bg-gray-500 text-white'
  };

  const priorityLabels = {
    critical: 'حرج',
    high: 'عالي',
    normal: 'عادي',
    low: 'منخفض'
  };

  const taskTypeLabels = {
    day_0_immediate: 'يوم 0 - مكالمة فورية',
    day_3_followup: 'يوم 3 - متابعة',
    day_10_experience: 'يوم 10 - تقييم التجربة',
    day_14_graduation: 'يوم 14 - جاهز للتخريج',
    monthly_survey: 'استبيان شهري',
    retention_call_1: 'استعادة - محاولة 1',
    retention_call_2: 'استعادة - محاولة 2',
    retention_call_3: 'استعادة - محاولة 3 (أخيرة)'
  };

  const stateLabels = {
    onboarding: 'قيد الاحتضان',
    active: 'نشط',
    retention: 'قيد الاستعادة',
    cold: 'بارد'
  };

  const stateColors = {
    onboarding: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    retention: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    cold: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
  };

  const formatPhone = (phone) => {
    // Format for WhatsApp (remove leading 0, add country code)
    return phone.replace(/^0/, '966');
  };

  const openWhatsApp = () => {
    const waPhone = formatPhone(task.phone);
    const message = encodeURIComponent(`مرحباً ${task.merchant_name}، معك من شركة النورس للشحن`);
    window.open(`https://wa.me/${waPhone}?text=${message}`, '_blank');
  };

  const minutesSinceRegistration = task.minutes_since_registration || 0;
  const is30MinViolation = task.task_type === 'day_0_immediate' && minutesSinceRegistration > 30;

  return (
    <>
      <div className={`
        border-r-4 rounded-2xl p-6 shadow-lg transition-all duration-200 hover:shadow-xl
        ${priorityColors[task.priority]}
        ${task.status === 'completed' ? 'opacity-60' : ''}
      `}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {task.merchant_name}
              </h3>
              <span className={`
                px-3 py-1 rounded-full text-xs font-bold
                ${priorityBadges[task.priority]}
              `}>
                {priorityLabels[task.priority]}
              </span>
              <span className={`
                px-3 py-1 rounded-full text-xs font-bold
                ${stateColors[task.current_state]}
              `}>
                {stateLabels[task.current_state]}
              </span>
            </div>
            
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
              {taskTypeLabels[task.task_type]}
            </p>
            
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                📱 {task.phone}
              </span>
              {task.registered_at && (
                <span className="flex items-center gap-1">
                  📅 تسجيل: {new Date(task.registered_at).toLocaleDateString('ar-SA')}
                </span>
              )}
              {task.last_shipment_at && (
                <span className="flex items-center gap-1">
                  📦 آخر شحنة: {new Date(task.last_shipment_at).toLocaleDateString('ar-SA')}
                </span>
              )}
            </div>
          </div>

          {task.status === 'completed' && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircleIcon className="w-6 h-6" />
              <span className="font-semibold">مكتملة</span>
            </div>
          )}
        </div>

        {/* 30-Min Violation Alert */}
        {is30MinViolation && task.status === 'pending' && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border-r-4 border-red-500 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
              <ClockIcon className="w-5 h-5" />
              <span className="font-bold">تنبيه:</span>
              <span>تجاوز {minutesSinceRegistration} دقيقة من التسجيل (الحد 30 دقيقة)</span>
            </div>
          </div>
        )}

        {/* Script */}
        {task.script_template && (
          <div className="mb-4 p-4 bg-white/50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
              📝 السكريبت المقترح:
            </p>
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
              {task.script_template.replace('[الاسم]', task.merchant_name)}
            </p>
          </div>
        )}

        {/* Actions */}
        {task.status === 'pending' && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowCallModal(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <PhoneIcon className="w-5 h-5" />
              <span>إجراء المكالمة</span>
            </button>
            
            <button
              onClick={openWhatsApp}
              className="flex items-center justify-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              <span>واتساب</span>
            </button>

            <Link
              to={`/merchants/${task.merchant_id}`}
              className="flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
            >
              التفاصيل
            </Link>
          </div>
        )}
      </div>

      {/* Call Modal */}
      {showCallModal && (
        <CallModal
          task={task}
          onClose={() => setShowCallModal(false)}
          onComplete={onComplete}
        />
      )}
    </>
  );
};

export default TaskCard;
