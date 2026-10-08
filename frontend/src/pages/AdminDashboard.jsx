import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminFormsApi } from '../api/client';
import { Navbar } from '../components/Navbar';
import {
  Plus, FileText, CheckCircle2, Archive, Edit3, Eye, Loader2, RefreshCw, AlertCircle
} from 'lucide-react';

export const AdminDashboard = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const navigate = useNavigate();

  const loadForms = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFormsApi.list();
      setForms(data);
    } catch (err) {
      setError(err.message || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const handlePublish = async (formId) => {
    setActionLoading(formId);
    try {
      await adminFormsApi.publish(formId);
      await loadForms();
    } catch (err) {
      alert(err.message || 'Failed to publish form');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (formId) => {
    if (!window.confirm('Are you sure you want to archive this form?')) return;
    setActionLoading(formId);
    try {
      await adminFormsApi.archive(formId);
      await loadForms();
    } catch (err) {
      alert(err.message || 'Failed to archive form');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Admin Form Management
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Create, edit, publish versions, and view user voice submissions.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadForms}
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh forms"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              to="/admin/builder/new"
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Form</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs flex items-center space-x-3">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
            <p className="text-sm">Loading admin forms...</p>
          </div>
        ) : forms.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/50 p-8">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">No forms created yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
              Get started by creating your first voice form with customizable fields and Tamil/English questions.
            </p>
            <Link
              to="/admin/builder/new"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-xl text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Form</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form) => {
              const isPublished = form.status === 'published';
              const isArchived = form.status === 'archived';

              return (
                <div
                  key={form.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-bold text-lg text-white line-clamp-1">
                        {form.title}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          isPublished
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                            : isArchived
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-amber-950/80 text-amber-400 border border-amber-800/80'
                        }`}
                      >
                        {form.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 h-8">
                      {form.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center space-x-4 text-xs font-mono text-slate-400 border-t border-b border-slate-800/80 py-2.5 mb-6">
                      <div>
                        Version: <span className="text-indigo-400 font-bold">v{form.latest_version_number}</span>
                      </div>
                      <div>
                        Fields: <span className="text-purple-400 font-bold">{form.field_count}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/admin/builder/${form.id}`}
                        className="p-2 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1"
                        title="Edit Form"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Link>

                      <Link
                        to={`/admin/forms/${form.id}/submissions`}
                        className="p-2 bg-slate-800/80 text-indigo-400 hover:text-indigo-300 hover:bg-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1"
                        title="View Submissions"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Submissions</span>
                      </Link>
                    </div>

                    <div className="flex items-center space-x-1">
                      {!isPublished && !isArchived && (
                        <button
                          onClick={() => handlePublish(form.id)}
                          disabled={actionLoading === form.id}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </button>
                      )}

                      {!isArchived && (
                        <button
                          onClick={() => handleArchive(form.id)}
                          disabled={actionLoading === form.id}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Archive Form"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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
