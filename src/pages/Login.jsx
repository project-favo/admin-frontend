import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import loginLogo from '../assets/login_logo.png';
import '../styles/Login.css';
import { useAuth } from '../hooks/useAuth';

function mapFirebaseAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

const Login = () => {
  const navigate = useNavigate();
  const { user, loading, authError, login, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    clearAuthError();
    try {
      await login(email, password);
    } catch (err) {
      const code = err?.code;
      setSubmitError(mapFirebaseAuthError(code));
    }
  };

  const displayError = submitError || authError;

  return (
    <div className="login-container">
      <div className="login-panel" role="main">
        <div className="login-brand">
          <img
            className="login-logo"
            src={loginLogo}
            alt="Favo"
            decoding="async"
          />
          <header className="login-header">
            <h1 className="login-title-main">FAVO Admin Portal</h1>
            <p className="login-title-sub">Please log in to your account</p>
          </header>
        </div>

        <form className="login-card" onSubmit={handleSubmit} noValidate>
          {displayError ? (
            <p className="login-error" role="alert">
              {displayError}
            </p>
          ) : null}

          <div className="input-field">
            <label className="input-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              className="input-box"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (submitError) setSubmitError(null);
              }}
              disabled={loading}
              required
            />
          </div>

          <div className="input-field">
            <label className="input-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="input-box"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (submitError) setSubmitError(null);
              }}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
