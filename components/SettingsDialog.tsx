import React, { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff, Check, AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { fetchAPIKeys, storeAPIKey, deleteAPIKey, APIKeyInfo } from '../services/apiService';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification: (message: string) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, onNotification }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedKeys, setSavedKeys] = useState<APIKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadKeys();
      setApiKey('');
      setShowKey(false);
      setError(null);
    }
  }, [isOpen]);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const keys = await fetchAPIKeys();
      setSavedKeys(keys);
    } catch {
      // Backend might not be available yet — that's okay.
      setSavedKeys([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError('Please enter an API key');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await storeAPIKey('gemini', trimmed);
      setApiKey('');
      setShowKey(false);
      await loadKeys();
      onNotification('API key saved successfully');
    } catch {
      setError('Failed to save API key. Is the backend running?');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteAPIKey(name);
      await loadKeys();
      onNotification('API key removed');
    } catch {
      setError('Failed to delete API key');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && apiKey.trim()) handleSave();
  };

  if (!isOpen) return null;

  const hasGeminiKey = savedKeys.some(k => k.name === 'gemini');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-md mx-4 bg-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white" id="settings-dialog-title">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gemini API Key
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Your key is encrypted and stored securely on the server. Get one at{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline"
              >
                Google AI Studio
              </a>.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setError(null); }}
                  placeholder={hasGeminiKey ? 'Enter new key to update...' : 'Enter your Gemini API key...'}
                  className="w-full px-3 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !apiKey.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Saved Keys */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Stored Keys</h3>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            ) : savedKeys.length === 0 ? (
              <p className="text-sm text-gray-600 py-2">No API keys configured yet.</p>
            ) : (
              <div className="space-y-2">
                {savedKeys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-green-900/30 rounded-md">
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{k.name}</p>
                        <p className="text-xs text-gray-500">{k.provider} &middot; updated {new Date(k.updated_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(k.name)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
