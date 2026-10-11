import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { brandConfig, getRoleLabel } from '../brand';
import { LogOut, Volume2, VolumeX } from 'lucide-react';

export const Navbar = ({ uiLang = 'en', setUiLang, speechEnabled = true, setSpeechEnabled }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const roleLabel = getRoleLabel(user.role);

  return (
    <nav className="bg-[#F5EBE0] border-b border-[#D6CCC2] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Header */}
          <div className="flex items-center space-x-6 sm:space-x-8">
            <Link to={user.role === 'admin' ? '/admin' : '/user'} className="flex flex-col group">
              <span className="text-xl font-bold font-serif text-[#23272F] tracking-tight group-hover:text-[#1F3FBF] transition-colors">
                {brandConfig.appName}
              </span>
              <span className="text-xs text-[#23272F]/75 font-sans-ui leading-none">
                {brandConfig.officeName}
              </span>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center space-x-2 font-sans-ui text-sm">
              {user.role === 'admin' && (
                <>
                  <Link
                    to="/admin"
                    className={`px-3 py-1.5 font-medium rounded transition-colors ${
                      location.pathname === '/admin'
                        ? 'bg-[#1F3FBF] text-[#F5EBE0]'
                        : 'text-[#23272F] hover:bg-[#E3D5CA]'
                    }`}
                  >
                    Forms
                  </Link>
                  <Link
                    to="/admin/builder/new"
                    className={`px-3 py-1.5 font-medium rounded transition-colors ${
                      location.pathname.startsWith('/admin/builder')
                        ? 'bg-[#1F3FBF] text-[#F5EBE0]'
                        : 'text-[#23272F] hover:bg-[#E3D5CA]'
                    }`}
                  >
                    Create Form
                  </Link>
                </>
              )}

              {user.role !== 'admin' && (
                <>
                  <Link
                    to="/user"
                    className={`px-3 py-1.5 font-medium rounded transition-colors ${
                      location.pathname === '/user'
                        ? 'bg-[#1F3FBF] text-[#F5EBE0]'
                        : 'text-[#23272F] hover:bg-[#E3D5CA]'
                    }`}
                  >
                    Forms
                  </Link>
                  <a
                    href="#my-submissions"
                    className="px-3 py-1.5 font-medium text-[#23272F] hover:bg-[#E3D5CA] rounded transition-colors"
                  >
                    My Applications
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Language Segmented Control */}
            {setUiLang && (
              <div className="flex items-center bg-[#D6CCC2] p-0.5 rounded text-xs font-sans-ui">
                <button
                  type="button"
                  onClick={() => setUiLang('en')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    uiLang === 'en'
                      ? 'bg-[#1F3FBF] text-[#F5EBE0] font-semibold'
                      : 'text-[#23272F] hover:text-[#1F3FBF]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setUiLang('ta')}
                  lang="ta"
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    uiLang === 'ta'
                      ? 'bg-[#1F3FBF] text-[#F5EBE0] font-semibold'
                      : 'text-[#23272F] hover:text-[#1F3FBF]'
                  }`}
                >
                  தமிழ்
                </button>
                <button
                  type="button"
                  onClick={() => setUiLang('auto')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    uiLang === 'auto'
                      ? 'bg-[#1F3FBF] text-[#F5EBE0] font-semibold'
                      : 'text-[#23272F] hover:text-[#1F3FBF]'
                  }`}
                >
                  Auto
                </button>
              </div>
            )}

            {/* Speech Toggle Labelled Switch */}
            {setSpeechEnabled && (
              <label className="hidden sm:flex items-center space-x-2 text-xs text-[#23272F]/75 cursor-pointer font-sans-ui select-none">
                <input
                  type="checkbox"
                  checked={speechEnabled}
                  onChange={(e) => setSpeechEnabled(e.target.checked)}
                  className="rounded border-[#D6CCC2] text-[#1F3FBF] focus:ring-[#1F3FBF]"
                />
                <span className="flex items-center space-x-1">
                  {speechEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#1F3FBF]" /> : <VolumeX className="w-3.5 h-3.5 text-[#23272F]/60" />}
                  <span>Read questions aloud</span>
                </span>
              </label>
            )}

            {/* Account Menu */}
            <div className="flex items-center space-x-2 pl-2 border-l border-[#D6CCC2] font-sans-ui">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-[#23272F] truncate max-w-[120px] sm:max-w-[160px]">
                  {user.email || user.username}
                </span>
                <span className="text-[11px] text-[#23272F]/75">
                  {roleLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Log out"
                aria-label="Log out"
                className="p-2 text-[#23272F]/75 hover:text-[#B3261E] rounded focus:outline-none focus:ring-2 focus:ring-[#1F3FBF] transition-colors cursor-pointer"
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
