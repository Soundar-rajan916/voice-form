import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { userFormsApi } from '../api/client';
import { Navbar } from '../components/Navbar';
import { EmergencyNotice } from '../components/EmergencyNotice';
import { brandConfig } from '../brand';
import { FileText, Clock, Trash2, Eye, Loader2, AlertCircle } from 'lucide-react';

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
    <div className="min-h-screen bg-[#DCE7E0] text-[#2A2E2C] flex flex-col font-sans-ui">
      <Navbar />
      <EmergencyNotice />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Intro Card */}
        <div className="bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg p-6 sm:p-8 sheet-shadow">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#2A2E2C]/75 block mb-1">
            {brandConfig.hospitalName}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#2A2E2C] mb-2">
            Citizen service and application forms
          </h1>
          <p className="text-sm text-[#2A2E2C]/75 max-w-3xl leading-relaxed">
            Fill in your application forms by speaking in Tamil or English, typing, or uploading a document. Our assistant asks one question at a time and displays your answers on your application slip.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-[#F6F8F5] border-l-4 border-[#B3261E] text-[#B3261E] text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Published Forms (Ruled List) */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold font-serif text-[#2A2E2C] flex items-center space-x-2">
              <FileText className="w-5 h-5 text-[#1F3FBF]" />
              <span>Forms</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-12 bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg flex flex-col items-center text-[#2A2E2C]/75">
              <Loader2 className="w-8 h-8 animate-spin text-[#1F3FBF] mb-3" />
              <p className="text-xs">Loading available forms...</p>
            </div>
          ) : publishedForms.length === 0 ? (
            <div className="bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg text-center py-12 p-6">
              <p className="text-sm text-[#2A2E2C]/75">No application forms published at the moment.</p>
            </div>
          ) : (
            <div className="bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg sheet-shadow divide-y divide-[#DCE7E0]">
              {publishedForms.map((form) => (
                <div
                  key={form.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#DCE7E0]/30 transition-colors"
                >
                  <div className="space-y-1">
                    <h3 className="font-serif font-bold text-lg text-[#2A2E2C]">
                      {form.title}
                    </h3>
                    <p className="text-xs text-[#2A2E2C]/75 max-w-2xl">
                      {form.description || 'Citizen service application form.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartForm(form.id)}
                    disabled={startingFormId === form.id}
                    className="py-2.5 px-5 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F6F8F5] font-semibold text-sm rounded transition-colors disabled:opacity-50 cursor-pointer shrink-0 focus:ring-2 focus:ring-[#1F3FBF]"
                  >
                    {startingFormId === form.id ? (
                      <span className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#F6F8F5]" />
                        <span>Starting...</span>
                      </span>
                    ) : (
                      <span>Start</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: User Submission History */}
        <section id="my-submissions">
          <div className="mb-4">
            <h2 className="text-xl font-bold font-serif text-[#2A2E2C] flex items-center space-x-2">
              <Clock className="w-5 h-5 text-[#1F3FBF]" />
              <span>My submitted forms</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[#2A2E2C]/75 text-xs">Loading history...</div>
          ) : submissions.length === 0 ? (
            <div className="bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg text-center py-8 p-6">
              <p className="text-xs text-[#2A2E2C]/75">You have not submitted any forms yet.</p>
            </div>
          ) : (
            <div className="bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg sheet-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse font-sans-ui">
                  <thead>
                    <tr className="bg-[#DCE7E0] text-[#2A2E2C] font-semibold border-b border-[#DCE7E0]">
                      <th className="py-3 px-4">Form / Title</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Started</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE7E0]">
                    {submissions.map((sub) => {
                      const isSubmitted = sub.status === 'submitted' || sub.status === 'completed';
                      return (
                        <tr key={sub.id} className="hover:bg-[#DCE7E0]/30 transition-colors">
                          <td className="py-3 px-4 font-medium text-[#2A2E2C]">
                            {sub.submission_title || sub.submission_name || `Submission #${sub.id}`}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                              isSubmitted ? 'bg-[#1F3FBF]/10 text-[#1F3FBF]' : 'bg-[#FFE45C] text-[#2A2E2C]'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-[#2A2E2C]/75">
                            {new Date(sub.started_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <Link
                              to={`/fill/${sub.id}`}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 border border-[#1F3FBF] text-[#1F3FBF] hover:bg-[#1F3FBF] hover:text-[#F6F8F5] rounded text-xs font-semibold transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isSubmitted ? 'View' : 'Resume'}</span>
                            </Link>
                            {!isSubmitted && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSubmission(sub.id)}
                                className="p-1.5 text-[#2A2E2C]/60 hover:text-[#B3261E] rounded transition-colors cursor-pointer"
                                title="Delete submission"
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
