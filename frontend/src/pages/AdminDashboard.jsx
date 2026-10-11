import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
    if (!window.confirm(`Permanent delete warning:\nAre you sure you want to permanently delete "${formTitle}"?\n\nThis will remove the form, all versions, fields, and submissions.`)) return;
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
    <div className="min-h-screen bg-[#DCE7E0] text-[#2A2E2C] flex flex-col font-sans-ui">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#2A2E2C]/75 block mb-1">
              Hospital staff management
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#2A2E2C]">
              Forms
            </h1>
            <p className="text-sm text-[#2A2E2C]/75 mt-1">
              Create, edit, publish versions, and view patient intake responses.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={loadForms}
              className="p-2.5 bg-[#F6F8F5] border border-[#DCE7E0] text-[#2A2E2C] hover:bg-[#DCE7E0] rounded transition-colors cursor-pointer focus:ring-2 focus:ring-[#1F3FBF]"
              title="Refresh forms"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              to="/admin/builder/new"
              className="px-4 py-2.5 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F6F8F5] font-semibold text-sm rounded transition-colors flex items-center space-x-2 cursor-pointer focus:ring-2 focus:ring-[#1F3FBF]"
            >
              <Plus className="w-4 h-4" />
              <span>Create Form</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#F6F8F5] border-l-4 border-[#B3261E] text-[#B3261E] text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Forms Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#2A2E2C]/75 bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg">
            <Loader2 className="w-8 h-8 animate-spin text-[#1F3FBF] mb-4" />
            <p className="text-sm">Loading intake forms...</p>
          </div>
        ) : forms.length === 0 ? (
          <div className="py-16 text-center bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg p-8 sheet-shadow">
            <FileText className="w-12 h-12 text-[#2A2E2C]/40 mx-auto mb-4" />
            <h3 className="text-lg font-bold font-serif text-[#2A2E2C] mb-1">No forms created yet</h3>
            <p className="text-xs text-[#2A2E2C]/75 max-w-sm mx-auto mb-6">
              Get started by creating your first patient intake form with Tamil and English questions.
            </p>
            <Link
              to="/admin/builder/new"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#1F3FBF] text-[#F6F8F5] text-sm font-semibold rounded"
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
                  className="bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg p-6 flex flex-col justify-between sheet-shadow"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-serif font-bold text-lg text-[#2A2E2C] line-clamp-1">
                        {form.title}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                        isPublished ? 'bg-[#1F3FBF]/10 text-[#1F3FBF]' : 'bg-[#DCE7E0] text-[#2A2E2C]'
                      }`}>
                        {form.status}
                      </span>
                    </div>

                    <p className="text-xs text-[#2A2E2C]/75 line-clamp-2 mb-4 h-8">
                      {form.description || 'Citizen service application form.'}
                    </p>

                    <div className="flex items-center space-x-4 text-xs font-sans-ui text-[#2A2E2C]/75 border-t border-b border-[#DCE7E0] py-2.5 mb-6">
                      <div>
                        Version: <span className="text-[#2A2E2C] font-semibold">v{form.latest_version_number}</span>
                      </div>
                      <div>
                        Fields: <span className="text-[#2A2E2C] font-semibold">{form.field_count}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/admin/builder/${form.id}`}
                        className="px-2.5 py-1.5 border border-[#DCE7E0] hover:bg-[#DCE7E0]/50 text-[#2A2E2C] text-xs font-semibold rounded flex items-center space-x-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Link>

                      <Link
                        to={`/admin/forms/${form.id}/submissions`}
                        className="px-2.5 py-1.5 border border-[#DCE7E0] hover:bg-[#DCE7E0]/50 text-[#2A2E2C] text-xs font-semibold rounded flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Responses</span>
                      </Link>
                    </div>

                    <div className="flex items-center space-x-1">
                      {!isPublished && !isArchived && (
                        <button
                          type="button"
                          onClick={() => handlePublish(form.id)}
                          disabled={actionLoading === form.id}
                          className="px-3 py-1.5 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F6F8F5] text-xs font-semibold rounded transition-colors flex items-center space-x-1 cursor-pointer focus:ring-2 focus:ring-[#1F3FBF]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </button>
                      )}

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => handleArchive(form.id)}
                          disabled={actionLoading === form.id}
                          className="p-1.5 text-[#2A2E2C]/60 hover:text-[#2A2E2C] rounded transition-colors cursor-pointer"
                          title="Archive form"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteForm(form.id, form.title)}
                        disabled={actionLoading === form.id}
                        className="p-1.5 text-[#2A2E2C]/60 hover:text-[#B3261E] rounded transition-colors cursor-pointer"
                        title="Delete form"
                      >
                        <Trash2 className="w-4 h-4" />
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
