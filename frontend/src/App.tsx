import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ConcertsPage } from './pages/customer/ConcertsPage';
import { ConcertDetailPage } from './pages/customer/ConcertDetailPage';
import { MyBookingsPage } from './pages/customer/MyBookingsPage';
import { BookingDetailPage } from './pages/customer/BookingDetailPage';
import { AdminConcertsPage } from './pages/operator/AdminConcertsPage';
import { AdminConcertDetailPage } from './pages/operator/AdminConcertDetailPage';
import { AdminConcertCreatePage } from './pages/operator/AdminConcertCreatePage';
import { AdminVouchersPage } from './pages/operator/AdminVouchersPage';
import { AdminBookingsPage } from './pages/operator/AdminBookingsPage';

function HomeRedirect() {
  const { user, isReady } = useAuth();
  if (!isReady) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Navigate to={user.role === 'OPERATOR' ? '/admin/concerts' : '/concerts'} replace />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />

          <Route
            path="/concerts"
            element={
              <ProtectedRoute role="CUSTOMER">
                <ConcertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/concerts/:id"
            element={
              <ProtectedRoute role="CUSTOMER">
                <ConcertDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute role="CUSTOMER">
                <MyBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings/:id"
            element={
              <ProtectedRoute role="CUSTOMER">
                <BookingDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/concerts"
            element={
              <ProtectedRoute role="OPERATOR">
                <AdminConcertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/concerts/new"
            element={
              <ProtectedRoute role="OPERATOR">
                <AdminConcertCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/concerts/:id"
            element={
              <ProtectedRoute role="OPERATOR">
                <AdminConcertDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/vouchers"
            element={
              <ProtectedRoute role="OPERATOR">
                <AdminVouchersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <ProtectedRoute role="OPERATOR">
                <AdminBookingsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
