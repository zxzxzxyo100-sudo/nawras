import React, { useState } from 'react';
import api from '../services/api';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const CallModal = ({ task, onClose, onComplete }) => {
  const [formData, setFormData] = useState({
    callOutcome: '',
    nawrasNote: '',
    surveyData: task.task_type === 'monthly_survey' ? {
      speed: 0,
      finance: 0,
      support: 0,
      returns: 0,
      trust: 0
    } : null
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSurvey = task.task_type === 'monthly_survey';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate Nawras Note (MANDATORY)
    if (!formData.nawrasNote.trim()) {
      setError('ملاحظة النورس إلزامية! يجب كتابة ملاحظة تفصيلية عن المكالمة');
      return;
    }

    if (formData.nawrasNote.trim().length < 10) {
      setError('ملاحظة النورس يجب أن تكون 10 أحرف على الأقل');
      return;
    }

    // Validate survey if needed
    if (isSurvey) {
      const allRated = Object.values(formData.surveyData).every(v => v > 0);
      if (!allRated) {
        setError('يجب تقييم جميع الأسئلة الخمسة!');
        return;
      }
    }

    try {
      setLoading(true);
      setError('');

      // Submit call log
      const callData = {
        merchantId: task.merchant_id,
        taskId: task.id,
        callType: task.task_type.includes('retention') ? 'retention' 
                  : task.task_type.includes('survey') ? 'survey' 
                  : 'onboarding',
        callOutcome: formData.callOutcome,
        nawrasNote: formData.nawrasNote,
        surveyData: isSurvey ? formData.surveyData : null
      };

      await api.post('/calls', callData);

      // Mark task as complete
      await api.patch(`/tasks/${task.id}/complete`, {
        callLogId: callData.id // Will be returned from API
      });

      onComplete(task.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء حفظ المكالمة');
    } finally {
      setLoading(false);
    }
  };

  const surveyQuestions = [
    { key: 'speed', label: '1. سرعة التوصيل' },
    { key: 'finance', label: '2. التعامل المالي' },
    { key: 'support', label: '3. الدعم الفني' },
    { key: 'returns', label: '4. حالة المرجوعات' },
    { key: 'trust', label: '5. ثقة المناديب' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">تسجيل مكالمة</h2>
            <p className="text-blue-100 text-sm mt-1">{task.merchant_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 border-r-4 border-red-500 rounded-lg flex items-start gap-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-300 font-semibold">{error}</p>
            </div>
          )}

          {/* Call Outcome */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              نتيجة المكالمة *
            </label>
            <select
              value={formData.callOutcome}
              onChange={(e) => setFormData({ ...formData, callOutcome: e.target.value })}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
            >
              <option value="">اختر النتيجة</option>
              <option value="answered">تم الرد</option>
              <option value="no_answer">لم يرد</option>
              <option value="busy">مشغول</option>
              <option value="callback_requested">طلب إعادة الاتصال</option>
            </select>
          </div>

          {/* Survey Questions (if monthly survey) */}
          {isSurvey && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">
                استبيان الرضا (5 أسئلة إلزامية)
              </h3>
              
              {surveyQuestions.map((q) => (
                <div key={q.key}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {q.label}
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          surveyData: { ...formData.surveyData, [q.key]: rating }
                        })}
                        className={`
                          flex-1 py-3 rounded-xl font-bold transition-all duration-200
                          ${formData.surveyData[q.key] === rating
                            ? 'bg-green-500 text-white shadow-lg scale-105'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }
                        `}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nawras Note (MANDATORY) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              ملاحظة النورس * (إلزامي)
            </label>
            <div className="relative">
              <textarea
                value={formData.nawrasNote}
                onChange={(e) => setFormData({ ...formData, nawrasNote: e.target.value })}
                required
                rows={5}
                placeholder="اكتب ملاحظة تفصيلية عن المكالمة... (هذا الحقل إلزامي ولا يمكن الحفظ بدونه)"
                className="w-full px-4 py-3 border-2 border-blue-300 dark:border-blue-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all resize-none"
              />
              <div className="absolute bottom-3 left-3 text-sm text-gray-500 dark:text-gray-400">
                {formData.nawrasNote.length} / 10 أحرف كحد أدنى
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              💡 <strong>مهم:</strong> هذه الملاحظة ستبقى مع ملف التاجر للأبد وسيقرأها أي موظف يستلم الملف لاحقاً
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  جاري الحفظ...
                </span>
              ) : (
                '💾 حفظ المكالمة'
              )}
            </button>
            
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-all duration-200"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CallModal;
