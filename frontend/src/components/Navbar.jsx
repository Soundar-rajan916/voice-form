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
    <nav className="bg-[#0B3954] border-b border-[#051B28]/60 sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand */}
          <div className="flex items-center space-x-8">
            <Link to={user.role === 'admin' ? '/admin' : '/user'} className="flex items-center space-x-3 group">
              <div className="w-12 h-12 neu-circle flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Mic className="w-6 h-6 text-[#BFD7EA]" />
              </div>
              <div>
                <span className="text-xl font-extrabold text-[#FFFFFF] tracking-tight">
                  VoiceForm
                </span>
                <span className="block text-[10px] font-mono text-[#BFD7EA] uppercase tracking-widest leading-none">
                  Tamil & English
                </span>
              </div>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center space-x-3">
              {user.role === 'admin' ? (
                <>
                  <Link
                    to="/admin"
                    className={`px-4 py-2 text-sm font-medium transition-all ${
                      location.pathname === '/admin'
                        ? 'neu-accent-button font-semibold'
                        : 'neu-button text-[#BFD7EA] hover:text-[#FFFFFF]'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/admin/builder/new"
                    className={`px-4 py-2 text-sm font-medium transition-all ${
                      location.pathname.startsWith('/admin/builder')
                        ? 'neu-accent-button font-semibold'
                        : 'neu-button text-[#BFD7EA] hover:text-[#FFFFFF]'
                    }`}
                  >
                    Create Form
                  </Link>
                </>
              ) : (
                <Link
                  to="/user"
                  className={`px-4 py-2 text-sm font-medium transition-all ${
                    location.pathname === '/user'
                      ? 'neu-accent-button font-semibold'
                      : 'neu-button text-[#BFD7EA] hover:text-[#FFFFFF]'
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
              <div className="flex items-center neu-inset p-1 text-xs font-medium">
                <Globe className="w-3.5 h-3.5 text-[#BFD7EA] ml-1.5 mr-1" />
                <button
                  onClick={() => setUiLang('en')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    uiLang === 'en' ? 'neu-accent-button font-semibold' : 'text-[#BFD7EA] hover:text-[#FFFFFF]'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setUiLang('ta')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    uiLang === 'ta' ? 'neu-accent-button font-semibold' : 'text-[#BFD7EA] hover:text-[#FFFFFF]'
                  }`}
                >
                  தமிழ்
                </button>
                <button
                  onClick={() => setUiLang('auto')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    uiLang === 'auto' ? 'neu-accent-button font-semibold' : 'text-[#BFD7EA] hover:text-[#FFFFFF]'
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
                className={`p-2.5 neu-button cursor-pointer ${
                  speechEnabled ? 'text-[#BFD7EA]' : 'text-[#BFD7EA]/40'
                }`}
              >
                {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}

            {/* User Profile info */}
            <div className="flex items-center space-x-3 pl-3 border-l border-[#051B28]/50">
              <span className="inline-flex items-center px-3 py-1 neu-pill text-xs font-semibold text-[#BFD7EA]">
                {user.role === 'admin' ? <Shield className="w-3 h-3 mr-1 text-[#087E8B]" /> : <UserIcon className="w-3 h-3 mr-1 text-[#087E8B]" />}
                {user.role}
              </span>
              <span className="hidden sm:inline text-xs text-[#BFD7EA] truncate max-w-[140px]">
                {user.username || user.email}
              </span>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2.5 neu-button text-[#BFD7EA] hover:text-[#FF5A5F] cursor-pointer"
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
