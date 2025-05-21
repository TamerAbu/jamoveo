
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Instrument options organized by category
const instrumentCategories = [
  {
    label: "Singers",
    options: [
      { value: 'vocals', label: 'Vocals (Lyrics Only)' }
    ]
  },
  {
    label: "Instrumentalists",
    options: [
      { value: 'guitar', label: 'Guitar' },
      { value: 'bass', label: 'Bass' },
      { value: 'drums', label: 'Drums' },
      { value: 'keyboard', label: 'Keyboard' },
      { value: 'saxophone', label: 'Saxophone' },
      { value: 'other', label: 'Other Instrument' }
    ]
  }
];

// Input field component for reuse
const FormField = ({ type, id, name, placeholder, value, onChange, autoComplete }) => (
  <input
    id={id}
    name={name}
    type={type}
    autoComplete={autoComplete}
    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    required
  />
);

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password2: '',
    instrument: 'guitar',
    adminCode: ''
  });
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();
  
  const { name, email, password, password2, instrument, adminCode } = formData;
  
  // Handle input changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear errors on typing
    if (error) clearError();
    if (formError) setFormError('');
  };
  
  // Validate form before submission
  const validateForm = () => {
    if (!name || !email || !password || !instrument) {
      setFormError('Please fill in all required fields');
      return false;
    }

    if (password !== password2) {
      setFormError('Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return false;
    }

    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      const userData = {
        name,
        email,
        password,
        instrument,
        adminCode
      };

      await register(userData);
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      setFormError(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine which error to show
  const displayError = formError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Join JaMoveo
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              sign in to your account
            </Link>
          </p>
        </div>
        
        {displayError && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{displayError}</h3>
              </div>
            </div>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            {/* Username field */}
            <div>
              <FormField
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Username"
                value={name}
                onChange={handleChange}
              />
            </div>
            
            {/* Email field */}
            <div>
              <FormField
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={handleChange}
              />
            </div>
            
            {/* Password field */}
            <div>
              <FormField
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Password"
                value={password}
                onChange={handleChange}
              />
            </div>
            
            {/* Confirm password field */}
            <div>
              <FormField
                id="password2"
                name="password2"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm Password"
                value={password2}
                onChange={handleChange}
              />
            </div>

            {/* Admin code field (optional) */}
            <div>
              <input
                id="adminCode"
                name="adminCode"
                type="text"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Admin Code (optional)"
                value={adminCode}
                onChange={handleChange}
              />
            </div>

            {/* Instrument selection */}
            <div>
              <label htmlFor="instrument" className="sr-only">Instrument</label>
              <select
                id="instrument"
                name="instrument"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                value={instrument}
                onChange={handleChange}
              >
                {instrumentCategories.map((category) => (
                  <optgroup key={category.label} label={category.label}>
                    {category.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center">
            <div className="text-sm">
              <p className="text-gray-500">
                Note: Singers will only see lyrics, while instrumentalists will see both chords and lyrics.
              </p>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                isLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;