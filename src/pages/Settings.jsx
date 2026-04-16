import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import '../styles/Settings.css';
import SettingsCard from '../components/SettingsCard';
import SettingRow from '../components/SettingRow';
import { getAuthMe } from '../api/authApi';
import { getApiBaseUrl } from '../config/api';
import { firebaseAuth } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import loadingDots from '../assets/loading-dots.svg';
import { downloadGdprPrivacyPdf } from '../utils/gdprPrivacyPdfExport';
import {
  getTablePageSize,
  setTablePageSize,
  TABLE_PAGE_SIZE_OPTIONS,
} from '../utils/adminPreferences';
import pkg from '../../package.json';

const CLIENT_SETTINGS_KEY = 'favo.admin.clientSettings.v1';

const AUTO_REJECT_OPTIONS = ['30', '50', '70'];

function normalizeAutoRejectThreshold(raw) {
  const s = raw != null ? String(raw).trim() : '';
  return AUTO_REJECT_OPTIONS.includes(s) ? s : '50';
}

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

function formatIsoDisplay(raw) {
  if (raw == null || raw === '') return '—';
  let d;
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    d = new Date(Number(raw.trim()));
  } else {
    d = new Date(raw);
  }
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function getEffectiveApiRootForDisplay() {
  const b = getApiBaseUrl();
  if (b) return b.replace(/\/$/, '');
  try {
    return new URL('/api', window.location.origin).href.replace(/\/$/, '');
  } catch {
    return `${window.location.origin}/api`;
  }
}

function getCopyableApiRoot() {
  const b = getApiBaseUrl();
  if (b) return b.replace(/\/$/, '');
  return `${window.location.origin.replace(/\/$/, '')}/api`;
}

function environmentModeLabel() {
  if (import.meta.env.PROD) return 'Production';
  if (import.meta.env.DEV) return 'Development';
  return import.meta.env.MODE || '—';
}

