import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  Zap,
  ZapOff,
  RefreshCw,
  Search,
  PlusCircle,
  AlertCircle,
  Check,
  X,
  Sparkles,
  ShoppingBag,
  Barcode,
  Keyboard
} from 'lucide-react';
import { Product, ThemeMode } from '../types';
import { playScanBeep, triggerHaptic } from '../utils/audioHaptics';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onUnrecognizedScan?: (barcode: string) => void;
  products: Product[];
  enableSound: boolean;
  enableHaptics: boolean;
  currencySymbol?: string;
  theme?: ThemeMode;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScanSuccess,
  onUnrecognizedScan,
  products,
  enableSound,
  enableHaptics,
  currencySymbol = '₹',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  // Separate billing into two tabs: Type & Search Billing (first) & Barcode Billing (second)
  const [billingTab, setBillingTab] = useState<'barcode' | 'search'>('search');

  // Camera Scanner States (Camera is OFF by default; opened via button)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<{ code: string; name?: string; time: number } | null>(null);

  // Type & Search Billing States
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [recentAddedName, setRecentAddedName] = useState<string | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-reader-viewfinder';

  const formatsToSupport = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.QR_CODE,
  ];

  const handleBarcodeDetected = (decodedText: string) => {
    const now = Date.now();
    if (lastScanned && lastScanned.code === decodedText && now - lastScanned.time < 1200) {
      return;
    }

    const matched = products.find((p) => p.barcode === decodedText);
    setLastScanned({ code: decodedText, name: matched?.name, time: now });

    if (enableSound) playScanBeep();
    if (enableHaptics) triggerHaptic([50, 40, 50]);

    onScanSuccess(decodedText);
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsStartingCamera(true);
    try {
      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: formatsToSupport,
          verbose: false,
        });
      }

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.5,
      };

      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        () => {}
      );
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraError(err?.message || 'Could not access camera. Please check camera permissions or use manual code entry.');
      setIsCameraActive(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrcodeRef.current && isCameraActive) {
      try {
        await html5QrcodeRef.current.stop();
        setIsCameraActive(false);
        setTorchOn(false);
      } catch (err) {
        console.error('Failed to stop camera scanner', err);
      }
    }
  };

  const toggleTorch = async () => {
    if (html5QrcodeRef.current && isCameraActive) {
      try {
        const capabilities = html5QrcodeRef.current.getRunningTrackCapabilities();
        if ((capabilities as any).torch) {
          const nextState = !torchOn;
          await (html5QrcodeRef.current as any).applyVideoConstraints({
            advanced: [{ torch: nextState }],
          });
          setTorchOn(nextState);
        } else {
          alert('Flashlight is not supported by your camera hardware.');
        }
      } catch (e) {
        alert('Could not toggle flashlight on this device.');
      }
    }
  };

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // When switching away from barcode tab, stop camera
  useEffect(() => {
    if (billingTab !== 'barcode' && isCameraActive) {
      stopCamera();
    }
  }, [billingTab]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Filter products based on search query and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      if (!matchCat) return false;

      if (!productSearchQuery.trim()) return true;
      const q = productSearchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });
  }, [products, productSearchQuery, selectedCategory]);

  const handleProductSelect = (productId: string) => {
    if (!productId) return;
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      handleBarcodeDetected(prod.barcode);
      setRecentAddedName(prod.name);
      setSelectedProductId('');
      setTimeout(() => setRecentAddedName(null), 2500);
    }
  };

  return (
    <div
      className={`border rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-colors duration-200 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'
      }`}
    >
      {/* Distinct billing tabs: Type & Search Billing (First) & Barcode Billing (Second) */}
      <div
        className={`p-2 border-b flex items-center space-x-2 ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <button
          type="button"
          onClick={() => setBillingTab('search')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            billingTab === 'search'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Type & Search Billing</span>
        </button>

        <button
          type="button"
          onClick={() => setBillingTab('barcode')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            billingTab === 'barcode'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
        >
          <Barcode className="w-4 h-4" />
          <span>Barcode Billing</span>
        </button>
      </div>

      {/* Added Product Toast Alert */}
      {recentAddedName && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between text-xs text-emerald-200 animate-fadeIn">
          <div className="flex items-center space-x-1.5 font-bold">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Added "{recentAddedName}" to Bill!</span>
          </div>
          <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold">
            +1 Added
          </span>
        </div>
      )}

      {/* TAB 1: BARCODE BILLING */}
      {billingTab === 'barcode' && (
        <div className="p-4 space-y-4">
          {/* Button to Open/Close Camera Scanner */}
          <div className="flex items-center space-x-2">
            {!isCameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={isStartingCamera}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Camera className={`w-4 h-4 ${isStartingCamera ? 'animate-spin' : ''}`} />
                <span>{isStartingCamera ? 'Initializing Camera...' : '📷 Open Camera for Scan'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>Close Camera</span>
                </button>

                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    torchOn
                      ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                      : isDark
                      ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      : 'bg-slate-100 text-slate-600 border-slate-300 hover:text-slate-900'
                  }`}
                  title="Toggle Flashlight"
                >
                  {torchOn ? <Zap className="w-4 h-4 text-amber-400 fill-amber-400" /> : <ZapOff className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>

          {/* Camera Viewfinder Area (rendered when active) */}
          <div
            className={`relative rounded-xl overflow-hidden bg-slate-950 transition-all ${
              isCameraActive ? 'min-h-[220px] border border-indigo-500/40' : 'h-0 hidden'
            }`}
          >
            <div id={scannerContainerId} className="w-full max-w-sm mx-auto" />

            {/* Target Laser Reticle overlay */}
            {isCameraActive && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-36 border-2 border-dashed border-indigo-400/80 rounded-xl relative shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse top-1/2 relative shadow-[0_0_10px_#ef4444]" />
                </div>
              </div>
            )}
          </div>

          {/* Camera Error Message */}
          {cameraError && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                isDark ? 'bg-amber-950/40 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Camera scanner could not open</p>
                <p className="text-[11px] opacity-80">{cameraError}</p>
                <p className="text-[10px] text-indigo-400 font-bold">
                  Tip: You can use your physical USB barcode gun or enter the barcode below.
                </p>
              </div>
            </div>
          )}

          {/* USB Laser Scanner Ready Banner */}
          {!isCameraActive && (
            <div
              className={`p-3.5 rounded-xl border text-center space-y-1 ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-center space-x-1.5 text-indigo-400 font-bold text-xs">
                <Barcode className="w-4 h-4" />
                <span>Hardware Barcode Scanner Ready</span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Plug-and-play USB & Bluetooth wireless barcode scanners input directly into the field below.
              </p>
            </div>
          )}

          {/* Manual Barcode Input Field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                handleBarcodeDetected(manualCode.trim());
                setManualCode('');
              }
            }}
            className="flex items-center space-x-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Scan with barcode gun or type barcode ID..."
                className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <Keyboard className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add</span>
            </button>
          </form>

          {/* Recent Scanned Feedback */}
          {lastScanned && (
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs animate-fadeIn ${
                isDark ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-bold">{lastScanned.name || 'Scanned Barcode'}</span>
                  <span className="text-[10px] font-mono ml-2 opacity-80">({lastScanned.code})</span>
                </div>
              </div>
              <span className="text-[10px] opacity-75">Just now</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TYPE & SEARCH BILLING */}
      {billingTab === 'search' && (
        <div className="p-4 space-y-3.5">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              placeholder="Search product name, category, or barcode..."
              className={`w-full pl-9 pr-8 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition-colors ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-400'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            {productSearchQuery.length > 0 && (
              <button
                onClick={() => setProductSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                    : isDark
                    ? 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                }`}
              >
                {cat === 'ALL' ? '🏷️ All Categories' : cat}
              </button>
            ))}
          </div>

          {/* Dropdown Selector */}
          <div className="space-y-1">
            <label className={`text-[10px] font-bold uppercase tracking-wider block ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Select Product from Dropdown:
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-medium cursor-pointer ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="">
                -- Choose product to add ({filteredProducts.length} available) --
              </option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {currencySymbol}{p.price.toFixed(2)} ({p.category} | Stock: {p.stock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Products List Tray */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {productSearchQuery.trim() ? `Search Results (${filteredProducts.length})` : `Quick Add Products (${filteredProducts.length})`}
              </span>
            </div>

            {products.length === 0 ? (
              <div
                className={`p-6 rounded-xl border text-center space-y-2 ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <ShoppingBag className="w-8 h-8 text-slate-500 mx-auto opacity-60" />
                <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  No products in catalog yet
                </p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Go to the <strong>Catalog & Stock</strong> tab in Admin login to add your Satyamamba Fireworks products.
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center py-4 text-slate-500 text-xs">
                No products match "{productSearchQuery}". Try another keyword or change category.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleProductSelect(p.id)}
                    className={`border rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-all group ${
                      isDark
                        ? 'bg-slate-950/80 hover:bg-emerald-950/40 border-slate-800 hover:border-emerald-500/40'
                        : 'bg-white hover:bg-emerald-50/80 border-slate-200 hover:border-emerald-300 shadow-xs'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className={`text-xs font-bold truncate ${
                        isDark ? 'text-white group-hover:text-emerald-300' : 'text-slate-900 group-hover:text-emerald-800'
                      }`}>
                        {p.name}
                      </p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono text-[9px]">
                          {p.barcode}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">{p.category}</span>
                        <span>•</span>
                        <span className={p.stock <= 5 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                          {p.stock} {p.unit}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 flex-shrink-0">
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        {currencySymbol}{p.price.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
