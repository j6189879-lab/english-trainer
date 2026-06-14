const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const corpusAPI = {
  getItems: (params) => request(`/corpus/items?${new URLSearchParams(params)}`),
  scan: () => request('/corpus/scan', { method: 'POST' }),
  stats: () => request('/corpus/stats'),
};

export const trainingAPI = {
  getToday: () => request('/training/today'),
  submit: (data) => request('/training/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  history: () => request('/training/history'),
};

export const progressAPI = {
  overview: () => request('/progress/overview'),
  stats: () => request('/progress/stats'),
};

export const settingsAPI = {
  get: () => request('/settings'),
  update: (data) => request('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  testAI: () => request('/settings/test-ai', { method: 'POST' }),
};
