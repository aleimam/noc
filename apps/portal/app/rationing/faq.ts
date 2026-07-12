// Rationing FAQ — grounded in how the search actually works (name search needs a full
// name of 2+ words, or plot/block; free; shows official source sheets; report-missing flow).
// Rendered BOTH as visible accordion and FAQPage JSON-LD (must match — Google requirement).

export function rationingFaq(locale: 'ar' | 'en'): { q: string; a: string }[] {
  if (locale === 'en') {
    return [
      {
        q: 'What are the New Obour rationing (تقنين) lists?',
        a: 'They are the official lists that survey land holders and owners in New Obour City ahead of legalizing their status. We publish copies of these sheets so you can search them easily.',
      },
      {
        q: 'How do I search for my name in the rationing lists?',
        a: 'Type your full name (at least two words) in the search box, or search by plot or block number. Tap a result to view the official source sheet.',
      },
      {
        q: 'Is the service free?',
        a: 'Yes. Searching the rationing lists on the New Obour portal is completely free.',
      },
      {
        q: "I couldn't find my name — what should I do?",
        a: 'Your sheet may not be digitized yet. Use the “Report a missing sheet” button so we can add it.',
      },
      {
        q: 'Are these sheets official?',
        a: 'We display images of the official sheets as issued. For a certified official statement, please visit the New Obour City Authority.',
      },
    ];
  }
  return [
    {
      q: 'ما هي كشوف تقنين العبور الجديدة؟',
      a: 'هي القوائم الرسمية لحصر واضعي اليد وأصحاب الأراضي في مدينة العبور الجديدة تمهيداً لتقنين أوضاعهم. ننشر نسخاً من هذه الكشوف لتسهيل البحث فيها.',
    },
    {
      q: 'كيف أبحث عن اسمي في كشوف التقنين؟',
      a: 'اكتب اسمك كاملاً (اسمين على الأقل) في خانة البحث، أو ابحث برقم القطعة أو البلوك، ثم اضغط على النتيجة لعرض الكشف الرسمي.',
    },
    {
      q: 'هل الخدمة مجانية؟',
      a: 'نعم، البحث في كشوف التقنين على بوابة العبور الجديدة مجاني تماماً.',
    },
    {
      q: 'لم أجد اسمي في الكشوف، ماذا أفعل؟',
      a: 'قد لا يكون الكشف الخاص بك قد أُضيف بعد. استخدم زر «الإبلاغ عن كشف غير موجود» لنعمل على إضافته.',
    },
    {
      q: 'هل هذه الكشوف رسمية؟',
      a: 'نعرض صور الكشوف الرسمية كما صدرت. للحصول على بيان رسمي معتمد يرجى مراجعة جهاز مدينة العبور الجديدة.',
    },
  ];
}
