# Product Requirement Document (PRD)

## Project Title: Mobile Barcode Billing System
**Document Version:** 1.0  
**Prepared For:** Anti-gravity Development Team  
**Target Platform:** Mobile (iOS / Android)  

---

## 1. Executive Summary & Objective

Small- to medium-sized retail businesses frequently face bottlenecks at traditional checkout counters due to bulky hardware setups, long queues, and manual product entry. 

**Objective:** Build a lightweight, reliable mobile application that uses the smartphone camera to scan product barcodes, retrieve product details, build an active cart/invoice, calculate taxes and totals, and generate/share a digital or printable receipt for customers.

---

## 2. Target Users & Personas

- **Cashier / Store Associate:** Needs rapid scanning, quick quantity adjustments, fast total calculation, and simple receipt generation.
- **Store Manager / Owner:** Needs catalog management (adding items, prices, barcodes) and transaction summary reports.
- **End Customer:** Receives an itemized digital receipt (via SMS/WhatsApp/email) or a thermal-printed receipt.

---

## 3. Key Functional Requirements

### 3.1. Camera-Based Barcode Scanner
- **Camera Integration:** Access rear device camera with real-time video feed.
- **Barcode Formats Supported:** EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, and standard QR codes.
- **Scanning Capabilities:**
  - Fast continuous/multi-scan mode (scan multiple items without leaving the viewfinder).
  - Torch/Flashlight toggle for low-light environments.
  - Audio/haptic feedback on successful scan.
  - Manual barcode entry fallback if a label is smudged or unreadable.

### 3.2. Real-Time Cart & Bill Calculation
- **Item Lookup:** Match scanned barcode with local or cloud product database:
  - Product Name
  - SKU / Barcode ID
  - Unit Price
  - Applicable Tax Rate (e.g., GST / VAT / Sales Tax)
- **Cart Interactions:**
  - Auto-increment quantity if the same item is scanned multiple times.
  - Manual quantity adjust (+ / - / keypad input).
  - Item removal / swipe to delete.
  - Line-item discount and overall bill discount (percentage or flat amount).
- **Calculation Breakdown:**
  - Subtotal (sum of unit prices $\times$ quantities)
  - Tax breakdown
  - Applied discounts
  - **Grand Total**

### 3.3. Checkout & Payment Handling
- **Payment Method Selection:**
  - Cash (with cash-tendered & change-due calculator).
  - UPI / QR Code payment prompt.
  - Card / External POS terminal confirmation.
- **Invoice Numbering:** Auto-incrementing, unique invoice identifier (e.g., `INV-2026-0001`).

### 3.4. Invoice / Receipt Generation & Sharing
- **Receipt Details:**
  - Business name, address, contact, and tax identification number.
  - Date & timestamp.
  - Itemized table (Name, Qty, Unit Price, Line Total).
  - Subtotal, Tax, Discount, Grand Total.
  - Selected payment mode.
- **Output Formats:**
  - Formatted PDF generation.
  - One-tap sharing via WhatsApp, SMS, or Email.
  - Bluetooth thermal printer integration (ESC/POS command standard) for instant paper receipt generation.

### 3.5. Inventory & Product Catalog Management
- **Catalog Database:**
  - Add / edit / delete items (Name, Barcode, Price, Tax rate, Stock count).
  - In-app barcode registration: Scan an unmapped product and assign details immediately.
  - CSV/Excel bulk import and export of product database.
- **Offline Mode:**
  - Local database caching (e.g., SQLite / WatermelonDB) so the cashier can continue scanning and billing even without an internet connection.
  - Auto-sync transactions when network connectivity is restored.

---

## 4. User Flow

```
[Start New Bill]
       │
       ▼
[Open Camera Scanner] ──(Scan Barcode)──► [Match Product in DB]
       │                                          │
       │◄─────────────[Add to Cart]───────────────┘
       │
[Review Cart / Adjust Quantities / Apply Discounts]
       │
       ▼
[Proceed to Checkout]
       │
       ▼
[Select Payment Method (Cash/UPI/Card)]
       │
       ▼
[Generate Final Bill & Invoice ID]
       │
       ├─► [Print via Bluetooth Thermal Printer]
       └─► [Share via WhatsApp / PDF / SMS]
```

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Barcode scan recognition within $\le 300\text{ ms}$; app load time under 2 seconds. |
| **Offline Reliability** | Core billing and scanning must work 100% offline using locally stored product records. |
| **Hardware Compatibility** | Android 9.0+ and iOS 14.0+; support for budget smartphones with minimum 720p rear camera. |
| **Security** | Role-based authentication (Manager vs. Cashier); encrypted local storage for sales data. |
| **Battery Efficiency** | Optimized camera viewfinder pipeline to prevent device overheating during extended checkout shifts. |

---

## 6. Suggested Technology Stack

- **Mobile Framework:** React Native / Flutter (single codebase for iOS & Android).
- **Barcode Engine:** Google ML Kit (Barcode Scanning API) / Vision Camera.
- **Local Storage:** SQLite / Realm / WatermelonDB (for offline-first capabilities).
- **Backend / Cloud (Optional Sync):** Node.js / Go / Firebase with PostgreSQL.
- **Peripheral Support:** Bluetooth ESC/POS printer protocol library.

---

## 7. Deliverables & Milestones for Anti-gravity

1. **Phase 1: Discovery & Wireframing**
   - UI/UX flow for the cashier counter and scanning screen.
   - Database schema definition.
2. **Phase 2: Core Engine & Scanning**
   - Camera module integration with Google ML Kit.
   - Local product catalog CRUD and barcode lookup.
3. **Phase 3: Billing Logic & Receipt Engine**
   - Cart mechanics, tax/discount calculation, and PDF/ESC-POS receipt generation.
4. **Phase 4: Testing & Hardening**
   - Stress testing scanning under poor lighting and damaged barcode conditions.
   - Offline-to-online sync verification.
5. **Phase 5: Deployment**
   - App distribution (APK release / App Store submission).