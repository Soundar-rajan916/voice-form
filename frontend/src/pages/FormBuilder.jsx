import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminFormsApi } from '../api/client';
import { Navbar } from '../components/Navbar';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Trash2, GripVertical, Save, CheckCircle2, ArrowLeft, Loader2, Sparkles, MessageSquare, AlertCircle, RefreshCw, FileText
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="neu-flat p-5 mb-4 space-y-4 relative group"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#051B28]/50 pb-3">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1.5 neu-button text-[#BFD7EA]/60 hover:text-[#FFFFFF]"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono font-bold text-[#BFD7EA] neu-pill px-3 py-1">
            Field #{index + 1}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs text-[#BFD7EA] cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => updateField(index, 'required', e.target.checked)}
              className="rounded border-[#087E8B] bg-[#0B3954] text-[#087E8B] focus:ring-[#BFD7EA]"
            />
            <span>Required</span>
          </label>
          <button
            type="button"
            onClick={() => removeField(index)}
            className="p-1.5 neu-button text-[#BFD7EA]/60 hover:text-[#FF5A5F] cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#BFD7EA] uppercase tracking-wider mb-1">
            Field Name
          </label>
          <div className="neu-inset px-3 py-2">
            <input
              type="text"
              required
              value={field.field_name}
              onChange={(e) => updateField(index, 'field_name', e.target.value)}
              placeholder="e.g. full_name, age, phone"
              className="w-full bg-transparent text-[#FFFFFF] text-sm focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#BFD7EA] uppercase tracking-wider mb-1">
            Data Type
          </label>
          <div className="neu-inset px-3 py-2">
            <select
              value={field.data_type}
              onChange={(e) => updateField(index, 'data_type', e.target.value)}
              className="w-full bg-transparent text-[#FFFFFF] text-sm focus:outline-none"
            >
              {DATA_TYPES.map((dt) => (
                <option key={dt} value={dt} className="bg-[#0B3954]">
                  {dt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#BFD7EA] uppercase tracking-wider mb-1">
          Description (LLM Extraction Context)
        </label>
        <div className="neu-inset px-3 py-2">
          <input
            type="text"
            required
            value={field.description}
            onChange={(e) => updateField(index, 'description', e.target.value)}
            placeholder="e.g. Full legal name of the user"
            className="w-full bg-transparent text-[#FFFFFF] text-sm focus:outline-none"
          />
        </div>
      </div>

      {field.data_type === 'Choice' && choicesEditor(index, field)}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#051B28]/50">
        <div>
          <label className="block text-[11px] font-semibold text-[#BFD7EA] uppercase tracking-wider mb-1">
            Question (English)
          </label>
          <div className="neu-inset px-3 py-1.5">
            <input
              type="text"
              value={field.question_en || ''}
              onChange={(e) => updateField(index, 'question_en', e.target.value)}
              placeholder="What is your full name?"
              className="w-full bg-transparent text-[#FFFFFF] text-xs focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#BFD7EA] uppercase tracking-wider mb-1">
            Question (Tamil / தமிழ்)
          </label>
          <div className="neu-inset px-3 py-1.5">
            <input
              type="text"
              value={field.question_ta || ''}
              onChange={(e) => updateField(index, 'question_ta', e.target.value)}
              placeholder="உங்கள் பெயர் என்ன?"
              className="w-full bg-transparent text-[#FFFFFF] text-xs focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const FormBuilder = () => {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [allowDocumentUpload, setAllowDocumentUpload] = useState(true);
  const [fields, setFields] = useState([]);
  const [formStatus, setFormStatus] = useState('draft');
  const [versionNumber, setVersionNumber] = useState(1);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!isNew) {
      const loadForm = async () => {
        try {
          const data = await adminFormsApi.get(id);
          setTitle(data.title);
          setDescription(data.description || '');
          setAllowDocumentUpload(data.allow_document_upload !== false);
          setFormStatus(data.status);
          if (data.current_version) {
            setVersionNumber(data.current_version.version_number);
            setFields(data.current_version.fields || []);
          }
        } catch (err) {
          setError(err.message || 'Failed to load form');
        } finally {
          setLoading(false);
        }
      };
      loadForm();
    } else {
      setFields([
        {
          field_name: 'full_name',
          data_type: 'String',
          description: 'full name of the user',
          required: true,
          position: 0,
          choices: [],
          question_en: 'What is your full name?',
          question_ta: 'உங்கள் பெயர் என்ன?'
        },
        {
          field_name: 'age',
          data_type: 'Number',
          description: 'age in years',
          required: true,
          position: 1,
          choices: [],
          question_en: 'What is your age in years?',
          question_ta: 'உங்கள் வயது என்ன?'
        },
        {
          field_name: 'email',
          data_type: 'Email',
          description: 'user email address',
          required: true,
          position: 2,
          choices: [],
          question_en: 'What is your email address?',
          question_ta: 'உங்கள் மின்னஞ்சல் முகவரி என்ன?'
        },
        {
          field_name: 'mobile_no',
          data_type: 'Phone',
          description: '10 digit mobile number',
          required: true,
          position: 3,
          choices: [],
          question_en: 'What is your 10 digit mobile number?',
          question_ta: 'உங்கள் அலைபேசி எண் என்ன?'
        }
      ]);
    }
  }, [id, isNew]);

  const addField = () => {
    const newField = {
      field_name: `field_${fields.length + 1}`,
      data_type: 'String',
      description: '',
      required: true,
      position: fields.length,
      choices: [],
      question_en: '',
      question_ta: ''
    };
    setFields([...fields, newField]);
  };

  const removeField = (index) => {
    const updated = fields.filter((_, i) => i !== index);
    setFields(updated);
  };

  const updateField = (index, key, value) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    setFields(updated);
  };

  const handleChoiceChange = (fieldIndex, choiceIndex, val) => {
    const updated = [...fields];
    const choices = [...(updated[fieldIndex].choices || [])];
    choices[choiceIndex] = val;
    updated[fieldIndex].choices = choices;
    setFields(updated);
  };

  const addChoice = (fieldIndex) => {
    const updated = [...fields];
    const choices = [...(updated[fieldIndex].choices || []), `Option ${(updated[fieldIndex].choices?.length || 0) + 1}`];
    updated[fieldIndex].choices = choices;
    setFields(updated);
  };

  const removeChoice = (fieldIndex, choiceIndex) => {
    const updated = [...fields];
    const choices = updated[fieldIndex].choices.filter((_, i) => i !== choiceIndex);
    updated[fieldIndex].choices = choices;
    setFields(updated);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((_, idx) => `field-${idx}` === active.id);
      const newIndex = fields.findIndex((_, idx) => `field-${idx}` === over.id);
      const reordered = arrayMove(fields, oldIndex, newIndex);
      const updated = reordered.map((f, i) => ({ ...f, position: i }));
      setFields(updated);
    }
  };

  const saveForm = async (publish = false) => {
    if (!title.trim()) {
      setError('Form title is required');
      return;
    }
    if (fields.length === 0) {
      setError('Form must have at least one field');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        title,
        description,
        allow_document_upload: allowDocumentUpload,
        fields: fields.map((f, idx) => ({
          field_name: f.field_name,
          data_type: f.data_type,
          description: f.description,
          required: f.required,
          position: idx,
          choices: f.choices || [],
          question_en: f.question_en || null,
          question_ta: f.question_ta || null
        }))
      };

      let savedForm;
      if (isNew) {
        savedForm = await adminFormsApi.create(payload);
      } else {
        savedForm = await adminFormsApi.update(id, payload);
      }

      if (publish) {
        await adminFormsApi.publish(savedForm.id);
      }

      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const choicesEditor = (fieldIndex, field) => (
    <div className="neu-inset p-3 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-[#BFD7EA]">
        <span>Choice Options</span>
        <button
          type="button"
          onClick={() => addChoice(fieldIndex)}
          className="text-[#BFD7EA] hover:text-[#FFFFFF] flex items-center space-x-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Option</span>
        </button>
      </div>

      <div className="space-y-2">
        {(field.choices || []).map((ch, choiceIdx) => (
          <div key={choiceIdx} className="flex items-center space-x-2">
            <div className="flex-1 neu-inset px-3 py-1.5">
              <input
                type="text"
                value={ch}
                onChange={(e) => handleChoiceChange(fieldIndex, choiceIdx, e.target.value)}
                placeholder={`Option ${choiceIdx + 1}`}
                className="w-full bg-transparent text-[#FFFFFF] text-xs focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => removeChoice(fieldIndex, choiceIdx)}
              className="p-1 neu-button text-[#BFD7EA]/60 hover:text-[#FF5A5F] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B3954] text-[#FFFFFF] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#051B28]/50">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="p-2.5 neu-button text-[#BFD7EA] hover:text-[#FFFFFF] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-extrabold text-[#FFFFFF]">
                  {isNew ? 'Create New Form' : 'Edit Voice Form'}
                </h1>
                {!isNew && (
                  <span className="px-3 py-0.5 neu-pill text-xs font-mono font-bold text-[#BFD7EA]">
                    v{versionNumber} ({formStatus})
                  </span>
                )}
              </div>
              <p className="text-xs text-[#BFD7EA] mt-0.5">
                Define fields, descriptions, choices, and document upload settings.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => saveForm(false)}
              disabled={saving}
              className="px-4 py-2.5 neu-button text-[#BFD7EA] hover:text-[#FFFFFF] font-medium text-sm transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#BFD7EA]" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              onClick={() => saveForm(true)}
              disabled={saving}
              className="px-4 py-2.5 neu-accent-button font-semibold text-sm flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish Form</span>
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
            <p className="text-sm">Loading form schema...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="neu-flat p-6 space-y-4">
                <h3 className="text-sm font-bold text-[#BFD7EA] uppercase tracking-wider mb-2">
                  General Form Details
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-[#BFD7EA] uppercase tracking-wider mb-1">
                    Form Title
                  </label>
                  <div className="neu-inset px-4 py-2.5">
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. User Profile Registration Form"
                      className="w-full bg-transparent text-[#FFFFFF] text-sm focus:outline-none font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#BFD7EA] uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <div className="neu-inset px-4 py-2.5">
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of the form purpose..."
                      className="w-full bg-transparent text-[#FFFFFF] text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#051B28]/50">
                  <div>
                    <span className="text-xs font-semibold text-[#BFD7EA] uppercase tracking-wider block">
                      Allow Document Upload
                    </span>
                    <span className="text-[11px] text-[#BFD7EA]/70">
                      Users can attach PDF/DOCX files to fill form fields using Vision AI.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDocumentUpload}
                      onChange={(e) => setAllowDocumentUpload(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#051B28] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#087E8B]"></div>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#BFD7EA] uppercase tracking-wider">
                    Form Fields ({fields.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addField}
                    className="px-3 py-1.5 neu-accent-button text-xs font-medium transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Field</span>
                  </button>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map((_, idx) => `field-${idx}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {fields.map((field, index) => (
                      <SortableFieldItem
                        key={`field-${index}`}
                        id={`field-${index}`}
                        index={index}
                        field={field}
                        updateField={updateField}
                        removeField={removeField}
                        choicesEditor={choicesEditor}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            <div className="space-y-6">
              <div className="neu-flat p-6 sticky top-24">
                <div className="flex items-center space-x-2 text-[#BFD7EA] mb-4 pb-3 border-b border-[#051B28]/50">
                  <MessageSquare className="w-5 h-5 text-[#BFD7EA]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#FFFFFF]">
                    Live Chat Preview
                  </h3>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  <div className="p-3 neu-inset text-xs text-[#BFD7EA]">
                    👋 <strong>Bot Greeting:</strong> "Hello! Let's get started with {title || 'this form'}."
                  </div>

                  {fields.map((f, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="p-3 neu-inset text-xs space-y-1">
                        <span className="text-[10px] font-mono text-[#BFD7EA]/70 uppercase tracking-wider">
                          Question #{idx + 1} ({f.data_type})
                        </span>
                        <p className="text-[#FFFFFF] font-medium">
                          {f.question_en || `What is your ${f.field_name}?`}
                        </p>
                        <p className="text-[#BFD7EA] text-[11px] italic">
                          {f.question_ta || `உங்கள் ${f.field_name} என்ன?`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
