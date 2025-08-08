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
    port: 3306,
    user: '',
    password: '',
    database: 'drawdb',
    filePath: 'server/drawdb.sqlite', // Fallback default
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

  const handleEngineChange = (value) => {
    setSettings(prev => ({
      ...prev,
      engine: value,
      port: value === 'mysql' ? 3306 : value === 'postgresql' ? 5432 : 3306
    }));
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

  return (
    <div style={{ maxWidth: 800 }}>
      {status && (
        <Card style={{ marginBottom: 16 }}>
          <Space vertical spacing="tight">
            <Text strong>{t('current_database')}:</Text>
            <div>
              {status.connected ? (
                <Text type="success">
                  {status.engine.toUpperCase()} - {status.database || 'Default'}
                </Text>
              ) : (
                <Text type="warning">{t('not_configured')}</Text>
              )}
            </div>
          </Space>
        </Card>
      )}

      <Space vertical spacing="loose" style={{ width: '100%' }}>
        <Select
          label={t('database_engine')}
          value={settings.engine}
          onChange={handleEngineChange}
          style={{ width: '100%' }}
        >
          <Select.Option value="sqlite">{t('sqlite')}</Select.Option>
          <Select.Option value="mysql">{t('mysql')}</Select.Option>
          <Select.Option value="postgresql">{t('postgresql')}</Select.Option>
        </Select>

        {settings.engine === 'sqlite' ? renderSQLiteFields() : renderMySQLPostgresFields()}

        <Space>
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
        </Space>
      </Space>
    </div>
  );
} 