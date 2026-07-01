import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, FileCode, CheckCircle, AlertCircle, Trash, Edit, Plus, Save, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE ? `${import.meta.env.VITE_API_BASE}/api` : 'http://localhost:5000/api';

export default function TemplateManager({ externalTemplateId, clearExternalTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null); // Template object currently being created/edited
  const [parsingLoading, setParsingLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [editorMode, setEditorMode] = useState('easy'); // 'easy' or 'advanced'
  const [easyFields, setEasyFields] = useState({
    companyName: '',
    companyAddress: '',
    companyGst: '',
    companyPhone: '',
    companyEmail: '',
    terms: []
  });

  // Extract values from HTML for easy editor
  const extractEasyFields = (html) => {
    if (!html) return { companyName: '', companyAddress: '', companyGst: '', companyPhone: '', companyEmail: '', terms: [] };
    
    // 1. Company Name & Address
    let companyName = '';
    let companyAddress = '';
    const nameAddrRegex = /<h2[^>]*>([\s\S]*?)<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i;
    const nameAddrMatch = html.match(nameAddrRegex);
    if (nameAddrMatch) {
      companyName = nameAddrMatch[1].trim();
      companyAddress = nameAddrMatch[2].trim();
    } else {
      // Try h3
      const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/i;
      const h3Match = html.match(h3Regex);
      if (h3Match) companyName = h3Match[1].trim();
    }

    // 2. GST No
    let companyGst = '';
    const gstRegex = /GST\s*No:\s*([^<&<\n]*)/i;
    const gstMatch = html.match(gstRegex);
    if (gstMatch) companyGst = gstMatch[1].trim();

    // 3. Tel / Phone
    let companyPhone = '';
    const phoneRegex = /Tel:\s*([^<&<\n]*)/i;
    const phoneMatch = html.match(phoneRegex);
    if (phoneMatch) companyPhone = phoneMatch[1].trim();

    // 4. Email
    let companyEmail = '';
    const emailRegex = /email:\s*([^<&<\n]*)/i;
    const emailMatch = html.match(emailRegex);
    if (emailMatch) companyEmail = emailMatch[1].trim();

    // 5. Terms & Conditions
    let terms = [];
    const olRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/i;
    const olMatch = html.match(olRegex);
    if (olMatch) {
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(olMatch[1])) !== null) {
        terms.push(liMatch[1].trim());
      }
    }

    return { companyName, companyAddress, companyGst, companyPhone, companyEmail, terms };
  };

  const handleEasyFieldChange = (field, value) => {
    let currentHtml = editingTemplate.htmlContent;
    let newHtml = currentHtml;

    if (field === 'companyName') {
      const regex = /(<h2[^>]*>)([\s\S]*?)(<\/h2>)/i;
      if (regex.test(currentHtml)) {
        newHtml = currentHtml.replace(regex, `$1${value}$3`);
      }
    } else if (field === 'companyAddress') {
      const regex = /(<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>)([\s\S]*?)(<\/p>)/i;
      if (regex.test(currentHtml)) {
        newHtml = currentHtml.replace(regex, `$1${value}$3`);
      }
    } else if (field === 'companyGst') {
      const regex = /(GST\s*No:\s*)([^<&<\n]*)/i;
      if (regex.test(currentHtml)) {
        newHtml = currentHtml.replace(regex, `$1${value}`);
      }
    } else if (field === 'companyPhone') {
      const regex = /(Tel:\s*)([^<&<\n]*)/i;
      if (regex.test(currentHtml)) {
        newHtml = currentHtml.replace(regex, `$1${value}`);
      }
    } else if (field === 'companyEmail') {
      const regex = /(email:\s*)([^<&<\n]*)/i;
      if (regex.test(currentHtml)) {
        newHtml = currentHtml.replace(regex, `$1${value}`);
      }
    } else if (field === 'terms') {
      // value is the array of terms
      const olRegex = /(<ol[^>]*>)([\s\S]*?)(<\/ol>)/i;
      if (olRegex.test(currentHtml)) {
        const newLis = value.map(t => `      <li>${t}</li>`).join('\n');
        newHtml = currentHtml.replace(olRegex, `$1\n${newLis}\n$3`);
      }
    }

    handleHtmlChange(newHtml);
  };

  useEffect(() => {
    if (editingTemplate) {
      const fields = extractEasyFields(editingTemplate.htmlContent);
      setEasyFields(fields);
      // Auto-set editor mode based on templates
      if (editingTemplate.id === 'tpl_computer_quotation' || editingTemplate.htmlContent.includes('WEBLINE TECHNOLOGIES')) {
        setEditorMode('easy');
      } else {
        setEditorMode('advanced');
      }
    }
  }, [editingTemplate ? editingTemplate.id : null]);

  useEffect(() => {
    if (editingTemplate && editorMode === 'advanced') {
      const fields = extractEasyFields(editingTemplate.htmlContent);
      setEasyFields(fields);
    }
  }, [editingTemplate?.htmlContent, editorMode]);

  const getLocalTemplates = () => {
    try {
      const local = localStorage.getItem('docforge_templates');
      return local ? JSON.parse(local) : [];
    } catch (e) {
      console.error("Failed to parse local templates", e);
      return [];
    }
  };

  const saveLocalTemplates = (tpls) => {
    try {
      localStorage.setItem('docforge_templates', JSON.stringify(tpls));
    } catch (e) {
      console.error("Failed to save local templates", e);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    let serverTemplates = [];
    try {
      const res = await axios.get(`${API_BASE}/templates`);
      serverTemplates = res.data;
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to load templates from server. Loading local storage.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    }

    // Clear old cached templates from localStorage to force update
    try {
      const local = localStorage.getItem('docforge_templates');
      if (local) {
        let localTemplates = JSON.parse(local);
        const oldIds = ['tpl_computer_quotation', 'tpl_1782380109290', 'tpl_technical_compliance', 'tpl_Technical_compliance'];
        const hasOldTemplates = localTemplates.some(t => oldIds.includes(t.id));
        if (hasOldTemplates) {
          localTemplates = localTemplates.filter(t => !oldIds.includes(t.id));
          localStorage.setItem('docforge_templates', JSON.stringify(localTemplates));
        }
      }
    } catch (e) {
      console.error("Failed to clear cached template in template manager:", e);
    }

    const localTemplates = getLocalTemplates();
    const merged = [...serverTemplates];
    localTemplates.forEach(localTpl => {
      const index = merged.findIndex(t => t.id === localTpl.id || (t.name && t.name === localTpl.name));
      if (index >= 0) {
        merged[index] = {
          ...merged[index],
          ...localTpl,
          originalFile: localTpl.originalFile || merged[index].originalFile
        };
      } else {
        merged.push(localTpl);
      }
    });

    setTemplates(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (externalTemplateId && templates.length > 0) {
      const tpl = templates.find(t => t.id === externalTemplateId);
      if (tpl) {
        handleStartEdit(tpl);
      }
      if (clearExternalTemplate) clearExternalTemplate();
    }
  }, [externalTemplateId, templates]);

  const handleUploadTemplate = async (file) => {
    if (!file) return;

    // Read the file as base64 data URL to store in browser storage
    let base64File = null;
    try {
      base64File = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (e) {
      console.error("Failed to read file for local storage", e);
    }

    const formData = new FormData();
    formData.append('templateFile', file);

    setParsingLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const res = await axios.post(`${API_BASE}/templates/parse-sample`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Open in editor
      setEditingTemplate({
        id: '',
        name: res.data.name,
        htmlContent: res.data.htmlContent,
        placeholders: res.data.placeholders,
        hasSpecificationsTable: res.data.hasSpecificationsTable,
        marginSettings: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
        useLetterhead: true,
        originalFile: base64File ? { name: file.name, data: base64File } : null
      });
      
      setStatus({ type: 'success', message: 'Sample document parsed successfully! You can now refine the template.' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: err.response?.data?.error || 'Failed to parse template file.' });
    } finally {
      setParsingLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate.name.trim()) {
      alert('Template Name is required');
      return;
    }
    if (!editingTemplate.htmlContent.trim()) {
      alert('Template content is empty');
      return;
    }

    const templateId = editingTemplate.id || `tpl_${Date.now()}`;
    const templateToSave = {
      ...editingTemplate,
      id: templateId,
      updatedAt: new Date().toISOString()
    };

    try {
      const res = await axios.post(`${API_BASE}/templates`, templateToSave);
      if (res.data && res.data.template) {
        templateToSave.id = res.data.template.id;
      }
      setStatus({ type: 'success', message: 'Template saved successfully!' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to save template on server. Saved to browser storage.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    }

    // Always update/save in localStorage
    const local = getLocalTemplates();
    const updated = local.some(t => t.id === templateToSave.id || (templateToSave.name && t.name === templateToSave.name))
      ? local.map(t => (t.id === templateToSave.id || (templateToSave.name && t.name === templateToSave.name)) ? templateToSave : t)
      : [...local, templateToSave];
    saveLocalTemplates(updated);

    setEditingTemplate(null);
    fetchTemplates();
    setTimeout(() => setStatus({ type: '', message: '' }), 3000);
  };

  const handleDeleteTemplate = async (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await axios.delete(`${API_BASE}/templates/${id}`);
      } catch (err) {
        console.error(err);
      }

      // Delete from localStorage too
      const local = getLocalTemplates();
      const filtered = local.filter(t => t.id !== id);
      saveLocalTemplates(filtered);

      setStatus({ type: 'success', message: 'Template deleted successfully!' });
      fetchTemplates();
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    }
  };

  const handleStartManualCreate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      htmlContent: `<h2 style="text-align: center; text-decoration: underline; margin-bottom: 25px; color: #000000; font-weight: bold;">\n  {{document_name}}\n</h2>\n\n<h3 style="margin-bottom: 15px; font-weight: bold; color: #000000;">\n  {{product_name}} Specifications\n</h3>\n\n{{specifications_table}}\n\n<div style="margin-top: 30px; font-size: 14px; line-height: 1.6; color: #1f2937;">\n  <p>We accept all the terms and conditions <strong>Bid Number:</strong> {{bid_number}}<strong>Dated:</strong> {{bid_date}}</p>\n  \n  <p style="margin-top: 30px;">Thanking You,</p>\n  \n  <div style="margin-top: 15px;">\n    {{company_stamp}}\n  </div>\n</div>`,
      placeholders: ['document_name', 'product_name', 'bid_number', 'bid_date'],
      hasSpecificationsTable: true,
      marginSettings: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      useLetterhead: true,
      originalFile: null
    });
  };

  const handleStartEdit = (template) => {
    setEditingTemplate(JSON.parse(JSON.stringify(template)));
  };

  // Re-detect placeholders in HTML when text is edited
  const handleHtmlChange = (value) => {
    // Basic regex placeholder extractor
    const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
    const detected = new Set();
    let match;
    while ((match = regex.exec(value)) !== null) {
      const tag = match[1].trim();
      if (tag !== 'specifications_table' && tag !== 'company_stamp' && tag !== 'quotation_table') {
        detected.add(tag);
      }
    }
    
    setEditingTemplate(prev => ({
      ...prev,
      htmlContent: value,
      placeholders: Array.from(detected),
      hasSpecificationsTable: value.includes('{{specifications_table}}')
    }));
  };

  return (
    <div className="space-y-6 text-[var(--nm-text-primary)]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--nm-text-primary)]">Document Templates</h1>
          <p className="mt-2 text-[var(--nm-text-muted)] text-sm">
            Create compliance document templates. Upload a DOCX/PDF master file, map placeholders, edit layout HTML, and configure page formatting.
          </p>
        </div>
        {!editingTemplate && (
          <div className="flex items-center gap-3">
            <button onClick={handleStartManualCreate} className="glass-btn-secondary">
              <Plus className="w-4 h-4" /> Create Blank Template
            </button>
            
            <label className={`glass-btn-primary cursor-pointer ${parsingLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className={`w-4 h-4 ${parsingLoading ? 'animate-spin' : ''}`} />
              {parsingLoading ? 'Parsing...' : 'Upload Sample Doc'}
              <input
                type="file"
                className="hidden"
                accept=".docx,.pdf"
                onChange={(e) => handleUploadTemplate(e.target.files[0])}
              />
            </label>
          </div>
        )}
      </div>

      {status.message && (
        <div className={`p-4 flex items-center gap-3 border ${
          status.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400' 
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400'
        } font-medium`}>
          {status.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />}
          <span>{status.message}</span>
        </div>
      )}

      {editingTemplate ? (
        /* Template Editor view */
        <div className="glass-panel space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--nm-border)] pb-4">
            <h2 className="text-xl font-semibold text-[var(--nm-text-primary)]">
              {editingTemplate.id ? 'Edit Master Template' : 'Configure New Template'}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingTemplate(null)} className="glass-btn-secondary py-1.5 px-4 text-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSaveTemplate} className="glass-btn-primary py-1.5 px-5 text-sm">
                <Save className="w-4 h-4" /> Save Template
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Editor Main Controls */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--nm-text-primary)] mb-1.5">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g., technical_compliance_macbook"
                  className="w-full glass-input"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Editor Mode Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-max mb-4">
                <button
                  type="button"
                  onClick={() => setEditorMode('easy')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    editorMode === 'easy'
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Easy Editor (No Code)
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('advanced')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    editorMode === 'advanced'
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Advanced HTML Editor
                </button>
              </div>

              {editorMode === 'easy' ? (
                (easyFields.companyName || easyFields.companyAddress || easyFields.companyGst || easyFields.companyPhone || easyFields.companyEmail || easyFields.terms.length > 0) ? (
                  <div className="space-y-4 border border-[var(--nm-border)] rounded p-5 bg-[var(--nm-card)]">
                    <h3 className="text-sm font-bold text-[var(--nm-text-primary)] uppercase tracking-wider mb-2 border-b border-[var(--nm-border)] pb-2">Company Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {easyFields.companyName !== undefined && (
                        <div className="flex flex-col space-y-1">
                          <label className="text-[10px] font-bold text-[var(--nm-text-muted)] uppercase">Company Subheader Name</label>
                          <input
                            type="text"
                            value={easyFields.companyName}
                            onChange={(e) => handleEasyFieldChange('companyName', e.target.value)}
                            className="glass-input text-xs"
                            placeholder="e.g. WEBLINE TECHNOLOGIES"
                          />
                        </div>
                      )}
                      
                      {easyFields.companyGst !== undefined && (
                        <div className="flex flex-col space-y-1">
                          <label className="text-[10px] font-bold text-[var(--nm-text-muted)] uppercase">GST Number</label>
                          <input
                            type="text"
                            value={easyFields.companyGst}
                            onChange={(e) => handleEasyFieldChange('companyGst', e.target.value)}
                            className="glass-input text-xs"
                            placeholder="e.g. 07IHRPK7935Q1Z1"
                          />
                        </div>
                      )}

                      {easyFields.companyPhone !== undefined && (
                        <div className="flex flex-col space-y-1">
                          <label className="text-[10px] font-bold text-[var(--nm-text-muted)] uppercase">Phone / Tel</label>
                          <input
                            type="text"
                            value={easyFields.companyPhone}
                            onChange={(e) => handleEasyFieldChange('companyPhone', e.target.value)}
                            className="glass-input text-xs"
                            placeholder="e.g. 9310428496"
                          />
                        </div>
                      )}

                      {easyFields.companyEmail !== undefined && (
                        <div className="flex flex-col space-y-1">
                          <label className="text-[10px] font-bold text-[var(--nm-text-muted)] uppercase">Email Address</label>
                          <input
                            type="text"
                            value={easyFields.companyEmail}
                            onChange={(e) => handleEasyFieldChange('companyEmail', e.target.value)}
                            className="glass-input text-xs"
                            placeholder="e.g. tech@webline.com"
                          />
                        </div>
                      )}
                    </div>

                    {easyFields.companyAddress !== undefined && (
                      <div className="flex flex-col space-y-1">
                        <label className="text-[10px] font-bold text-[var(--nm-text-muted)] uppercase">Company Address</label>
                        <textarea
                          rows={2}
                          value={easyFields.companyAddress}
                          onChange={(e) => handleEasyFieldChange('companyAddress', e.target.value)}
                          className="glass-input text-xs"
                          placeholder="Enter complete company address"
                        />
                      </div>
                    )}

                    {easyFields.terms !== undefined && (
                      <div className="space-y-3 pt-3 border-t border-[var(--nm-border)]">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-[var(--nm-text-primary)] uppercase tracking-wider">Terms & Conditions</label>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedTerms = [...easyFields.terms, 'New Term'];
                              handleEasyFieldChange('terms', updatedTerms);
                            }}
                            className="text-xs text-[var(--nm-brand)] font-bold hover:underline"
                          >
                            + Add Term
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          {easyFields.terms.map((term, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <span className="text-xs font-bold text-[var(--nm-text-muted)] w-6">{index + 1}.</span>
                              <input
                                type="text"
                                value={term}
                                onChange={(e) => {
                                  const updatedTerms = [...easyFields.terms];
                                  updatedTerms[index] = e.target.value;
                                  handleEasyFieldChange('terms', updatedTerms);
                                }}
                                className="flex-1 glass-input py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedTerms = easyFields.terms.filter((_, idx) => idx !== index);
                                  handleEasyFieldChange('terms', updatedTerms);
                                }}
                                className="text-slate-400 hover:text-red-500 p-1"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {easyFields.terms.length === 0 && (
                            <p className="text-xs text-[var(--nm-text-muted)] italic">No terms defined. Click "+ Add Term" to create one.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-[var(--nm-border)] rounded bg-[var(--nm-card)]">
                    <p className="text-sm text-[var(--nm-text-muted)]">
                      This template layout is not structured as a standard Quotation form.
                    </p>
                    <p className="text-xs text-[var(--nm-text-muted)] mt-1 mb-4">
                      No matching company subheader, GST, contact info, or terms list was detected.
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditorMode('advanced')}
                      className="glass-btn-secondary py-1 px-3 text-xs"
                    >
                      Open Advanced HTML Editor
                    </button>
                  </div>
                )
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-semibold text-[var(--nm-text-primary)]">HTML Template Markup</label>
                    <span className="text-xs text-[var(--nm-text-muted)] font-mono">HTML structure</span>
                  </div>
                  <textarea
                    rows={15}
                    placeholder="<h2>Heading</h2><p>Content with {{placeholder_name}}</p>"
                    className="w-full glass-input font-mono text-xs leading-relaxed focus:border-[var(--nm-brand)]"
                    value={editingTemplate.htmlContent}
                    onChange={(e) => handleHtmlChange(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Template Settings & Placelolder Guide Side Panel */}
            <div className="space-y-6">
              {/* Margins & Settings */}
              <div className="p-5 bg-slate-50/50 dark:bg-slate-900/30 border border-[var(--nm-border)] rounded space-y-4">
                <h3 className="text-sm font-bold text-[var(--nm-text-primary)] uppercase tracking-wider">Template Settings</h3>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm text-[var(--nm-text-primary)] font-semibold">Use Company Letterhead</label>
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[var(--nm-brand)] bg-[var(--nm-card)] border-[var(--nm-border)] rounded cursor-pointer"
                    checked={editingTemplate.useLetterhead}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, useLetterhead: e.target.checked }))}
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--nm-border)]">
                  <span className="text-xs font-bold text-[var(--nm-text-primary)]">PDF Document Margins</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[var(--nm-text-muted)] uppercase font-semibold">Top</label>
                      <input
                        type="text"
                        className="w-full bg-[var(--nm-card)] border border-[var(--nm-border)] rounded px-3 py-1.5 text-xs text-[var(--nm-text-primary)] focus:outline-none focus:border-[var(--nm-brand)]"
                        value={editingTemplate.marginSettings?.top || '20mm'}
                        onChange={(e) => setEditingTemplate(prev => ({
                          ...prev,
                          marginSettings: { ...prev.marginSettings, top: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--nm-text-muted)] uppercase font-semibold">Bottom</label>
                      <input
                        type="text"
                        className="w-full bg-[var(--nm-card)] border border-[var(--nm-border)] rounded px-3 py-1.5 text-xs text-[var(--nm-text-primary)] focus:outline-none focus:border-[var(--nm-brand)]"
                        value={editingTemplate.marginSettings?.bottom || '20mm'}
                        onChange={(e) => setEditingTemplate(prev => ({
                          ...prev,
                          marginSettings: { ...prev.marginSettings, bottom: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--nm-text-muted)] uppercase font-semibold">Left</label>
                      <input
                        type="text"
                        className="w-full bg-[var(--nm-card)] border border-[var(--nm-border)] rounded px-3 py-1.5 text-xs text-[var(--nm-text-primary)] focus:outline-none focus:border-[var(--nm-brand)]"
                        value={editingTemplate.marginSettings?.left || '20mm'}
                        onChange={(e) => setEditingTemplate(prev => ({
                          ...prev,
                          marginSettings: { ...prev.marginSettings, left: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--nm-text-muted)] uppercase font-semibold">Right</label>
                      <input
                        type="text"
                        className="w-full bg-[var(--nm-card)] border border-[var(--nm-border)] rounded px-3 py-1.5 text-xs text-[var(--nm-text-primary)] focus:outline-none focus:border-[var(--nm-brand)]"
                        value={editingTemplate.marginSettings?.right || '20mm'}
                        onChange={(e) => setEditingTemplate(prev => ({
                          ...prev,
                          marginSettings: { ...prev.marginSettings, right: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Detected Placeholders Cheat Sheet */}
              <div className="p-5 bg-slate-50/50 dark:bg-slate-900/30 border border-[var(--nm-border)] rounded space-y-3">
                <h3 className="text-sm font-bold text-[var(--nm-text-primary)] uppercase tracking-wider">Detected Variables</h3>
                
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editingTemplate.placeholders.map(p => (
                    <div key={p} className="flex justify-between items-center bg-[var(--nm-card)] px-3 py-1.5 rounded border border-[var(--nm-border)]">
                      <span className="font-mono text-xs text-[var(--nm-text-primary)]">{"{{" + p + "}}"}</span>
                      <span className="text-[10px] text-[var(--nm-brand)] bg-[var(--nm-brand-soft)] border border-[var(--nm-brand-border)] px-2 py-0.5 rounded font-semibold">Form Field</span>
                    </div>
                  ))}

                  {editingTemplate.hasSpecificationsTable && (
                    <div className="flex justify-between items-center bg-[var(--nm-card)] px-3 py-1.5 rounded border border-emerald-250 text-emerald-600 dark:text-emerald-450">
                      <span className="font-mono text-xs font-semibold">{"{{specifications_table}}"}</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400">Dynamic Table</span>
                    </div>
                  )}

                  {editingTemplate.htmlContent.includes('{{company_stamp}}') && (
                    <div className="flex justify-between items-center bg-[var(--nm-card)] px-3 py-1.5 rounded border border-teal-250 text-teal-600 dark:text-teal-455">
                      <span className="font-mono text-xs font-semibold">{"{{company_stamp}}"}</span>
                      <span className="text-[10px] text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded font-bold dark:bg-teal-950/20 dark:border-teal-800/50 dark:text-teal-400">Stamp Overlay</span>
                    </div>
                  )}

                  {editingTemplate.placeholders.length === 0 && !editingTemplate.hasSpecificationsTable && (
                    <p className="text-xs text-[var(--nm-text-muted)] italic">No variables detected yet. Add curly-bracket templates to define fields.</p>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--nm-border)] text-[10px] text-[var(--nm-text-muted)] space-y-1">
                  <p>• Type <code className="text-[var(--nm-text-primary)]">{"{{variable_name}}"}</code> to insert a field.</p>
                  <p>• Type <code className="text-emerald-500 font-semibold">{"{{specifications_table}}"}</code> to insert the full compliance specification grid.</p>
                  <p>• Type <code className="text-teal-500 font-semibold">{"{{company_stamp}}"}</code> to control where the signature stamp is drawn.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Grid List view */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div key={tpl.id} className="glass-panel hover-elevate flex flex-col justify-between group">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded bg-[var(--nm-brand-soft)] border border-[var(--nm-brand-border)] flex items-center justify-center text-[var(--nm-brand)] transition-transform">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--nm-text-primary)] truncate max-w-[180px]">{tpl.name}</h3>
                </div>

                <div className="space-y-1.5 text-xs text-[var(--nm-text-muted)] mb-6">
                  <div className="flex justify-between">
                    <span>Input Parameters:</span>
                    <span className="font-bold text-[var(--nm-text-primary)]">{tpl.placeholders.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Specifications Table:</span>
                    <span className={`font-bold ${tpl.hasSpecificationsTable ? 'text-emerald-600' : 'text-[var(--nm-text-muted)]'}`}>
                      {tpl.hasSpecificationsTable ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Use Letterhead:</span>
                    <span className={`font-bold ${tpl.useLetterhead ? 'text-[var(--nm-brand)]' : 'text-[var(--nm-text-muted)]'}`}>
                      {tpl.useLetterhead ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Source Doc:</span>
                    <span className="font-bold text-[var(--nm-text-primary)] truncate max-w-[120px]" title={tpl.originalFile ? tpl.originalFile.name : 'Manual'}>
                      {tpl.originalFile ? tpl.originalFile.name : 'Manual'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--nm-border)] pt-4 mt-4">
                <span className="text-[10px] text-[var(--nm-text-muted)] font-mono">
                  {new Date(tpl.updatedAt).toLocaleDateString()}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleStartEdit(tpl)}
                    className="text-[var(--nm-text-muted)] hover:text-[var(--nm-brand)] hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded transition-all"
                    title="Edit Template"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="text-[var(--nm-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-2 rounded transition-all"
                    title="Delete Template"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {templates.length === 0 && !loading && (
            <div className="col-span-full py-16 text-center glass-panel bg-slate-50/50 dark:bg-slate-900/10">
              <Upload className="w-12 h-12 text-[var(--nm-text-muted)] opacity-25 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[var(--nm-text-primary)]">No Templates Available</h3>
              <p className="text-sm text-[var(--nm-text-muted)] mt-1 mb-6">Upload a master DOCX/PDF to auto-parse, or build a template from scratch.</p>
              
              <div className="flex justify-center gap-3">
                <button onClick={handleStartManualCreate} className="glass-btn-secondary">
                  Create Blank Template
                </button>
                <label className="glass-btn-primary cursor-pointer">
                  <Upload className="w-4 h-4" /> Upload Sample Document
                  <input
                    type="file"
                    className="hidden"
                    accept=".docx,.pdf"
                    onChange={(e) => handleUploadTemplate(e.target.files[0])}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
