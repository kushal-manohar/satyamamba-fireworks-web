import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Package, Plus, Edit2, Trash2, Download, Search, Barcode, Save, X, Camera, RefreshCw } from 'lucide-react';
import { Product, StoreSettings, ThemeMode } from '../types';
import { playScanBeep, triggerHaptic } from '../utils/audioHaptics';

interface InventoryManagerProps {
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onImportProducts: (products: Product[]) => void;
  settings: StoreSettings;
  theme?: ThemeMode;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  onSaveProduct,
  onDeleteProduct,
  onImportProducts,
  settings,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // In-modal Camera Barcode Scanner state
  const [isScanningBarcode, setIsScanningBarcode] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const modalScannerContainerId = 'modal-inventory-barcode-scanner';

  // Extract categories
  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.barcode.includes(searchQuery) ||
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  const handleOpenAddModal = (initialBarcode: string = '') => {
    setEditingProduct({
      id: `prod-${Date.now()}`,
      barcode: initialBarcode || `890${Math.floor(100000000 + Math.random() * 900000000)}`,
      name: '',
      category: 'General',
      price: 100,
      taxRate: 18,
      stock: 50,
      unit: 'pcs',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct({ ...product });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.barcode || !editingProduct?.price) {
      alert('Please fill in product name, barcode, and price.');
      return;
    }

    onSaveProduct(editingProduct as Product);
    stopModalScanner();
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  // Start WebRTC Camera Scanner inside Add Product Modal
  const startModalScanner = async () => {
    setIsScanningBarcode(true);
    setCameraError(null);
    try {
      setTimeout(async () => {
        if (!html5QrcodeRef.current) {
          html5QrcodeRef.current = new Html5Qrcode(modalScannerContainerId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.QR_CODE,
            ],
            verbose: false,
          });
        }

        await html5QrcodeRef.current.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 240, height: 140 }, aspectRatio: 1.5 },
          (decodedText) => {
            handleBarcodeDetectedInModal(decodedText);
          },
          () => {}
        );
      }, 200);
    } catch (err: any) {
      setCameraError(err?.message || 'Could not access camera feed.');
    }
  };

  const stopModalScanner = async () => {
    if (html5QrcodeRef.current && isScanningBarcode) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current = null;
      } catch (e) {
        // ignore
      }
    }
    setIsScanningBarcode(false);
  };

  const handleBarcodeDetectedInModal = (barcode: string) => {
    if (settings.enableSound) playScanBeep();
    if (settings.enableHaptics) triggerHaptic([50, 40, 50]);

    stopModalScanner();

    // Check if barcode already exists in catalog
    const existing = products.find(p => p.barcode === barcode);
    if (existing) {
      alert(`Barcode "${barcode}" matches existing product "${existing.name}". Loaded product details for editing.`);
      setEditingProduct({ ...existing });
    } else {
      setEditingProduct(prev => ({
        ...prev,
        barcode: barcode,
      }));
    }
  };

  useEffect(() => {
    return () => {
      stopModalScanner();
    };
  }, []);

  const handleExportCSV = () => {
    const headers = ['ID,Barcode,Name,Category,Price,TaxRate,Stock,Unit,Description'];
    const rows = products.map(p =>
      `"${p.id}","${p.barcode}","${p.name.replace(/"/g, '""')}","${p.category}",${p.price},${p.taxRate},${p.stock},"${p.unit}","${(p.description || '').replace(/"/g, '""')}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalog_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`border rounded-2xl overflow-hidden flex flex-col h-full transition-colors ${
      isDark ? 'bg-slate-900 border-slate-800 text-white shadow-2xl' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
    }`}>
      {/* Catalog Header */}
      <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center space-x-2">
          <Package className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
          <div>
            <h2 className={`font-extrabold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Product Catalog & Inventory
            </h2>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {products.length} registered items
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleOpenAddModal()}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>

          <button
            onClick={handleExportCSV}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 border ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-300 shadow-sm'
            }`}
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV Export</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={`p-3 border-b flex flex-col gap-2.5 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/60 border-slate-200'
      }`}>
        <div className="relative w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name, barcode, category..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors ${
              isDark
                ? 'bg-slate-950 border border-slate-800 text-white placeholder-slate-500'
                : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
            }`}
          />
          <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isDark
                  ? 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-300 shadow-sm hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List Table */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center">
            <Package className={`w-10 h-10 mx-auto mb-2 opacity-40 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl p-3 flex items-start justify-between transition-all border ${
                  isDark
                    ? 'bg-slate-950 border-slate-800/80 hover:border-indigo-500/40'
                    : 'bg-white border-slate-200 hover:border-indigo-400 shadow-sm'
                }`}
              >
                <div className="space-y-1 pr-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      isDark
                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      {p.category}
                    </span>
                    <span className={`text-[10px] font-mono flex items-center space-x-1 ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      <Barcode className="w-3 h-3 text-slate-400" />
                      <span>{p.barcode}</span>
                    </span>
                  </div>

                  <h3 className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{p.name}</h3>

                  <div className="flex items-center space-x-3 text-[11px] pt-1">
                    <span className={`font-mono font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {settings.currencySymbol}{p.price.toFixed(2)} / {p.unit}
                    </span>
                    <span className={p.taxRate === 0 ? (isDark ? "text-emerald-400 font-bold" : "text-emerald-600 font-bold") : (isDark ? "text-slate-400" : "text-slate-500")}>
                      Tax: {p.taxRate === 0 ? '0% (Tax Free)' : `${p.taxRate}%`}
                    </span>
                    <span className={`font-semibold ${p.stock < 20 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                      Stock: {p.stock} {p.unit}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEditModal(p)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      isDark
                        ? 'bg-slate-900 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-300 border-slate-800'
                        : 'bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border-slate-200'
                    }`}
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"?`)) onDeleteProduct(p.id);
                    }}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      isDark
                        ? 'bg-slate-900 hover:bg-rose-600/20 text-slate-400 hover:text-rose-300 border-slate-800'
                        : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200'
                    }`}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && editingProduct && (
        <div className={`fixed inset-0 z-50 backdrop-blur-md flex items-center justify-center p-4 ${
          isDark ? 'bg-slate-950/80' : 'bg-slate-900/50'
        }`}>
          <div className={`border rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-scaleUp ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <h3 className={`font-extrabold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {products.some(p => p.id === editingProduct.id) ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => {
                  stopModalScanner();
                  setIsModalOpen(false);
                }}
                className={isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-800"}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* In-Modal Barcode Camera Scanner */}
            {isScanningBarcode ? (
              <div className={`p-4 space-y-3 text-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <span className={`text-xs font-bold block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Point camera at product barcode</span>
                <div id={modalScannerContainerId} className="w-full max-w-xs mx-auto rounded-xl overflow-hidden bg-black min-h-[180px]" />
                {cameraError && <p className="text-xs text-rose-500">{cameraError}</p>}
                <button
                  type="button"
                  onClick={stopModalScanner}
                  className={`px-4 py-2 text-rose-500 rounded-xl text-xs font-bold transition-all border ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-white hover:bg-slate-100 border-slate-300 shadow-sm'
                  }`}
                >
                  Cancel Scanner
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="p-4 space-y-3">
                {/* Barcode input + SCAN BARCODE Button */}
                <div>
                  <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Product Barcode ID
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      required
                      value={editingProduct.barcode || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500 ${
                        isDark ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-900'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={startModalScanner}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1 shadow-md"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Scan Barcode</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    placeholder="e.g. 10cm Electric Sparklers"
                    className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500 ${
                      isDark ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Category
                    </label>
                    <input
                      type="text"
                      required
                      value={editingProduct.category || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                      placeholder="Category"
                      className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500 ${
                        isDark ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Selling Price ({settings.currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editingProduct.price || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500 ${
                        isDark ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Tax Rate (%)
                      </label>
                      {editingProduct.taxRate === 0 && (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                          isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}>
                          0% Tax Free
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={editingProduct.taxRate !== undefined && editingProduct.taxRate !== null ? editingProduct.taxRate : 0}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        setEditingProduct({ ...editingProduct, taxRate: isNaN(val) ? 0 : val });
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs text-center font-mono focus:outline-none focus:border-indigo-500 ${
                        isDark ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-900'
                      }`}
                    />
                    <div className="flex items-center space-x-1 mt-1.5">
                      {[0, 5, 12, 18, 28].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setEditingProduct({ ...editingProduct, taxRate: rate })}
                          className={`flex-1 py-0.5 rounded text-[10px] font-bold transition-all ${
                            editingProduct.taxRate === rate
                              ? rate === 0 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-indigo-600 text-white shadow-xs'
                              : isDark
                              ? 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                              : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                          }`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Stock Qty
                    </label>
                    <input
                      type="number"
                      value={editingProduct.stock || 50}
                      onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value, 10) || 0 })}
                      className={`w-full px-3 py-2 rounded-xl text-xs text-center focus:outline-none focus:border-indigo-500 ${
                        isDark ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Unit
                    </label>
                    <select
                      value={editingProduct.unit || 'pcs'}
                      onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                      className={`w-full px-2 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500 ${
                        isDark ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="pcs">pcs</option>
                      <option value="box">box</option>
                      <option value="pack">pack</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center space-x-1"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Product Details</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
