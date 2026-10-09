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
    <div className="min-h-screen bg-[#0B3954] text-[#FFFFFF] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Banner */}
        <div className="neu-flat p-8 relative overflow-hidden">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 neu-pill text-[#BFD7EA] text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5 text-[#FF5A5F]" />
              <span>Voice-Driven Conversational AI</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#FFFFFF] tracking-tight mb-3">
              Fill Forms Naturally via Voice in Tamil & English
            </h1>
            <p className="text-sm text-[#BFD7EA] leading-relaxed">
              Select a form below to start an interactive chatbot voice session. The bot asks questions one by one, listens to your spoken Tamil or English response, extracts clean values, and updates your form live.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 neu-inset text-[#FF5A5F] text-xs flex items-center space-x-3 border-l-4 border-[#C81D25]">
            <AlertCircle className="w-4 h-4 text-[#FF5A5F]" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Published Forms */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#FFFFFF] flex items-center space-x-2">
              <FileText className="w-5 h-5 text-[#BFD7EA]" />
              <span>Available Voice Forms</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center text-[#BFD7EA]">
              <Loader2 className="w-8 h-8 animate-spin text-[#087E8B] mb-3" />
              <p className="text-xs">Fetching published forms...</p>
            </div>
          ) : publishedForms.length === 0 ? (
            <div className="text-center py-12 neu-inset p-6">
              <p className="text-sm text-[#BFD7EA]/70">No published forms available at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publishedForms.map((form) => (
                <div
                  key={form.id}
                  className="neu-flat p-6 transition-all flex flex-col justify-between group hover:scale-[1.01]"
                >
                  <div>
                    <h3 className="font-bold text-lg text-[#FFFFFF] mb-2 group-hover:text-[#BFD7EA] transition-colors">
                      {form.title}
                    </h3>
                    <p className="text-xs text-[#BFD7EA] line-clamp-2 mb-4">
                      {form.description || 'Voice-driven form survey.'}
                    </p>

                    <div className="flex items-center space-x-4 text-xs font-mono text-[#BFD7EA] mb-6">
                      <span>Version: v{form.latest_version_number}</span>
                      <span>•</span>
                      <span>{form.field_count} Fields</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartForm(form.id)}
                    disabled={startingFormId === form.id}
                    className="w-full py-3.5 px-4 neu-accent-button font-semibold text-sm flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {startingFormId === form.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#FFFFFF]" />
                        <span>Starting Session...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 text-[#BFD7EA]" />
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
        <section className="pt-6 border-t border-[#051B28]/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#FFFFFF] flex items-center space-x-2">
              <Clock className="w-5 h-5 text-[#BFD7EA]" />
              <span>Your Submission History</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[#BFD7EA] text-xs">Loading history...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 neu-inset p-6">
              <p className="text-xs text-[#BFD7EA]/70">You haven't completed any form submissions yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => {
                const isSubmitted = sub.status === 'submitted' || sub.status === 'completed';
                return (
                  <div
                    key={sub.id}
                    className="neu-flat p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                  >
                    <div>
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="font-bold text-[#FFFFFF] text-base">
                          {sub.submission_title || sub.submission_name || `Submission #${sub.id}`}
                        </span>
                        <span className="px-3 py-0.5 neu-pill text-xs font-semibold uppercase tracking-wider text-[#BFD7EA]">
                          {sub.status}
                        </span>
                        <span className="text-xs font-mono text-[#BFD7EA]">
                          v{sub.version_number}
                        </span>
                      </div>

                      <p className="text-xs text-[#BFD7EA]/80">
                        Started: {new Date(sub.started_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Link
                        to={`/fill/${sub.id}`}
                        className="px-4 py-2 neu-button text-[#BFD7EA] hover:text-[#FFFFFF] text-xs font-semibold transition-colors flex items-center space-x-1.5"
                      >
                        <Eye className="w-4 h-4 text-[#BFD7EA]" />
                        <span>{isSubmitted ? 'View Submission' : 'Resume Session'}</span>
                      </Link>

                      {!isSubmitted && (
                        <button
                          onClick={() => handleDeleteSubmission(sub.id)}
                          className="p-2 neu-button text-[#BFD7EA]/60 hover:text-[#FF5A5F] transition-colors cursor-pointer"
                          title="Delete Submission"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
