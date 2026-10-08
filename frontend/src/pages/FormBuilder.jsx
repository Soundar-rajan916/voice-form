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
  Plus, Trash2, GripVertical, Save, CheckCircle2, ArrowLeft, Loader2, Sparkles, MessageSquare, AlertCircle, RefreshCw
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
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg mb-4 space-y-4 relative group hover:border-slate-700 transition-all"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-800/60 px-2.5 py-1 rounded-md">
            Field #{index + 1}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => updateField(index, 'required', e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Required</span>
          </label>
          <button
            type="button"
            onClick={() => removeField(index)}
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Field Name
          </label>
          <input
            type="text"
            required
            value={field.field_name}
            onChange={(e) => updateField(index, 'field_name', e.target.value)}
            placeholder="e.g. full_name, age, phone"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Data Type
          </label>
          <select
            value={field.data_type}
            onChange={(e) => updateField(index, 'data_type', e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
          >
            {DATA_TYPES.map((dt) => (
              <option key={dt} value={dt}>
                {dt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Description (LLM Extraction Context)
        </label>
        <input
          type="text"
          required
          value={field.description}
          onChange={(e) => updateField(index, 'description', e.target.value)}
          placeholder="e.g. Full legal name of the user"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {field.data_type === 'Choice' && choicesEditor(index, field)}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
        <div>
          <label className="block text-[11px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">
            Question (English)
          </label>
          <input
            type="text"
            value={field.question_en || ''}
            onChange={(e) => updateField(index, 'question_en', e.target.value)}
            placeholder="What is your full name?"
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-purple-300 uppercase tracking-wider mb-1">
            Question (Tamil / தமிழ்)
          </label>
          <input
            type="text"
            value={field.question_ta || ''}
            onChange={(e) => updateField(index, 'question_ta', e.target.value)}
            placeholder="உங்கள் பெயர் என்ன?"
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:border-purple-500 focus:outline-none"
          />
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
    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
        <span>Choice Options</span>
        <button
          type="button"
          onClick={() => addChoice(fieldIndex)}
          className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Option</span>
        </button>
      </div>

      <div className="space-y-2">
        {(field.choices || []).map((ch, choiceIdx) => (
          <div key={choiceIdx} className="flex items-center space-x-2">
            <input
              type="text"
              value={ch}
              onChange={(e) => handleChoiceChange(fieldIndex, choiceIdx, e.target.value)}
              placeholder={`Option ${choiceIdx + 1}`}
              className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeChoice(fieldIndex, choiceIdx)}
              className="p-1 text-slate-500 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-extrabold text-white">
                  {isNew ? 'Create New Form' : 'Edit Voice Form'}
                </h1>
                {!isNew && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    v{versionNumber} ({formStatus})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Define fields, descriptions, and choices for voice chatbot extraction.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => saveForm(false)}
              disabled={saving}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-sm transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-400" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              onClick={() => saveForm(true)}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish Form</span>
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
            <p className="text-sm">Loading form schema...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                  General Form Details
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Form Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. User Profile Registration Form"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the form purpose..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                    Form Fields ({fields.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addField}
                    className="px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center space-x-1"
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
                <div className="flex items-center space-x-2 text-indigo-400 mb-4 pb-3 border-b border-slate-800">
                  <MessageSquare className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Live Chat Preview
                  </h3>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  <div className="p-3 bg-indigo-950/60 border border-indigo-800/60 rounded-xl text-xs text-indigo-200">
                    👋 <strong>Bot Greeting:</strong> "Hello! Let's get started with {title || 'this form'}."
                  </div>

                  {fields.map((f, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                          Question #{idx + 1} ({f.data_type})
                        </span>
                        <p className="text-slate-200 font-medium">
                          {f.question_en || `What is your ${f.field_name}?`}
                        </p>
                        <p className="text-purple-300 text-[11px] italic">
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
