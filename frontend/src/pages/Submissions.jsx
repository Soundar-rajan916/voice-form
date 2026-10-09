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
    <div className="min-h-screen bg-[#0B3954] text-[#FFFFFF] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#051B28]/50">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="p-2.5 neu-button text-[#BFD7EA] hover:text-[#FFFFFF] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-[#FFFFFF]">
                {form ? form.title : 'Form'} Submissions
              </h1>
              <p className="text-xs text-[#BFD7EA] mt-0.5">
                View extracted answers, raw transcripts, and export CSV by version.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Version filter */}
            {form?.current_version && (
              <div className="flex items-center neu-inset px-3 py-1.5 text-xs text-[#BFD7EA] space-x-2">
                <Filter className="w-3.5 h-3.5 text-[#BFD7EA]" />
                <span>Version:</span>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="bg-transparent text-[#FFFFFF] font-semibold focus:outline-none"
                >
                  <option value="" className="bg-[#0B3954]">All Versions</option>
                  <option value={form.current_version.id} className="bg-[#0B3954]">
                    Latest (v{form.current_version.version_number})
                  </option>
                </select>
              </div>
            )}

            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2.5 neu-accent-button font-semibold text-sm flex items-center space-x-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 neu-inset text-[#FF5A5F] text-xs flex items-center space-x-3 border-l-4 border-[#C81D25]">
            <AlertCircle className="w-4 h-4 text-[#FF5A5F]" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#BFD7EA]">
            <Loader2 className="w-8 h-8 animate-spin text-[#087E8B] mb-4" />
            <p className="text-sm">Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-16 text-center neu-inset p-8">
            <FileText className="w-12 h-12 text-[#BFD7EA]/40 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#FFFFFF] mb-1">No submissions yet</h3>
            <p className="text-xs text-[#BFD7EA] max-w-sm mx-auto">
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
                  className="neu-flat p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#051B28]/50 pb-4">
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 neu-pill text-[#BFD7EA] font-mono text-xs font-bold flex items-center justify-center">
                        {sub.submission_title || sub.submission_name || `#${sub.id}`}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <UserIcon className="w-3.5 h-3.5 text-[#BFD7EA]" />
                          <span className="text-sm font-semibold text-[#FFFFFF]">
                            {sub.user_email || 'User'}
                          </span>
                        </div>
                        <span className="text-xs text-[#BFD7EA]/80 font-mono">
                          Started: {new Date(sub.started_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs font-mono">
                      <span className="px-3 py-1 neu-pill text-[#BFD7EA]">
                        Version v{sub.version_number}
                      </span>
                      <span className="px-3 py-1 neu-pill uppercase tracking-wider font-bold text-[#BFD7EA]">
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
                          className="neu-inset p-4 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#BFD7EA]">
                              {field.field_name}
                            </span>
                            <span className="font-mono text-[10px] text-[#BFD7EA]/70 uppercase">
                              {field.data_type}
                            </span>
                          </div>

                          <div className="text-sm font-bold text-[#BFD7EA] neu-inset px-3 py-1.5">
                            {ans?.value ? ans.value : <span className="text-[#BFD7EA]/40 font-normal italic">Unanswered</span>}
                          </div>

                          {ans?.raw_transcript && (
                            <div className="text-[11px] text-[#BFD7EA]/70 italic pt-1">
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
