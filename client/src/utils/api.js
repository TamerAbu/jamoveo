// src/utils/api.js - Fix for API interceptor
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  }
});

// Attach the JWT (if any) to every outgoing request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Critical fix for the 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Special case: NEVER do any redirects for auth endpoints
    const isAuthEndpoint = 
      error.config && (
        error.config.url.includes('/auth/login') || 
        error.config.url.includes('/auth/register')
      );
    
    if (isAuthEndpoint) {
      // For auth endpoints, just pass through the error with no redirects
      return Promise.reject(error);
    }
    
    // For non-auth endpoints, handle 401 errors
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      
      // Don't redirect if already on login or register
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        localStorage.removeItem('token');
        
        // Use the navigate function if available, or fallback to direct URL change
        if (window.reactNavigate) {
          window.reactNavigate('/login');
        } else {
          // Simple redirect without changing URL to avoid 404
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  },
);

export default api;