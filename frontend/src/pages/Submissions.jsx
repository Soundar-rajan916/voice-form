import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminFormsApi } from '../api/client';
import { Navbar } from '../components/Navbar';
import {
  Download, ArrowLeft, Loader2, Filter, Calendar, User as UserIcon, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';

export const Submissions = () => {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSubmissions = async (vId = selectedVersion) => {
    setLoading(true);
    setError('');
    try {
      const [formData, subsData] = await Promise.all([
        adminFormsApi.get(formId),
        adminFormsApi.getSubmissions(formId, vId || null)
      ]);
      setForm(formData);
      setSubmissions(subsData);
    } catch (err) {
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions(selectedVersion);
  }, [formId, selectedVersion]);

  const handleDownloadCSV = () => {
    const url = adminFormsApi.getCSVUrl(formId, selectedVersion);
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                {form ? form.title : 'Form'} Submissions
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                View extracted answers, raw transcripts, and export CSV by version.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Version filter */}
            {form?.current_version && (
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 space-x-2">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Version:</span>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="bg-transparent text-white font-semibold focus:outline-none"
                >
                  <option value="" className="bg-slate-900">All Versions</option>
                  <option value={form.current_version.id} className="bg-slate-900">
                    Latest (v{form.current_version.version_number})
                  </option>
                </select>
              </div>
            )}

            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs flex items-center space-x-3">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
            <p className="text-sm">Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/50 p-8">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">No submissions yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Submissions submitted by users will appear here with version isolation and raw transcripts.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {submissions.map((sub) => {
              const answersByField = (sub.answers || []).reduce((acc, a) => {
                acc[a.field_id] = a;
                return acc;
              }, {});

              return (
                <div
                  key={sub.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="flex items-center space-x-3">
                      <span className="w-8 h-8 rounded-xl bg-indigo-950/80 border border-indigo-800 text-indigo-400 font-mono text-xs font-bold flex items-center justify-center">
                        #{sub.id}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm font-semibold text-white">
                            {sub.user_email || 'User'}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          Started: {new Date(sub.started_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs font-mono">
                      <span className="px-2.5 py-1 bg-purple-950/80 text-purple-300 border border-purple-800 rounded-lg">
                        Version v{sub.version_number}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg uppercase tracking-wider font-bold ${
                          sub.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                  </div>

                  {/* Answers breakdown table/grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(sub.fields || []).map((field) => {
                      const ans = answersByField[field.id];
                      return (
                        <div
                          key={field.id}
                          className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-300">
                              {field.field_name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 uppercase">
                              {field.data_type}
                            </span>
                          </div>

                          <div className="text-sm font-bold text-emerald-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                            {ans?.value ? ans.value : <span className="text-slate-600 font-normal italic">Unanswered</span>}
                          </div>

                          {ans?.raw_transcript && (
                            <div className="text-[11px] text-slate-400 italic pt-1">
                              Raw Transcript: "{ans.raw_transcript}" ({ans.language || 'auto'})
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
