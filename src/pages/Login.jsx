import { useNavigate } from 'react-router-dom';
import loginLogo from '../assets/login_logo.png';
import '../styles/Login.css';

const Login = () => {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="login-container">
      <div className="login-center">
        <header className="login-header">
          <h1 className="login-title-main">FAVO Admin Portal</h1>
          <p className="login-title-sub">Please log in to your account</p>
        </header>

        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <div className="input-field">
            <label className="input-label" htmlFor="login-email">
              Email Address or Username
            </label>
            <input
              id="login-email"
              className="input-box"
              type="text"
              autoComplete="username"
              placeholder="Enter your email..."
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
              placeholder="******"
            />
          </div>

          <button type="submit" className="login-button">
            Log in
          </button>
        </form>
      </div>

      <img className="login-logo" src={loginLogo} alt="Favo Logo" />
    </div>
  );
};

export default Login;
