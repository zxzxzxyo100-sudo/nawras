import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TaskCard from '../components/TaskCard';
import StatsGrid from '../components/StatsGrid';
import api from '../services/api';
import { 
  ClockIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

const OfficerDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    overdue: 0,
    critical: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, completed

  useEffect(() => {
    loadTodaysTasks();
  }, []);

  const loadTodaysTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tasks/today');
      setTasks(response.data);
      
      // Calculate stats
      const pending = response.data.filter(t => t.status === 'pending').length;
      const completed = response.data.filter(t => t.status === 'completed').length;
      const overdue = response.data.filter(t => t.status === 'overdue').length;
      const critical = response.data.filter(t => t.priority === 'critical' && t.status === 'pending').length;
      
      setStats({ pending, completed, overdue, critical });
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskComplete = async (taskId) => {
    // Task completed - reload list
    await loadTodaysTasks();
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'pending') return task.status === 'pending';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  const statsCards = [
    {
      title: 'مهام معلقة',
      value: stats.pending,
      icon: ClockIcon,
      color: 'blue',
      subtitle: 'تحتاج إجراء اليوم'
    },
    {
      title: 'مهام مكتملة',
      value: stats.completed,
      icon: CheckCircleIcon,
      color: 'green',
      subtitle: 'تمت اليوم'
    },
    {
      title: 'مهام متأخرة',
      value: stats.overdue,
      icon: ExclamationTriangleIcon,
      color: 'red',
      subtitle: 'تحتاج متابعة فورية'
    },
    {
      title: 'مهام حرجة',
      value: stats.critical,
      icon: ExclamationTriangleIcon,
      color: 'yellow',
      subtitle: 'أولوية قصوى'
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          مهام اليوم
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {new Date().toLocaleDateString('ar-SA', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Stats Grid */}
      <StatsGrid cards={statsCards} />

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-6 py-2 rounded-xl font-semibold transition-all duration-200 ${
            filter === 'all'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          الكل ({tasks.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-6 py-2 rounded-xl font-semibold transition-all duration-200 ${
            filter === 'pending'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          معلقة ({stats.pending})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-6 py-2 rounded-xl font-semibold transition-all duration-200 ${
            filter === 'completed'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          مكتملة ({stats.completed})
        </button>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">جاري تحميل المهام...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-lg">
          <div className="text-6xl mb-4">✨</div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            رائع! لا توجد مهام
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {filter === 'completed' 
              ? 'لم تكمل أي مهام بعد اليوم'
              : 'جميع مهامك مكتملة لهذا اليوم'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onComplete={handleTaskComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default OfficerDashboard;
