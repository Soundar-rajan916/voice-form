import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminFormsApi } from '../api/client';
import { Navbar } from '../components/Navbar';
import { Sheet } from '../components/Sheet';
import { Toast } from '../components/Toast';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Trash2, GripVertical, CheckCircle2, ArrowLeft, Loader2, AlertCircle
} from 'lucide-react';

const DATA_TYPES = ['String', 'Number', 'Email', 'Phone', 'Date', 'Boolean', 'Choice'];

const SortableFieldItem = ({
  id, index, field, updateField, removeField, choicesEditor
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const SENSITIVE_KEYWORDS = [
    'aadhaar', 'pan', 'voter', 'ration', 'bank', 'account', 'passport', 'credit', 'ssn', 'uidai', 'identity'
  ];
  const textToCheck = `${field.field_name || ''} ${field.description || ''}`.toLowerCase();
  const isSensitiveMatch = SENSITIVE_KEYWORDS.some((kw) => textToCheck.includes(kw));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg p-5 mb-4 space-y-4 sheet-shadow relative"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#DCE7E0] pb-3">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1.5 text-[#2A2E2C]/60 hover:text-[#2A2E2C] rounded"
            aria-label="Drag field row"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-[#2A2E2C] uppercase tracking-wider bg-[#DCE7E0] px-3 py-1 rounded">
            Field #{index + 1}
          </span>
        </div>

        <div className="flex items-center space-x-4 font-sans-ui">
          <label className="flex items-center space-x-2 text-xs text-[#2A2E2C]/75 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(field.is_sensitive_number)}
              onChange={(e) => updateField(index, 'is_sensitive_number', e.target.checked)}
              className="rounded border-[#DCE7E0] text-[#5B2A86] focus:ring-[#5B2A86]"
            />
            <span className={field.is_sensitive_number ? 'font-semibold text-[#5B2A86]' : ''}>
              Sensitive number
            </span>
          </label>
          <label className="flex items-center space-x-2 text-xs text-[#2A2E2C]/75 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => updateField(index, 'required', e.target.checked)}
              className="rounded border-[#DCE7E0] text-[#1F3FBF] focus:ring-[#1F3FBF]"
            />
            <span>Required</span>
          </label>
          <button
            type="button"
            onClick={() => removeField(index)}
            className="p-1.5 text-[#2A2E2C]/60 hover:text-[#B3261E] rounded transition-colors cursor-pointer"
            title="Delete field"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Auto-suggest banner when sensitive keywords matched */}
      {isSensitiveMatch && !field.is_sensitive_number && (
        <div className="bg-[#FFE45C]/35 border border-[#23272F]/20 p-2.5 rounded text-xs text-[#23272F] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#5B2A86] shrink-0" />
            <span>Keyword match: "{field.field_name || field.description}". Enable "Sensitive number" protection?</span>
          </div>
          <button
            type="button"
            onClick={() => updateField(index, 'is_sensitive_number', true)}
            className="px-2.5 py-1 bg-[#5B2A86] text-[#FCFCFA] text-[11px] font-semibold rounded hover:bg-[#5B2A86]/90 cursor-pointer shrink-0 ml-2"
          >
            Enable protection
          </button>
        </div>
      )}

      {/* Warning banner when sensitive number is enabled */}
      {field.is_sensitive_number && (
        <div className="bg-[#FFE45C]/20 border-l-4 border-[#5B2A86] p-3 rounded text-xs text-[#23272F] space-y-1">
          <div className="flex items-center space-x-1.5 font-semibold text-[#5B2A86]">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Sensitive Number Protection Active</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Voice and document extraction will be disabled. The applicant or operator must type this field directly. It will be masked on screen (•••• 1234), encrypted at rest (Fernet), and excluded from logs and standard CSV exports.
          </p>
          <p className="text-[11px] font-medium text-[#B3261E]">
            Legal Warning: Collecting identity or banking numbers carries strict statutory obligations and data protection compliance rules.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans-ui">
        <div>
          <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
            Field Name
          </label>
          <input
            type="text"
            required
            value={field.field_name}
            onChange={(e) => updateField(index, 'field_name', e.target.value)}
            placeholder="e.g. full_name, age, blood_group"
            className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-2 text-sm text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
            Data Type
          </label>
          <select
            value={field.data_type}
            onChange={(e) => updateField(index, 'data_type', e.target.value)}
            className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-2 text-sm text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
          >
            {DATA_TYPES.map((dt) => (
              <option key={dt} value={dt}>
                {dt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="font-sans-ui">
        <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
          Description (Context for AI)
        </label>
        <input
          type="text"
          value={field.description || ''}
          onChange={(e) => updateField(index, 'description', e.target.value)}
          placeholder="e.g. age of the applicant in years"
          className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-2 text-sm text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
        />
      </div>

      {field.data_type === 'Choice' && (
        <div className="font-sans-ui bg-[#DCE7E0]/30 p-3 rounded border border-[#DCE7E0]">
          <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
            Choices (Comma separated)
          </label>
          <input
            type="text"
            value={Array.isArray(field.choices) ? field.choices.join(', ') : field.choices || ''}
            onChange={(e) => choicesEditor(index, e.target.value)}
            placeholder="Female, Male, Other, Prefer not to say"
            className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-2 text-sm text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
          />
        </div>
      )}

      {/* Question Previews */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#DCE7E0] font-sans-ui">
        <div>
          <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
            English Question Preview
          </label>
          <input
            type="text"
            value={field.question_en || ''}
            onChange={(e) => updateField(index, 'question_en', e.target.value)}
            placeholder="Generated on publish if blank"
            className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-1.5 text-xs text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
            Tamil Question Preview (தமிழ்)
          </label>
          <input
            type="text"
            value={field.question_ta || ''}
            onChange={(e) => updateField(index, 'question_ta', e.target.value)}
            placeholder="Generated on publish if blank"
            lang="ta"
            className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-1.5 text-xs text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none tamil-text"
          />
        </div>
      </div>
    </div>
  );
};

export const FormBuilder = () => {
  const { id } = useParams();
  const isEdit = Boolean(id && id !== 'new');
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [allowDocUpload, setAllowDocUpload] = useState(true);
  const [fields, setFields] = useState([
    { id: 'f_1', field_name: 'full_name', data_type: 'String', description: 'full name of the applicant', required: true, is_sensitive_number: false, question_en: '', question_ta: '' }
  ]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [error, setError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (isEdit) {
      const fetchForm = async () => {
        try {
          const data = await adminFormsApi.get(id);
          setTitle(data.title);
          setDescription(data.description || '');
          setAllowDocUpload(data.allow_document_upload);
          if (data.current_version && data.current_version.fields) {
            setFields(
              data.current_version.fields.map((f) => ({
                id: String(f.id),
                field_name: f.field_name,
                data_type: f.data_type,
                description: f.description || '',
                required: f.required,
                is_sensitive_number: Boolean(f.is_sensitive_number),
                choices: f.choices || [],
                question_en: f.question_en || '',
                question_ta: f.question_ta || ''
              }))
            );
          }
        } catch (err) {
          setError(err.message || 'Failed to load form details');
        } finally {
          setLoading(false);
        }
      };
      fetchForm();
    }
  }, [id, isEdit]);

  const handleAddField = () => {
    const newId = `field_${Date.now()}`;
    setFields([
      ...fields,
      { id: newId, field_name: '', data_type: 'String', description: '', required: true, is_sensitive_number: false, question_en: '', question_ta: '' }
    ]);
  };

  const handleUpdateField = (index, key, value) => {
    const updated = [...fields];
    updated[index][key] = value;
    setFields(updated);
  };

  const handleChoicesChange = (index, choicesStr) => {
    const arr = choicesStr.split(',').map((s) => s.trim()).filter(Boolean);
    const updated = [...fields];
    updated[index].choices = arr;
    setFields(updated);
  };

  const handleRemoveField = (index) => {
    if (fields.length === 1) {
      alert('A form must contain at least one field.');
      return;
    }
    setFields(fields.filter((_, idx) => idx !== index));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async (publish = false) => {
    if (!title.trim()) {
      alert('Please enter a form title.');
      return;
    }
    for (let f of fields) {
      if (!f.field_name.trim()) {
        alert('All fields must have a valid field name.');
        return;
      }
    }

    setSaving(true);
    setError('');

    const payload = {
      title,
      description,
      allow_document_upload: allowDocUpload,
      fields: fields.map((f, idx) => ({
        field_name: f.field_name,
        data_type: f.data_type,
        description: f.description,
        required: f.required,
        is_sensitive_number: Boolean(f.is_sensitive_number),
        position: idx,
        choices: f.data_type === 'Choice' ? (Array.isArray(f.choices) ? f.choices : []) : null,
        question_en: f.question_en || null,
        question_ta: f.question_ta || null
      }))
    };

    try {
      let savedForm;
      if (isEdit) {
        savedForm = await adminFormsApi.update(id, payload);
      } else {
        savedForm = await adminFormsApi.create(payload);
      }

      if (publish && savedForm) {
        await adminFormsApi.publish(savedForm.id);
        setToastMessage('Form published');
      } else {
        setToastMessage('Form saved');
      }

      setTimeout(() => navigate('/admin'), 1200);
    } catch (err) {
      setError(err.message || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const previewFields = fields.map((f, idx) => ({
    id: f.id || idx + 1,
    field_name: f.field_name || `field_${idx + 1}`,
    data_type: f.data_type
  }));

  return (
    <div className="min-h-screen bg-[#DCE7E0] text-[#2A2E2C] flex flex-col font-sans-ui">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {toastMessage && (
          <Toast message={toastMessage} />
        )}

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#DCE7E0]">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="p-2 bg-[#F6F8F5] border border-[#DCE7E0] text-[#2A2E2C] hover:bg-[#DCE7E0] rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-serif text-[#2A2E2C]">
                {isEdit ? 'Edit Form' : 'Create Form'}
              </h1>
              <p className="text-xs text-[#2A2E2C]/75 mt-0.5">
                Define numbered field rows and preview the application slip.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 border border-[#1F3FBF] text-[#1F3FBF] hover:bg-[#1F3FBF] hover:text-[#F6F8F5] font-semibold text-sm rounded transition-colors cursor-pointer"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-2 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F6F8F5] font-semibold text-sm rounded transition-colors flex items-center space-x-2 cursor-pointer focus:ring-2 focus:ring-[#1F3FBF]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish form</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#F6F8F5] border-l-4 border-[#B3261E] text-[#B3261E] text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#2A2E2C]/75 bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg">
            <Loader2 className="w-8 h-8 animate-spin text-[#1F3FBF] mb-4" />
            <p className="text-sm">Loading form configuration...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Form Metadata & Numbered Fields (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Form Info Card */}
              <div className="bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg p-6 sheet-shadow space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
                    Form Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Income certificate request"
                    className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-2 text-base text-[#2A2E2C] font-serif font-bold focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2A2E2C]/75 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description for citizens and staff"
                    className="w-full bg-[#F6F8F5] border border-[#DCE7E0] rounded px-3 py-2 text-sm text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
                  />
                </div>

                <label className="flex items-center space-x-2 text-xs text-[#2A2E2C]/75 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={allowDocUpload}
                    onChange={(e) => setAllowDocUpload(e.target.checked)}
                    className="rounded border-[#DCE7E0] text-[#1F3FBF] focus:ring-[#1F3FBF]"
                  />
                  <span>Allow citizens to upload supporting documents (.pdf / .docx)</span>
                </label>
              </div>

              {/* Numbered Fields Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold font-serif text-[#2A2E2C]">
                  Form Fields (Ordered)
                </h2>
                <button
                  type="button"
                  onClick={handleAddField}
                  className="px-3 py-1.5 bg-[#1F3FBF] text-[#F6F8F5] text-xs font-semibold rounded flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Field</span>
                </button>
              </div>

              {/* Drag and drop field list */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {fields.map((field, idx) => (
                    <SortableFieldItem
                      key={field.id}
                      id={field.id}
                      index={idx}
                      field={field}
                      updateField={handleUpdateField}
                      removeField={handleRemoveField}
                      choicesEditor={handleChoicesChange}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* Right: Live Preview of Sheet (5 cols) */}
            <div className="lg:col-span-5">
              <div className="sticky top-24 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#2A2E2C]/75">
                    Live Application Slip Preview
                  </span>
                </div>
                <div className="h-[600px]">
                  <Sheet
                    formTitle={title || "Application Slip"}
                    fields={previewFields}
                    answers={{}}
                    allAnswered={false}
                    submissionStatus="in_progress"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
