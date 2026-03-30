import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { isFirebaseConfigured } from './config/firebase';
import { AuthProvider } from './context/AuthProvider';
import AdminLayout from './components/AdminLayout';
import RequireAuth from './components/RequireAuth';
import FirebaseConfigMissing from './components/FirebaseConfigMissing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Products from './pages/Products';
import Moderation from './pages/Moderation';
import Settings from './pages/Settings';

function App() {
  if (!isFirebaseConfigured()) {
    return <FirebaseConfigMissing />;
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route element={<AdminLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/products" element={<Products />} />
              <Route path="/moderation" element={<Moderation />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;