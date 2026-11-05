import React, { useState } from 'react';
import { X, Printer, Download, Share2, Check, MessageSquare, Sparkles, FileText } from 'lucide-react';
import { Invoice, StoreSettings } from '../types';
import { generateInvoicePDF, shareViaWhatsApp } from '../utils/pdfGenerator';
import { printViaBluetooth } from '../utils/thermalPrinter';

interface ReceiptViewModalProps {
  invoice: Invoice;
  settings: StoreSettings;
  onClose: () => void;
  onNewBill: () => void;
}

export const ReceiptViewModal: React.FC<ReceiptViewModalProps> = ({
  invoice,
  settings,
  onClose,
  onNewBill,
}) => {
  const [isPrintingBt, setIsPrintingBt] = useState<boolean>(false);
  const [printStatusMsg, setPrintStatusMsg] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfDownloadMsg, setPdfDownloadMsg] = useState<string | null>(null);

  const handleDownloadPDF = () => {
    try {
      setIsGeneratingPdf(true);
      setPdfDownloadMsg('Generating PDF invoice...');

      const doc = generateInvoicePDF(invoice, settings);
      const cleanId = (invoice.id || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${cleanId}.pdf`;

      // Method 1: Create Blob and trigger direct browser anchor download
      try {
        const blob = doc.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.style.display = 'none';
        downloadLink.href = blobUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();

        setTimeout(() => {
          if (downloadLink.parentNode) {
            downloadLink.parentNode.removeChild(downloadLink);
          }
          URL.revokeObjectURL(blobUrl);
        }, 4000);

        setPdfDownloadMsg(`✓ Invoice downloaded as "${fileName}"`);
      } catch (blobErr) {
        console.warn('Direct Blob download failed, attempting doc.save fallback:', blobErr);
        // Method 2 fallback: standard jsPDF doc.save
        doc.save(fileName);
        setPdfDownloadMsg(`✓ Invoice downloaded as "${fileName}"`);
      }

      setTimeout(() => setPdfDownloadMsg(null), 5000);
    } catch (e: any) {
      console.error('Failed to generate PDF:', e);
      setPdfDownloadMsg(`Failed to generate PDF: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleBluetoothPrint = async () => {
    setIsPrintingBt(true);
    setPrintStatusMsg('Connecting to Bluetooth Thermal Printer...');
    const result = await printViaBluetooth(invoice, settings);
    setIsPrintingBt(false);
    setPrintStatusMsg(result.message);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-scaleUp">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-emerald-400 bg-emerald-500/20 p-1 rounded-full" />
            <div>
              <h3 className="font-extrabold text-base text-white">Bill Completed</h3>
              <p className="text-[10px] text-slate-400 font-mono">Invoice #{invoice.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Thermal Paper Simulator View */}
        <div className="p-4 overflow-y-auto bg-slate-950 flex flex-col items-center">
          {printStatusMsg && (
            <div className={`w-full mb-3 p-2.5 rounded-xl text-xs font-semibold text-center border ${
              printStatusMsg.includes('success')
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300'
            }`}>
              {printStatusMsg}
            </div>
          )}

          {pdfDownloadMsg && (
            <div className={`w-full mb-3 p-2.5 rounded-xl text-xs font-semibold text-center border ${
              pdfDownloadMsg.startsWith('✓')
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : pdfDownloadMsg.includes('Generating')
                ? 'bg-amber-950/80 border-amber-500/40 text-amber-300 animate-pulse'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
            }`}>
              {pdfDownloadMsg}
            </div>
          )}

          {/* Thermal Paper Slip Container */}
          <div className="w-full max-w-[340px] bg-amber-50/95 text-slate-900 p-5 rounded-sm shadow-2xl font-mono text-xs border-t-8 border-indigo-600 relative overflow-hidden">
            {/* Store Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
              <h2 className="font-black text-sm tracking-tight text-slate-950 uppercase">{settings.storeName}</h2>
              {settings.address && <p className="text-[10px] text-slate-700">{settings.address}</p>}
              <p className="text-[10px] text-slate-700">Ph: {settings.phone} | GST: {settings.gstin}</p>
            </div>

            {/* Invoice Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>INVOICE:</span>
                <span className="font-bold">{invoice.id}</span>
              </div>
              <div className="flex justify-between">
                <span>DATE:</span>
                <span>{new Date(invoice.timestamp).toLocaleDateString()} {new Date(invoice.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span>CASHIER:</span>
                <span>{invoice.cashierName}</span>
              </div>
              {invoice.customerName && (
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span>{invoice.customerName}</span>
                </div>
              )}
            </div>

            {/* Itemized Table */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] text-slate-600 border-b border-slate-300 pb-1">
                <span className="w-2/5">ITEM</span>
                <span className="w-1/5 text-center">QTY</span>
                <span className="w-2/5 text-right">TOTAL</span>
              </div>
              {invoice.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-[11px] leading-tight">
                  <span className="w-2/5 truncate">{item.name}</span>
                  <span className="w-1/5 text-center">x{item.quantity}</span>
                  <span className="w-2/5 text-right font-bold">{settings.currencySymbol}{item.lineTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-700">
                <span>Subtotal:</span>
                <span>{settings.currencySymbol}{invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Tax Total:</span>
                <span>
                  {invoice.includeTax === false ? (
                    <span className="text-emerald-700 font-bold">0% Tax Free</span>
                  ) : (
                    `${settings.currencySymbol}${invoice.taxTotal.toFixed(2)}`
                  )}
                </span>
              </div>
              {invoice.discountTotal > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>
                    Discount {invoice.overallDiscountValue ? `(${invoice.overallDiscountType === 'FLAT' ? `${settings.currencySymbol}${invoice.overallDiscountValue}` : `${invoice.overallDiscountValue}%`})` : ''}:
                  </span>
                  <span>-{settings.currencySymbol}{invoice.discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-1.5 text-slate-950 border-t border-slate-300">
                <span>GRAND TOTAL:</span>
                <span>{settings.currencySymbol}{invoice.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-2 text-[10px] space-y-0.5 text-slate-700">
              <div className="flex justify-between font-bold">
                <span>PAYMENT MODE:</span>
                <span>{invoice.paymentMethod}</span>
              </div>
              {invoice.cashTendered && (
                <>
                  <div className="flex justify-between">
                    <span>Tendered:</span>
                    <span>{settings.currencySymbol}{invoice.cashTendered.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>Change Returned:</span>
                    <span>{settings.currencySymbol}${(invoice.changeDue || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-3 text-[10px] text-slate-600 border-t border-dashed border-slate-400">
              <p>{settings.receiptFooter}</p>
              <div className="w-32 h-6 mx-auto mt-2 bg-slate-900 rounded flex items-center justify-center text-[9px] text-white tracking-widest font-mono">
                |||| ||| ||||||| |||
              </div>
            </div>
          </div>
        </div>

        {/* Share & Print Action Sheet */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleBluetoothPrint}
              disabled={isPrintingBt}
              className="py-2.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-1 shadow-md shadow-indigo-600/20"
            >
              <Printer className="w-4 h-4" />
              <span>BT Print</span>
            </button>

            <button
              onClick={() => shareViaWhatsApp(invoice, settings)}
              className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-1 shadow-md shadow-emerald-600/20"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className={`py-2.5 px-2 text-white rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-1 border ${
                isGeneratingPdf 
                  ? 'bg-amber-600/30 border-amber-500/50 text-amber-200 cursor-wait' 
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600'
              }`}
            >
              <Download className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce text-amber-400' : ''}`} />
              <span>{isGeneratingPdf ? 'Generating...' : 'PDF Invoice'}</span>
            </button>
          </div>

          <button
            onClick={onNewBill}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4 fill-slate-950" />
            <span>Start Next Bill</span>
          </button>
        </div>
      </div>
    </div>
  );
};
