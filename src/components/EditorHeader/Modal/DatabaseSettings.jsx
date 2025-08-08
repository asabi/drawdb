import React, { useState, useEffect } from 'react';
import { Button, Card } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

export default function DatabaseSettings({ onClose }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    engine: 'sqlite',
    name: '',
    host: '',
    port: '',
    username: '',
    password: '',
    database: '',
    filePath: '',
    useSSL: false,
    useSSH: false,
    sshHost: '',
    sshPort: 22,
    sshUser: '',
    privateKey: '',
    passphrase: '',
    ca: '',
    cert: '',
    key: ''
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (status?.defaultSQLitePath && settings.engine === 'sqlite') {
      setSettings(prev => ({ ...prev, filePath: status.defaultSQLitePath }));
    }
  }, [status?.defaultSQLitePath, settings.engine]);

  const loadStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await fetch('http://localhost:3001/api/settings/status');
      const data = await response.json();
      setStatus(data);
      
      // Pre-populate with current configuration if available
      if (data.currentConfig) {
        setSettings(prev => ({
          ...prev,
          ...data.currentConfig,
          name: data.currentConfig.name || getDefaultName(data.currentConfig.engine)
        }));
      } else if (data.defaultConfig) {
        setSettings(prev => ({
          ...prev,
          ...data.defaultConfig,
          name: data.defaultConfig.name || getDefaultName(data.defaultConfig.engine)
        }));
      }
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  const getDefaultName = (engine) => {
    switch (engine) {
      case 'sqlite':
        return 'SQLite (Default)';
      case 'postgresql':
        return 'PostgreSQL';
      case 'mysql':
        return 'MySQL';
      default:
        return 'Database';
    }
  };

  const handleEngineChange = (engine) => {
    const newSettings = {
      ...settings,
      engine,
      name: getDefaultName(engine)
    };

    // Set default values based on engine
    if (engine === 'mysql') {
      newSettings.port = '3306';
      newSettings.username = 'root';
    } else if (engine === 'postgresql') {
      newSettings.port = '5432';
      newSettings.username = 'postgres';
    }

    setSettings(newSettings);
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const response = await fetch('http://localhost:3001/api/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Connection test successful!');
      } else {
        alert(`Connection test failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      alert('Connection test failed: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      
      // Save the configuration
      const saveResponse = await fetch('http://localhost:3001/api/configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...settings,
          configured: true,
          is_default: true // Make this the default
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save configuration');
      }

      // Apply the settings
      const applyResponse = await fetch('http://localhost:3001/api/settings/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const result = await applyResponse.json();
      
      if (result.success) {
        alert('Settings saved and applied successfully!');
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('databaseSettingsChanged'));
        onClose();
      } else {
        alert(`Failed to apply settings: ${result.message}`);
      }
    } catch (error) {
      console.error('Save settings error:', error);
      alert('Failed to save settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentDatabaseStatus = () => {
    if (!status) return 'Loading...';
    
    if (status.connected) {
      return `${status.engine.charAt(0).toUpperCase() + status.engine.slice(1)} (Connected)`;
    }
    
    if (status.defaultConfig?.configured) {
      return `${status.defaultConfig.engine.charAt(0).toUpperCase() + status.defaultConfig.engine.slice(1)} (Default)`;
    }
    
    return 'Not configured';
  };

  const getCurrentDatabaseStatusColor = () => {
    if (!status) return 'text-gray-400';
    
    if (status.connected) {
      return 'text-green-500';
    }
    
    if (status.defaultConfig?.configured) {
      return 'text-blue-500';
    }
    
    return 'text-red-500';
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-200 mb-4">
        {t('database_settings')}
      </h2>

      {/* Current Database Status */}
      <div className="mb-4">
        <div className="text-sm text-gray-400 mb-2">{t('current_database')}:</div>
        <div className={`text-sm font-medium ${getCurrentDatabaseStatusColor()}`}>
          {getCurrentDatabaseStatus()}
        </div>
      </div>

      {/* Database Engine Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {t('database_engine')}
        </label>
        <select
          value={settings.engine}
          onChange={(e) => handleEngineChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="sqlite">{t('sqlite')}</option>
          <option value="mysql">{t('mysql')}</option>
          <option value="postgresql">{t('postgresql')}</option>
        </select>
      </div>

      {/* Configuration Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Configuration Name
        </label>
        <input
          type="text"
          value={settings.name}
          onChange={(e) => setSettings({ ...settings, name: e.target.value })}
          placeholder="Enter configuration name"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* SQLite Configuration */}
      {settings.engine === 'sqlite' && (
        <Card className="mb-4">
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-2">
              {t('file_path')}
            </label>
            <input
              type="text"
              value={settings.filePath}
              onChange={(e) => setSettings({ ...settings, filePath: e.target.value })}
              placeholder={t('enter_file_path')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={statusLoading}
            />
            {statusLoading && (
              <div className="text-xs text-gray-500 mt-1">{t('loading')}...</div>
            )}
            {settings.filePath === status?.defaultSQLitePath && (
              <div className="text-xs text-green-500 mt-1">{t('default_path')}</div>
            )}
          </div>
        </Card>
      )}

      {/* MySQL/PostgreSQL Configuration */}
      {(settings.engine === 'mysql' || settings.engine === 'postgresql') && (
        <Card className="mb-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Host</label>
              <input
                type="text"
                value={settings.host || ''}
                onChange={(e) => setSettings({ ...settings, host: e.target.value })}
                placeholder="localhost"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Port</label>
              <input
                type="number"
                value={settings.port || ''}
                onChange={(e) => setSettings({ ...settings, port: e.target.value })}
                placeholder={settings.engine === 'mysql' ? '3306' : '5432'}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Username</label>
              <input
                type="text"
                value={settings.username || ''}
                onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                placeholder={settings.engine === 'mysql' ? 'root' : 'postgres'}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={settings.password || ''}
                onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                placeholder="Enter password"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Database</label>
            <input
              type="text"
              value={settings.database || ''}
              onChange={(e) => setSettings({ ...settings, database: e.target.value })}
              placeholder="Enter database name"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* SSL Configuration */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.useSSL}
                onChange={(e) => setSettings({ ...settings, useSSL: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-300">Use SSL/TLS</span>
            </label>
          </div>

          {/* SSH Configuration */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.useSSH}
                onChange={(e) => setSettings({ ...settings, useSSH: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-300">Use SSH Tunnel</span>
            </label>
          </div>

          {settings.useSSH && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">SSH Host</label>
                <input
                  type="text"
                  value={settings.sshHost || ''}
                  onChange={(e) => setSettings({ ...settings, sshHost: e.target.value })}
                  placeholder="SSH server host"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">SSH Port</label>
                <input
                  type="number"
                  value={settings.sshPort || 22}
                  onChange={(e) => setSettings({ ...settings, sshPort: parseInt(e.target.value) })}
                  placeholder="22"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {settings.useSSH && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">SSH Username</label>
              <input
                type="text"
                value={settings.sshUser || ''}
                onChange={(e) => setSettings({ ...settings, sshUser: e.target.value })}
                placeholder="SSH username"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {settings.useSSH && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Private Key</label>
              <textarea
                value={settings.privateKey || ''}
                onChange={(e) => setSettings({ ...settings, privateKey: e.target.value })}
                placeholder="SSH private key content"
                rows={4}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {settings.useSSH && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Passphrase</label>
              <input
                type="password"
                value={settings.passphrase || ''}
                onChange={(e) => setSettings({ ...settings, passphrase: e.target.value })}
                placeholder="Private key passphrase (if any)"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </Card>
      )}

      <div className="flex gap-3">
        <Button
          type="secondary"
          loading={testing}
          onClick={handleTestConnection}
          disabled={!settings.engine}
        >
          {t('test_connection')}
        </Button>
        <Button
          type="primary"
          loading={loading}
          onClick={handleSaveSettings}
          disabled={!settings.engine}
        >
          {t('save_settings')}
        </Button>
      </div>
    </div>
  );
} 