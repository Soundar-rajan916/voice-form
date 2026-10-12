import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminFormsApi } from '../api/client';
import { Navbar } from '../components/Navbar';
import {
  Download, ArrowLeft, Loader2, Filter, AlertCircle, FileText
} from 'lucide-react';

export const Submissions = () => {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadSubmissions = async (vId = selectedVersion) => {
    setLoading(true);
    setError('');
    try {
      const [formData, subsData] = await Promise.all([
        adminFormsApi.get(formId),
        adminFormsApi.getSubmissions(formId, vId || null)
      ]);
      setForm(formData);
      setSubmissions((subsData || []).filter((s) => s.status !== 'in_progress'));
    } catch (err) {
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions(selectedVersion);
  }, [formId, selectedVersion]);

  const handleDownloadExcel = async () => {
    setExporting(true);
    setError('');
    try {
      const blob = await adminFormsApi.downloadExcel(formId, selectedVersion);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (form?.title || `form_${formId}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safeTitle}_submissions.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to export Excel file');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDEDE9] text-[#23272F] flex flex-col font-sans-ui">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#D6CCC2]">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="p-2 bg-[#F5EBE0] border border-[#D6CCC2] text-[#23272F] hover:bg-[#E3D5CA] rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-[#23272F]/75 block mb-0.5">
                Applications ledger
              </span>
              <h1 className="text-2xl font-bold font-serif text-[#23272F]">
                {form ? form.title : 'Form'} Applications
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Version filter */}
            {form?.current_version && (
              <div className="flex items-center bg-[#F5EBE0] border border-[#D6CCC2] rounded px-3 py-1.5 text-xs text-[#23272F] space-x-2">
                <Filter className="w-3.5 h-3.5 text-[#23272F]/75" />
                <span>Version:</span>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="bg-transparent text-[#23272F] font-semibold focus:outline-none"
                >
                  <option value="">All versions</option>
                  <option value={form.current_version.id}>
                    Latest (v{form.current_version.version_number})
                  </option>
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={exporting}
              className="px-4 py-2 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F5EBE0] font-semibold text-sm rounded transition-colors flex items-center space-x-2 cursor-pointer focus:ring-2 focus:ring-[#1F3FBF] disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#F5EBE0] border-l-4 border-[#B3261E] text-[#B3261E] text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#23272F]/75 bg-[#F5EBE0] border border-[#D6CCC2] rounded-lg">
            <Loader2 className="w-8 h-8 animate-spin text-[#1F3FBF] mb-4" />
            <p className="text-sm">Loading applications...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-16 text-center bg-[#F5EBE0] border border-[#D6CCC2] rounded-lg p-8 sheet-shadow">
            <FileText className="w-12 h-12 text-[#23272F]/40 mx-auto mb-4" />
            <h3 className="text-lg font-bold font-serif text-[#23272F] mb-1">No applications submitted yet</h3>
            <p className="text-xs text-[#23272F]/75 max-w-sm mx-auto">
              Completed citizen applications will appear here with reference numbers and extracted answers.
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
                  className="bg-[#F5EBE0] border border-[#D6CCC2] rounded-lg p-6 space-y-4 sheet-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D6CCC2] pb-4">
                    <div className="space-y-2">
                      <div>
                        <span className="px-3 py-1 bg-[#D6CCC2] text-[#23272F] font-semibold text-xs rounded">
                          {sub.submission_title || sub.submission_name || `Application #${sub.id}`}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#23272F]/75">
                        <span>Applicant: <strong className="text-[#23272F]">{sub.user_email || 'Citizen'}</strong></span>
                        {sub.language_chosen && <span>Language: <strong>{sub.language_chosen.toUpperCase()}</strong></span>}
                        <span>Submitted: {new Date(sub.submitted_at || sub.started_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-sans-ui">
                      <span className="px-2.5 py-1 bg-[#1F3FBF]/10 text-[#1F3FBF] rounded uppercase font-semibold">
                        {sub.status}
                      </span>
                    </div>
                  </div>

                  {/* Answers grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(sub.fields || []).map((field) => {
                      const ans = answersByField[field.id];
                      return (
                        <div
                          key={field.id}
                          className="bg-[#F5EBE0] border border-[#D6CCC2] p-4 rounded space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold uppercase tracking-wider text-[#23272F]/75">
                              {field.field_name.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-[#23272F]/60">
                              {field.data_type}
                            </span>
                          </div>

                          <div className="text-sm font-semibold text-[#1F3FBF] pt-1">
                            {ans?.value ? (
                              ans.value
                            ) : (
                              <span className="text-[#23272F]/50 font-normal italic">Unanswered</span>
                            )}
                          </div>

                          {ans?.raw_transcript && (
                            <div className="text-xs text-[#23272F]/70 italic pt-1 border-t border-[#D6CCC2] mt-1">
                              Transcript: "{ans.raw_transcript}" ({ans.language || 'auto'})
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
