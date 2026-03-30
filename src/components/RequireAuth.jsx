import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        Yükleniyor…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
