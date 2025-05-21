
import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user from token on initial render
  useEffect(() => {
    loadUser();
  }, []);
  
  // Load user data from token
  const loadUser = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      setLoading(false);
      return null;
    }
    
    try {
      const res = await api.get('/auth/me');
      setCurrentUser(res.data.data);
      return res.data.data;
    } catch (err) {
      console.error('Error loading user:', err);
      localStorage.removeItem('token');
      setCurrentUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Register user
  const register = async (userData) => {
    try {
      setError(null);
      
      const res = await api.post('/auth/register', userData);
      
      if (res.data && res.data.token) {
        localStorage.setItem('token', res.data.token);
        await loadUser();
        return res.data;
      }
      
      throw new Error('Registration failed: No token received');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Registration failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Login user
  const login = async (userData) => {
    try {
      setError(null);
      
      const res = await api.post('/auth/login', userData);
      
      if (res.data && res.data.token) {
        localStorage.setItem('token', res.data.token);
        await loadUser();
        return res.data;
      }
      
      throw new Error('Login failed: No token received');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Invalid credentials';
      setError(errorMessage);
      throw err;
    }
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
  };

  // Clear authentication errors
  const clearError = () => {
    setError(null);
  };

  // Context value to provide
  const value = {
    currentUser,
    loading,
    error,
    register,
    login,
    logout,
    clearError,
    loadUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;