import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ForgotPassword from './pages/ForgotPassword';

function PrivateRoute({ children, adminOnly }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !user.is_admin) return <Navigate to="/teacher" />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={
            <PrivateRoute adminOnly>
              <AdminDashboard />
            </PrivateRoute>
          } />
          <Route path="/teacher" element={
            <PrivateRoute>
              <TeacherDashboard />
            </PrivateRoute>
          } />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;
