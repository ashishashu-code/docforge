import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash, Edit, Save, X, PlusCircle, Laptop, Search } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function ProductLibrary({ externalProductId, clearExternalProduct }) {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null); // Product object currently being edited/created
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [productSearch, setProductSearch] = useState('');
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/products`);
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products:", err);
      setStatus({ type: 'error', message: 'Failed to load product specifications library.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (externalProductId && products.length > 0) {
      const prod = products.find(p => p.id === externalProductId);
      if (prod) {
        handleStartEdit(prod);
      }
      if (clearExternalProduct) clearExternalProduct();
    }
  }, [externalProductId, products]);

  const saveProductsList = async (updatedList) => {
    try {
      const res = await axios.post(`${API_BASE}/products`, updatedList);
      setProducts(res.data.products);
      setStatus({ type: 'success', message: 'Product specifications updated successfully!' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to save product specifications.' });
    }
  };

  const handleStartCreate = () => {
    setEditingProduct({
      id: `prod_${Date.now()}`,
      name: '',
      specifications: [
        { description: '', requiredSpec: '', offeredSpec: '' }
      ]
    });
  };

  const handleStartEdit = (product) => {
    // Clone to avoid direct mutation
    setEditingProduct(JSON.parse(JSON.stringify(product)));
  };

  const handleDeleteProduct = (productId) => {
    if (window.confirm("Are you sure you want to delete this product template?")) {
      const filtered = products.filter(p => p.id !== productId);
      saveProductsList(filtered);
    }
  };

  const handleAddSpecRow = () => {
    setEditingProduct(prev => ({
      ...prev,
      specifications: [...prev.specifications, { description: '', requiredSpec: '', offeredSpec: '' }]
    }));
  };

  const handleRemoveSpecRow = (index) => {
    const specs = [...editingProduct.specifications];
    specs.splice(index, 1);
    setEditingProduct(prev => ({ ...prev, specifications: specs }));
  };

  const handleSpecChange = (index, field, value) => {
    const specs = [...editingProduct.specifications];
    specs[index][field] = value;
    setEditingProduct(prev => ({ ...prev, specifications: specs }));
  };

  const handleSaveProduct = () => {
    if (!editingProduct.name.trim()) {
      alert("Product Name is required");
      return;
    }

    // Filter out completely empty spec rows
    const cleanedSpecs = editingProduct.specifications.filter(
      s => s.description.trim() || s.requiredSpec.trim() || s.offeredSpec.trim()
    );

    const updatedProduct = {
      ...editingProduct,
      specifications: cleanedSpecs.length > 0 ? cleanedSpecs : [{ description: '', requiredSpec: '', offeredSpec: '' }]
    };

    let updatedList;
    const exists = products.some(p => p.id === updatedProduct.id);
    if (exists) {
      updatedList = products.map(p => p.id === updatedProduct.id ? updatedProduct : p);
    } else {
      updatedList = [...products, updatedProduct];
    }

    saveProductsList(updatedList);
    setEditingProduct(null);
  };

  return (
    <div className="flex flex-col space-y-4 h-[calc(100vh-8rem)]">
      {status.message && (
        <div className={`p-3 rounded border text-xs font-medium ${
          status.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400' 
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400'
        }`}>
          <span>{status.message}</span>
        </div>
      )}

      {/* Split view container */}
      <div className="flex-1 flex flex-row bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded overflow-hidden h-full">
        {/* Left products list column */}
        <div className="w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/20">
          {/* Header Add button */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <button 
              onClick={handleStartCreate}
              className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white px-3 py-2 text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-all shadow-sm"
            >
              + Add Product
            </button>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-slate-400 dark:border-slate-650">
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <input 
                type="text" 
                placeholder="Search products..." 
                className="bg-transparent border-none outline-none text-[11px] w-full text-slate-800 dark:text-slate-200 placeholder-slate-600 dark:placeholder-slate-400" 
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-150 dark:divide-slate-800">
            {filteredProducts.map(p => {
              const isActive = editingProduct?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleStartEdit(p)}
                  className={`w-full text-left px-4 py-3 text-xs transition-colors cursor-pointer block ${
                    isActive 
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-l-4 border-slate-700' 
                      : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">{p.specifications.length} clauses</div>
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400 italic">No products found</div>
            )}
          </div>
        </div>

        {/* Right workspace specs details editor */}
        <div className="flex-1 flex flex-col overflow-y-auto p-5">
          {editingProduct ? (
            <div className="space-y-6">
              {/* Top details card */}
              <div className="border border-slate-200 dark:border-slate-800 rounded p-4 space-y-4 bg-white dark:bg-slate-900">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Product Profile</span>
                    <h2 className="text-base font-bold text-slate-800 dark:text-white uppercase mt-0.5">{editingProduct.name || 'New Product Spec'}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setEditingProduct(null)} 
                      className="bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded text-xs font-bold cursor-pointer hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 transition-all shadow-sm"
                    >
                      CANCEL
                    </button>
                    <button 
                      onClick={handleSaveProduct} 
                      className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-1.5 rounded text-xs font-bold cursor-pointer transition-all shadow-sm"
                    >
                      SAVE PROFILE
                    </button>
                    {products.some(p => p.id === editingProduct.id) && (
                      <button 
                        onClick={() => {
                          handleDeleteProduct(editingProduct.id);
                          setEditingProduct(null);
                        }}
                        className="bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded text-xs font-bold cursor-pointer hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/30 transition-all shadow-sm"
                      >
                        DELETE
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Product Name</label>
                  <input
                    type="text"
                    placeholder="e.g. MacBook Air M4"
                    className="bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-405 focus:outline-none focus:border-slate-650 w-full"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              {/* Specifications Table Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                    Product Specification Specifications
                  </h3>
                  <button 
                    type="button" 
                    onClick={handleAddSpecRow}
                    className="text-xs text-slate-700 dark:text-slate-350 font-bold hover:underline cursor-pointer"
                  >
                    + Add Spec Row
                  </button>
                </div>

                <div className="border border-slate-400 dark:border-slate-700 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-400 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        <th className="py-2.5 px-3 w-1/4">Specification Clause / Name</th>
                        <th className="py-2.5 px-3 w-3/8">Required Specification</th>
                        <th className="py-2.5 px-3 w-3/8">Offered Specification</th>
                        <th className="py-2.5 px-3 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {editingProduct.specifications.map((spec, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="e.g., Memory"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500"
                              value={spec.description}
                              onChange={(e) => handleSpecChange(index, 'description', e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <textarea
                              placeholder="e.g., Minimum 16GB unified memory"
                              rows={2}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500 resize-none"
                              value={spec.requiredSpec}
                              onChange={(e) => handleSpecChange(index, 'requiredSpec', e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <textarea
                              placeholder="e.g., 16GB unified memory"
                              rows={2}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-650 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-slate-500 resize-none"
                              value={spec.offeredSpec}
                              onChange={(e) => handleSpecChange(index, 'offeredSpec', e.target.value)}
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveSpecRow(index)}
                              disabled={editingProduct.specifications.length <= 1}
                              className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-1 cursor-pointer"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/20 h-full">
              <Laptop className="w-8 h-8 opacity-25 mb-2 animate-bounce" />
              <p className="text-xs">Please select a product specs profile from the menu on the left to start editing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
