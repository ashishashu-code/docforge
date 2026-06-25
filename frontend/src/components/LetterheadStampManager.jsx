import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function LetterheadStampManager() {
  const [assets, setAssets] = useState({ letterhead: null, stamp: null });
  const [letterheadLoading, setLetterheadLoading] = useState(false);
  const [stampLoading, setStampLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const fetchAssetInfo = async () => {
    // Retrieve from local storage
    const lhName = localStorage.getItem('docforge_letterhead_name');
    const stampName = localStorage.getItem('docforge_stamp_name');
    
    // Fallback to server if not found in local storage
    let serverLetterhead = null;
    let serverStamp = null;
    try {
      const res = await axios.get(`${API_BASE}/assets/info`);
      serverLetterhead = res.data.letterhead;
      serverStamp = res.data.stamp;
    } catch (err) {
      console.error("Failed to load asset info from server:", err);
    }
    
    setAssets({
      letterhead: lhName || serverLetterhead,
      stamp: stampName || serverStamp,
      localLetterheadName: lhName,
      localStampName: stampName,
      localLetterheadData: localStorage.getItem('docforge_letterhead_data'),
      localStampData: localStorage.getItem('docforge_stamp_data')
    });
  };

  useEffect(() => {
    fetchAssetInfo();
  }, []);

  const handleUpload = async (file, fieldname) => {
    if (!file) return;

    const setLoading = fieldname === 'letterhead' ? setLetterheadLoading : setStampLoading;
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        try {
          localStorage.setItem(`docforge_${fieldname}_data`, dataUrl);
          localStorage.setItem(`docforge_${fieldname}_name`, file.name);
          
          setStatus({
            type: 'success',
            message: `${fieldname.charAt(0).toUpperCase() + fieldname.slice(1)} saved in browser local storage successfully!`
          });
          
          fetchAssetInfo();
        } catch (storageError) {
          console.error("Local storage quota exceeded:", storageError);
          setStatus({
            type: 'error',
            message: 'Browser storage is full. Please optimize your file size (under 1.5MB recommended).'
          });
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setStatus({ type: 'error', message: `Failed to read file ${file.name}` });
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setStatus({
        type: 'error',
        message: err.message || `Failed to save ${fieldname}.`
      });
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-[var(--nm-text-primary)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--nm-text-primary)]">Company Identity Assets</h1>
        <p className="mt-2 text-[var(--nm-text-muted)] text-sm">
          Upload your official company letterhead and signature stamp. These will be automatically incorporated into your generated compliance and tender documents.
        </p>
      </div>

      {status.message && (
        <div className={`p-4 rounded flex items-center gap-3 border ${
          status.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400' 
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400'
        } font-medium`}>
          {status.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />}
          <span>{status.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Letterhead Upload Section */}
        <div className="glass-panel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-300 dark:border-slate-700 pb-3">
              <h2 className="text-xl font-semibold text-[var(--nm-text-primary)] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--nm-brand)]" />
                1. Company Letterhead
              </h2>
              {assets.letterhead ? (
                <span className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--nm-brand-soft)] text-[var(--nm-brand)] border border-[var(--nm-brand-border)]">
                  Active
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[var(--nm-text-muted)]">
                  Missing
                </span>
              )}
            </div>
            
            <p className="text-sm text-[var(--nm-text-muted)] mb-6">
              Used as the background/header for every generated document. Supports PDF layout (overlayed onto generated pages) or PNG/JPG (inserted in header).
            </p>

            {assets.letterhead && (
              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-300 dark:border-slate-700 rounded mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-[var(--nm-brand)]" />
                  <div>
                    <div className="text-sm font-bold text-[var(--nm-text-primary)] truncate max-w-[200px]">
                      {assets.letterhead}
                    </div>
                    <div className="text-xs text-[var(--nm-text-muted)] mt-0.5 font-medium">
                      Currently applied to all outputs
                    </div>
                  </div>
                </div>
                {/* Visual indicator of letterhead type */}
                <span className="text-xs font-bold text-[var(--nm-text-primary)] bg-[var(--nm-bg-darker)] px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700">
                  {assets.letterhead.split('.').pop().toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded cursor-pointer py-8 transition-all ${
              letterheadLoading 
                ? 'border-[var(--nm-brand)] bg-slate-150/40 dark:bg-slate-900/40 pointer-events-none' 
                : 'border-slate-300 dark:border-slate-700 hover:border-[var(--nm-brand)] bg-slate-50/50 hover:bg-slate-100/50 dark:bg-slate-900/10 dark:hover:bg-slate-800/10'
            }`}>
              <div className="flex flex-col items-center justify-center space-y-2">
                <Upload className={`w-8 h-8 ${letterheadLoading ? 'animate-bounce text-[var(--nm-brand)]' : 'text-[var(--nm-text-muted)]'}`} />
                <span className="text-sm font-semibold text-[var(--nm-text-primary)]">
                  {letterheadLoading ? 'Uploading...' : 'Upload Letterhead File'}
                </span>
                <span className="text-xs text-[var(--nm-text-muted)]">
                  PDF, PNG, or JPG (Max 10MB)
                </span>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".pdf,.png,.jpg,.jpeg" 
                onChange={(e) => handleUpload(e.target.files[0], 'letterhead')}
              />
            </label>
          </div>
        </div>

        {/* Stamp Upload Section */}
        <div className="glass-panel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-300 dark:border-slate-700 pb-3">
              <h2 className="text-xl font-semibold text-[var(--nm-text-primary)] flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-500" />
                2. Company Stamp / Seal
              </h2>
              {assets.stamp ? (
                <span className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400">
                  Active
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[var(--nm-text-muted)]">
                  Optional
                </span>
              )}
            </div>

            <p className="text-sm text-[var(--nm-text-muted)] mb-6">
              Official company seal or signature block. Must be a PNG image with a transparent background so it overlays signature lines cleanly without blocky white boxes.
            </p>

            {assets.stamp && (
              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-300 dark:border-slate-700 rounded mb-6 flex items-center gap-4">
                <div className="w-16 h-16 bg-white dark:bg-slate-950 rounded flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-700">
                  <img 
                    src={assets.localStampData || `http://localhost:5000/assets/stamps/${assets.stamp}?t=${Date.now()}`} 
                    alt="Stamp Preview" 
                    className="max-w-full max-h-full object-contain p-1"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/150?text=Stamp';
                    }}
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--nm-text-primary)] truncate max-w-[200px]">
                    {assets.stamp}
                  </div>
                  <div className="text-xs text-[var(--nm-text-muted)] mt-0.5 font-medium">
                    Transparent PNG loaded
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded cursor-pointer py-8 transition-all ${
              stampLoading 
                ? 'border-[var(--nm-brand)] bg-slate-150/40 dark:bg-slate-900/40 pointer-events-none' 
                : 'border-slate-300 dark:border-slate-700 hover:border-[var(--nm-brand)] bg-slate-50/50 hover:bg-slate-100/50 dark:bg-slate-900/10 dark:hover:bg-slate-800/10'
            }`}>
              <div className="flex flex-col items-center justify-center space-y-2">
                <Upload className={`w-8 h-8 ${stampLoading ? 'animate-bounce text-[var(--nm-brand)]' : 'text-[var(--nm-text-muted)]'}`} />
                <span className="text-sm font-semibold text-[var(--nm-text-primary)]">
                  {stampLoading ? 'Uploading...' : 'Upload Stamp File'}
                </span>
                <span className="text-xs text-[var(--nm-text-muted)]">
                  PNG with transparency only (Max 5MB)
                </span>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".png" 
                onChange={(e) => handleUpload(e.target.files[0], 'stamp')}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
