import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { userFormsApi } from '../api/client';
import { Navbar } from '../components/Navbar';
import { EmergencyNotice } from '../components/EmergencyNotice';
import { brandConfig } from '../brand';
import { getTranslation } from '../i18n';
import { FileText, Clock, Trash2, Eye, Loader2, AlertCircle } from 'lucide-react';

export const UserHome = () => {
  const [publishedForms, setPublishedForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingFormId, setStartingFormId] = useState(null);
  const [error, setError] = useState('');
  const [uiLang, setUiLang] = useState('en');

  const navigate = useNavigate();
  const t = (key, params) => getTranslation(uiLang, key, params);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [formsData, subsData] = await Promise.all([
        userFormsApi.listPublished(),
        userFormsApi.listSubmissions()
      ]);
      setPublishedForms(formsData);
      setSubmissions(subsData);
    } catch (err) {
      setError(err.message || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartForm = async (formId) => {
    setStartingFormId(formId);
    try {
      const sub = await userFormsApi.startSubmission(formId);
      navigate(`/fill/${sub.id}`);
    } catch (err) {
      alert(err.message || 'Failed to start form submission');
      setStartingFormId(null);
    }
  };

  const handleDeleteSubmission = async (subId) => {
    if (!window.confirm('Delete this submission history?')) return;
    try {
      await userFormsApi.deleteSubmission(subId);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete submission');
    }
  };

  return (
    <div className="min-h-screen bg-[#EDEDE9] text-[#1C1917] flex flex-col font-body">
      <Navbar uiLang={uiLang} setUiLang={setUiLang} />
      <EmergencyNotice uiLang={uiLang} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Intro Hero Card */}
        <div className="bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl p-6 sm:p-8 sheet-shadow">
          <span className="text-sm font-semibold uppercase tracking-wider text-[#524E4A] block mb-1">
            {brandConfig.hospitalName}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1C1917] mb-2 page-title">
            {t('hero_title')}
          </h1>
          <p className="text-base text-[#524E4A] max-w-3xl leading-relaxed">
            {t('hero_subtitle')}
          </p>
        </div>

        {error && (
          <div role="alert" className="p-4 bg-[#F5EBE0] border-l-4 border-[#B3261E] text-[#B3261E] text-sm flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Published Forms */}
        <section aria-labelledby="available-services-title">
          <div className="mb-4">
            <h2 id="available-services-title" className="text-xl sm:text-2xl font-bold font-display text-[#1C1917] flex items-center space-x-2">
              <FileText className="w-5 h-5 text-[#1F3FBF]" />
              <span>{t('available_forms_title')}</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-12 bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl flex flex-col items-center text-[#524E4A]">
              <Loader2 className="w-8 h-8 animate-spin text-[#1F3FBF] mb-3" />
              <p className="text-sm">Loading available services...</p>
            </div>
          ) : publishedForms.length === 0 ? (
            <div className="bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl text-center py-12 p-6">
              <p className="text-base text-[#524E4A]">{t('no_forms_msg')}</p>
            </div>
          ) : (
            <div className="bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl sheet-shadow divide-y divide-[#D6CCC2]">
              {publishedForms.map((form) => (
                <div
                  key={form.id}
                  className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#E3D5CA]/40 transition-colors"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-[#1C1917]">
                      {form.title}
                    </h3>
                    <p className="text-sm text-[#524E4A] max-w-2xl">
                      {form.description || 'Citizen service application form.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartForm(form.id)}
                    disabled={startingFormId === form.id}
                    className="py-2.5 px-5 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 cursor-pointer shrink-0 min-h-[44px] focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                  >
                    {startingFormId === form.id ? (
                      <span className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Starting...</span>
                      </span>
                    ) : (
                      <span>{t('fill_in_btn')}</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: User Submission History */}
        <section id="my-submissions" aria-labelledby="my-submissions-title">
          <div className="mb-4">
            <h2 id="my-submissions-title" className="text-xl sm:text-2xl font-bold font-display text-[#1C1917] flex items-center space-x-2">
              <Clock className="w-5 h-5 text-[#1F3FBF]" />
              <span>{t('history_title')}</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[#524E4A] text-sm">Loading history...</div>
          ) : submissions.length === 0 ? (
            <div className="bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl text-center py-8 p-6">
              <p className="text-sm text-[#524E4A]">{t('no_submissions_msg')}</p>
            </div>
          ) : (
            <div className="bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl sheet-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse font-body">
                  <thead>
                    <tr className="bg-[#D6CCC2]/70 text-[#1C1917] font-semibold border-b border-[#D6CCC2]">
                      <th className="py-3 px-4">{t('col_title')}</th>
                      <th className="py-3 px-4">{t('col_status')}</th>
                      <th className="py-3 px-4">{t('col_started')}</th>
                      <th className="py-3 px-4 text-right">{t('col_action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6CCC2]">
                    {submissions.map((sub) => {
                      const isSubmitted = sub.status === 'submitted' || sub.status === 'completed';
                      return (
                        <tr key={sub.id} className="hover:bg-[#E3D5CA]/40 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-[#1C1917]">
                            {sub.submission_title || sub.submission_name || `Submission #${sub.id}`}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
                              isSubmitted ? 'bg-[#15803D]/10 text-[#15803D]' : 'bg-[#E3D5CA] text-[#524E4A]'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-sm text-[#524E4A]">
                            {new Date(sub.started_at).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <Link
                              to={`/fill/${sub.id}`}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 border border-[#1F3FBF] text-[#1F3FBF] hover:bg-[#1F3FBF] hover:text-white rounded-md text-sm font-semibold transition-colors min-h-[36px]"
                            >
                              <Eye className="w-4 h-4" />
                              <span>{isSubmitted ? t('btn_view') : t('btn_resume')}</span>
                            </Link>
                            {!isSubmitted && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSubmission(sub.id)}
                                className="p-2 text-[#524E4A] hover:text-[#B3261E] rounded transition-colors cursor-pointer min-h-[36px] min-w-[36px]"
                                title={t('btn_delete')}
                                aria-label={`${t('btn_delete')} submission`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
