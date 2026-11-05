import { jsPDF } from 'jspdf';
import defaultJsPDF from 'jspdf';
import { Invoice, StoreSettings } from '../types';

/**
 * Robust constructor resolution across Vite, Rollup, Webpack and browser environments
 */
const createJsPdf = (options: any): jsPDF => {
  if (typeof jsPDF === 'function') {
    return new jsPDF(options);
  }
  if (typeof (defaultJsPDF as any) === 'function') {
    return new (defaultJsPDF as any)(options);
  }
  if (typeof (defaultJsPDF as any)?.jsPDF === 'function') {
    return new (defaultJsPDF as any).jsPDF(options);
  }
  throw new Error('jsPDF library could not be instantiated');
};

const fmt = (num: number | undefined | null): string => {
  return typeof num === 'number' && !isNaN(num) ? num.toFixed(2) : '0.00';
};

export const generateInvoicePDF = (invoice: Invoice, settings: StoreSettings): jsPDF => {
  const doc = createJsPdf({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  // Standard Helvetica handles 'Rs. ' perfectly without non-Latin-1 encoding issues
  const curr = settings.currencySymbol === '₹' ? 'Rs. ' : (settings.currencySymbol ? `${settings.currencySymbol} ` : 'Rs. ');
  let y = 20;

  // Header - Store Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229); // Indigo brand color
  doc.text(settings.storeName || 'FIREWORKS STORE', pageWidth / 2, y, { align: 'center' });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99); // Dark slate
  if (settings.address) {
    doc.text(settings.address, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }
  const contactInfo = `Phone: ${settings.phone || 'N/A'} | GSTIN: ${settings.gstin || 'N/A'}`;
  doc.text(contactInfo, pageWidth / 2, y, { align: 'center' });

  // Divider line
  y += 8;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageWidth - 15, y);

  // Invoice Meta Box
  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(`TAX INVOICE: ${invoice.id || 'N/A'}`, 15, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  const invoiceDate = invoice.timestamp ? new Date(invoice.timestamp).toLocaleString() : new Date().toLocaleString();
  doc.text(`Date: ${invoiceDate}`, pageWidth - 15, y, { align: 'right' });

  y += 6;
  doc.text(`Cashier: ${invoice.cashierName || 'Store Cashier'}`, 15, y);
  doc.text(`Payment: ${invoice.paymentMethod || 'CASH'}`, pageWidth - 15, y, { align: 'right' });

  if (invoice.customerName || invoice.customerPhone) {
    y += 6;
    doc.text(`Customer: ${invoice.customerName || 'Walk-in'} (${invoice.customerPhone || 'N/A'})`, 15, y);
  }

  // Table Headers
  y += 10;
  doc.setFillColor(243, 244, 246);
  doc.rect(15, y, pageWidth - 30, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);

  doc.text('#', 18, y + 5.5);
  doc.text('Item Description', 28, y + 5.5);
  doc.text('Qty', 115, y + 5.5, { align: 'right' });
  doc.text('Unit Price', 145, y + 5.5, { align: 'right' });
  doc.text('Tax %', 165, y + 5.5, { align: 'right' });
  doc.text('Total', pageWidth - 18, y + 5.5, { align: 'right' });

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  items.forEach((item, index) => {
    // Check if new page is needed
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    const rowBg = index % 2 === 0 ? 255 : 249;
    doc.setFillColor(rowBg, rowBg, rowBg);
    doc.rect(15, y - 4, pageWidth - 30, 7, 'F');

    doc.text((index + 1).toString(), 18, y);
    
    // Truncate long names
    const itemName = item.name || 'Item';
    const nameStr = itemName.length > 40 ? itemName.substring(0, 38) + '...' : itemName;
    doc.text(nameStr, 28, y);
    
    const qty = item.quantity || 1;
    const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
    const taxRate = typeof item.taxRate === 'number' ? item.taxRate : 0;
    const lineTotal = typeof item.lineTotal === 'number' ? item.lineTotal : unitPrice * qty;

    doc.text(qty.toString(), 115, y, { align: 'right' });
    doc.text(`${curr}${fmt(unitPrice)}`, 145, y, { align: 'right' });
    doc.text(`${taxRate}%`, 165, y, { align: 'right' });
    doc.text(`${curr}${fmt(lineTotal)}`, pageWidth - 18, y, { align: 'right' });

    y += 7;
  });

  // Divider
  y += 2;
  doc.setDrawColor(209, 213, 219);
  doc.line(15, y, pageWidth - 15, y);

  // Calculation Breakdown Box
  y += 8;
  const calcX = pageWidth - 85;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', calcX, y);
  doc.text(`${curr}${fmt(invoice.subtotal)}`, pageWidth - 18, y, { align: 'right' });

  y += 6;
  const taxLabel = invoice.includeTax === false ? 'Tax (0% Free):' : 'Total Tax:';
  const taxValStr = invoice.includeTax === false ? `${curr}0.00` : `${curr}${fmt(invoice.taxTotal)}`;
  doc.text(taxLabel, calcX, y);
  doc.text(taxValStr, pageWidth - 18, y, { align: 'right' });

  if (invoice.discountTotal && invoice.discountTotal > 0) {
    y += 6;
    doc.setTextColor(220, 38, 38);
    const discLabel = invoice.overallDiscountValue
      ? `Discount (${invoice.overallDiscountType === 'FLAT' ? `${curr}${invoice.overallDiscountValue}` : `${invoice.overallDiscountValue}%`}):`
      : 'Discount:';
    doc.text(discLabel, calcX, y);
    doc.text(`-${curr}${fmt(invoice.discountTotal)}`, pageWidth - 18, y, { align: 'right' });
    doc.setTextColor(31, 41, 55);
  }

  y += 8;
  doc.setFillColor(238, 242, 255);
  doc.rect(calcX - 5, y - 5, 75, 10, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229);
  doc.text('Grand Total:', calcX, y + 2);
  doc.text(`${curr}${fmt(invoice.grandTotal)}`, pageWidth - 18, y + 2, { align: 'right' });

  // Footer Note
  y += 25;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(settings.receiptFooter || 'Thank you for your purchase!', pageWidth / 2, y, { align: 'center' });

  return doc;
};

export const shareViaWhatsApp = (invoice: Invoice, settings: StoreSettings) => {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const itemsText = items
    .map(i => `• ${i.name} x${i.quantity} = ${settings.currencySymbol}${fmt(i.lineTotal)}`)
    .join('\n');

  const text = `🧾 *RECEIPT FROM ${(settings.storeName || 'STORE').toUpperCase()}*\n` +
    `Invoice: *${invoice.id}*\n` +
    `Date: ${new Date(invoice.timestamp || Date.now()).toLocaleDateString()}\n\n` +
    `*ITEMS:*\n${itemsText}\n\n` +
    `Subtotal: ${settings.currencySymbol}${fmt(invoice.subtotal)}\n` +
    `Tax: ${settings.currencySymbol}${fmt(invoice.taxTotal)}\n` +
    `*GRAND TOTAL: ${settings.currencySymbol}${fmt(invoice.grandTotal)}*\n\n` +
    `Payment Mode: ${invoice.paymentMethod || 'CASH'}\n\n` +
    `Thank you for shopping with us!`;

  const encoded = encodeURIComponent(text);
  const whatsappUrl = invoice.customerPhone
    ? `https://wa.me/${invoice.customerPhone.replace(/[^0-9]/g, '')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.open(whatsappUrl, '_blank');
};
