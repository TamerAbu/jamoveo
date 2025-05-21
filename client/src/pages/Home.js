
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Button component for reuse
const Button = ({ to, primary = true, children }) => (
  <Link
    to={to}
    className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md ${
      primary 
        ? 'text-white bg-primary-700 hover:bg-primary-800' 
        : 'text-primary-800 bg-white hover:bg-primary-50'
    }`}
  >
    {children}
  </Link>
);

const Home = () => {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-600 to-primary-800 flex flex-col justify-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
            JaMoveo
          </h1>
          <p className="mt-5 max-w-xl mx-auto text-xl text-primary-100">
            The ultimate band rehearsal management app
          </p>
          
          <div className="mt-8 flex justify-center">
            {currentUser ? (
              <Button to="/dashboard">Go to Dashboard</Button>
            ) : (
              <div className="space-x-4">
                <Button to="/login">Login</Button>
                <Button to="/register" primary={false}>Register</Button>
              </div>
            )}
          </div>
          
          {/* Navigation help */}
          <div className="mt-12 text-white">
            <p className="text-lg">
              New user? <Link to="/register" className="underline font-semibold">Register here</Link>
            </p>
            <p className="text-lg mt-2">
              Already have an account? <Link to="/login" className="underline font-semibold">Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;