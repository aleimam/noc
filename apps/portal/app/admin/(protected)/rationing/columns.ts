// Canonical column contract for the rationing-sheet Excel template + import.
// Import reads cells by POSITION (1..N), so this ORDER is the contract — keep it stable
// and matching the source workbook ("Applicants" sheet).
export const SHEET_COLUMNS = [
  { key: 'applicantNo', ar: 'رقم المتقدّم', en: 'Applicant No', type: 'number' },
  { key: 'applicantName', ar: 'اسم المتقدّم', en: 'Applicant Name', type: 'text' },
  { key: 'plotNo', ar: 'رقم القطعة', en: 'Plot No', type: 'text' },
  { key: 'blockNo', ar: 'رقم المربع', en: 'Block No', type: 'text' },
  { key: 'plotFullRef', ar: 'المرجع الكامل للقطعة', en: 'Plot Full Reference', type: 'text' },
  { key: 'city', ar: 'المدينة', en: 'City', type: 'text' },
  { key: 'originalOwner', ar: 'المالك الأصلي', en: 'Original Owner', type: 'text' },
  { key: 'attendanceDay', ar: 'يوم الحضور', en: 'Attendance Day', type: 'text' },
  { key: 'attendanceDate', ar: 'تاريخ الحضور', en: 'Attendance Date', type: 'date' },
  { key: 'listDate', ar: 'تاريخ الكشف', en: 'List Date', type: 'date' },
  { key: 'declarationRequired', ar: 'يلزم إقرار', en: 'Declaration Required', type: 'bool' },
  { key: 'declarationDetails', ar: 'تفاصيل الإقرار', en: 'Declaration Details', type: 'text' },
  { key: 'remarks', ar: 'ملاحظات (داخلي)', en: 'Remarks', type: 'text' },
  { key: 'sourceFile', ar: 'ملف المصدر (داخلي)', en: 'Source File', type: 'text' },
] as const;

export type SheetColumnKey = (typeof SHEET_COLUMNS)[number]['key'];
