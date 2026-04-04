import { useCallback, useEffect, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import '../styles/Settings.css';
import SettingsCard from '../components/SettingsCard';
import SettingRow from '../components/SettingRow';
import { getAuthMe } from '../api/authApi';
import { firebaseAuth } from '../config/firebase';
import loadingDots from '../assets/loading-dots.svg';

const CLIENT_SETTINGS_KEY = 'favo.admin.clientSettings.v1';

function loadClientSettings() {
  try {
    const raw = localStorage.getItem(CLIENT_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveClientSettings(partial) {
  const prev = loadClientSettings() || {};
  localStorage.setItem(CLIENT_SETTINGS_KEY, JSON.stringify({ ...prev, ...partial }));
}

function formatUserType(userType) {
  if (userType == null || String(userType).trim() === '') return '—';
  let s = String(userType).trim();
  if (s.toUpperCase().startsWith('ROLE_')) {
    s = s.slice(5);
  }
  const upper = s.toUpperCase();
  if (upper === 'ADMIN') return 'Admin';
  if (upper === 'GENERAL_USER') return 'General user';
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

const Settings = () => {
  const saved = loadClientSettings();
  const [spamSensitivity, setSpamSensitivity] = useState(saved?.spamSensitivity ?? 'high');
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(saved?.autoRejectThreshold ?? '95');
  const [dataRetention, setDataRetention] = useState(saved?.dataRetentionMonths ?? '36');

  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState(null);

  const [pwStatus, setPwStatus] = useState({ kind: 'idle', message: '' });

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setMeLoading(true);
    setMeError(null);
    (async () => {
      try {
        const res = await getAuthMe({ signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Profile request failed (${res.status})`);
        }
        const dto = await res.json();
        if (!alive) return;
        setMe(dto);
      } catch (e) {
        if (!alive) return;
        if (e?.name === 'AbortError') return;
        setMe(null);
        setMeError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (alive) setMeLoading(false);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const handleSaveAiSettings = useCallback(() => {
    saveClientSettings({
      spamSensitivity,
      autoRejectThreshold,
    });
    setPwStatus({ kind: 'idle', message: '' });
  }, [spamSensitivity, autoRejectThreshold]);

  const handleDataRetentionChange = useCallback((e) => {
    const v = e.target.value;
    setDataRetention(v);
    saveClientSettings({ dataRetentionMonths: v });
  }, []);

  const handleChangePassword = useCallback(async () => {
    const auth = firebaseAuth;
    const email = auth?.currentUser?.email;
    if (!auth || !email) {
      setPwStatus({ kind: 'error', message: 'No signed-in user or email.' });
      return;
    }
    setPwStatus({ kind: 'sending', message: '' });
    try {
      await sendPasswordResetEmail(auth, email);
      setPwStatus({ kind: 'sent', message: 'Password reset email sent. Check your inbox.' });
    } catch (e) {
      setPwStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Could not send reset email.',
      });
    }
  }, []);

  const handleDownloadCompliance = useCallback(() => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            userDataRetentionMonths: Number(dataRetention) || null,
            accountEmail: me?.email ?? null,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `favo-retention-summary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dataRetention, me?.email]);

  return (
    <div className="settings-page">
      <h2 className="settings-main-title">System Settings</h2>

      <div className="settings-grid">
        <SettingsCard title="Account Settings">
          {meLoading ? (
            <div className="settings-loading" aria-live="polite" aria-busy="true">
              <img src={loadingDots} alt="" />
              <div className="settings-loading-text">Loading profile…</div>
            </div>
          ) : meError ? (
            <div role="alert" className="settings-inline-msg settings-inline-msg--error">
              Could not load profile: {meError}
            </div>
          ) : (
            <>
              <SettingRow label="Email:" value={me?.email != null ? String(me.email) : '—'} />
              <SettingRow label="Role:" value={formatUserType(me?.userType)} />
              <button type="button" className="settings-btn" onClick={handleChangePassword}>
                {pwStatus.kind === 'sending' ? 'Sending…' : 'Change Password'}
              </button>
              {pwStatus.kind === 'sent' && (
                <p className="settings-inline-msg settings-inline-msg--ok">{pwStatus.message}</p>
              )}
              {pwStatus.kind === 'error' && pwStatus.message && (
                <p role="alert" className="settings-inline-msg settings-inline-msg--error">
                  {pwStatus.message}
                </p>
              )}
            </>
          )}
        </SettingsCard>

        <div className="settings-column">
          <SettingsCard title="AI Moderation Settings">
            <p className="settings-hint">
              These preferences are stored in this browser until the API provides system settings.
            </p>
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
            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={handleSaveAiSettings}
            >
              Save AI Settings
            </button>
          </SettingsCard>

          <SettingsCard title="GDPR & Data Privacy">
            <p className="settings-hint">
              Retention is saved in this browser. A full server-side compliance export is not yet
              available from the API.
            </p>
            <SettingRow label="User Data Retention:">
              <select
                className="settings-select"
                aria-label="User data retention period"
                value={dataRetention}
                onChange={handleDataRetentionChange}
              >
                <option value="12">12 Months</option>
                <option value="24">24 Months</option>
                <option value="36">36 Months</option>
              </select>
            </SettingRow>
            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={handleDownloadCompliance}
            >
              Download Compliance Report
            </button>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
};

export default Settings;
