import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">🎫 Concert Booking</div>
        <nav className="app-header__nav">
          {user?.role === 'CUSTOMER' && (
            <>
              <NavLink to="/concerts">Concerts</NavLink>
              <NavLink to="/bookings">My Bookings</NavLink>
            </>
          )}
          {user?.role === 'OPERATOR' && (
            <>
              <NavLink to="/admin/concerts">Concerts</NavLink>
              <NavLink to="/admin/vouchers">Vouchers</NavLink>
              <NavLink to="/admin/bookings">Bookings</NavLink>
            </>
          )}
        </nav>
        <div className="app-header__user">
          {user && (
            <>
              <span className="user-chip">
                {user.fullName} <span className="role-badge">{user.role}</span>
              </span>
              <button className="btn btn--ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
