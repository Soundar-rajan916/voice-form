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
    <div className="min-h-screen bg-[#DCE7E0] flex items-center justify-center p-4 sm:p-6 lg:p-8 text-[#2A2E2C]">
      <div className="w-full max-w-5xl bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg sheet-shadow overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Side: Plain Login/Register Form */}
        <div className="p-6 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#2A2E2C] tracking-tight">
                {brandConfig.appName}
              </h1>
              <p className="text-sm text-[#2A2E2C]/75 font-sans-ui mt-1">
                {brandConfig.hospitalName} patient intake portal
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-[#DCE7E0] p-1 rounded-md mb-6 font-sans-ui text-sm font-medium">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(''); }}
                className={`flex-1 py-2 rounded transition-colors flex items-center justify-center space-x-2 cursor-pointer ${
                  !isRegister ? 'bg-[#1F3FBF] text-[#F6F8F5] font-semibold' : 'text-[#2A2E2C] hover:text-[#1F3FBF]'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in</span>
              </button>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(''); }}
                className={`flex-1 py-2 rounded transition-colors flex items-center justify-center space-x-2 cursor-pointer ${
                  isRegister ? 'bg-[#1F3FBF] text-[#F6F8F5] font-semibold' : 'text-[#2A2E2C] hover:text-[#1F3FBF]'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Register</span>
              </button>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-[#F6F8F5] border-l-4 border-[#B3261E] text-[#B3261E] text-xs font-sans-ui flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 font-sans-ui">
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. priya_s"
                      className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-2 text-sm text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-2 text-sm text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-2 text-sm text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F6F8F5] font-semibold text-sm rounded transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer focus:ring-2 focus:ring-[#1F3FBF]"
              >
                <span>{submitting ? 'Processing...' : isRegister ? 'Create account' : 'Sign in'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-[#DCE7E0] text-xs text-[#2A2E2C]/75 font-sans-ui">
            <p>Demo hospital staff login: <code className="bg-[#DCE7E0] px-1.5 py-0.5 rounded text-[#2A2E2C]">admin@voiceform.com / Admin@12345</code></p>
          </div>
        </div>

        {/* Right Side: Static Miniature Registration Slip */}
        <div className="hidden md:flex bg-[#F6F8F5] border-l border-[#DCE7E0] p-8 flex-col justify-center select-none font-sans-ui">
          <div className="bg-[#F6F8F5] border border-[#DCE7E0] rounded p-6 sheet-shadow relative">
            <div className="border-b border-[#DCE7E0] pb-3 mb-4">
              <span className="text-[11px] font-semibold text-[#2A2E2C]/75 uppercase tracking-widest block">
                {brandConfig.hospitalName}
              </span>
              <h2 className="font-serif text-xl font-bold text-[#2A2E2C] mt-0.5">
                Registration slip
              </h2>
            </div>

            <div className="space-y-3 text-sm divide-y divide-[#DCE7E0]">
              <div className="pt-2">
                <span className="text-xs text-[#2A2E2C]/75 block uppercase tracking-wider">Full name / முழு பெயர்</span>
                <span className="text-[#1F3FBF] font-semibold text-base">Priya Soundararajan</span>
                <span className="block text-xs text-[#1F3FBF]/80 tamil-text" lang="ta">பிரியா சௌந்தரராஜன்</span>
              </div>

              <div className="pt-2">
                <span className="text-xs text-[#2A2E2C]/75 block uppercase tracking-wider">Age / வயது</span>
                <span className="text-[#1F3FBF] font-semibold">34</span>
              </div>

              <div className="pt-2">
                <span className="text-xs text-[#2A2E2C]/75 block uppercase tracking-wider">Gender / பாலினம்</span>
                <span className="text-[#1F3FBF] font-semibold">Female</span>
              </div>

              <div className="pt-2">
                <span className="text-xs text-[#2A2E2C]/75 block uppercase tracking-wider">Department / துறை</span>
                <span className="text-[#1F3FBF] font-semibold">General Medicine</span>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-[#DCE7E0] text-center text-xs text-[#2A2E2C]/75 italic">
              Sample registration entry
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
