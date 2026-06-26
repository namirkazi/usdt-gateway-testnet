// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin]       = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('gateway_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(res => setAdmin(res.data.data.admin))
      .catch(() => localStorage.removeItem('gateway_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await authApi.login(username, password);
    const { token, admin } = res.data.data;
    localStorage.setItem('gateway_token', token);
    setAdmin(admin);
    return admin;
  };

  const logout = () => {
    localStorage.removeItem('gateway_token');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
