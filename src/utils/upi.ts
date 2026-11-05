import QRCode from 'qrcode';
import { StoreSettings, UpiAccount } from '../types';

export const getEffectiveUpiAccounts = (settings: StoreSettings): UpiAccount[] => {
  const accounts: UpiAccount[] = settings.upiAccounts && settings.upiAccounts.length > 0
    ? [...settings.upiAccounts]
    : [];

  if (settings.upiId && !accounts.some((a) => a.upiId.toLowerCase() === settings.upiId.toLowerCase())) {
    accounts.unshift({
      id: 'default-upi',
      upiId: settings.upiId,
      label: 'Primary UPI',
      isDefault: true,
    });
  }

  // Ensure at least one is flagged as default
  if (accounts.length > 0 && !accounts.some((a) => a.isDefault)) {
    accounts[0].isDefault = true;
  }

  return accounts;
};

export interface UpiValidationResult {
  isValid: boolean;
  cleaned: string;
  error?: string;
}

/**
 * Validates and sanitizes a UPI ID (Virtual Payment Address).
 * Standard Indian NPCI VPA format: username@bank (e.g. store@okhdfcbank, 9876543210@paytm)
 */
export const validateUpiId = (rawUpi: string): UpiValidationResult => {
  if (!rawUpi || !rawUpi.trim()) {
    return {
      isValid: false,
      cleaned: '',
      error: 'UPI ID is required (e.g. store@okhdfcbank or 9876543210@paytm)',
    };
  }

  let cleaned = rawUpi.trim();

  // Strip accidental upi:// or upi: scheme prefixes if pasted
  if (cleaned.toLowerCase().startsWith('upi://pay?')) {
    const match = cleaned.match(/[?&]pa=([^&]+)/i);
    if (match && match[1]) {
      cleaned = decodeURIComponent(match[1]);
    }
  } else if (cleaned.toLowerCase().startsWith('upi:')) {
    cleaned = cleaned.replace(/^upi:\/?\/?/i, '');
  }

  // Remove whitespace and convert to lowercase (standard for VPAs)
  cleaned = cleaned.replace(/\s+/g, '').toLowerCase();

  // Check format: prefix@handle
  // NPCI specs: Alphanumeric with dots, hyphens, underscores before '@', alphanumeric after '@'
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$/;

  if (!upiRegex.test(cleaned)) {
    return {
      isValid: false,
      cleaned,
      error: 'Invalid UPI format. Must be in the form username@bank (e.g. store@okhdfcbank, 9876543210@ybl)',
    };
  }

  return {
    isValid: true,
    cleaned,
  };
};

export interface BuildUpiParams {
  upiId: string;
  storeName: string;
  amount?: number;
  note?: string;
  invoiceId?: string;
  isStatic?: boolean;
}

/**
 * Builds an NPCI-compliant UPI Intent URI.
 * CRITICAL: In NPCI UPI spec:
 * - 'pa' MUST contain the raw '@' symbol (NOT '%40') so UPI apps recognize the VPA
 * - 'pn' (payee name) should be sanitized to alphanumeric + spaces, max 25-30 chars
 * - 'am' (amount) must be formatted to 2 decimal places if provided
 * - 'cu' must always be 'INR'
 * - 'tn' (transaction note) should be URL-encoded without raw spaces
 */
export const buildUpiPaymentUrl = ({
  upiId,
  storeName,
  amount,
  note = 'Bill Payment',
  invoiceId,
  isStatic = false,
}: BuildUpiParams): string => {
  const { cleaned } = validateUpiId(upiId);
  const vpa = cleaned || upiId.trim().toLowerCase();

  // Sanitize store name: only alphanumeric and spaces, max 25 chars
  const cleanStore = (storeName || 'Merchant')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25) || 'Store';

  const cleanNote = (note || 'Bill Payment')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25) || 'Bill';

  // Base parameters: pa (literal @), pn, cu
  let url = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(cleanStore)}&cu=INR`;

  // If dynamic QR and amount is positive, include am and tn
  if (!isStatic && typeof amount === 'number' && amount > 0) {
    url += `&am=${amount.toFixed(2)}`;
    url += `&tn=${encodeURIComponent(cleanNote)}`;
  }

  if (invoiceId) {
    const cleanRef = invoiceId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 25);
    if (cleanRef) {
      url += `&tr=${encodeURIComponent(cleanRef)}`;
    }
  }

  return url;
};

/**
 * Generates an offline base64 Data URL for the QR code.
 * Falls back to single-encoded external API if client-side rendering fails.
 */
export const generateUpiQrDataUrl = async (upiUrl: string): Promise<string> => {
  try {
    const dataUrl = await QRCode.toDataURL(upiUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 260,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return dataUrl;
  } catch (err) {
    console.warn('Local QRCode generation failed, using fallback URL:', err);
    // Fallback: single URL-encode the whole upiUrl
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(upiUrl)}`;
  }
};
