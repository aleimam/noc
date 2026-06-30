// Admin-editable Calculator configuration, stored as one JSON blob in
// Setting('calculator.config') and merged over the in-code defaults so missing keys
// always fall back. Pure logic + defaults live in ./calc (client-safe).
import { prisma } from '@noc/db';
import { DEFAULT_CALC_CONFIG, type CalculatorConfig } from './calc';

const KEY = 'calculator.config';

export async function getCalculatorConfig(): Promise<CalculatorConfig> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (!row?.value) return DEFAULT_CALC_CONFIG;
    const parsed = JSON.parse(row.value) as Partial<CalculatorConfig>;
    return {
      ...DEFAULT_CALC_CONFIG,
      ...parsed,
      factors: { ...DEFAULT_CALC_CONFIG.factors, ...(parsed.factors ?? {}) },
      contact: { ...DEFAULT_CALC_CONFIG.contact, ...(parsed.contact ?? {}) },
      standardAreas: parsed.standardAreas?.length ? parsed.standardAreas : DEFAULT_CALC_CONFIG.standardAreas,
      utilityBrackets: parsed.utilityBrackets?.length ? parsed.utilityBrackets : DEFAULT_CALC_CONFIG.utilityBrackets,
      downPaymentBands: parsed.downPaymentBands?.length ? parsed.downPaymentBands : DEFAULT_CALC_CONFIG.downPaymentBands,
    };
  } catch {
    return DEFAULT_CALC_CONFIG;
  }
}

export async function saveCalculatorConfig(cfg: CalculatorConfig): Promise<void> {
  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(cfg) },
    create: { key: KEY, value: JSON.stringify(cfg) },
  });
}
