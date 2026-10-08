import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mic, LogOut, Shield, User as UserIcon, Volume2, VolumeX, Globe } from 'lucide-react';

export const Navbar = ({ uiLang = 'en', setUiLang, speechEnabled = true, setSpeechEnabled }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-8">
            <Link to={user.role === 'admin' ? '/admin' : '/user'} className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Mic className="w-5 h-5 text-indigo-400 group-hover:text-pink-400 transition-colors" />
                </div>
              </div>
              <div>
                <span className="text-xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  VoiceForm
                </span>
                <span className="block text-[10px] font-mono text-indigo-400 uppercase tracking-widest leading-none">
                  Tamil & English
                </span>
              </div>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center space-x-2">
              {user.role === 'admin' ? (
                <>
                  <Link
                    to="/admin"
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === '/admin'
                        ? 'bg-slate-800 text-indigo-400'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/admin/builder/new"
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname.startsWith('/admin/builder')
                        ? 'bg-slate-800 text-indigo-400'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    Create Form
                  </Link>
                </>
              ) : (
                <Link
                  to="/user"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/user'
                      ? 'bg-slate-800 text-indigo-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Published Forms
                </Link>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-4">
            {/* Language Selector */}
            {setUiLang && (
              <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700/60 text-xs font-medium">
                <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
                <button
                  onClick={() => setUiLang('en')}
                  className={`px-2 py-1 rounded transition-colors ${
                    uiLang === 'en' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setUiLang('ta')}
                  className={`px-2 py-1 rounded transition-colors ${
                    uiLang === 'ta' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  தமிழ்
                </button>
                <button
                  onClick={() => setUiLang('auto')}
                  className={`px-2 py-1 rounded transition-colors ${
                    uiLang === 'auto' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Auto
                </button>
              </div>
            )}

            {/* Speech Toggle */}
            {setSpeechEnabled && (
              <button
                onClick={() => setSpeechEnabled(!speechEnabled)}
                title={speechEnabled ? "Voice Output: Enabled" : "Voice Output: Disabled"}
                className={`p-2 rounded-lg border transition-colors ${
                  speechEnabled
                    ? 'bg-indigo-950/60 border-indigo-700/80 text-indigo-400 hover:bg-indigo-900/60'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}

            {/* User Profile info */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                user.role === 'admin'
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                  : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
              }`}>
                {user.role === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : <UserIcon className="w-3 h-3 mr-1" />}
                {user.role}
              </span>
              <span className="hidden sm:inline text-xs text-slate-300 truncate max-w-[140px]">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
