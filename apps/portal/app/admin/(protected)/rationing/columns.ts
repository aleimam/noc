// Canonical column contract for the rationing-sheet Excel template + import.
// Import reads cells by POSITION (1..N), so this ORDER is the contract — keep it stable.
export const SHEET_COLUMNS = [
  { key: 'numberInSheet', ar: 'رقم بالكشف', en: 'Number in Sheet', type: 'text' },
  { key: 'ownerName', ar: 'اسم المالك', en: 'Owner Name', type: 'text' },
  { key: 'company', ar: 'الشركة / الجمعية', en: 'Company', type: 'text' },
  { key: 'originalPiece', ar: 'القطعة الأصلية', en: 'Original Piece', type: 'text' },
  { key: 'originalLocation', ar: 'الموقع الأصلي', en: 'Original Location', type: 'text' },
  { key: 'originalMember', ar: 'العضو الأصلي', en: 'Original Member', type: 'text' },
  { key: 'sheetDate', ar: 'تاريخ الكشف', en: 'Sheet Date', type: 'date' },
  { key: 'paymentDate', ar: 'تاريخ السداد', en: 'Payment Date', type: 'date' },
  { key: 'sheetNotes', ar: 'ملاحظات', en: 'Sheet Notes', type: 'text' },
] as const;
