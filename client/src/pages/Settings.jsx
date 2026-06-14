import React, { useState, useEffect } from 'react';
import { settingsAPI, corpusAPI } from '../api';

export default function Settings() {
  const [settings, setSettings] = useState({
    obsidianPath: '',
    dailyQuestionCount: '5',
    extraReviewCount: '0',
    deepseekApiKey: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const data = await settingsAPI.get();
      setSettings((prev) => ({ ...prev, ...data }));
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load settings: ' + err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setSaveStatus(null);
      await settingsAPI.update(settings);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setSaveStatus('error');
      setMessage({ type: 'error', text: 'Failed to save: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAI() {
    try {
      setTesting(true);
      setMessage(null);
      // Auto-save settings (especially the API key) before testing
      await settingsAPI.update(settings);
      const result = await settingsAPI.testAI();
      setMessage({ type: 'success', text: `✅ AI connection OK! Model: ${result.model}` });
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setTesting(false);
    }
  }

  async function handleScan() {
    if (!settings.obsidianPath) {
      setMessage({ type: 'error', text: 'Please configure Obsidian folder path first.' });
      return;
    }
    try {
      setScanning(true);
      setMessage(null);
      const result = await corpusAPI.scan();
      setMessage({
        type: 'success',
        text: `Scan complete! ${result.totalProcessed} items found. (Added: ${result.addedCount}, Updated: ${result.updatedCount})`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'Scan failed: ' + err.message });
    } finally {
      setScanning(false);
    }
  }

  function handleChange(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Settings</h2>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Obsidian Folder */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Obsidian Folder Path
        </label>
        <input
          type="text"
          className="input-field"
          placeholder="e.g., C:\Users\cjy18\个人知识库（ai接入）\English Listening"
          value={settings.obsidianPath}
          onChange={(e) => handleChange('obsidianPath', e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1">
          Point to the folder containing your daily English listening notes (*.md)
        </p>
      </div>

      {/* Question Counts */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Daily Training</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Base Question Count
            </label>
            <input
              type="number"
              min="1"
              max="20"
              className="input-field"
              value={settings.dailyQuestionCount}
              onChange={(e) => handleChange('dailyQuestionCount', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Extra Review Questions
            </label>
            <input
              type="number"
              min="0"
              max="20"
              className="input-field"
              value={settings.extraReviewCount}
              onChange={(e) => handleChange('extraReviewCount', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* DeepSeek API Key */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          DeepSeek API Key
        </label>
        <input
          type="password"
          className="input-field"
          placeholder="sk-..."
          value={settings.deepseekApiKey}
          onChange={(e) => handleChange('deepseekApiKey', e.target.value)}
        />
        <div className="flex gap-3 mt-3">
          <button
            onClick={handleTestAI}
            disabled={testing || !settings.deepseekApiKey}
            className="btn-secondary text-sm"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="btn-secondary text-sm"
          >
            {scanning ? 'Scanning...' : 'Scan Obsidian Folder Now'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm"
          >
            {saving
              ? 'Saving...'
              : saveStatus === 'success'
              ? '✓ Saved'
              : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
