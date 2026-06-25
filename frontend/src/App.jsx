import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, FileCode, Laptop, Settings, BadgeAlert, CheckCircle2, ChevronRight, FileSpreadsheet, Sun, Moon, Search } from 'lucide-react';
import DocumentGenerator from './components/DocumentGenerator';
import TemplateManager from './components/TemplateManager';
import ProductLibrary from './components/ProductLibrary';
import LetterheadStampManager from './components/LetterheadStampManager';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('generate');
  const [assetStatus, setAssetStatus] = useState({ letterhead: null, stamp: null });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  const [externalTemplateId, setExternalTemplateId] = useState('');
  const [externalTemplateEditId, setExternalTemplateEditId] = useState('');
  const [externalProductId, setExternalProductId] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [allTemplates, setAllTemplates] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const fetchSearchData = async () => {
    try {
      const [templatesRes, productsRes] = await Promise.all([
        axios.get(`${API_BASE}/templates`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/products`).catch(() => ({ data: [] }))
      ]);
      
      let localTemplates = [];
      try {
        const local = localStorage.getItem('docforge_templates');
        localTemplates = local ? JSON.parse(local) : [];
      } catch (e) {}

      const mergedTemplates = [...templatesRes.data];
      localTemplates.forEach(localTpl => {
        const index = mergedTemplates.findIndex(t => t.id === localTpl.id || (t.name && t.name === localTpl.name));
        if (index === -1) {
          mergedTemplates.push(localTpl);
        }
      });

      setAllTemplates(mergedTemplates);
      setAllProducts(productsRes.data);
    } catch (err) {
      console.error("Search data fetch failed:", err);
    }
  };

  useEffect(() => {
    fetchSearchData();
  }, [activeTab]);

  const fetchAssetStatus = async () => {
    const lhLocal = localStorage.getItem('docforge_letterhead_name');
    const stampLocal = localStorage.getItem('docforge_stamp_name');

    let serverLetterhead = null;
    let serverStamp = null;
    try {
      const res = await axios.get(`${API_BASE}/assets/info`);
      serverLetterhead = res.data.letterhead;
      serverStamp = res.data.stamp;
    } catch (err) {
      console.error("Asset check fail:", err);
    }

    setAssetStatus({
      letterhead: lhLocal || serverLetterhead,
      stamp: stampLocal || serverStamp
    });
  };

  useEffect(() => {
    fetchAssetStatus();
    const interval = setInterval(fetchAssetStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const navItems = [
    { id: 'generate', name: 'Generate Document', icon: Sparkles },
    { id: 'templates', name: 'Document Templates', icon: FileCode },
    { id: 'products', name: 'Product specs library', icon: Laptop },
    { id: 'assets', name: 'Identity Assets', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-row bg-[var(--nm-bg)] dark:bg-[var(--nm-bg)] text-[var(--nm-text-primary)] transition-colors duration-200 w-full overflow-hidden">
      {/* Sidebar Navigation - Dark Vyapar Sidebar */}
      <aside className="w-64 bg-[#111c24] dark:bg-slate-950 flex flex-col justify-between p-4 shrink-0 h-screen sticky top-0 z-20">
        <div className="space-y-6">
          {/* Circular Brand Header */}
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs shadow-inner shrink-0">
              DF
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer">
              <span className="font-bold text-xs text-white tracking-tight">DocForge Compliance</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-90" />
            </div>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-xs font-semibold transition-all duration-150 group cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-white font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#f59e0b]' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer/Status Information */}
        <div className="mt-8 border-t border-slate-800 pt-4 space-y-4">
          <span className="text-[9px] text-slate-500 font-mono tracking-wider uppercase block font-semibold">Identity Checklist</span>
          
          <div className="bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded p-3 space-y-2 text-slate-300">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Letterhead</span>
              {assetStatus.letterhead ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Present
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-500 font-medium">
                  <BadgeAlert className="w-3.5 h-3.5" /> Missing
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Signature Stamp</span>
              {assetStatus.stamp ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-500 italic">
                  Optional
                </span>
              )}
            </div>
          </div>

          {/* Theme Toggle Button */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Appearance</span>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center active:scale-95"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content Area with White Top Bar */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10 shadow-sm">
          {/* Left search */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded border border-slate-400 dark:border-slate-700 w-80">
              <Search className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <input 
                type="text" 
                placeholder="Search templates or products..." 
                className="bg-transparent border-none outline-none text-xs w-full text-slate-900 dark:text-slate-200 placeholder-slate-600 dark:placeholder-slate-400" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const filteredT = searchQuery.trim() ? allTemplates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())) : [];
                    const filteredP = searchQuery.trim() ? allProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())) : [];
                    if (filteredT.length > 0) {
                      setExternalTemplateId(filteredT[0].id);
                      setActiveTab('generate');
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    } else if (filteredP.length > 0) {
                      setExternalProductId(filteredP[0].id);
                      setActiveTab('products');
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }
                  }
                }}
              />
            </div>
            {isSearchFocused && searchQuery.trim() && (() => {
              const filteredT = allTemplates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
              const filteredP = allProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
              if (filteredT.length === 0 && filteredP.length === 0) return null;
              return (
                <div className="absolute top-11 left-0 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-lg max-h-64 overflow-y-auto z-50 text-xs py-1">
                  {filteredT.length > 0 && (
                    <div>
                      <div className="px-3 py-1 bg-slate-50 dark:bg-slate-850 font-bold text-slate-400 uppercase tracking-wider text-[9px] border-b border-slate-100 dark:border-slate-800">
                        Templates
                      </div>
                      {filteredT.map(tpl => (
                        <div 
                          key={tpl.id}
                          className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          onClick={() => {
                            setExternalTemplateId(tpl.id);
                            setActiveTab('generate');
                            setSearchQuery('');
                            setIsSearchFocused(false);
                          }}
                        >
                          <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-2">{tpl.name}</span>
                          <span className="text-[9px] text-emerald-700 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded shrink-0">Use</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {filteredP.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-800 mt-1">
                      <div className="px-3 py-1 bg-slate-50 dark:bg-slate-850 font-bold text-slate-400 uppercase tracking-wider text-[9px] border-b border-slate-100 dark:border-slate-800">
                        Product Specifications
                      </div>
                      {filteredP.map(prod => (
                        <div 
                          key={prod.id}
                          className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          onClick={() => {
                            setExternalProductId(prod.id);
                            setActiveTab('products');
                            setSearchQuery('');
                            setIsSearchFocused(false);
                          }}
                        >
                          <span className="font-medium text-slate-700 pr-2 dark:text-slate-200 truncate">{prod.name}</span>
                          <span className="text-[9px] text-amber-700 dark:text-amber-450 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded shrink-0">Edit</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Right quick actions */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('generate')} 
              className="bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded text-[11px] font-bold cursor-pointer hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/30 transition-all animate-pulse"
            >
              + Add Document
            </button>
            <button 
              onClick={() => setActiveTab('templates')} 
              className="bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded text-[11px] font-bold cursor-pointer hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 transition-all"
            >
              + Add Template
            </button>
            <button 
              onClick={() => setActiveTab('products')} 
              className="bg-slate-800 text-white px-3 py-1.5 rounded text-[11px] font-bold cursor-pointer hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition-all"
            >
              + Add Product
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 overflow-y-auto w-full">
          {activeTab === 'generate' && (
            <DocumentGenerator 
              externalTemplateId={externalTemplateId} 
              clearExternalTemplate={() => setExternalTemplateId('')} 
            />
          )}
          {activeTab === 'templates' && (
            <TemplateManager 
              externalTemplateId={externalTemplateEditId} 
              clearExternalTemplate={() => setExternalTemplateEditId('')} 
            />
          )}
          {activeTab === 'products' && (
            <ProductLibrary 
              externalProductId={externalProductId} 
              clearExternalProduct={() => setExternalProductId('')} 
            />
          )}
          {activeTab === 'assets' && <LetterheadStampManager />}
        </main>
      </div>
    </div>
  );
}
