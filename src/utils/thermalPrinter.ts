import { Invoice, StoreSettings } from '../types';

/**
 * ESC/POS Thermal Printer Protocol commands and Web Bluetooth connector
 */

// Command bytes for ESC/POS printers
const ESC = 0x1B;
const GS = 0x1D;

export const generateEscPosBuffer = (invoice: Invoice, settings: StoreSettings): Uint8Array => {
  const bytes: number[] = [];

  const addStr = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
  };

  const addLine = (str: string = '') => {
    addStr(str + '\n');
  };

  // Initialize printer
  bytes.push(ESC, 0x40);

  // Center alignment
  bytes.push(ESC, 0x61, 1);

  // Double height & bold header
  bytes.push(ESC, 0x21, 0x20); // Bold / large
  addLine(settings.storeName.toUpperCase());

  // Normal text reset
  bytes.push(ESC, 0x21, 0x00);
  if (settings.address) addLine(settings.address);
  if (settings.phone) addLine(`Ph: ${settings.phone}`);
  if (settings.gstin) addLine(`GSTIN: ${settings.gstin}`);

  addLine('--------------------------------');

  // Left alignment for invoice metadata
  bytes.push(ESC, 0x61, 0);
  addLine(`Invoice #: ${invoice.id}`);
  addLine(`Date: ${new Date(invoice.timestamp).toLocaleString()}`);
  addLine(`Cashier: ${invoice.cashierName}`);
  if (invoice.customerName) addLine(`Customer: ${invoice.customerName}`);

  addLine('--------------------------------');
  addLine('Item           Qty  Price  Amount');
  addLine('--------------------------------');

  invoice.items.forEach(item => {
    const name = item.name.length > 14 ? item.name.substring(0, 14) : item.name.padEnd(14, ' ');
    const qty = item.quantity.toString().padStart(3, ' ');
    const price = item.unitPrice.toFixed(0).padStart(5, ' ');
    const total = item.lineTotal.toFixed(0).padStart(7, ' ');
    addLine(`${name} ${qty} ${price} ${total}`);
  });

  addLine('--------------------------------');
  
  // Right alignment for totals
  bytes.push(ESC, 0x61, 2);
  bytes.push(ESC, 0x45, 1); // Bold
  addLine(`Subtotal: ${settings.currencySymbol}${invoice.subtotal.toFixed(2)}`);
  addLine(`Tax: ${invoice.includeTax === false ? 'Excluded (0%)' : `${settings.currencySymbol}${invoice.taxTotal.toFixed(2)}`}`);
  if (invoice.discountTotal > 0) {
    const discTag = invoice.overallDiscountValue ? ` (${invoice.overallDiscountType === 'FLAT' ? `${settings.currencySymbol}${invoice.overallDiscountValue}` : `${invoice.overallDiscountValue}%`})` : '';
    addLine(`Discount${discTag}: -${settings.currencySymbol}${invoice.discountTotal.toFixed(2)}`);
  }
  addLine(`GRAND TOTAL: ${settings.currencySymbol}${invoice.grandTotal.toFixed(2)}`);
  bytes.push(ESC, 0x45, 0); // Bold off

  addLine('--------------------------------');
  bytes.push(ESC, 0x61, 0);
  addLine(`Payment Mode: ${invoice.paymentMethod}`);
  if (invoice.paymentMethod === 'CASH' && invoice.cashTendered) {
    addLine(`Tendered: ${settings.currencySymbol}${invoice.cashTendered.toFixed(2)}`);
    addLine(`Change: ${settings.currencySymbol}${(invoice.changeDue || 0).toFixed(2)}`);
  }

  // Center alignment for footer
  bytes.push(ESC, 0x61, 1);
  addLine('\n' + (settings.receiptFooter || 'Thank you for your business!'));
  addLine('\n\n\n');

  // Cut paper command (GS V 66 0)
  bytes.push(GS, 0x56, 66, 0);

  return new Uint8Array(bytes);
};

/**
 * Web Bluetooth ESC/POS Print Handler
 */
export const printViaBluetooth = async (invoice: Invoice, settings: StoreSettings): Promise<{ success: boolean; message: string }> => {
  if (typeof window === 'undefined' || !('bluetooth' in navigator)) {
    return { success: false, message: 'Web Bluetooth is not supported in this browser. Use Chrome or Edge on Mobile/Desktop.' };
  }

  try {
    const device = await (navigator as unknown as { bluetooth: { requestDevice: (options: unknown) => Promise<any> } }).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', 0xFF00]
    });

    if (!device || !device.gatt) {
      return { success: false, message: 'No bluetooth device connected.' };
    }

    const server = await device.gatt.connect();
    // Get primary service
    const services = await server.getPrimaryServices();
    if (services.length === 0) {
      return { success: false, message: 'No print service found on selected Bluetooth device.' };
    }

    const service = services[0];
    const characteristics = await service.getCharacteristics();
    const writeCharacteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);

    if (!writeCharacteristic) {
      return { success: false, message: 'Printer write characteristic not found.' };
    }

    const buffer = generateEscPosBuffer(invoice, settings);
    
    // Send in chunks of 512 bytes
    const CHUNK_SIZE = 512;
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const chunk = buffer.slice(i, i + CHUNK_SIZE);
      await writeCharacteristic.writeValue(chunk);
    }

    return { success: true, message: 'Printed successfully via Bluetooth thermal printer!' };
  } catch (error: any) {
    console.error('Bluetooth printing error:', error);
    return { success: false, message: error.message || 'Bluetooth connection failed.' };
  }
};
