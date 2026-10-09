import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminFormsApi } from '../api/client';
import { Navbar } from '../components/Navbar';
import {
  Plus, FileText, CheckCircle2, Archive, Edit3, Eye, Loader2, RefreshCw, AlertCircle, Trash2
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

  const handleDeleteForm = async (formId, formTitle) => {
    if (!window.confirm(`⚠️ PERMANENT DELETE WARNING:\nAre you sure you want to permanently delete "${formTitle}"?\n\nThis will delete the form, all versions, fields, and ALL user submissions permanently.`)) return;
    setActionLoading(formId);
    try {
      await adminFormsApi.delete(formId);
      await loadForms();
    } catch (err) {
      alert(err.message || 'Failed to delete form');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B3954] text-[#FFFFFF] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#FFFFFF] tracking-tight">
              Admin Form Management
            </h1>
            <p className="text-sm text-[#BFD7EA] mt-1">
              Create, edit, publish versions, and view user voice submissions.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadForms}
              className="p-2.5 neu-button text-[#BFD7EA] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              title="Refresh forms"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              to="/admin/builder/new"
              className="px-4 py-2.5 neu-accent-button font-semibold text-sm flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Form</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 neu-inset text-[#FF5A5F] text-xs flex items-center space-x-3 border-l-4 border-[#C81D25]">
            <AlertCircle className="w-4 h-4 text-[#FF5A5F]" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#BFD7EA]">
            <Loader2 className="w-8 h-8 animate-spin text-[#087E8B] mb-4" />
            <p className="text-sm">Loading admin forms...</p>
          </div>
        ) : forms.length === 0 ? (
          <div className="py-16 text-center neu-inset p-8">
            <FileText className="w-12 h-12 text-[#BFD7EA]/50 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#FFFFFF] mb-1">No forms created yet</h3>
            <p className="text-xs text-[#BFD7EA] max-w-sm mx-auto mb-6">
              Get started by creating your first voice form with customizable fields and Tamil/English questions.
            </p>
            <Link
              to="/admin/builder/new"
              className="inline-flex items-center space-x-2 px-4 py-2.5 neu-accent-button text-sm font-medium"
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
                  className="neu-flat p-6 transition-all flex flex-col justify-between hover:scale-[1.01]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-bold text-lg text-[#FFFFFF] line-clamp-1">
                        {form.title}
                      </h3>
                      <span className="px-2.5 py-0.5 neu-pill text-xs font-semibold uppercase tracking-wider text-[#BFD7EA]">
                        {form.status}
                      </span>
                    </div>

                    <p className="text-xs text-[#BFD7EA] line-clamp-2 mb-4 h-8">
                      {form.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center space-x-4 text-xs font-mono text-[#BFD7EA] border-t border-b border-[#051B28]/50 py-2.5 mb-6">
                      <div>
                        Version: <span className="text-[#FFFFFF] font-bold">v{form.latest_version_number}</span>
                      </div>
                      <div>
                        Fields: <span className="text-[#BFD7EA] font-bold">{form.field_count}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/admin/builder/${form.id}`}
                        className="p-2 neu-button text-[#BFD7EA] hover:text-[#FFFFFF] text-xs font-medium transition-colors flex items-center space-x-1"
                        title="Edit Form"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Link>

                      <Link
                        to={`/admin/forms/${form.id}/submissions`}
                        className="p-2 neu-button text-[#BFD7EA] hover:text-[#FFFFFF] text-xs font-medium transition-colors flex items-center space-x-1"
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
                          className="px-3 py-1.5 neu-accent-button text-xs font-medium transition-colors flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </button>
                      )}

                      {!isArchived && (
                        <button
                          onClick={() => handleArchive(form.id)}
                          disabled={actionLoading === form.id}
                          className="p-2 neu-button text-[#BFD7EA]/60 hover:text-amber-400 transition-colors cursor-pointer"
                          title="Archive Form"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteForm(form.id, form.title)}
                        disabled={actionLoading === form.id}
                        className="p-2 neu-button text-[#FF5A5F]/70 hover:text-[#FF5A5F] hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="Delete Form Permanently"
                      >
                        <Trash2 className="w-4 h-4 text-[#FF5A5F]" />
                      </button>
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
