const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('voiceform_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || response.statusText || 'API Request Failed';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// Auth APIs
export const authApi = {
  register: (email, password, username) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username: username || undefined }),
    }),
  login: (email, password) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => apiRequest('/auth/me'),
};

// Admin Forms APIs
export const adminFormsApi = {
  list: () => apiRequest('/admin/forms'),
  get: (id) => apiRequest(`/admin/forms/${id}`),
  create: (formData) =>
    apiRequest('/admin/forms', {
      method: 'POST',
      body: JSON.stringify(formData),
    }),
  update: (id, formData) =>
    apiRequest(`/admin/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(formData),
    }),
  publish: (id) =>
    apiRequest(`/admin/forms/${id}/publish`, {
      method: 'POST',
    }),
  archive: (id) =>
    apiRequest(`/admin/forms/${id}/archive`, {
      method: 'POST',
    }),
  unarchive: (id, targetStatus) => {
    const query = targetStatus ? `?target_status=${targetStatus}` : '';
    return apiRequest(`/admin/forms/${id}/unarchive${query}`, {
      method: 'POST',
    });
  },
  delete: (id) =>
    apiRequest(`/admin/forms/${id}`, {
      method: 'DELETE',
    }),
  getSubmissions: (formId, versionId) => {
    const query = versionId ? `?version_id=${versionId}` : '';
    return apiRequest(`/admin/forms/${formId}/submissions${query}`);
  },
  downloadExcel: async (formId, versionId) => {
    const token = localStorage.getItem('voiceform_token');
    const query = versionId ? `?version_id=${versionId}` : '';
    const res = await fetch(`/admin/forms/${formId}/submissions.xlsx${query}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to export Excel file');
    }
    return res.blob();
  },
  getExcelUrl: (formId, versionId) => {
    const token = localStorage.getItem('voiceform_token');
    const params = new URLSearchParams();
    if (versionId) params.append('version_id', versionId);
    if (token) params.append('token', token);
    const query = params.toString() ? `?${params.toString()}` : '';
    return `/admin/forms/${formId}/submissions.xlsx${query}`;
  },
  getCSVUrl: (formId, versionId) => {
    const token = localStorage.getItem('voiceform_token');
    const params = new URLSearchParams();
    if (versionId) params.append('version_id', versionId);
    if (token) params.append('token', token);
    const query = params.toString() ? `?${params.toString()}` : '';
    return `/admin/forms/${formId}/submissions.csv${query}`;
  },
};

// User Forms & Submissions APIs
export const userFormsApi = {
  listPublished: () => apiRequest('/forms'),
  getPublished: (id) => apiRequest(`/forms/${id}`),
  startSubmission: (formId) =>
    apiRequest(`/forms/${formId}/submissions`, {
      method: 'POST',
    }),
  listSubmissions: () => apiRequest('/submissions'),
  getSubmission: (id) => apiRequest(`/submissions/${id}`),
  deleteSubmission: (id) =>
    apiRequest(`/submissions/${id}`, {
      method: 'DELETE',
    }),
  completeSubmission: (id, answers) =>
    apiRequest(`/submissions/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(answers || []),
    }),
};
