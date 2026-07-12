// Calculator FAQ — grounded in the actual logic (calc.ts): net-area factors 0.85 (<500 m²)
// / 0.80 (≥500 m²), buy shortfall vs sell surplus against the standard area, plus utilities,
// admin fee and transfer fee; results are indicative, not official.
// Rendered BOTH as visible accordion and FAQPage JSON-LD (must match — Google requirement).

export function calculatorFaq(locale: 'ar' | 'en'): { q: string; a: string }[] {
  if (locale === 'en') {
    return [
      {
        q: 'How is the reconciliation (تصالح) calculated?',
        a: 'From the area difference between your area after deduction and the standard plot area (buying the shortfall or selling the surplus), plus utilities, the administrative fee and the ownership-transfer fee — then split across a down payment, a completion payment and three annual installments.',
      },
      {
        q: 'What is the actual (after-deduction) area?',
        a: 'It is your plot area after applying the deduction factor: 0.85 for areas under 500 m² and 0.80 for 500 m² and above. This area is the basis of the calculation.',
      },
      {
        q: 'What is the difference between buying the shortfall and selling the surplus?',
        a: 'If your area after deduction is smaller than the standard plot you buy the difference from the Authority; if it is larger you sell the surplus to the Authority at the set per-metre price.',
      },
      {
        q: 'How does the area calculator work?',
        a: 'It converts the original area to the net area by multiplying it by 0.85 (under 500 m²) or 0.80 (500 m² and above).',
      },
      {
        q: 'Is the result official?',
        a: 'No. The figures are indicative estimates for guidance only and are not an official statement from the City Authority. Visit the Authority for the exact values.',
      },
    ];
  }
  return [
    {
      q: 'كيف يُحسب التصالح في العبور الجديدة؟',
      a: 'يُحسب من فرق المساحة بين مساحتك بعد الخصم والمساحة القياسية (شراء العجز أو بيع الزيادة)، مضافاً إليه رسوم الترفيق والرسوم الإدارية ومصاريف نقل الملكية، ثم يُوزَّع على مقدم ودفعة استكمال وثلاثة أقساط سنوية.',
    },
    {
      q: 'ما هي المساحة الفعلية (بعد الخصم)؟',
      a: 'هي مساحة أرضك بعد تطبيق نسبة الخصم: 0.85 للمساحات الأقل من 500 م²، و0.80 لمساحة 500 م² فأكثر. هذه المساحة هي أساس الحساب.',
    },
    {
      q: 'ما الفرق بين شراء العجز وبيع الزيادة؟',
      a: 'إذا كانت مساحتك بعد الخصم أقل من المساحة القياسية تشتري الفرق من الجهاز، وإذا كانت أكبر تبيع الزيادة للجهاز بسعر المتر المحدد.',
    },
    {
      q: 'كيف تعمل حاسبة المساحة؟',
      a: 'تحوّل المساحة الأصلية إلى صافي المساحة بضربها في 0.85 (أقل من 500 م²) أو 0.80 (500 م² فأكثر).',
    },
    {
      q: 'هل النتيجة رسمية؟',
      a: 'لا، القيم تقديرية للاسترشاد فقط وليست بياناً رسمياً من جهاز المدينة. راجع الجهاز لمعرفة القيم الدقيقة.',
    },
  ];
}
