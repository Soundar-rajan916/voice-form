import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { brandConfig } from '../brand';
import { AlertCircle, LogIn, UserPlus, ArrowRight } from 'lucide-react';

export const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      let loggedUser;
      if (isRegister) {
        loggedUser = await register(email, password, username);
      } else {
        loggedUser = await login(email, password);
      }

      if (loggedUser.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/user');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDEDE9] flex items-center justify-center p-4 sm:p-6 lg:p-8 text-[#23272F]">
      <div className="w-full max-w-md bg-[#F5EBE0] border border-[#D6CCC2] rounded-lg sheet-shadow p-6 sm:p-8 flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#23272F] tracking-tight">
              {brandConfig.appName}
            </h1>
            <p className="text-sm text-[#23272F]/75 font-sans-ui mt-1">
              {brandConfig.officeName || brandConfig.hospitalName} citizen service portal
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-[#D6CCC2] p-1 rounded-md mb-6 font-sans-ui text-sm font-medium">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 py-2 rounded transition-colors flex items-center justify-center space-x-2 cursor-pointer ${
                !isRegister ? 'bg-[#1F3FBF] text-[#F5EBE0] font-semibold' : 'text-[#23272F] hover:text-[#1F3FBF]'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign in</span>
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 py-2 rounded transition-colors flex items-center justify-center space-x-2 cursor-pointer ${
                isRegister ? 'bg-[#1F3FBF] text-[#F5EBE0] font-semibold' : 'text-[#23272F] hover:text-[#1F3FBF]'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Register</span>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-[#F5EBE0] border-l-4 border-[#B3261E] text-[#B3261E] text-xs font-sans-ui flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 font-sans-ui">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-[#23272F]/75 uppercase tracking-wider mb-1">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. priya_s"
                    className="w-full bg-[#F5EBE0] border border-[#D6CCC2] rounded px-3 py-2 text-sm text-[#23272F] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#23272F]/75 uppercase tracking-wider mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@example.com"
                className="w-full bg-[#F5EBE0] border border-[#D6CCC2] rounded px-3 py-2 text-sm text-[#23272F] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#23272F]/75 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F5EBE0] border border-[#D6CCC2] rounded px-3 py-2 text-sm text-[#23272F] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F5EBE0] font-semibold text-sm rounded transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer focus:ring-2 focus:ring-[#1F3FBF]"
            >
              <span>{submitting ? 'Processing...' : isRegister ? 'Create account' : 'Sign in'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-8 pt-4 border-t border-[#D6CCC2] text-xs text-[#23272F]/75 font-sans-ui">
          <p>Demo administrator login: <code className="bg-[#D6CCC2] px-1.5 py-0.5 rounded text-[#23272F]">admin@voiceform.com / Admin@12345</code></p>
        </div>
      </div>
    </div>
  );
};
