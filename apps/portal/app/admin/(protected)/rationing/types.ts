// Shared types for the rationing admin import flow. Kept out of the 'use server'
// actions module (which may only export async functions).

export type PreviewRow = {
  rowNumber: number;
  applicantName: string;
  names: string[];
  plotNo: string;
  blockNo: string;
  city: string | null;
  originalOwner: string | null;
  status: 'new' | 'duplicate'; // duplicate = already in DB or earlier in this file
  flagged: boolean; // has an internal remark (OCR verification)
};

export type ScanRow = {
  id: string;
  fileName: string;
  path: string;
  matchedRows: number; // applicant rows whose sourceFile == fileName
};

export type ScanReport = {
  matchedScans: number;
  orphanScans: number;
  rowsCovered: number;
  rowsMissing: number; // distinct sourceFile values with no scan
  scans: ScanRow[];
};

export type PreviewResult =
  | {
      ok: true;
      fileName: string;
      summary: {
        total: number;
        newCount: number;
        duplicateCount: number;
        flaggedCount: number;
        newCities: string[];
      };
      rows: PreviewRow[]; // capped sample for the UI
    }
  | { ok: false; error: string };
