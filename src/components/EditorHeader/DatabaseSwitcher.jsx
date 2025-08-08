import React, { useState, useEffect } from 'react';
import { Dropdown, Button, Tooltip } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { IconChevronDown } from '@douyinfe/semi-icons';

export default function DatabaseSwitcher({ 
  currentDatabase, 
  onDatabaseChange, 
  useBackendStorage, 
  backendAvailable 
}) {
  const { t } = useTranslation();
  const [recentDatabases, setRecentDatabases] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (useBackendStorage && backendAvailable) {
      loadRecentDatabases();
    }
  }, [useBackendStorage, backendAvailable]);

  const loadRecentDatabases = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/settings/status');
      const data = await response.json();
      
      if (data.connected) {
        setRecentDatabases([
          {
            id: 'current',
            name: data.database || 'Default',
            engine: data.engine,
            type: 'current'
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load recent databases:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDatabaseIcon = (engine) => {
    switch (engine) {
      case 'sqlite':
        return '🗄️';
      case 'postgresql':
        return '🐘';
      case 'mysql':
        return '🐬';
      default:
        return '🗄️';
    }
  };

  const getDatabaseColor = (engine) => {
    switch (engine) {
      case 'sqlite':
        return 'text-blue-500';
      case 'postgresql':
        return 'text-green-500';
      case 'mysql':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  const getDatabaseName = () => {
    if (!useBackendStorage || !backendAvailable) {
      return 'Local Storage';
    }
    
    if (currentDatabase?.engine && currentDatabase?.database) {
      return `${currentDatabase.engine.toUpperCase()} - ${currentDatabase.database}`;
    }
    
    return 'Not Connected';
  };

  const getDatabaseIconForCurrent = () => {
    if (!useBackendStorage || !backendAvailable) {
      return '💾';
    }
    
    return getDatabaseIcon(currentDatabase?.engine || 'sqlite');
  };

  const menuItems = [
    {
      key: 'settings',
      name: t('database_settings'),
      icon: '⚙️',
      onClick: () => {
        // Trigger database settings modal
        window.dispatchEvent(new CustomEvent('openDatabaseSettings'));
      }
    },
    {
      key: 'divider',
      type: 'divider'
    },
    ...recentDatabases.map(db => ({
      key: db.id,
      name: `${getDatabaseIcon(db.engine)} ${db.name}`,
      icon: db.type === 'current' ? '✅' : '',
      onClick: () => onDatabaseChange(db)
    }))
  ];

  return (
    <Dropdown
      trigger="click"
      position="bottomLeft"
      render={
        <Dropdown.Menu>
          {menuItems.map((item, index) => (
            item.type === 'divider' ? (
              <Dropdown.Divider key={index} />
            ) : (
              <Dropdown.Item
                key={item.key}
                onClick={item.onClick}
                icon={item.icon}
                disabled={loading}
              >
                {item.name}
              </Dropdown.Item>
            )
          ))}
        </Dropdown.Menu>
      }
    >
      <Tooltip content={t('switch_database')} position="bottom">
        <Button
          type="tertiary"
          theme="borderless"
          className="flex items-center gap-2 px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
        >
          <span className="text-lg">{getDatabaseIconForCurrent()}</span>
          <span className="text-sm font-medium truncate max-w-32">
            {getDatabaseName()}
          </span>
          <IconChevronDown size="small" />
        </Button>
      </Tooltip>
    </Dropdown>
  );
} 