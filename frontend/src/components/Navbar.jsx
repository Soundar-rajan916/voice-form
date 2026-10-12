import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { brandConfig } from '../brand';
import { getTranslation } from '../i18n';
import { LogOut, Volume2, VolumeX, User as UserIcon } from 'lucide-react';

export const Navbar = ({ uiLang = 'en', setUiLang, speechEnabled = true, setSpeechEnabled }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const t = (key, params) => getTranslation(uiLang, key, params);
  const displayName = user.username || (user.email ? user.email.split('@')[0] : 'Citizen');
  const isAdmin = user.role === 'admin';

  return (
    <nav aria-label="Main Navigation" className="bg-[#F5EBE0] border-b border-[#D6CCC2] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Header */}
          <div className="flex items-center space-x-6 sm:space-x-8">
            <Link
              to={isAdmin ? '/admin' : '/user'}
              className="flex flex-col group focus-visible:outline-2 focus-visible:outline-[#1F3FBF] rounded-sm"
              aria-label={`${brandConfig.appName} home`}
            >
              <span className="text-xl sm:text-2xl font-bold font-display text-[#1C1917] tracking-tight group-hover:text-[#1F3FBF] transition-colors brand-logo">
                {brandConfig.appName}
              </span>
              <span className="text-sm text-[#524E4A] font-body leading-none">
                {brandConfig.officeName}
              </span>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center space-x-2 text-sm font-body">
              {isAdmin && (
                <>
                  <Link
                    to="/admin"
                    className={`px-3 py-2 font-medium rounded-md transition-colors min-h-[44px] flex items-center ${
                      location.pathname === '/admin'
                        ? 'bg-[#1F3FBF] text-white'
                        : 'text-[#1C1917] hover:bg-[#E3D5CA]'
                    }`}
                  >
                    Forms
                  </Link>
                  <Link
                    to="/admin/builder/new"
                    className={`px-3 py-2 font-medium rounded-md transition-colors min-h-[44px] flex items-center ${
                      location.pathname.startsWith('/admin/builder')
                        ? 'bg-[#1F3FBF] text-white'
                        : 'text-[#1C1917] hover:bg-[#E3D5CA]'
                    }`}
                  >
                    Create Form
                  </Link>
                </>
              )}

              {!isAdmin && (
                <>
                  <Link
                    to="/user"
                    className={`px-3 py-2 font-medium rounded-md transition-colors min-h-[44px] flex items-center ${
                      location.pathname === '/user'
                        ? 'bg-[#1F3FBF] text-white'
                        : 'text-[#1C1917] hover:bg-[#E3D5CA]'
                    }`}
                  >
                    {t('nav_forms')}
                  </Link>
                  <Link
                    to="/user#my-submissions"
                    className="px-3 py-2 font-medium text-[#1C1917] hover:bg-[#E3D5CA] rounded-md transition-colors min-h-[44px] flex items-center"
                  >
                    {t('nav_submissions')}
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Language Switcher: Only English and தமிழ் */}
            {setUiLang && (
              <div
                role="group"
                aria-label="Language selector"
                className="flex items-center bg-[#D6CCC2] p-1 rounded-md text-sm font-body"
              >
                <button
                  type="button"
                  onClick={() => setUiLang('en')}
                  aria-pressed={uiLang === 'en'}
                  className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer min-h-[36px] font-medium ${
                    uiLang === 'en'
                      ? 'bg-[#1F3FBF] text-white shadow-xs'
                      : 'text-[#1C1917] hover:text-[#1F3FBF]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setUiLang('ta')}
                  lang="ta"
                  aria-pressed={uiLang === 'ta'}
                  className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer min-h-[36px] font-medium ${
                    uiLang === 'ta'
                      ? 'bg-[#1F3FBF] text-white shadow-xs'
                      : 'text-[#1C1917] hover:text-[#1F3FBF]'
                  }`}
                >
                  தமிழ்
                </button>
              </div>
            )}

            {/* Speech Toggle Labelled Switch: On/Off not by color alone */}
            {setSpeechEnabled && (
              <label
                className="hidden sm:flex items-center space-x-2 text-sm text-[#524E4A] cursor-pointer font-body select-none px-2 py-1 rounded hover:bg-[#E3D5CA]/50 min-h-[44px]"
                title={speechEnabled ? t('speech_toggle_on') : t('speech_toggle_off')}
              >
                <input
                  type="checkbox"
                  checked={speechEnabled}
                  onChange={(e) => setSpeechEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D6CCC2] text-[#1F3FBF] focus:ring-2 focus:ring-[#1F3FBF]"
                  aria-label={t('speech_toggle_label')}
                />
                <span className="flex items-center space-x-1.5">
                  {speechEnabled ? (
                    <Volume2 className="w-4 h-4 text-[#1F3FBF]" aria-hidden="true" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-[#524E4A]" aria-hidden="true" />
                  )}
                  <span className="font-medium text-[#1C1917]">
                    {speechEnabled ? t('speech_toggle_on') : t('speech_toggle_off')}
                  </span>
                </span>
              </label>
            )}

            {/* Account Info and Logout */}
            <div className="flex items-center space-x-2 sm:space-x-3 pl-2 sm:pl-3 border-l border-[#D6CCC2] font-body">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-[#E3D5CA] flex items-center justify-center text-[#1C1917] font-semibold text-sm shrink-0" aria-hidden="true">
                  <UserIcon className="w-4 h-4 text-[#524E4A]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-[#1C1917] truncate max-w-[120px] sm:max-w-[160px]" title={user.email || user.username}>
                    {displayName}
                  </span>
                  {isAdmin && (
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#1F3FBF]">
                      {t('role_admin')}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                aria-label={t('nav_logout')}
                title={t('nav_logout')}
                className="px-3 py-2 text-sm font-medium text-[#B3261E] hover:bg-[#E3D5CA] rounded-md transition-colors cursor-pointer flex items-center space-x-1 min-h-[44px]"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('nav_logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
