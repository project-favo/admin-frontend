import { useState } from 'react';
import '../styles/Settings.css';
import SettingsCard from '../components/SettingsCard';
import SettingRow from '../components/SettingRow';

const MOCK_ACCOUNT = {
  username: 'ozgetontu',
  email: 'ozgetontu@favo.com',
  role: 'Admin',
};

const Settings = () => {
  const [spamSensitivity, setSpamSensitivity] = useState('high');
  const [autoRejectThreshold, setAutoRejectThreshold] = useState('95');
  const [dataRetention, setDataRetention] = useState('36');

  return (
    <div className="settings-page">
      <h2 className="settings-main-title">System Settings</h2>

      <div className="settings-grid">
        <SettingsCard title="Account Settings">
          <SettingRow label="Username:" value={MOCK_ACCOUNT.username} />
          <SettingRow label="Email:" value={MOCK_ACCOUNT.email} />
          <SettingRow label="Role:" value={MOCK_ACCOUNT.role} />
          <button type="button" className="settings-btn">
            Change Password
          </button>
        </SettingsCard>

        <div className="settings-column">
          <SettingsCard title="AI Moderation Settings">
            <SettingRow label="Spam Filter Sensitivity:">
              <select
                className="settings-select"
                aria-label="Spam filter sensitivity"
                value={spamSensitivity}
                onChange={(e) => setSpamSensitivity(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </SettingRow>
            <SettingRow label="Auto-Reject Threshold:">
              <select
                className="settings-select"
                aria-label="Auto-reject threshold"
                value={autoRejectThreshold}
                onChange={(e) => setAutoRejectThreshold(e.target.value)}
              >
                <option value="80">80%</option>
                <option value="85">85%</option>
                <option value="90">90%</option>
                <option value="95">95%</option>
              </select>
            </SettingRow>
            <button type="button" className="settings-btn settings-btn--secondary">
              Save AI Settings
            </button>
          </SettingsCard>

          <SettingsCard title="GDPR & Data Privacy">
            <SettingRow label="User Data Retention:">
              <select
                className="settings-select"
                aria-label="User data retention period"
                value={dataRetention}
                onChange={(e) => setDataRetention(e.target.value)}
              >
                <option value="12">12 Months</option>
                <option value="24">24 Months</option>
                <option value="36">36 Months</option>
              </select>
            </SettingRow>
            <button type="button" className="settings-btn settings-btn--secondary">
              Download Compliance Report
            </button>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
};

export default Settings;
