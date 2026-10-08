import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { userFormsApi } from '../api/client';
import { Navbar } from '../components/Navbar';
import {
  Mic, Play, FileText, Trash2, Clock, CheckCircle2, Loader2, AlertCircle, Sparkles, Eye
} from 'lucide-react';

export const UserHome = () => {
  const [publishedForms, setPublishedForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingFormId, setStartingFormId] = useState(null);
  const [error, setError] = useState('');

  const navigate = useNavigate();

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-800/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Voice-Driven Conversational AI</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
              Fill Forms Naturally via Voice in Tamil & English
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Select a form below to start an interactive chatbot voice session. The bot asks questions one by one, listens to your spoken Tamil or English response, extracts clean values, and updates your form live.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs flex items-center space-x-3">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Published Forms */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span>Available Voice Forms</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
              <p className="text-xs">Fetching published forms...</p>
            </div>
          ) : publishedForms.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <p className="text-sm text-slate-400">No published forms available at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publishedForms.map((form) => (
                <div
                  key={form.id}
                  className="bg-slate-900 border border-slate-800 hover:border-indigo-700/80 rounded-2xl p-6 shadow-xl transition-all flex flex-col justify-between group"
                >
                  <div>
                    <h3 className="font-bold text-lg text-white mb-2 group-hover:text-indigo-300 transition-colors">
                      {form.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                      {form.description || 'Voice-driven form survey.'}
                    </p>

                    <div className="flex items-center space-x-4 text-xs font-mono text-slate-400 mb-6">
                      <span>Version: v{form.latest_version_number}</span>
                      <span>•</span>
                      <span>{form.field_count} Fields</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartForm(form.id)}
                    disabled={startingFormId === form.id}
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {startingFormId === form.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Starting Session...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 text-indigo-200" />
                        <span>Start Voice Session</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: User Submission History */}
        <section className="pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <span>Your Submission History</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading history...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <p className="text-xs text-slate-400">You haven't completed any form submissions yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="font-bold text-white text-base">
                        Submission #{sub.id}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          sub.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {sub.status}
                      </span>
                      <span className="text-xs font-mono text-purple-400">
                        v{sub.version_number}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">
                      Started: {new Date(sub.started_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Link
                      to={`/fill/${sub.id}`}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{sub.status === 'completed' ? 'View Summary' : 'Resume Session'}</span>
                    </Link>

                    <button
                      onClick={() => handleDeleteSubmission(sub.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors"
                      title="Delete Submission"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
