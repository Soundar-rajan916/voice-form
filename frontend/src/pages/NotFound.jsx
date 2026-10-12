import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { brandConfig } from '../brand';
import { getTranslation } from '../i18n';
import {
  FileQuestion,
  Home,
  ArrowLeft,
  Compass,
  FileText,
  LogIn,
  LayoutDashboard
} from 'lucide-react';

export const NotFound = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lang, setLang] = useState(() => localStorage.getItem('voiceform_lang') || 'en');

  const handleLangChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem('voiceform_lang', newLang);
  };

  const t = (key) => getTranslation(lang, key);
  const homePath = user ? (user.role === 'admin' ? '/admin' : '/user') : '/';

  return (
    <div className="min-h-screen bg-[#EDEDE9] text-[#1C1917] flex flex-col font-sans-ui selection:bg-[#1F3FBF] selection:text-white">
      {/* Top Header Bar */}
      <header className="bg-[#F5EBE0] border-b border-[#D6CCC2] px-4 sm:px-8 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            to={homePath}
            className="flex flex-col group focus-visible:outline-2 focus-visible:outline-[#1F3FBF] rounded-sm"
            aria-label={`${brandConfig.appName} Home`}
          >
            <span className="text-xl sm:text-2xl font-bold font-display text-[#1C1917] tracking-tight group-hover:text-[#1F3FBF] transition-colors brand-logo">
              {brandConfig.appName}
            </span>
            <span className="text-xs text-[#524E4A] font-body">
              {brandConfig.officeName}
            </span>
          </Link>

          {/* Language Switcher */}
          <div className="flex items-center gap-1.5 bg-[#EDEDE9] p-1 rounded-lg border border-[#D6CCC2]">
            <button
              type="button"
              onClick={() => handleLangChange('en')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer min-h-[36px] ${
                lang === 'en'
                  ? 'bg-[#1F3FBF] text-white shadow-xs'
                  : 'text-[#1C1917] hover:bg-[#E3D5CA]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLangChange('ta')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer min-h-[36px] ${
                lang === 'ta'
                  ? 'bg-[#1F3FBF] text-white shadow-xs'
                  : 'text-[#1C1917] hover:bg-[#E3D5CA]'
              }`}
            >
              தமிழ்
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-2xl w-full bg-[#F5EBE0] border border-[#D6CCC2] rounded-2xl p-6 sm:p-12 sheet-shadow text-center space-y-8 relative overflow-hidden">
          {/* Subtle Document Ruler Accent Top */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1F3FBF] via-[#5B2A86] to-[#1F3FBF]" />

          {/* Icon Badge & Status Stamp */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#1F3FBF]/10 border-2 border-[#1F3FBF]/20 flex items-center justify-center text-[#1F3FBF] shadow-inner">
                <FileQuestion className="w-10 h-10 sm:w-12 sm:h-12 text-[#1F3FBF] animate-pulse" />
              </div>
              <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 bg-[#B3261E] text-white text-[11px] font-bold tracking-wider uppercase rounded-full shadow-xs">
                {t('not_found_code')}
              </span>
            </div>

            <span className="inline-block px-3 py-1 bg-[#B3261E]/10 border border-[#B3261E]/30 text-[#B3261E] text-xs font-bold uppercase tracking-widest rounded-md">
              {t('not_found_badge')}
            </span>
          </div>

          {/* Heading & Explanatory Copy */}
          <div className="space-y-3 max-w-lg mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1C1917] tracking-tight leading-snug">
              {t('not_found_title')}
            </h1>
            <p className="text-sm sm:text-base text-[#524E4A] font-body leading-relaxed">
              {t('not_found_desc')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to={homePath}
              className="w-full sm:w-auto px-6 py-3 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 min-h-[48px] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
            >
              <Home className="w-4 h-4" />
              <span>{t('not_found_btn_home')}</span>
            </Link>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-6 py-3 bg-[#F5EBE0] hover:bg-[#E3D5CA] border border-[#D6CCC2] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('not_found_btn_back')}</span>
            </button>
          </div>

          {/* Quick Helpful Directory */}
          <div className="pt-6 border-t border-[#D6CCC2] text-left">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#524E4A] mb-3 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#1F3FBF]" />
              <span>{t('not_found_help_heading')}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <Link
                to="/user"
                className="p-3 bg-[#EDEDE9]/70 hover:bg-[#E3D5CA] border border-[#D6CCC2]/60 rounded-lg flex items-center gap-2.5 text-[#1C1917] font-medium transition-colors"
              >
                <FileText className="w-4 h-4 text-[#1F3FBF] shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-[#1C1917]">{t('nav_forms')}</div>
                  <div className="text-[11px] text-[#524E4A] truncate">Citizen services catalog</div>
                </div>
              </Link>

              {user?.role === 'admin' ? (
                <Link
                  to="/admin"
                  className="p-3 bg-[#EDEDE9]/70 hover:bg-[#E3D5CA] border border-[#D6CCC2]/60 rounded-lg flex items-center gap-2.5 text-[#1C1917] font-medium transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-[#1F3FBF] shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold text-[#1C1917]">Admin Portal</div>
                    <div className="text-[11px] text-[#524E4A] truncate">Form builder & submissions</div>
                  </div>
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="p-3 bg-[#EDEDE9]/70 hover:bg-[#E3D5CA] border border-[#D6CCC2]/60 rounded-lg flex items-center gap-2.5 text-[#1C1917] font-medium transition-colors"
                >
                  <LogIn className="w-4 h-4 text-[#1F3FBF] shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold text-[#1C1917]">{t('login_button')}</div>
                    <div className="text-[11px] text-[#524E4A] truncate">Access your account</div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="text-center py-4 px-4 text-xs text-[#524E4A] font-body border-t border-[#D6CCC2]/40 bg-[#F5EBE0]/50">
        <p>{t('disclaimer_short')}</p>
      </footer>
    </div>
  );
};

export default NotFound;
