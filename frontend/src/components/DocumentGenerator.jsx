import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Download, Play, Plus, Trash, Sparkles, RefreshCw, Layers, Search } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE ? `${import.meta.env.VITE_API_BASE}/api` : 'http://localhost:5000/api';

export default function DocumentGenerator({ externalTemplateId, clearExternalTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // Form states
  const [formValues, setFormValues] = useState({});
  const [specifications, setSpecifications] = useState([]);
  const [hasStamp, setHasStamp] = useState(true);
  
  // Generation & Preview states
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()));

  useEffect(() => {
    const fetchData = async () => {
      let serverTemplates = [];
      let serverProducts = [];
      
      try {
        const res = await axios.get(`${API_BASE}/templates`);
        serverTemplates = res.data;
      } catch (err) {
        console.error("Failed to load templates from server:", err);
      }
      
      try {
        const res = await axios.get(`${API_BASE}/products`);
        serverProducts = res.data;
      } catch (err) {
        console.error("Failed to load products from server:", err);
      }

      // Load local templates
      let localTemplates = [];
      try {
        const local = localStorage.getItem('docforge_templates');
        localTemplates = local ? JSON.parse(local) : [];
      } catch (e) {
        console.error("Failed to load local templates:", e);
      }

      const mergedTemplates = [...serverTemplates];
      localTemplates.forEach(localTpl => {
        const index = mergedTemplates.findIndex(t => t.id === localTpl.id || (t.name && t.name === localTpl.name));
        if (index >= 0) {
          mergedTemplates[index] = {
            ...mergedTemplates[index],
            ...localTpl,
            originalFile: localTpl.originalFile || mergedTemplates[index].originalFile
          };
        } else {
          mergedTemplates.push(localTpl);
        }
      });
      
      setTemplates(mergedTemplates);
      setProducts(serverProducts);
      
      // Auto-select first template if available
      if (mergedTemplates.length > 0) {
        handleSelectTemplate(mergedTemplates[0].id, mergedTemplates);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (externalTemplateId && templates.length > 0) {
      handleSelectTemplate(externalTemplateId, templates);
      if (clearExternalTemplate) clearExternalTemplate();
    }
  }, [externalTemplateId, templates]);

  const handleSelectTemplate = (id, templatesList = templates) => {
    setSelectedTemplateId(id);
    const template = templatesList.find(t => t.id === id);
    setSelectedTemplate(template);
    
    if (template) {
      // Initialize form values for each placeholder
      const initialValues = {};
      template.placeholders.forEach(p => {
        initialValues[p] = '';
      });
      setFormValues(initialValues);
      
      // Initialize specifications table if supported
      const isQuotation = template.htmlContent && template.htmlContent.includes('{{quotation_table}}');
      if (isQuotation) {
        setSpecifications([
          { description: '', hsnSac: '', unit: 'unit', quantity: '1', priceUnit: '', gst: '18' }
        ]);
      } else if (template.hasSpecificationsTable) {
        setSpecifications([
          { description: '', requiredSpec: '', offeredSpec: '' }
        ]);
      } else {
        setSpecifications([]);
      }
      
      // Reset preview
      setPreviewUrl('');
    } else {
      setSelectedTemplate(null);
      setFormValues({});
      setSpecifications([]);
      setPreviewUrl('');
    }
  };

  const handleInputChange = (placeholderName, val) => {
    setFormValues(prev => ({
      ...prev,
      [placeholderName]: val
    }));
  };

  const handleProductSelect = (productId) => {
    if (!productId) return;
    const prod = products.find(p => p.id === productId);
    if (prod && prod.specifications) {
      // Clone specifications
      setSpecifications(JSON.parse(JSON.stringify(prod.specifications)));
    }
  };

  // Spec table functions
  const handleAddSpecRow = () => {
    const isQuotation = selectedTemplate && selectedTemplate.htmlContent && selectedTemplate.htmlContent.includes('{{quotation_table}}');
    if (isQuotation) {
      setSpecifications(prev => [
        ...prev,
        { description: '', hsnSac: '', unit: 'unit', quantity: '1', priceUnit: '', gst: '18' }
      ]);
    } else {
      setSpecifications(prev => [
        ...prev,
        { description: '', requiredSpec: '', offeredSpec: '' }
      ]);
    }
  };

  const handleRemoveSpecRow = (idx) => {
    const specs = [...specifications];
    specs.splice(idx, 1);
    setSpecifications(specs);
  };

  const handleSpecChange = (idx, field, val) => {
    const specs = [...specifications];
    specs[idx][field] = val;
    setSpecifications(specs);
  };

  // Document compilation trigger
  const handleGeneratePreview = async () => {
    if (!selectedTemplateId) return;
    setGenerating(true);
    setError('');
    
    const letterheadData = localStorage.getItem('docforge_letterhead_data');
    const letterheadName = localStorage.getItem('docforge_letterhead_name');
    const stampData = localStorage.getItem('docforge_stamp_data');
    const stampName = localStorage.getItem('docforge_stamp_name');
    
    try {
      const res = await axios.post(`${API_BASE}/generate`, {
        templateId: selectedTemplateId,
        formValues,
        specifications,
        outputFormat: 'pdf',
        hasStamp,
        letterheadData,
        letterheadName,
        stampData,
        stampName
      }, {
        responseType: 'blob' // Important to fetch binary PDF buffer
      });
      
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error(err);
      setError('Generation failed. Ensure the server is online and Chromium is installed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format) => {
    if (!selectedTemplateId) return;
    setError('');
    
    const letterheadData = localStorage.getItem('docforge_letterhead_data');
    const letterheadName = localStorage.getItem('docforge_letterhead_name');
    const stampData = localStorage.getItem('docforge_stamp_data');
    const stampName = localStorage.getItem('docforge_stamp_name');
    
    try {
      const res = await axios.post(`${API_BASE}/generate`, {
        templateId: selectedTemplateId,
        formValues,
        specifications,
        outputFormat: format,
        hasStamp,
        letterheadData,
        letterheadName,
        stampData,
        stampName
      }, {
        responseType: 'blob'
      });
      
      const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const ext = format === 'pdf' ? 'pdf' : 'docx';
      const blob = new Blob([res.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      const tplName = selectedTemplate ? selectedTemplate.name.replace(/\s+/g, '_') : 'document';
      link.setAttribute('download', `${tplName}_compliance.${ext}`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error(err);
      setError(`Failed to download ${format.toUpperCase()} file.`);
    }
  };

  const isQuotation = selectedTemplate && selectedTemplate.htmlContent && selectedTemplate.htmlContent.includes('{{quotation_table}}');

  return (
    <div className="flex flex-col space-y-4 h-[calc(100vh-8rem)]">
      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400 text-xs font-medium">
          <span>{error}</span>
        </div>
      )}

      {/* Split view container */}
      <div className="flex-1 flex flex-col lg:flex-row bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded overflow-y-auto lg:overflow-hidden h-full">
        {/* Left templates list column */}
        <div className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/20 h-44 lg:h-full">
          {/* Header orange button */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <button 
              onClick={() => {
                // Focus on templates
                const addTplBtn = document.querySelector('button[onClick*="templates"]');
                if (addTplBtn) addTplBtn.click();
              }}
              className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white px-3 py-2 text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-all shadow-sm"
            >
              + Add Item
            </button>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-slate-400 dark:border-slate-650">
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <input 
                type="text" 
                placeholder="Search items..." 
                className="bg-transparent border-none outline-none text-[11px] w-full text-slate-800 dark:text-slate-200 placeholder-slate-600 dark:placeholder-slate-400" 
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-150 dark:divide-slate-800">
            {filteredTemplates.map(t => {
              const isActive = selectedTemplateId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t.id)}
                  className={`w-full text-left px-4 py-3 text-xs transition-colors cursor-pointer block ${
                    isActive 
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-l-4 border-slate-700' 
                      : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">{t.placeholders.length} fields</div>
                </button>
              );
            })}
            {filteredTemplates.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400 italic">No templates found</div>
            )}
          </div>
        </div>

        {/* Right workspace details area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden h-auto lg:h-full">
          {selectedTemplate ? (
            <div className="flex-1 flex flex-col overflow-visible lg:overflow-y-auto p-5 space-y-6">
              {/* Top details card */}
              <div className="border border-slate-300 dark:border-slate-800 rounded p-4 space-y-4 bg-white dark:bg-slate-900 relative">
                {/* Title and Top buttons */}
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Template Selected</span>
                    <h2 className="text-base font-bold text-slate-800 dark:text-white uppercase mt-0.5">{selectedTemplate.name}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleGeneratePreview}
                      disabled={generating}
                      className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      {generating ? 'GENERATING...' : 'ADJUST ITEM'}
                    </button>
                    {previewUrl && (
                      <>
                        <button 
                          onClick={() => handleDownload('pdf')}
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-bold cursor-pointer hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-all shadow-sm"
                        >
                          DOWNLOAD PDF
                        </button>
                        <button 
                          onClick={() => handleDownload('docx')}
                          className="bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded text-xs font-bold cursor-pointer hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                          WORD
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Form fields grid */}
                {selectedTemplate.placeholders.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Document Placeholders</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedTemplate.placeholders.map(p => (
                        <div key={p} className="flex flex-col space-y-1">
                          <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                            {p.replace(/_/g, ' ')}
                          </label>
                          <input
                            type="text"
                            placeholder={`Enter ${p.replace(/_/g, ' ')}`}
                            className="bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-600 w-full"
                            value={formValues[p] || ''}
                            onChange={(e) => handleInputChange(p, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-450 italic">No placeholders defined. Ready to generate.</div>
                )}

                {/* Library selection dropdown */}
                {selectedTemplate.hasSpecificationsTable && (
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-300 dark:border-slate-800">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">Auto-fill:</span>
                    <select
                      defaultValue=""
                      className="bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-700 rounded px-3 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-500 cursor-pointer"
                      onChange={(e) => handleProductSelect(e.target.value)}
                    >
                      <option value="">-- Select Product Library --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Specifications Table Section */}
              {selectedTemplate.hasSpecificationsTable && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                      Transactions / Specifications
                    </h3>
                    <button 
                      type="button" 
                      onClick={handleAddSpecRow}
                      className="text-xs text-slate-700 dark:text-slate-350 font-bold hover:underline cursor-pointer"
                    >
                      + Add Row
                    </button>
                  </div>

                  <div className="border border-slate-400 dark:border-slate-700 rounded overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-400 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          <th className="py-2.5 px-3 w-1/3">Description Clause</th>
                          <th className="py-2.5 px-3 w-1/3">Required Spec</th>
                          <th className="py-2.5 px-3 w-1/3">Offered Spec</th>
                          <th className="py-2.5 px-3 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                        {specifications.map((spec, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="e.g. Processor"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500"
                                value={spec.description}
                                onChange={(e) => handleSpecChange(idx, 'description', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <textarea
                                placeholder="Required specs"
                                rows={1}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500 resize-none"
                                value={spec.requiredSpec}
                                onChange={(e) => handleSpecChange(idx, 'requiredSpec', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <textarea
                                placeholder="Offered compliance spec"
                                rows={1}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500 resize-none"
                                value={spec.offeredSpec}
                                onChange={(e) => handleSpecChange(idx, 'offeredSpec', e.target.value)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSpecRow(idx)}
                                disabled={specifications.length <= 1}
                                className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-1 cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Quotation Table Section */}
              {isQuotation && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                      Quotation Items
                    </h3>
                    <button 
                      type="button" 
                      onClick={handleAddSpecRow}
                      className="text-xs text-slate-700 dark:text-slate-350 font-bold hover:underline cursor-pointer"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="border border-slate-400 dark:border-slate-700 rounded overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-400 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          <th className="py-2.5 px-3 w-[40%]">Item Description</th>
                          <th className="py-2.5 px-3 w-[15%]">HSN/SAC</th>
                          <th className="py-2.5 px-3 w-[10%]">Unit</th>
                          <th className="py-2.5 px-3 w-[10%]">Qty</th>
                          <th className="py-2.5 px-3 w-[15%]">Price/Unit</th>
                          <th className="py-2.5 px-3 w-[10%]">GST %</th>
                          <th className="py-2.5 px-3 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                        {specifications.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="e.g. Lenovo Laptop"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500"
                                value={item.description || ''}
                                onChange={(e) => handleSpecChange(idx, 'description', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="8471"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500"
                                value={item.hsnSac || ''}
                                onChange={(e) => handleSpecChange(idx, 'hsnSac', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="unit"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500"
                                value={item.unit || 'unit'}
                                onChange={(e) => handleSpecChange(idx, 'unit', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                placeholder="1"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500"
                                value={item.quantity || ''}
                                onChange={(e) => handleSpecChange(idx, 'quantity', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                placeholder="99860"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500"
                                value={item.priceUnit || ''}
                                onChange={(e) => handleSpecChange(idx, 'priceUnit', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                placeholder="18"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500"
                                value={item.gst || ''}
                                onChange={(e) => handleSpecChange(idx, 'gst', e.target.value)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSpecRow(idx)}
                                disabled={specifications.length <= 1}
                                className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-1 cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Signature Stamp Options */}
              <div className="border-t border-slate-100 dark:border-slate-850 pt-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase">Include Signature Stamp</h4>
                  <p className="text-[10px] text-slate-400">Overlays transparent stamp block automatically</p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-slate-800 dark:accent-slate-400 cursor-pointer"
                  checked={hasStamp}
                  onChange={(e) => setHasStamp(e.target.checked)}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/20">
              <Layers className="w-8 h-8 opacity-25 mb-2 animate-bounce" />
              <p className="text-xs">Please select a document template from the menu on the left to start editing.</p>
            </div>
          )}

          {/* PDF Live Preview Column */}
          {selectedTemplate && (
            <div className="w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col h-[500px] lg:h-full bg-slate-50/30">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-700 dark:text-slate-350" /> Live Document Preview
                </span>
                {previewUrl && (
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400">
                    Rendered PDF
                  </span>
                )}
              </div>
              <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex items-center justify-center relative">
                {previewUrl ? (
                  <iframe
                    src={`${previewUrl}#toolbar=0&navpanes=0`}
                    className="w-full h-full border-none"
                    title="Live Preview"
                  />
                ) : (
                  <div className="text-center text-xs text-slate-400 p-6">
                    <Play className="w-8 h-8 opacity-20 mx-auto mb-2" />
                    <p>Click **ADJUST ITEM** above to preview compiled PDF.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
