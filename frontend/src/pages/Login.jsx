import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mic, Mail, Lock, LogIn, UserPlus, AlertCircle, ArrowRight, User } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0B3954]">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto w-16 h-16 neu-circle mb-4 shrink-0">
            <Mic className="w-8 h-8 text-[#BFD7EA]" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#FFFFFF] tracking-tight">VoiceForm</h1>
          <p className="text-sm text-[#BFD7EA] mt-2">
            Chatbot-Style Voice-Driven Form Filling in Tamil & English
          </p>
        </div>

        {/* Auth Card - Soft Extruded Surface */}
        <div className="neu-flat p-8">
          {/* Tab Switcher - Inset Soft Panel */}
          <div className="flex neu-inset p-1.5 mb-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                !isRegister ? 'neu-accent-button font-semibold' : 'text-[#BFD7EA] hover:text-[#FFFFFF]'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                isRegister ? 'neu-accent-button font-semibold' : 'text-[#BFD7EA] hover:text-[#FFFFFF]'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Register</span>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 neu-inset text-[#FF5A5F] text-xs flex items-start space-x-3 border-l-4 border-[#C81D25]">
              <AlertCircle className="w-4 h-4 text-[#FF5A5F] flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-[#BFD7EA] uppercase tracking-wider mb-2">
                  Username
                </label>
                <div className="relative neu-inset px-4 py-3 flex items-center space-x-3">
                  <User className="w-5 h-5 text-[#BFD7EA]/60 shrink-0" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    className="w-full bg-transparent text-[#FFFFFF] placeholder-[#BFD7EA]/40 focus:outline-none text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#BFD7EA] uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative neu-inset px-4 py-3 flex items-center space-x-3">
                <Mail className="w-5 h-5 text-[#BFD7EA]/60 shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-transparent text-[#FFFFFF] placeholder-[#BFD7EA]/40 focus:outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#BFD7EA] uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative neu-inset px-4 py-3 flex items-center space-x-3">
                <Lock className="w-5 h-5 text-[#BFD7EA]/60 shrink-0" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-[#FFFFFF] placeholder-[#BFD7EA]/40 focus:outline-none text-sm"
                />
              </div>
              {isRegister && (
                <p className="text-[11px] text-[#BFD7EA]/70 mt-1.5">
                  Must be at least 6 characters long.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 neu-accent-button font-semibold text-sm flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{submitting ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Preset Admin Credentials Hint */}
          <div className="mt-8 pt-6 border-t border-[#051B28]/50 text-center">
            <p className="text-xs font-mono text-[#BFD7EA] neu-inset py-2 px-4 inline-block tracking-wide">
              admin@voiceform.com / Admin@12345
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
