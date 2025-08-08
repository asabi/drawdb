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
  const [availableDatabases, setAvailableDatabases] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (useBackendStorage && backendAvailable) {
      loadAvailableDatabases();
    }
  }, [useBackendStorage, backendAvailable]);

  // Listen for database settings changes
  useEffect(() => {
    const handleDatabaseSettingsChanged = () => {
      loadAvailableDatabases();
    };

    window.addEventListener('databaseSettingsChanged', handleDatabaseSettingsChanged);
    
    return () => {
      window.removeEventListener('databaseSettingsChanged', handleDatabaseSettingsChanged);
    };
  }, []);

  const loadAvailableDatabases = async () => {
    try {
      setLoading(true);
      
      // Get both configurations and current status
      const [configsResponse, statusResponse] = await Promise.all([
        fetch('http://localhost:3001/api/configs'),
        fetch('http://localhost:3001/api/settings/status')
      ]);
      
      const configs = await configsResponse.json();
      const status = await statusResponse.json();
      
      // Get the current active database engine
      const currentEngine = status.currentConfig?.engine || status.engine;
      
      // Transform configurations to the expected format
      const databases = configs.map(config => ({
        id: config.id,
        name: config.name,
        engine: config.engine,
        configured: config.configured,
        current: config.engine === currentEngine, // Use current engine from status
        is_default: config.is_default
      }));
      
      setAvailableDatabases(databases);
    } catch (error) {
      console.error('Failed to load available databases:', error);
      // Fallback to default databases
      setAvailableDatabases([
        {
          id: 'sqlite',
          name: 'SQLite (Default)',
          engine: 'sqlite',
          configured: true,
          current: true,
          is_default: true
        },
        {
          id: 'postgresql',
          name: 'PostgreSQL',
          engine: 'postgresql',
          configured: false,
          current: false,
          is_default: false
        },
        {
          id: 'mysql',
          name: 'MySQL',
          engine: 'mysql',
          configured: false,
          current: false,
          is_default: false
        }
      ]);
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

  const getCurrentDatabaseName = () => {
    if (!useBackendStorage || !backendAvailable) {
      return 'Local Storage';
    }
    
    const current = availableDatabases.find(db => db.current);
    if (current) {
      return current.name;
    }
    
    // Find default database
    const defaultDb = availableDatabases.find(db => db.is_default);
    if (defaultDb) {
      return defaultDb.name;
    }
    
    return 'SQLite (Default)';
  };

  const getCurrentDatabaseIcon = () => {
    if (!useBackendStorage || !backendAvailable) {
      return '💾';
    }
    
    const current = availableDatabases.find(db => db.current);
    if (current) {
      return getDatabaseIcon(current.engine);
    }
    
    // Find default database
    const defaultDb = availableDatabases.find(db => db.is_default);
    if (defaultDb) {
      return getDatabaseIcon(defaultDb.engine);
    }
    
    return getDatabaseIcon('sqlite');
  };

  const handleDatabaseSelect = async (database) => {
    console.log('handleDatabaseSelect called with:', database);
    
    if (!database.configured) {
      // If not configured, open settings modal
      console.log('Database not configured, opening settings');
      window.dispatchEvent(new CustomEvent('openDatabaseSettings'));
      return;
    }
    
    // If already current, do nothing
    if (database.current) {
      console.log('Database already current, doing nothing');
      return;
    }
    
    try {
      console.log('Attempting to connect to database:', database.engine);
      // Connect to the selected database
      const response = await fetch(`http://localhost:3001/api/configs/${database.engine}/connect`, {
        method: 'POST'
      });
      
      if (response.ok) {
        console.log('Successfully connected to database:', database.engine);
        // Switch to the selected database
        onDatabaseChange(database);
        
        // Reload available databases to update current status
        await loadAvailableDatabases();
        
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('databaseSettingsChanged'));
      } else {
        console.error('Failed to connect to database:', database.engine);
        const errorData = await response.json();
        alert(`Failed to connect to ${database.name}: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to switch database:', error);
      alert(`Failed to switch to ${database.name}: ${error.message}`);
    }
  };

  const menuItems = [
    {
      key: 'settings',
      name: t('database_settings'),
      icon: '⚙️',
      onClick: () => {
        window.dispatchEvent(new CustomEvent('openDatabaseSettings'));
      }
    },
    {
      key: 'divider',
      type: 'divider'
    },
    ...availableDatabases.map((db, index) => ({
      key: `db-${db.engine}-${db.id || index}`,
      name: db.configured ? db.name : `${db.name} (Not Configured)`,
      icon: db.current ? '✅' : getDatabaseIcon(db.engine),
      disabled: !db.configured,
      onClick: () => {
        console.log('Dropdown item clicked for database:', db);
        handleDatabaseSelect(db);
      }
    }))
  ];

  return (
    <Dropdown
      trigger="click"
      position="bottomLeft"
      style={{ width: '280px' }}
      render={
        <Dropdown.Menu>
          {menuItems.map((item, index) => (
            item.type === 'divider' ? (
              <Dropdown.Divider key={index} />
            ) : (
              <Dropdown.Item
                key={item.key}
                onClick={item.onClick}
                disabled={item.disabled || loading}
                style={{ 
                  opacity: item.disabled ? 0.6 : 1,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span>{item.name}</span>
              </Dropdown.Item>
            )
          ))}
        </Dropdown.Menu>
      }
    >
      <Button
        type="tertiary"
        theme="borderless"
        className="flex items-center gap-4 px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md min-w-0"
      >
        <span className="text-lg flex-shrink-0 mr-1">{getCurrentDatabaseIcon()}</span>
        <span className="text-sm font-medium truncate max-w-48">
          {getCurrentDatabaseName()}
        </span>
        <IconChevronDown size="small" className="flex-shrink-0" />
      </Button>
    </Dropdown>
  );
} 