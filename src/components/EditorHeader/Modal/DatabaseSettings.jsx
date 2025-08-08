import React, { useState, useEffect } from 'react';
import { 
  Select, 
  Input, 
  Button, 
  Checkbox, 
  TextArea, 
  Toast,
  Spin,
  Typography,
  Space,
  Card
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function DatabaseSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  
  const [settings, setSettings] = useState({
    engine: 'sqlite',
    host: 'localhost',
    port: '',
    username: '',
    password: '',
    database: 'drawdb',
    filePath: 'server/drawdb.sqlite',
    useSSL: false,
    useSSH: false,
    sshHost: '',
    sshPort: '22',
    sshUser: '',
    privateKey: '',
    passphrase: '',
    ca: '',
    cert: '',
    key: ''
  });

  useEffect(() => {
    // Load current status
    loadStatus();
  }, []);

  // Update settings when status changes
  useEffect(() => {
    if (status?.defaultSQLitePath) {
      console.log('Updating filePath from status:', status.defaultSQLitePath);
      setSettings(prev => ({
        ...prev,
        filePath: status.defaultSQLitePath
      }));
    }
  }, [status]);

  const loadStatus = async () => {
    try {
      console.log('Loading database settings status...');
      setStatusLoading(true);
      const response = await fetch('http://localhost:3001/api/settings/status');
      const data = await response.json();
      console.log('Status data received:', data);
      setStatus(data);
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleEngineChange = (engine) => {
    setSettings({
      ...settings,
      engine,
      // Reset to appropriate defaults for the selected engine
      host: 'localhost',
      port: engine === 'mysql' ? '3306' : engine === 'postgresql' ? '5432' : '',
      username: engine === 'mysql' ? 'root' : engine === 'postgresql' ? 'postgres' : '',
      password: '',
      database: 'drawdb',
      filePath: engine === 'sqlite' ? (status?.defaultSQLitePath || 'server/drawdb.sqlite') : '',
      useSSL: false,
      useSSH: false,
      sshHost: '',
      sshPort: '22',
      sshUser: '',
      privateKey: '',
      passphrase: '',
      ca: '',
      cert: '',
      key: ''
    });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      console.log('Sending test connection request with settings:', settings);
      const response = await fetch('http://localhost:3001/api/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      if (response.ok) {
        Toast.success(t('connection_successful'));
      } else {
        Toast.error(`${t('connection_failed')}: ${result.details || result.error}`);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      Toast.error(`${t('connection_failed')}: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/settings/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const result = await response.json();
      
      if (response.ok) {
        Toast.success(t('settings_saved'));
        await loadStatus();
        // Notify other components that database settings have changed
        window.dispatchEvent(new CustomEvent('databaseSettingsChanged'));
      } else {
        Toast.error(`${t('connection_failed')}: ${result.details}`);
      }
    } catch (error) {
      Toast.error(`${t('connection_failed')}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderSQLiteFields = () => (
    <Card title={t('sqlite')} style={{ marginBottom: 16 }}>
      <Space vertical spacing="loose" style={{ width: '100%' }}>
        <Input
          label={t('file_path')}
          placeholder="/path/to/database.sqlite"
          value={statusLoading ? 'Loading...' : settings.filePath}
          onChange={(value) => setSettings(prev => ({ ...prev, filePath: value }))}
          helpText="This is the current default SQLite database location. You can change it to use a different file."
          suffix={
            settings.filePath === status?.defaultSQLitePath ? (
              <Text type="success" size="small">Default</Text>
            ) : null
          }
          disabled={statusLoading}
        />
      </Space>
    </Card>
  );

  const renderMySQLPostgresFields = () => (
    <Card title={settings.engine === 'mysql' ? t('mysql') : t('postgresql')} style={{ marginBottom: 16 }}>
      <Space vertical spacing="loose" style={{ width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label={t('host')}
            value={settings.host}
            onChange={(value) => setSettings(prev => ({ ...prev, host: value }))}
          />
          <Input
            label={t('port')}
            type="number"
            value={settings.port}
            onChange={(value) => setSettings(prev => ({ ...prev, port: parseInt(value) || 3306 }))}
          />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label={t('username')}
            value={settings.user}
            onChange={(value) => setSettings(prev => ({ ...prev, user: value }))}
          />
          <Input
            label={t('password')}
            type="password"
            value={settings.password}
            onChange={(value) => setSettings(prev => ({ ...prev, password: value }))}
          />
        </div>
        
        <Input
          label={t('database')}
          value={settings.database}
          onChange={(value) => setSettings(prev => ({ ...prev, database: value }))}
        />

        <Checkbox
          checked={settings.useSSL}
          onChange={(checked) => setSettings(prev => ({ ...prev, useSSL: checked }))}
        >
          {t('use_ssl')}
        </Checkbox>

        {settings.useSSL && (
          <Card title="SSL Configuration" style={{ marginTop: 16 }}>
            <Space vertical spacing="loose" style={{ width: '100%' }}>
              <TextArea
                label={t('ca_certificate')}
                placeholder="CA certificate content"
                value={settings.ca}
                onChange={(value) => setSettings(prev => ({ ...prev, ca: value }))}
                rows={3}
              />
              <TextArea
                label={t('client_certificate')}
                placeholder="Client certificate content"
                value={settings.cert}
                onChange={(value) => setSettings(prev => ({ ...prev, cert: value }))}
                rows={3}
              />
              <TextArea
                label={t('client_key')}
                placeholder="Client key content"
                value={settings.key}
                onChange={(value) => setSettings(prev => ({ ...prev, key: value }))}
                rows={3}
              />
            </Space>
          </Card>
        )}

        <Checkbox
          checked={settings.useSSH}
          onChange={(checked) => setSettings(prev => ({ ...prev, useSSH: checked }))}
        >
          {t('use_ssh_tunnel')}
        </Checkbox>

        {settings.useSSH && (
          <Card title="SSH Tunnel Configuration" style={{ marginTop: 16 }}>
            <Space vertical spacing="loose" style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Input
                  label={t('ssh_host')}
                  value={settings.sshHost}
                  onChange={(value) => setSettings(prev => ({ ...prev, sshHost: value }))}
                />
                <Input
                  label={t('ssh_port')}
                  type="number"
                  value={settings.sshPort}
                  onChange={(value) => setSettings(prev => ({ ...prev, sshPort: parseInt(value) || 22 }))}
                />
              </div>
              
              <Input
                label={t('ssh_username')}
                value={settings.sshUser}
                onChange={(value) => setSettings(prev => ({ ...prev, sshUser: value }))}
              />
              
              <TextArea
                label={t('private_key')}
                placeholder="SSH private key content"
                value={settings.privateKey}
                onChange={(value) => setSettings(prev => ({ ...prev, privateKey: value }))}
                rows={4}
              />
              
              <Input
                label={t('passphrase')}
                type="password"
                placeholder="SSH key passphrase (if any)"
                value={settings.passphrase}
                onChange={(value) => setSettings(prev => ({ ...prev, passphrase: value }))}
              />
            </Space>
          </Card>
        )}
      </Space>
    </Card>
  );

  const getCurrentDatabaseStatus = () => {
    if (status?.connected) {
      return `${status.engine} - ${status.database || 'Default'}`;
    }
    if (status?.engine === 'sqlite') {
      return 'SQLite (Default)';
    }
    return 'Not configured';
  };

  const getCurrentDatabaseStatusColor = () => {
    if (status?.connected) {
      return 'text-green-500';
    }
    if (status?.engine === 'sqlite') {
      return 'text-blue-500';
    }
    return 'text-orange-500';
  };

  return (
    <div style={{ maxWidth: 800 }}>
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

      {/* SQLite Configuration */}
      {settings.engine === 'sqlite' && (
        <Card className="mb-4">
          <div className="text-sm font-medium text-gray-300 mb-3">{t('sqlite')}</div>
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
          <div className="text-sm font-medium text-gray-300 mb-3">
            {settings.engine === 'mysql' ? t('mysql') : t('postgresql')}
          </div>
          
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
        </Card>
      )}

      {/* Action Buttons */}
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