const Settings = () => {
  const { logout } = useAuth();
  const saved = loadClientSettings();
  const [spamSensitivity, setSpamSensitivity] = useState(saved?.spamSensitivity ?? 'high');
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(() =>
    normalizeAutoRejectThreshold(saved?.autoRejectThreshold)
  );
  const [dataRetention, setDataRetention] = useState(saved?.dataRetentionMonths ?? '36');
  const [tablePageSize, setTablePageSizeState] = useState(() => getTablePageSize());

  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState(null);

  const [pwStatus, setPwStatus] = useState({ kind: 'idle', message: '' });
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [copyApiStatus, setCopyApiStatus] = useState('idle');
  const [sessionTimes, setSessionTimes] = useState({
    memberSince: '—',
    lastSignIn: '—',
  });

  const regionInfo = useMemo(() => {
    let timeZone = '—';
    let language = '—';
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '—';
    } catch {
      /* ignore */
    }
    try {
      language = navigator.language || '—';
    } catch {
      /* ignore */
    }
    return { timeZone, language };
  }, []);

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

  useEffect(() => {
    if (!firebaseAuth) return undefined;
    function sync() {
      const u = firebaseAuth.currentUser;
      if (!u?.metadata) {
        setSessionTimes({ memberSince: '—', lastSignIn: '—' });
        return;
      }
      setSessionTimes({
        memberSince: formatIsoDisplay(u.metadata.creationTime),
        lastSignIn: formatIsoDisplay(u.metadata.lastSignInTime),
      });
    }
    sync();
    const unsub = onAuthStateChanged(firebaseAuth, sync);
    return () => unsub();
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

  const handleTablePageSizeChange = useCallback((e) => {
    const v = Number(e.target.value);
    setTablePageSize(v);
    setTablePageSizeState(v);
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

  const handleSignOut = useCallback(async () => {
    setSignOutBusy(true);
    try {
      await logout();
    } finally {
      setSignOutBusy(false);
    }
  }, [logout]);

  const handleCopyApiUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getCopyableApiRoot());
      setCopyApiStatus('ok');
      window.setTimeout(() => setCopyApiStatus('idle'), 2200);
    } catch {
      setCopyApiStatus('err');
      window.setTimeout(() => setCopyApiStatus('idle'), 2800);
    }
  }, []);

  const handleDownloadGdprPdf = useCallback(() => {
    downloadGdprPrivacyPdf({
      dataRetentionMonths: dataRetention,
      accountEmail: me?.email ?? null,
    });
  }, [dataRetention, me?.email]);

  const apiDisplay = getEffectiveApiRootForDisplay();

  return (
    <div className="settings-page">
      <div className="settings-page-inner">
        <header className="settings-header">
          <h2 className="settings-main-title">System settings</h2>
          <p className="settings-subtitle">
            Account security, workspace defaults, environment details, and privacy preferences for
            this browser.
          </p>
        </header>

        <div className="settings-account-row">
          <SettingsCard title="Account" className="settings-card--account">
            {meLoading ? (
              <div className="settings-loading" aria-live="polite" aria-busy="true">
                <img src={loadingDots} alt="" />
                <div className="settings-loading-text">Loading profile…</div>
              </div>
            ) : meError ? (
              <div role="alert" className="settings-alert settings-alert--error">
                Could not load profile: {meError}
              </div>
            ) : (
              <>
                <SettingRow label="Email" value={me?.email != null ? String(me.email) : '—'} />
                <SettingRow label="Role" value={formatUserType(me?.userType)} />
                <SettingRow label="Member since" value={sessionTimes.memberSince} />
                <SettingRow label="Last sign-in" value={sessionTimes.lastSignIn} />
                <div className="settings-actions settings-actions--split">
                  <button
                    type="button"
                    className="settings-btn settings-btn--primary"
                    onClick={handleChangePassword}
                  >
                    {pwStatus.kind === 'sending' ? 'Sending…' : 'Change password'}
                  </button>
                  <button
                    type="button"
                    className="settings-btn settings-btn--ghost"
                    onClick={handleSignOut}
                    disabled={signOutBusy}
                  >
                    {signOutBusy ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
                {pwStatus.kind === 'sent' && (
                  <p className="settings-alert settings-alert--success settings-alert--compact">
                    {pwStatus.message}
                  </p>
                )}
                {pwStatus.kind === 'error' && pwStatus.message && (
                  <p role="alert" className="settings-alert settings-alert--error settings-alert--compact">
                    {pwStatus.message}
                  </p>
                )}
              </>
            )}
          </SettingsCard>
        </div>

        <div className="settings-grid settings-grid--pair">
            <SettingsCard title="AI moderation">
              <p className="settings-hint">
                These preferences are stored in this browser only. They are not sent to the API yet
                and do not change live moderation behavior on the server.
              </p>
              <SettingRow label="Spam filter sensitivity">
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
              <SettingRow label="Auto-reject threshold">
                <select
                  className="settings-select"
                  aria-label="Auto-reject threshold"
                  value={autoRejectThreshold}
                  onChange={(e) => setAutoRejectThreshold(e.target.value)}
                >
                  <option value="30">30%</option>
                  <option value="50">50%</option>
                  <option value="70">70%</option>
                </select>
              </SettingRow>
              <div className="settings-actions">
                <button
                  type="button"
                  className="settings-btn settings-btn--secondary"
                  onClick={handleSaveAiSettings}
                >
                  Save AI settings
                </button>
              </div>
            </SettingsCard>

            <SettingsCard title={'GDPR & data privacy'}>
              <p className="settings-hint">
                Retention is saved in this browser. Download a PDF snapshot that reflects the
                selected user data retention period below. A full server-side compliance export is
                not yet available from the API.
              </p>
              <SettingRow label="User data retention">
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
              <div className="settings-actions">
                <button
                  type="button"
                  className="settings-btn settings-btn--secondary"
                  onClick={handleDownloadGdprPdf}
                >
                  Download GDPR & data privacy PDF
                </button>
              </div>
            </SettingsCard>
        </div>

        <div className="settings-grid settings-grid--row2">
          <SettingsCard title="System & environment">
            <p className="settings-hint">
              Read-only diagnostics for support and deployment checks. API base is where this app
              sends authenticated requests.
            </p>
            <SettingRow label="Application" value={`Favo Admin v${pkg.version}`} />
            <SettingRow label="Environment" value={environmentModeLabel()} />
            <SettingRow label="Time zone" value={regionInfo.timeZone} />
            <SettingRow label="Browser language" value={regionInfo.language} />
            <SettingRow label="API base URL">
              <div className="settings-inline-api">
                <code className="settings-code">{apiDisplay}</code>
                <button
                  type="button"
                  className="settings-btn settings-btn--mini"
                  onClick={handleCopyApiUrl}
                >
                  {copyApiStatus === 'ok' ? 'Copied' : copyApiStatus === 'err' ? 'Failed' : 'Copy'}
                </button>
              </div>
            </SettingRow>
          </SettingsCard>

          <SettingsCard title="Workspace">
            <p className="settings-hint">
              Default rows per page for Users, Products, and Moderation tables. Reload or revisit a
              list to apply after changing.
            </p>
            <SettingRow label="Table page size">
              <select
                className="settings-select"
                aria-label="Default table page size"
                value={String(tablePageSize)}
                onChange={handleTablePageSizeChange}
              >
                {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>
                    {n} rows
                  </option>
                ))}
              </select>
            </SettingRow>
            <SettingRow label="Shortcuts">
              <nav className="settings-quick-links" aria-label="Main admin sections">
                <Link className="settings-quick-link" to="/dashboard">
                  Dashboard
                </Link>
                <Link className="settings-quick-link" to="/users">
                  Users
                </Link>
                <Link className="settings-quick-link" to="/products">
                  Products
                </Link>
                <Link className="settings-quick-link" to="/moderation">
                  Moderation
                </Link>
              </nav>
            </SettingRow>
            <p className="settings-workspace-tip">
              PDF exports on list pages use the <strong>filters and columns</strong> you have selected
              there—switch filters before exporting to match what you need in the file.
            </p>
          </SettingsCard>
        </div>

        <footer className="settings-page-footer">
          <p className="settings-footer-line">
            <strong>Favo Admin Portal</strong> · v{pkg.version} · {environmentModeLabel()} build
          </p>
          <p className="settings-footer-hint">
            Use <kbd className="settings-kbd">Tab</kbd> to move between controls ·{' '}
            <kbd className="settings-kbd">Enter</kbd> activates buttons
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Settings;
