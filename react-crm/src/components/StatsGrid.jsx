import React from 'react';

const StatsGrid = ({ cards }) => {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      icon: 'bg-blue-500',
      text: 'text-blue-600 dark:text-blue-400'
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      icon: 'bg-green-500',
      text: 'text-green-600 dark:text-green-400'
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      icon: 'bg-red-500',
      text: 'text-red-600 dark:text-red-400'
    },
    yellow: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      icon: 'bg-yellow-500',
      text: 'text-yellow-600 dark:text-yellow-400'
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const colors = colorClasses[card.color] || colorClasses.blue;

        return (
          <div
            key={index}
            className={`${colors.bg} rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:-translate-y-1`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 ${colors.icon} rounded-xl flex items-center justify-center shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {card.value}
            </h3>
            
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
              {card.title}
            </p>
            
            <p className={`text-xs ${colors.text} font-medium`}>
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default StatsGrid;
