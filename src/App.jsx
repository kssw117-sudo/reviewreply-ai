import React, { useState, useEffect } from 'react';

// Ответ сервера о пробной попытке или дневном лимите (считаются на сервере).
function guardError(data) {
  if (data && (data.code === 'trial_used' || data.code === 'limit_reached')) {
    const e = new Error(data.error || data.code);
    e.guardMessage = data.error;
    e.guardCode = data.code;
    return e;
  }
  return null;
}


// Маленький помощник для IndexedDB — используем для фото, т.к. до трёх
// изображений в base64 легко превышают лимит localStorage (~5-10 МБ)
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('rr_drafts', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}
async function idbSet(key, value) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* тихо игнорируем — фото просто не сохранятся черновиком */ }
}

const FREE_TRIAL_LIMIT = 1;
const DAILY_GEN_LIMIT = 50;
const DAILY_GEN_KEY = 'rr_daily_gens';

function getTrialCount() {
  const stored = localStorage.getItem('reviewreply_trial_count');
  return stored ? parseInt(stored, 10) : 0;
}

function getDailyCount() {
  const today = new Date().toISOString().slice(0, 10);
  let record;
  try {
    record = JSON.parse(localStorage.getItem(DAILY_GEN_KEY) || 'null');
  } catch (e) {
    record = null;
  }
  if (!record || record.date !== today) return 0;
  return record.count;
}

function checkAndUseDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  let record;
  try {
    record = JSON.parse(localStorage.getItem(DAILY_GEN_KEY) || 'null');
  } catch (e) {
    record = null;
  }
  if (!record || record.date !== today) {
    record = { date: today, count: 0 };
  }
  if (record.count >= DAILY_GEN_LIMIT) {
    return false;
  }
  record.count += 1;
  localStorage.setItem(DAILY_GEN_KEY, JSON.stringify(record));
  return true;
}

export default function ReviewReplyAI() {
  const [dailyCount, setDailyCount] = useState(() => getDailyCount());
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (window.location.search.includes('welcome=1')) {
      setShowWelcome(true);
      window.history.replaceState({}, '', window.location.pathname);
      const timer = setTimeout(() => setShowWelcome(false), 3800);
      return () => clearTimeout(timer);
    }
  }, []);

  const [businessName, setBusinessName] = useState(() => localStorage.getItem('rr_draft_businessName') || '');
  const [reviewText, setReviewText] = useState(() => localStorage.getItem('rr_draft_reviewText') || '');
  const [tone, setTone] = useState('warm');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [licenseCode, setLicenseCode] = useState(() => localStorage.getItem('rr_licenseCode') || '');
  const [showSupportEmail, setShowSupportEmail] = useState(false);
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('rr_unlocked') === 'true');
  const [licenseError, setLicenseError] = useState('');
  const [showHelpBubble, setShowHelpBubble] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [factIdx, setFactIdx] = useState(0);
  const [rateStars, setRateStars] = useState(0);
  const [rateProblem, setRateProblem] = useState('');

  const LIVE_FACTS = [
    { text: 'Just generated: 3 reply options in 4 seconds', stars: 5 },
    { text: 'Every reply comes with a private note only you see', stars: 5 },
    { text: 'Works with reviews from any platform — Google, Yelp, anywhere', stars: 5 },
    { text: 'Handles a 1-star review just as carefully', stars: 1 },
    { text: 'Each reply matches your tone — friendly, formal, or brief', stars: 5 },
    { text: 'Just replied to a 3-star review in 4 seconds', stars: 3 },
    { text: 'Picks up on the specific details in each review', stars: 5 },
    { text: 'Never sends the same reply twice', stars: 5 },
    { text: 'Reads the whole review, not just the star rating', stars: 4 },
    { text: 'Just turned a tricky 2-star review into a calm, professional reply', stars: 2 },
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setFactIdx(i => (i + 1) % LIVE_FACTS.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  // Лёгкий "поп"-звук для открытия/закрытия окошка подсказки
  function playPopSound(opening) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(opening ? 520 : 380, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(opening ? 780 : 260, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) { /* звук не критичен для работы приложения */ }
  }

  const [includeEmoji, setIncludeEmoji] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [trialCount, setTrialCount] = useState(getTrialCount());
  const [socialPost, setSocialPost] = useState(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialCopied, setSocialCopied] = useState(false);
  const [followUpMsg, setFollowUpMsg] = useState(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpCopied, setFollowUpCopied] = useState(false);

  // Восстанавливаем фото и все сгенерированные результаты при загрузке страницы
  useEffect(() => {
    try {
      const savedResult = localStorage.getItem('rr_draft_result');
      if (savedResult) setResult(JSON.parse(savedResult));
      const savedSocial = localStorage.getItem('rr_draft_socialPost');
      if (savedSocial) setSocialPost(JSON.parse(savedSocial));
      const savedFollowUp = localStorage.getItem('rr_draft_followUpMsg');
      if (savedFollowUp) setFollowUpMsg(JSON.parse(savedFollowUp));
    } catch (e) { /* повреждённые данные — просто игнорируем */ }
    idbGet('photos').then(p => { if (p) setPhotos(p); });
  }, []);

  // Сохраняем текстовые поля при каждом изменении
  useEffect(() => { localStorage.setItem('rr_draft_businessName', businessName); }, [businessName]);
  useEffect(() => { localStorage.setItem('rr_draft_reviewText', reviewText); }, [reviewText]);

  // Фото — в IndexedDB, там лимит намного больше, чем у localStorage
  // (до трёх изображений в base64 легко превысят localStorage)
  useEffect(() => {
    idbSet('photos', photos);
  }, [photos]);

  // Сохраняем все сгенерированные результаты, чтобы не потерять их при
  // случайном закрытии вкладки или обновлении страницы
  useEffect(() => {
    try {
      if (result) localStorage.setItem('rr_draft_result', JSON.stringify(result));
    } catch (e) { /* превышена квота — пропускаем */ }
  }, [result]);
  useEffect(() => {
    try {
      if (socialPost) localStorage.setItem('rr_draft_socialPost', JSON.stringify(socialPost));
    } catch (e) { /* превышена квота — пропускаем */ }
  }, [socialPost]);
  useEffect(() => {
    try {
      if (followUpMsg) localStorage.setItem('rr_draft_followUpMsg', JSON.stringify(followUpMsg));
    } catch (e) { /* превышена квота — пропускаем */ }
  }, [followUpMsg]);

  const languages = [
    { code: 'en', label: 'English', englishName: 'English', rtl: false },
    { code: 'ru', label: 'Русский', englishName: 'Russian', rtl: false },
    { code: 'ar', label: 'العربية', englishName: 'Arabic', rtl: true },
    { code: 'fa', label: 'فارسی', englishName: 'Persian', rtl: true },
    { code: 'es', label: 'Español', englishName: 'Spanish', rtl: false },
    { code: 'fr', label: 'Français', englishName: 'French', rtl: false },
    { code: 'de', label: 'Deutsch', englishName: 'German', rtl: false },
    { code: 'it', label: 'Italiano', englishName: 'Italian', rtl: false },
    { code: 'pt', label: 'Português', englishName: 'Portuguese', rtl: false },
    { code: 'tr', label: 'Türkçe', englishName: 'Turkish', rtl: false },
    { code: 'zh', label: '中文', englishName: 'Chinese', rtl: false },
    { code: 'hi', label: 'हिन्दी', englishName: 'Hindi', rtl: false },
    { code: 'ja', label: '日本語', englishName: 'Japanese', rtl: false },
    { code: 'sv', label: 'Svenska', englishName: 'Swedish', rtl: false },
    { code: 'no', label: 'Norsk', englishName: 'Norwegian', rtl: false },
    { code: 'da', label: 'Dansk', englishName: 'Danish', rtl: false },
    { code: 'fi', label: 'Suomi', englishName: 'Finnish', rtl: false },
    { code: 'uk', label: 'Українська', englishName: 'Ukrainian', rtl: false },
    { code: 'be', label: 'Беларуская', englishName: 'Belarusian', rtl: false },
    { code: 'el', label: 'Ελληνικά', englishName: 'Greek', rtl: false },
  ];

  const ui = {
    en: { title: 'ReviewReply AI', subtitle: 'Paste any customer review, get thoughtful replies in seconds.', businessLabel: 'Your business name', businessPh: 'e.g. Morning Coffee Shop', reviewLabel: "Paste the customer's review", reviewPh: 'e.g. Loved the coffee but service was slow on Saturday...', toneLabel: 'Reply tone', toneWarm: 'Warm', toneProfessional: 'Professional', toneBrief: 'Short', languageLabel: 'Interface language', generateBtn: 'Generate replies', generatingBtn: 'Writing replies...', fillError: 'Please fill in your business name and paste the review.', genError: 'Could not generate. Please try again.', limitReached: 'Daily generation limit reached. Try again tomorrow.', positiveLabel: 'Positive review', negativeLabel: 'Negative review', mixedLabel: 'Mixed review', copyBtn: 'Copy', copiedBtn: 'Copied!', repliesHeading: 'Reply options' , licenseGateTitle: 'Enter your access code', licensePh: 'Access code', unlockBtn: 'Unlock', licenseInvalid: 'Invalid or inactive code', photoLabel: 'Attach a photo (optional)', uploadPhoto: 'Add photo', changePhoto: 'Change photo', emojiToggle: 'Emoji', noCodeText: 'No code? Buy access', freeTriesLabel: '{n} free {word} left -- no code needed', trialExhausted: "You've used your free replies. Enter a code, or buy access to keep going.", subtextLabel: 'Reading between the lines', socialBtnLabel: 'Turn into a social media post', socialHeading: 'Ready-to-post caption', socialGeneratingBtn: 'Writing caption...', followUpBtnLabel: 'Draft a private follow-up message', followUpHeading: 'Private message to the customer', followUpGeneratingBtn: 'Writing message...', haveCodeLabel: 'Already have a code?'},
    ru: { title: 'ReviewReply AI', subtitle: 'Вставьте отзыв клиента — получите готовые варианты ответа за секунды.', businessLabel: 'Название бизнеса', businessPh: 'Например: кофейня «Утро»', reviewLabel: 'Вставьте отзыв клиента', reviewPh: 'Например: кофе понравился, но обслуживание было медленным в субботу...', toneLabel: 'Тон ответа', toneWarm: 'Тёплый', toneProfessional: 'Деловой', toneBrief: 'Короткий', languageLabel: 'Язык интерфейса', generateBtn: 'Сгенерировать ответы', generatingBtn: 'Пишу ответы...', fillError: 'Заполните название бизнеса и вставьте отзыв.', genError: 'Не удалось сгенерировать. Попробуйте ещё раз.', limitReached: 'Достигнут дневной лимит генераций. Попробуйте завтра.', positiveLabel: 'Положительный отзыв', negativeLabel: 'Отрицательный отзыв', mixedLabel: 'Смешанный отзыв', copyBtn: 'Копировать', copiedBtn: 'Скопировано!', repliesHeading: 'Варианты ответа' , licenseGateTitle: 'Введите код доступа', licensePh: 'Код доступа', unlockBtn: 'Разблокировать', licenseInvalid: 'Неверный или неактивный код', photoLabel: 'Прикрепить фото (необязательно)', uploadPhoto: 'Загрузить фото', changePhoto: 'Сменить фото', emojiToggle: 'Эмодзи', noCodeText: 'Нет кода? Купить доступ', freeTriesLabel: 'Осталось {n} бесплатных попыток -- код не нужен', trialExhausted: 'Бесплатные попытки закончились. Введите код или купите доступ, чтобы продолжить.', subtextLabel: 'Между строк', socialBtnLabel: 'Превратить в пост для соцсетей', socialHeading: 'Готовая подпись для поста', socialGeneratingBtn: 'Пишу подпись...', followUpBtnLabel: 'Составить личное сообщение', followUpHeading: 'Личное сообщение клиенту', followUpGeneratingBtn: 'Пишу сообщение...', haveCodeLabel: 'Уже есть код?'},
    ar: { title: 'ReviewReply AI', subtitle: 'الصق أي تقييم من العميل واحصل على ردود مدروسة خلال ثوانٍ.', businessLabel: 'اسم نشاطك التجاري', businessPh: 'مثال: مقهى الصباح', reviewLabel: 'الصق تقييم العميل', reviewPh: 'مثال: أحببت القهوة لكن الخدمة كانت بطيئة يوم السبت...', toneLabel: 'نبرة الرد', toneWarm: 'ودود', toneProfessional: 'احترافي', toneBrief: 'مختصر', languageLabel: 'لغة الواجهة', generateBtn: 'إنشاء الردود', generatingBtn: 'جارٍ كتابة الردود...', fillError: 'يرجى إدخال اسم النشاط ولصق التقييم.', genError: 'تعذر الإنشاء. حاول مرة أخرى.', positiveLabel: 'تقييم إيجابي', negativeLabel: 'تقييم سلبي', mixedLabel: 'تقييم مختلط', copyBtn: 'نسخ', copiedBtn: 'تم النسخ!', repliesHeading: 'خيارات الرد' , licenseGateTitle: 'أدخل رمز الوصول', licensePh: 'رمز الوصول', unlockBtn: 'فتح', licenseInvalid: 'رمز غير صالح أو غير مفعّل', photoLabel: 'إرفاق صورة (اختياري)', uploadPhoto: 'رفع صورة', changePhoto: 'تغيير الصورة', emojiToggle: 'الرموز التعبيرية', noCodeText: 'لا يوجد رمز؟ شراء الوصول', freeTriesLabel: 'متبقٍ {n} محاولة مجانية -- لا حاجة لرمز', trialExhausted: 'لقد استخدمت محاولاتك المجانية. أدخل رمزًا أو اشترِ الوصول للمتابعة.', subtextLabel: 'ما بين السطور', socialBtnLabel: 'تحويله إلى منشور على وسائل التواصل', socialHeading: 'تعليق جاهز للنشر', socialGeneratingBtn: 'جارٍ كتابة التعليق...', followUpBtnLabel: 'صياغة رسالة خاصة للمتابعة', followUpHeading: 'رسالة خاصة للعميل', followUpGeneratingBtn: 'جارٍ كتابة الرسالة...', haveCodeLabel: 'هل لديك رمز بالفعل؟'},
    fa: { title: 'ReviewReply AI', subtitle: 'نظر مشتری را وارد کنید و در چند ثانیه پاسخ‌های مناسب دریافت کنید.', businessLabel: 'نام کسب‌وکار', businessPh: 'مثال: کافه صبح', reviewLabel: 'نظر مشتری را وارد کنید', reviewPh: 'مثال: قهوه عالی بود اما سرویس روز شنبه کند بود...', toneLabel: 'لحن پاسخ', toneWarm: 'گرم', toneProfessional: 'حرفه‌ای', toneBrief: 'کوتاه', languageLabel: 'زبان رابط کاربری', generateBtn: 'ایجاد پاسخ‌ها', generatingBtn: 'در حال نوشتن...', fillError: 'لطفاً نام کسب‌وکار و نظر را وارد کنید.', genError: 'ایجاد نشد. دوباره امتحان کنید.', positiveLabel: 'نظر مثبت', negativeLabel: 'نظر منفی', mixedLabel: 'نظر ترکیبی', copyBtn: 'کپی', copiedBtn: 'کپی شد!', repliesHeading: 'گزینه‌های پاسخ' , licenseGateTitle: 'کد دسترسی را وارد کنید', licensePh: 'کد دسترسی', unlockBtn: 'باز کردن', licenseInvalid: 'کد نامعتبر یا غیرفعال', photoLabel: 'پیوست عکس (اختیاری)', uploadPhoto: 'آپلود عکس', changePhoto: 'تغییر عکس', emojiToggle: 'ایموجی', noCodeText: 'کد ندارید؟ خرید دسترسی', freeTriesLabel: '{n} تلاش رایگان باقی مانده -- بدون نیاز به کد', trialExhausted: 'تلاش‌های رایگان شما تمام شد. کد را وارد کنید یا دسترسی بخرید.', subtextLabel: 'بین خطوط', socialBtnLabel: 'تبدیل به پست شبکه اجتماعی', socialHeading: 'کپشن آماده انتشار', socialGeneratingBtn: 'در حال نوشتن کپشن...', followUpBtnLabel: 'پیش‌نویس پیام خصوصی', followUpHeading: 'پیام خصوصی به مشتری', followUpGeneratingBtn: 'در حال نوشتن پیام...', haveCodeLabel: 'کد دارید؟'},
    es: { title: 'ReviewReply AI', subtitle: 'Pega cualquier reseña y obtén respuestas listas en segundos.', businessLabel: 'Nombre del negocio', businessPh: 'Ej: Cafetería Mañana', reviewLabel: 'Pega la reseña del cliente', reviewPh: 'Ej: Me encantó el café pero el servicio fue lento el sábado...', toneLabel: 'Tono de la respuesta', toneWarm: 'Cálido', toneProfessional: 'Profesional', toneBrief: 'Breve', languageLabel: 'Idioma de la interfaz', generateBtn: 'Generar respuestas', generatingBtn: 'Escribiendo...', fillError: 'Completa el nombre del negocio y la reseña.', genError: 'No se pudo generar. Intenta de nuevo.', positiveLabel: 'Reseña positiva', negativeLabel: 'Reseña negativa', mixedLabel: 'Reseña mixta', copyBtn: 'Copiar', copiedBtn: '¡Copiado!', repliesHeading: 'Opciones de respuesta' , licenseGateTitle: 'Introduce tu código de acceso', licensePh: 'Código de acceso', unlockBtn: 'Desbloquear', licenseInvalid: 'Código inválido o inactivo', photoLabel: 'Adjuntar foto (opcional)', uploadPhoto: 'Subir foto', changePhoto: 'Cambiar foto', emojiToggle: 'Emoji', noCodeText: '¿Sin código? Comprar acceso', freeTriesLabel: 'Te quedan {n} pruebas gratis -- sin código', trialExhausted: 'Ya usaste tus pruebas gratis. Ingresa un código o compra acceso para continuar.', subtextLabel: 'Entre líneas', socialBtnLabel: 'Convertir en publicación', socialHeading: 'Descripción lista para publicar', socialGeneratingBtn: 'Escribiendo descripción...', followUpBtnLabel: 'Redactar un mensaje privado', followUpHeading: 'Mensaje privado para el cliente', followUpGeneratingBtn: 'Escribiendo mensaje...', haveCodeLabel: '¿Ya tienes un código?'},
    fr: { title: 'ReviewReply AI', subtitle: 'Collez un avis client, obtenez des réponses réfléchies en quelques secondes.', businessLabel: "Nom de l'entreprise", businessPh: 'Ex : Café du Matin', reviewLabel: "Collez l'avis du client", reviewPh: 'Ex : Café excellent mais service lent le samedi...', toneLabel: 'Ton de la réponse', toneWarm: 'Chaleureux', toneProfessional: 'Professionnel', toneBrief: 'Court', languageLabel: "Langue de l'interface", generateBtn: 'Générer les réponses', generatingBtn: 'Rédaction en cours...', fillError: "Remplissez le nom de l'entreprise et l'avis.", genError: 'Échec de la génération. Réessayez.', positiveLabel: 'Avis positif', negativeLabel: 'Avis négatif', mixedLabel: 'Avis mitigé', copyBtn: 'Copier', copiedBtn: 'Copié !', repliesHeading: 'Options de réponse' , licenseGateTitle: "Entrez votre code d'accès", licensePh: "Code d'accès", unlockBtn: 'Déverrouiller', licenseInvalid: 'Code invalide ou inactif', photoLabel: 'Joindre une photo (facultatif)', uploadPhoto: 'Ajouter une photo', changePhoto: 'Changer la photo', emojiToggle: 'Emoji', noCodeText: "Pas de code ? Acheter lʼaccès", freeTriesLabel: 'Il vous reste {n} essais gratuits -- sans code', trialExhausted: "Vous avez utilisé vos essais gratuits. Entrez un code ou achetez l'accès pour continuer.", subtextLabel: 'Entre les lignes', socialBtnLabel: 'Transformer en publication', socialHeading: 'Légende prête à publier', socialGeneratingBtn: 'Rédaction en cours...', followUpBtnLabel: 'Rédiger un message privé', followUpHeading: 'Message privé au client', followUpGeneratingBtn: 'Rédaction du message...', haveCodeLabel: 'Vous avez déjà un code ?'},
    de: { title: 'ReviewReply AI', subtitle: 'Bewertung einfügen, in Sekunden durchdachte Antworten erhalten.', businessLabel: 'Firmenname', businessPh: 'z.B. Café Morgen', reviewLabel: 'Kundenbewertung einfügen', reviewPh: 'z.B. Kaffee war super, aber der Service war samstags langsam...', toneLabel: 'Tonfall der Antwort', toneWarm: 'Herzlich', toneProfessional: 'Professionell', toneBrief: 'Kurz', languageLabel: 'Oberflächensprache', generateBtn: 'Antworten generieren', generatingBtn: 'Schreibe Antworten...', fillError: 'Firmenname und Bewertung ausfüllen.', genError: 'Generierung fehlgeschlagen. Erneut versuchen.', positiveLabel: 'Positive Bewertung', negativeLabel: 'Negative Bewertung', mixedLabel: 'Gemischte Bewertung', copyBtn: 'Kopieren', copiedBtn: 'Kopiert!', repliesHeading: 'Antwortoptionen' , licenseGateTitle: 'Zugangscode eingeben', licensePh: 'Zugangscode', unlockBtn: 'Entsperren', licenseInvalid: 'Ungültiger oder inaktiver Code', photoLabel: 'Foto anhängen (optional)', uploadPhoto: 'Foto hochladen', changePhoto: 'Foto ändern', emojiToggle: 'Emoji', noCodeText: 'Kein Code? Zugang kaufen', freeTriesLabel: 'Noch {n} kostenlose Versuche -- kein Code nötig', trialExhausted: 'Ihre kostenlosen Versuche sind aufgebraucht. Geben Sie einen Code ein oder kaufen Sie Zugang.', subtextLabel: 'Zwischen den Zeilen', socialBtnLabel: 'In einen Social-Media-Post umwandeln', socialHeading: 'Fertige Bildunterschrift', socialGeneratingBtn: 'Schreibe Bildunterschrift...', followUpBtnLabel: 'Private Nachricht verfassen', followUpHeading: 'Private Nachricht an den Kunden', followUpGeneratingBtn: 'Schreibe Nachricht...', haveCodeLabel: 'Haben Sie bereits einen Code?'},
    it: { title: 'ReviewReply AI', subtitle: "Incolla una recensione e ottieni risposte pronte in pochi secondi.", businessLabel: 'Nome attività', businessPh: 'Es: Caffetteria Mattino', reviewLabel: 'Incolla la recensione del cliente', reviewPh: 'Es: Caffè ottimo ma servizio lento il sabato...', toneLabel: 'Tono della risposta', toneWarm: 'Caloroso', toneProfessional: 'Professionale', toneBrief: 'Breve', languageLabel: "Lingua dell'interfaccia", generateBtn: 'Genera risposte', generatingBtn: 'Scrittura in corso...', fillError: "Inserisci nome attività e recensione.", genError: 'Generazione non riuscita. Riprova.', positiveLabel: 'Recensione positiva', negativeLabel: 'Recensione negativa', mixedLabel: 'Recensione mista', copyBtn: 'Copia', copiedBtn: 'Copiato!', repliesHeading: 'Opzioni di risposta' , licenseGateTitle: 'Inserisci il codice di accesso', licensePh: 'Codice di accesso', unlockBtn: 'Sblocca', licenseInvalid: 'Codice non valido o inattivo', photoLabel: 'Allega una foto (facoltativo)', uploadPhoto: 'Carica foto', changePhoto: 'Cambia foto', emojiToggle: 'Emoji', noCodeText: "Nessun codice? Acquista lʼaccesso", freeTriesLabel: 'Hai ancora {n} prove gratuite -- nessun codice richiesto', trialExhausted: "Hai esaurito le prove gratuite. Inserisci un codice o acquista l'accesso.", subtextLabel: 'Tra le righe', socialBtnLabel: 'Trasforma in un post social', socialHeading: 'Didascalia pronta', socialGeneratingBtn: 'Scrittura in corso...', followUpBtnLabel: 'Scrivi un messaggio privato', followUpHeading: 'Messaggio privato al cliente', followUpGeneratingBtn: 'Scrittura messaggio...', haveCodeLabel: 'Hai già un codice?'},
    pt: { title: 'ReviewReply AI', subtitle: 'Cole uma avaliação e receba respostas prontas em segundos.', businessLabel: 'Nome do negócio', businessPh: 'Ex: Cafeteria Manhã', reviewLabel: 'Cole a avaliação do cliente', reviewPh: 'Ex: Adorei o café mas o atendimento foi lento no sábado...', toneLabel: 'Tom da resposta', toneWarm: 'Caloroso', toneProfessional: 'Profissional', toneBrief: 'Curto', languageLabel: 'Idioma da interface', generateBtn: 'Gerar respostas', generatingBtn: 'Escrevendo...', fillError: 'Preencha o nome do negócio e a avaliação.', genError: 'Não foi possível gerar. Tente novamente.', positiveLabel: 'Avaliação positiva', negativeLabel: 'Avaliação negativa', mixedLabel: 'Avaliação mista', copyBtn: 'Copiar', copiedBtn: 'Copiado!', repliesHeading: 'Opções de resposta' , licenseGateTitle: 'Insira seu código de acesso', licensePh: 'Código de acesso', unlockBtn: 'Desbloquear', licenseInvalid: 'Código inválido ou inativo', photoLabel: 'Anexar foto (opcional)', uploadPhoto: 'Carregar foto', changePhoto: 'Alterar foto', emojiToggle: 'Emoji', noCodeText: 'Sem código? Comprar acesso', freeTriesLabel: 'Restam {n} testes grátis -- sem código', trialExhausted: 'Você usou seus testes grátis. Digite um código ou compre acesso para continuar.', subtextLabel: 'Nas entrelinhas', socialBtnLabel: 'Transformar em post', socialHeading: 'Legenda pronta para postar', socialGeneratingBtn: 'Escrevendo legenda...', followUpBtnLabel: 'Redigir mensagem privada', followUpHeading: 'Mensagem privada ao cliente', followUpGeneratingBtn: 'Escrevendo mensagem...', haveCodeLabel: 'Já tem um código?'},
    tr: { title: 'ReviewReply AI', subtitle: 'Bir müşteri yorumu yapıştırın, saniyeler içinde yanıt seçenekleri alın.', businessLabel: 'İşletme adı', businessPh: 'Örn: Sabah Kahve Dükkanı', reviewLabel: 'Müşteri yorumunu yapıştırın', reviewPh: 'Örn: Kahve harikaydı ama cumartesi hizmet yavaştı...', toneLabel: 'Yanıt tonu', toneWarm: 'Samimi', toneProfessional: 'Profesyonel', toneBrief: 'Kısa', languageLabel: 'Arayüz dili', generateBtn: 'Yanıtları oluştur', generatingBtn: 'Yazılıyor...', fillError: 'İşletme adını ve yorumu girin.', genError: 'Oluşturulamadı. Tekrar deneyin.', positiveLabel: 'Olumlu yorum', negativeLabel: 'Olumsuz yorum', mixedLabel: 'Karışık yorum', copyBtn: 'Kopyala', copiedBtn: 'Kopyalandı!', repliesHeading: 'Yanıt seçenekleri' , licenseGateTitle: 'Erişim kodunuzu girin', licensePh: 'Erişim kodu', unlockBtn: 'Kilidi aç', licenseInvalid: 'Geçersiz veya etkin olmayan kod', photoLabel: 'Fotoğraf ekle (isteğe bağlı)', uploadPhoto: 'Fotoğraf yükle', changePhoto: 'Fotoğrafı değiştir', emojiToggle: 'Emoji', noCodeText: 'Kodunuz yok mu? Erişim satın alın', freeTriesLabel: '{n} ücretsiz deneme hakkınız kaldı -- kod gerekmez', trialExhausted: 'Ücretsiz denemeleriniz bitti. Bir kod girin veya erişim satın alın.', subtextLabel: 'Satır aralarında', socialBtnLabel: 'Sosyal medya gönderisine dönüştür', socialHeading: 'Yayına hazır başlık', socialGeneratingBtn: 'Başlık yazılıyor...', followUpBtnLabel: 'Özel bir mesaj taslağı hazırla', followUpHeading: 'Müşteriye özel mesaj', followUpGeneratingBtn: 'Mesaj yazılıyor...', haveCodeLabel: 'Zaten bir kodunuz var mı?'},
    zh: { title: 'ReviewReply AI', subtitle: '粘贴任意客户评价，几秒内获得回复建议。', businessLabel: '企业名称', businessPh: '例如：晨光咖啡馆', reviewLabel: '粘贴客户评价', reviewPh: '例如：咖啡很棒，但周六服务较慢……', toneLabel: '回复语气', toneWarm: '亲切', toneProfessional: '专业', toneBrief: '简短', languageLabel: '界面语言', generateBtn: '生成回复', generatingBtn: '生成中...', fillError: '请填写企业名称并粘贴评价。', genError: '生成失败，请重试。', positiveLabel: '正面评价', negativeLabel: '负面评价', mixedLabel: '中性评价', copyBtn: '复制', copiedBtn: '已复制！', repliesHeading: '回复选项' , licenseGateTitle: '输入访问码', licensePh: '访问码', unlockBtn: '解锁', licenseInvalid: '无效或未激活的代码', photoLabel: '附加照片（可选）', uploadPhoto: '上传照片', changePhoto: '更换照片', emojiToggle: '表情符号', noCodeText: '没有代码？购买访问权限', freeTriesLabel: '还剩 {n} 次免费试用 -- 无需代码', trialExhausted: '您的免费试用已用完。请输入代码或购买访问权限。', subtextLabel: '弦外之音', socialBtnLabel: '转换为社交媒体帖子', socialHeading: '可直接发布的文案', socialGeneratingBtn: '正在生成文案...', followUpBtnLabel: '起草私信', followUpHeading: '给客户的私信', followUpGeneratingBtn: '正在生成私信...', haveCodeLabel: '已有代码？'},
    hi: { title: 'ReviewReply AI', subtitle: 'कोई भी ग्राहक समीक्षा पेस्ट करें, सेकंडों में जवाब पाएं।', businessLabel: 'व्यवसाय का नाम', businessPh: 'उदा: मॉर्निंग कॉफी शॉप', reviewLabel: 'ग्राहक की समीक्षा पेस्ट करें', reviewPh: 'उदा: कॉफी बढ़िया थी लेकिन शनिवार को सेवा धीमी थी...', toneLabel: 'जवाब का लहजा', toneWarm: 'आत्मीय', toneProfessional: 'व्यावसायिक', toneBrief: 'संक्षिप्त', languageLabel: 'इंटरफ़ेस भाषा', generateBtn: 'जवाब बनाएं', generatingBtn: 'लिखा जा रहा है...', fillError: 'व्यवसाय का नाम और समीक्षा भरें।', genError: 'जनरेट नहीं हो सका। फिर से प्रयास करें।', positiveLabel: 'सकारात्मक समीक्षा', negativeLabel: 'नकारात्मक समीक्षा', mixedLabel: 'मिश्रित समीक्षा', copyBtn: 'कॉपी करें', copiedBtn: 'कॉपी हो गया!', repliesHeading: 'जवाब विकल्प' , licenseGateTitle: 'अपना एक्सेस कोड डालें', licensePh: 'एक्सेस कोड', unlockBtn: 'अनलॉक करें', licenseInvalid: 'अमान्य या निष्क्रिय कोड', photoLabel: 'फोटो जोड़ें (वैकल्पिक)', uploadPhoto: 'फोटो अपलोड करें', changePhoto: 'फोटो बदलें', emojiToggle: 'इमोजी', noCodeText: 'कोड नहीं है? एक्सेस खरीदें', freeTriesLabel: '{n} मुफ्त प्रयास बाकी हैं -- कोड की जरूरत नहीं', trialExhausted: 'आपके मुफ्त प्रयास समाप्त हो गए। जारी रखने के लिए कोड डालें या एक्सेस खरीदें।', subtextLabel: 'पंक्तियों के बीच', socialBtnLabel: 'सोशल मीडिया पोस्ट में बदलें', socialHeading: 'पोस्ट के लिए तैयार कैप्शन', socialGeneratingBtn: 'कैप्शन लिखा जा रहा है...', followUpBtnLabel: 'निजी संदेश तैयार करें', followUpHeading: 'ग्राहक के लिए निजी संदेश', followUpGeneratingBtn: 'संदेश लिखा जा रहा है...', haveCodeLabel: 'पहले से कोड है?'},
    ja: { title: 'ReviewReply AI', subtitle: 'お客様のレビューを貼り付けるだけで、数秒で返信案が届きます。', businessLabel: 'ビジネス名', businessPh: '例：モーニングコーヒーショップ', reviewLabel: 'お客様のレビューを貼り付け', reviewPh: '例：コーヒーは最高でしたが、土曜日のサービスが遅かったです…', toneLabel: '返信のトーン', toneWarm: '温かい', toneProfessional: 'プロフェッショナル', toneBrief: '簡潔', languageLabel: 'インターフェース言語', generateBtn: '返信を生成', generatingBtn: '作成中...', fillError: 'ビジネス名とレビューを入力してください。', genError: '生成できませんでした。もう一度お試しください。', positiveLabel: '好意的なレビュー', negativeLabel: '否定的なレビュー', mixedLabel: '中立的なレビュー', copyBtn: 'コピー', copiedBtn: 'コピーしました！', repliesHeading: '返信オプション' , licenseGateTitle: 'アクセスコードを入力', licensePh: 'アクセスコード', unlockBtn: '解除', licenseInvalid: '無効または無効化されたコード', photoLabel: '写真を添付（任意）', uploadPhoto: '写真をアップロード', changePhoto: '写真を変更', emojiToggle: '絵文字', noCodeText: 'コードがない場合はこちら', freeTriesLabel: '残り{n}回無料でお試しいただけます -- コード不要', trialExhausted: '無料トライアルを使い切りました。コードを入力するか、アクセスを購入してください。', subtextLabel: '行間を読む', socialBtnLabel: 'SNS投稿に変換', socialHeading: '投稿用キャプション', socialGeneratingBtn: 'キャプション作成中...', followUpBtnLabel: '個別メッセージを作成', followUpHeading: 'お客様への個別メッセージ', followUpGeneratingBtn: 'メッセージ作成中...', haveCodeLabel: 'コードをお持ちですか？'},
    sv: { title: 'ReviewReply AI', subtitle: 'Klistra in en recension, få genomtänkta svar på sekunder.', businessLabel: 'Företagsnamn', businessPh: 'T.ex: Morgon Kaffehus', reviewLabel: 'Klistra in kundens recension', reviewPh: 'T.ex: Älskade kaffet men servicen var långsam på lördagen...', toneLabel: 'Svarston', toneWarm: 'Varm', toneProfessional: 'Professionell', toneBrief: 'Kort', languageLabel: 'Gränssnittsspråk', generateBtn: 'Generera svar', generatingBtn: 'Skriver svar...', fillError: 'Fyll i företagsnamn och recension.', genError: 'Kunde inte generera. Försök igen.', positiveLabel: 'Positiv recension', negativeLabel: 'Negativ recension', mixedLabel: 'Blandad recension', copyBtn: 'Kopiera', copiedBtn: 'Kopierat!', repliesHeading: 'Svarsalternativ' , licenseGateTitle: 'Ange din åtkomstkod', licensePh: 'Åtkomstkod', unlockBtn: 'Lås upp', licenseInvalid: 'Ogiltig eller inaktiv kod', photoLabel: 'Bifoga foto (valfritt)', uploadPhoto: 'Ladda upp foto', changePhoto: 'Byt foto', emojiToggle: 'Emoji', noCodeText: 'Ingen kod? Köp åtkomst', freeTriesLabel: '{n} gratisförsök kvar -- ingen kod behövs', trialExhausted: 'Dina gratisförsök är slut. Ange en kod eller köp åtkomst för att fortsätta.', subtextLabel: 'Mellan raderna', socialBtnLabel: 'Gör om till ett inlägg', socialHeading: 'Klar bildtext', socialGeneratingBtn: 'Skriver bildtext...', followUpBtnLabel: 'Skriv ett privat meddelande', followUpHeading: 'Privat meddelande till kunden', followUpGeneratingBtn: 'Skriver meddelande...', haveCodeLabel: 'Har du redan en kod?'},
    no: { title: 'ReviewReply AI', subtitle: 'Lim inn en anmeldelse, få gjennomtenkte svar på sekunder.', businessLabel: 'Bedriftsnavn', businessPh: 'F.eks: Morgen Kaffebar', reviewLabel: 'Lim inn kundens anmeldelse', reviewPh: 'F.eks: Elsket kaffen men service var treg på lørdag...', toneLabel: 'Svartone', toneWarm: 'Varm', toneProfessional: 'Profesjonell', toneBrief: 'Kort', languageLabel: 'Grensesnittspråk', generateBtn: 'Generer svar', generatingBtn: 'Skriver svar...', fillError: 'Fyll inn bedriftsnavn og anmeldelse.', genError: 'Kunne ikke generere. Prøv igjen.', positiveLabel: 'Positiv anmeldelse', negativeLabel: 'Negativ anmeldelse', mixedLabel: 'Blandet anmeldelse', copyBtn: 'Kopier', copiedBtn: 'Kopiert!', repliesHeading: 'Svaralternativer' , licenseGateTitle: 'Angi tilgangskoden din', licensePh: 'Tilgangskode', unlockBtn: 'Lås opp', licenseInvalid: 'Ugyldig eller inaktiv kode', photoLabel: 'Legg ved bilde (valgfritt)', uploadPhoto: 'Last opp bilde', changePhoto: 'Bytt bilde', emojiToggle: 'Emoji', noCodeText: 'Ingen kode? Kjøp tilgang', freeTriesLabel: '{n} gratis forsøk igjen -- ingen kode nødvendig', trialExhausted: 'Gratisforsøkene dine er brukt opp. Skriv inn en kode eller kjøp tilgang.', subtextLabel: 'Mellom linjene', socialBtnLabel: 'Gjør om til et innlegg', socialHeading: 'Klar bildetekst', socialGeneratingBtn: 'Skriver bildetekst...', followUpBtnLabel: 'Skriv en privat melding', followUpHeading: 'Privat melding til kunden', followUpGeneratingBtn: 'Skriver melding...', haveCodeLabel: 'Har du allerede en kode?'},
    da: { title: 'ReviewReply AI', subtitle: 'Indsæt en anmeldelse, få gennemtænkte svar på sekunder.', businessLabel: 'Virksomhedsnavn', businessPh: 'F.eks: Morgen Kaffebar', reviewLabel: 'Indsæt kundens anmeldelse', reviewPh: 'F.eks: Elskede kaffen men service var langsom lørdag...', toneLabel: 'Svartone', toneWarm: 'Varm', toneProfessional: 'Professionel', toneBrief: 'Kort', languageLabel: 'Grænsefladesprog', generateBtn: 'Generer svar', generatingBtn: 'Skriver svar...', fillError: 'Udfyld virksomhedsnavn og anmeldelse.', genError: 'Kunne ikke generere. Prøv igen.', positiveLabel: 'Positiv anmeldelse', negativeLabel: 'Negativ anmeldelse', mixedLabel: 'Blandet anmeldelse', copyBtn: 'Kopier', copiedBtn: 'Kopieret!', repliesHeading: 'Svarmuligheder' , licenseGateTitle: 'Indtast din adgangskode', licensePh: 'Adgangskode', unlockBtn: 'Lås op', licenseInvalid: 'Ugyldig eller inaktiv kode', photoLabel: 'Vedhæft foto (valgfrit)', uploadPhoto: 'Upload foto', changePhoto: 'Skift foto', emojiToggle: 'Emoji', noCodeText: 'Ingen kode? Køb adgang', freeTriesLabel: '{n} gratis forsøg tilbage -- ingen kode nødvendig', trialExhausted: 'Dine gratis forsøg er brugt. Indtast en kode, eller køb adgang for at fortsætte.', subtextLabel: 'Mellem linjerne', socialBtnLabel: 'Lav om til et opslag', socialHeading: 'Klar billedtekst', socialGeneratingBtn: 'Skriver billedtekst...', followUpBtnLabel: 'Skriv en privat besked', followUpHeading: 'Privat besked til kunden', followUpGeneratingBtn: 'Skriver besked...', haveCodeLabel: 'Har du allerede en kode?'},
    fi: { title: 'ReviewReply AI', subtitle: 'Liitä asiakasarvostelu, saat harkittuja vastauksia sekunneissa.', businessLabel: 'Yrityksen nimi', businessPh: 'Esim: Aamu Kahvila', reviewLabel: 'Liitä asiakkaan arvostelu', reviewPh: 'Esim: Kahvi oli mahtavaa mutta palvelu hidasta lauantaina...', toneLabel: 'Vastauksen sävy', toneWarm: 'Lämmin', toneProfessional: 'Ammattimainen', toneBrief: 'Lyhyt', languageLabel: 'Käyttöliittymän kieli', generateBtn: 'Luo vastaukset', generatingBtn: 'Kirjoitetaan...', fillError: 'Täytä yrityksen nimi ja arvostelu.', genError: 'Luonti epäonnistui. Yritä uudelleen.', positiveLabel: 'Myönteinen arvostelu', negativeLabel: 'Kielteinen arvostelu', mixedLabel: 'Sekalainen arvostelu', copyBtn: 'Kopioi', copiedBtn: 'Kopioitu!', repliesHeading: 'Vastausvaihtoehdot' , licenseGateTitle: 'Anna käyttöoikeuskoodisi', licensePh: 'Käyttöoikeuskoodi', unlockBtn: 'Avaa lukitus', licenseInvalid: 'Virheellinen tai passiivinen koodi', photoLabel: 'Liitä kuva (valinnainen)', uploadPhoto: 'Lataa kuva', changePhoto: 'Vaihda kuva', emojiToggle: 'Emoji', noCodeText: 'Ei koodia? Osta käyttöoikeus', freeTriesLabel: '{n} ilmaista yritystä jäljellä -- ei koodia tarvita', trialExhausted: 'Ilmaiset yrityksesi on käytetty. Anna koodi tai osta käyttöoikeus jatkaaksesi.', subtextLabel: 'Rivien välissä', socialBtnLabel: 'Muuta somejulkaisuksi', socialHeading: 'Valmis kuvateksti', socialGeneratingBtn: 'Kirjoitetaan kuvatekstiä...', followUpBtnLabel: 'Kirjoita yksityinen viesti', followUpHeading: 'Yksityinen viesti asiakkaalle', followUpGeneratingBtn: 'Kirjoitetaan viestiä...', haveCodeLabel: 'Onko sinulla jo koodi?'},
    uk: { title: 'ReviewReply AI', subtitle: 'Вставте відгук клієнта — отримайте варіанти відповіді за секунди.', businessLabel: 'Назва бізнесу', businessPh: 'Наприклад: кавʼярня «Ранок»', reviewLabel: 'Вставте відгук клієнта', reviewPh: 'Наприклад: кава чудова, але обслуговування в суботу було повільним...', toneLabel: 'Тон відповіді', toneWarm: 'Теплий', toneProfessional: 'Діловий', toneBrief: 'Короткий', languageLabel: 'Мова інтерфейсу', generateBtn: 'Згенерувати відповіді', generatingBtn: 'Пишу відповіді...', fillError: 'Заповніть назву бізнесу і вставте відгук.', genError: 'Не вдалося згенерувати. Спробуйте ще раз.', positiveLabel: 'Позитивний відгук', negativeLabel: 'Негативний відгук', mixedLabel: 'Змішаний відгук', copyBtn: 'Копіювати', copiedBtn: 'Скопійовано!', repliesHeading: 'Варіанти відповіді' , licenseGateTitle: 'Введіть код доступу', licensePh: 'Код доступу', unlockBtn: 'Розблокувати', licenseInvalid: 'Невірний або неактивний код', photoLabel: 'Додати фото (необовʼязково)', uploadPhoto: 'Завантажити фото', changePhoto: 'Змінити фото', emojiToggle: 'Емодзі', noCodeText: 'Немає коду? Купити доступ', freeTriesLabel: 'Залишилось {n} безкоштовних спроб -- код не потрібен', trialExhausted: 'Безкоштовні спроби закінчились. Введіть код або купіть доступ, щоб продовжити.', subtextLabel: 'Між рядків', socialBtnLabel: 'Перетворити на пост', socialHeading: 'Готовий підпис для посту', socialGeneratingBtn: 'Пишу підпис...', followUpBtnLabel: 'Скласти особисте повідомлення', followUpHeading: 'Особисте повідомлення клієнту', followUpGeneratingBtn: 'Пишу повідомлення...', haveCodeLabel: 'Вже маєте код?'},
    be: { title: 'ReviewReply AI', subtitle: 'Устаўце водгук кліента — атрымайце варыянты адказу за секунды.', businessLabel: 'Назва бізнесу', businessPh: 'Напрыклад: кавярня «Раніца»', reviewLabel: 'Устаўце водгук кліента', reviewPh: 'Напрыклад: кава выдатная, але абслугоўванне ў суботу было павольным...', toneLabel: 'Тон адказу', toneWarm: 'Цёплы', toneProfessional: 'Дзелавы', toneBrief: 'Кароткі', languageLabel: 'Мова інтэрфейсу', generateBtn: 'Згенераваць адказы', generatingBtn: 'Пішу адказы...', fillError: 'Запоўніце назву бізнесу і ўстаўце водгук.', genError: 'Не атрымалася згенераваць. Паспрабуйце яшчэ раз.', positiveLabel: 'Станоўчы водгук', negativeLabel: 'Адмоўны водгук', mixedLabel: 'Змешаны водгук', copyBtn: 'Капіяваць', copiedBtn: 'Скапіявана!', repliesHeading: 'Варыянты адказу' , licenseGateTitle: 'Увядзіце код доступу', licensePh: 'Код доступу', unlockBtn: 'Разблакаваць', licenseInvalid: 'Няправільны або неактыўны код', photoLabel: 'Дадаць фота (неабавязкова)', uploadPhoto: 'Загрузіць фота', changePhoto: 'Змяніць фота', emojiToggle: 'Эмодзі', noCodeText: 'Няма кода? Купіць доступ', freeTriesLabel: 'Засталося {n} бясплатных спроб -- код не патрэбны', trialExhausted: 'Бясплатныя спробы скончыліся. Увядзіце код або купіце доступ, каб працягнуць.', subtextLabel: 'Паміж радкоў', socialBtnLabel: 'Ператварыць у пост', socialHeading: 'Гатовы подпіс для посту', socialGeneratingBtn: 'Пішу подпіс...', followUpBtnLabel: 'Скласці асабістае паведамленне', followUpHeading: 'Асабістае паведамленне кліенту', followUpGeneratingBtn: 'Пішу паведамленне...', haveCodeLabel: 'Ужо ёсць код?'},
    el: { title: 'ReviewReply AI', subtitle: 'Επικολλήστε μια κριτική πελάτη και λάβετε απαντήσεις σε δευτερόλεπτα.', businessLabel: 'Όνομα επιχείρησης', businessPh: 'Π.χ. Καφετέρια Πρωί', reviewLabel: 'Επικολλήστε την κριτική του πελάτη', reviewPh: 'Π.χ. Λάτρεψα τον καφέ αλλά η εξυπηρέτηση ήταν αργή το Σάββατο...', toneLabel: 'Τόνος απάντησης', toneWarm: 'Θερμός', toneProfessional: 'Επαγγελματικός', toneBrief: 'Σύντομος', languageLabel: 'Γλώσσα διεπαφής', generateBtn: 'Δημιουργία απαντήσεων', generatingBtn: 'Σύνταξη απαντήσεων...', fillError: 'Συμπληρώστε το όνομα της επιχείρησης και την κριτική.', genError: 'Αποτυχία δημιουργίας. Δοκιμάστε ξανά.', positiveLabel: 'Θετική κριτική', negativeLabel: 'Αρνητική κριτική', mixedLabel: 'Μικτή κριτική', copyBtn: 'Αντιγραφή', copiedBtn: 'Αντιγράφηκε!', repliesHeading: 'Επιλογές απάντησης' , licenseGateTitle: 'Εισαγάγετε τον κωδικό πρόσβασης', licensePh: 'Κωδικός πρόσβασης', unlockBtn: 'Ξεκλείδωμα', licenseInvalid: 'Μη έγκυρος ή ανενεργός κωδικός', photoLabel: 'Επισύναψη φωτογραφίας (προαιρετικό)', uploadPhoto: 'Μεταφόρτωση φωτογραφίας', changePhoto: 'Αλλαγή φωτογραφίας', emojiToggle: 'Emoji', noCodeText: 'Δεν έχετε κωδικό; Αγοράστε πρόσβαση', freeTriesLabel: 'Απομένουν {n} δωρεάν δοκιμές -- δεν χρειάζεται κωδικός', trialExhausted: 'Οι δωρεάν δοκιμές σας τελείωσαν. Εισαγάγετε κωδικό ή αγοράστε πρόσβαση.', subtextLabel: 'Ανάμεσα στις γραμμές', socialBtnLabel: 'Μετατροπή σε ανάρτηση', socialHeading: 'Έτοιμη λεζάντα', socialGeneratingBtn: 'Σύνταξη λεζάντας...', followUpBtnLabel: 'Σύνταξη ιδιωτικού μηνύματος', followUpHeading: 'Ιδιωτικό μήνυμα στον πελάτη', followUpGeneratingBtn: 'Σύνταξη μηνύματος...', haveCodeLabel: 'Έχετε ήδη κωδικό;'},
  };

  const currentLang = languages.find(l => l.code === language) || languages[0];
  const t = ui[language] || ui.en;

  const tones = [
    { value: 'warm', label: t.toneWarm },
    { value: 'professional', label: t.toneProfessional },
    { value: 'brief', label: t.toneBrief },
  ];

  async function handleGenerate() {
    if (!businessName.trim() || !reviewText.trim()) {
      setError(t.fillError);
      return;
    }
    if (!checkAndUseDailyLimit()) {
      setDailyCount(DAILY_GEN_LIMIT);
      setError(t.limitReached || 'Daily generation limit reached. Try again tomorrow.');
      return;
    }
    setDailyCount(getDailyCount());
    setError('');
    setLoading(true);
    setResult(null);
    setCopiedIdx(null);
    setSocialPost(null);
    setFollowUpMsg(null);

    const toneInstruction = {
      warm: 'Write in a warm, personal, genuinely appreciative tone.',
      professional: 'Write in a polished, professional, business-appropriate tone.',
      brief: 'Write a short, simple, natural-sounding reply -- 1-2 sentences max.',
    }[tone];

    const emojiInstruction = includeEmoji
      ? 'Include one relevant emoji per reply, used naturally, not excessively.'
      : 'Do not use any emojis.';

    const photoInstruction = photos.length > 0
      ? `${photos.length > 1 ? photos.length + ' photos were' : 'A photo was'} attached to this review. Look at ${photos.length > 1 ? 'them' : 'it'} carefully and reference something specific and true about what you actually see, if it adds something genuine to the reply -- do not force it if it does not fit naturally.`
      : '';

    const promptText = `You are helping a small business owner named "${businessName}" reply to a customer review. Here is the review:

"${reviewText}"

${toneInstruction} ${emojiInstruction} Write your reply in ${currentLang.englishName}, matching the interface language selected by the business owner -- regardless of what language the review itself is written in. ${photoInstruction}

Read the review carefully and reference specific details the customer actually mentioned (a product name, a staff member, a specific issue or compliment) instead of generic phrases like "thank you for your feedback." Be precise, not generic.

If the review is positive, thank the customer specifically for what they mentioned, and invite them back naturally. If the review is negative or mixed, acknowledge their specific concern without being defensive, briefly explain or apologize where appropriate, and offer a concrete next step (e.g. contact directly to resolve it) -- never argue or make excuses.

Write 3 different reply options, varying in phrasing and structure (not just synonyms of the same sentence).

Also write one short, private internal note for the business owner (in ${currentLang.englishName}, regardless of the review's language, since this part is for the owner, not the customer) -- one sentence pointing out a concrete, specific pattern or issue worth paying attention to, only if the review actually contains something actionable. If there is genuinely nothing actionable (e.g. a purely positive review with no specific suggestion), leave this as an empty string rather than inventing something.

Also, separately, read between the lines of the review's tone (in ${currentLang.englishName}) -- one short phrase noting anything the words alone might not fully convey (e.g. praise that sounds lukewarm, politeness masking real frustration, genuine warmth vs. generic phrasing). Only include this if there is a real, noticeable gap between the literal words and the likely underlying feeling -- if the tone is straightforward and matches the words, leave this as an empty string.

Respond ONLY with valid JSON, no markdown, no code fences, in this exact shape:
{"sentiment": "positive" or "negative" or "mixed", "replies": ["reply option 1", "reply option 2", "reply option 3"], "insight": "short internal note, or empty string", "subtext": "short tone note, or empty string"}`;

    let content = promptText;
    if (photos.length > 0) {
      content = [
        ...photos.map(p => ({ type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.base64 } })),
        { type: 'text', text: promptText }
      ];
    }

    const isTrial = !unlocked && trialCount < FREE_TRIAL_LIMIT;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseCode, content, trial: isTrial })
      });

      if (response.status === 403 || response.status === 429) {
        const ge = guardError(await response.json().catch(() => ({})));
        if (ge) {
          if (ge.guardCode === 'trial_used') {
            localStorage.setItem('reviewreply_trial_count', String(FREE_TRIAL_LIMIT));
            setTrialCount(FREE_TRIAL_LIMIT);
          }
          throw ge;
        }
        throw new Error('license');
      }

      const data = await response.json();
      const text = data.content.map(b => b.text || '').join('');
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);

      if (isTrial) {
        const next = trialCount + 1;
        localStorage.setItem('reviewreply_trial_count', String(next));
        setTrialCount(next);
      }
    } catch (err) {
      if (err.message === 'license') {
        setUnlocked(false);
        setLicenseError(t.licenseInvalid);
      } else {
        setError(err.guardMessage || t.genError);
      }
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || []).slice(0, 3 - photos.length);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        setPhotos(prev => prev.length >= 3 ? prev : [...prev, { preview: reader.result, base64, mediaType: file.type }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removePhoto(index) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  // Проверка кода: коды AppSumo начинаются с "REPLY-" и проверяются через
  // /api/redeem-appsumo (уникальный код на покупателя, отмечается как
  // использованный). Обычные коды (Getly) работают как раньше.
  // Разблокировка теперь происходит на отдельной странице /unlock.html —
  // она сама вызывает /api/redeem-appsumo при необходимости, ставит
  // localStorage-флаги и возвращает пользователя на / с ?welcome=1.

  function handleCopy(replyText, idx) {
    navigator.clipboard.writeText(replyText).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }

  async function handleGenerateSocialPost() {
    if (!result) return;
    if (!checkAndUseDailyLimit()) {
      setDailyCount(DAILY_GEN_LIMIT);
      setError(t.limitReached || 'Daily generation limit reached. Try again tomorrow.');
      return;
    }
    setDailyCount(getDailyCount());
    setSocialLoading(true);
    setSocialCopied(false);

    const socialPrompt = `A customer left this positive review for a small business called "${businessName}":

"${reviewText}"

Write one short, upbeat social media caption (2-3 sentences, in ${currentLang.englishName}) celebrating this happy customer -- suitable for Instagram or TikTok. Do not quote the review word-for-word; capture the spirit of it in the business's own voice. Include one relevant emoji. Then provide 5 relevant hashtags (no # symbol, lowercase, no spaces).

Respond ONLY with valid JSON, no markdown, no code fences, in this exact shape:
{"caption": "the caption text", "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]}`;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseCode, content: socialPrompt, trial: !unlocked && trialCount <= FREE_TRIAL_LIMIT })
      });
      const data = await response.json();
      { const ge = guardError(data); if (ge) throw ge; }
      const text = data.content.map(b => b.text || '').join('');
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setSocialPost(parsed);
    } catch (err) {
      setError(err.guardMessage || t.genError);
    } finally {
      setSocialLoading(false);
    }
  }

  function handleCopySocial() {
    if (!socialPost) return;
    const full = socialPost.caption + '\n\n' + socialPost.hashtags.map(h => '#' + h).join(' ');
    navigator.clipboard.writeText(full).then(() => {
      setSocialCopied(true);
      setTimeout(() => setSocialCopied(false), 1500);
    });
  }

  async function handleGenerateFollowUp() {
    if (!result) return;
    if (!checkAndUseDailyLimit()) {
      setDailyCount(DAILY_GEN_LIMIT);
      setError(t.limitReached || 'Daily generation limit reached. Try again tomorrow.');
      return;
    }
    setDailyCount(getDailyCount());
    setFollowUpLoading(true);
    setFollowUpCopied(false);

    const followUpPrompt = `A customer named (unknown, address them generically e.g. "Hi there") left this negative or mixed review for a small business called "${businessName}":

"${reviewText}"

Write one short, genuine private message (in ${currentLang.englishName}) that the business owner could send directly to this customer (via email or DM, not as a public reply) to try to actually resolve the issue. Unlike a public reply, this can be more direct and personal: acknowledge the specific problem, offer a concrete gesture if appropriate (e.g. a discount, a replacement, an invitation to discuss), and invite them to reply. Keep it warm but not groveling -- 3-5 sentences.

Respond ONLY with valid JSON, no markdown, no code fences, in this exact shape:
{"message": "the private message text"}`;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseCode, content: followUpPrompt, trial: !unlocked && trialCount <= FREE_TRIAL_LIMIT })
      });
      const data = await response.json();
      { const ge = guardError(data); if (ge) throw ge; }
      const text = data.content.map(b => b.text || '').join('');
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setFollowUpMsg(parsed.message);
    } catch (err) {
      setError(err.guardMessage || t.genError);
    } finally {
      setFollowUpLoading(false);
    }
  }

  function handleCopyFollowUp() {
    if (!followUpMsg) return;
    navigator.clipboard.writeText(followUpMsg).then(() => {
      setFollowUpCopied(true);
      setTimeout(() => setFollowUpCopied(false), 1500);
    });
  }

  const sentimentStyles = {
    positive: { bg: '#EAF3EC', text: '#3D6B4A', label: t.positiveLabel },
    negative: { bg: '#FBEAE7', text: '#B34B3C', label: t.negativeLabel },
    mixed: { bg: '#FBF2E3', text: '#A56A45', label: t.mixedLabel },
  };

  const bodyFont = currentLang.rtl ? "'Cairo', 'Inter', sans-serif" : "'Inter', system-ui, sans-serif";

  // Живой пример на первом экране: вкладки тона переключаются сами
  const [demoTab, setDemoTab] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setDemoTab(i => (i + 1) % 3), 4200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!langOpen) return;
    const close = () => setLangOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [langOpen]);

  const DEMO = [
    { tab: 'Warm', text: "Maya, thank you for telling us, and I'm sorry. A 25-minute wait with no word from us isn't okay, especially on a Saturday. We've added a second barista on weekend mornings. Your next coffee is on us." },
    { tab: 'Professional', text: 'Thank you for your feedback, Maya. A 25-minute wait without an apology falls short of our standard. We have increased weekend staffing to prevent this, and we would welcome the chance to serve you again.' },
    { tab: 'Short', text: "Maya, you're right, and we're sorry. We've added staff on weekend mornings. Hope to see you again soon." },
  ];

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const FEATURES = [
    { title: 'Three real replies', text: 'Different structure, not synonyms. Each one names what the customer actually said.', icon: 'M4 6h16M4 12h10M4 18h13' },
    { title: 'A private note for you', text: 'One line on the pattern behind the review, like weekend wait times or a training gap.', icon: 'M12 3l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z' },
    { title: 'Reads between the lines', text: 'Flags polite words that hide real frustration, or praise that sounds lukewarm.', icon: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
    { title: 'Five stars into a post', text: 'Turn a happy review into an Instagram or TikTok caption with hashtags in one click.', icon: 'M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4' },
    { title: 'Private follow-up', text: 'For a bad review, a direct message that actually tries to win the customer back.', icon: 'M4 5h16v11H8l-4 4z' },
    { title: '20 languages, photos too', text: 'Reply in your language whatever language the review is in. Attach the photos the customer posted.', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20' },
  ];

  const FAQ = [
    { q: 'Does this work for Google, Yelp, TripAdvisor, or just one platform?', a: 'Paste a review from anywhere: Google, Yelp, TripAdvisor, Booking.com, Facebook, Amazon, app stores. ReviewReply AI reads the text you give it and doesn’t need to be connected to any platform.' },
    { q: 'Does it post the reply for me?', a: 'No. It drafts three options and you copy the one you like onto the platform yourself, so you stay in control of what goes out under your name.' },
    { q: 'Will the replies sound like a robot wrote them?', a: 'Each reply picks up specific details from the review and you get three different structures and lengths, so you can choose the one that sounds like you, not a template.' },
    { q: 'What is the private note?', a: 'With every reply you get a note only you see. It flags when a review quietly points at a bigger pattern, like a recurring complaint about wait times or a training gap.' },
    { q: 'What happens after my free preview?', a: 'You get one free reply to try it out. A license is $79, one time, no subscription, and gives you unlimited replies.' },
  ];

  const C = { bg: '#F5F4EE', card: '#FFFFFF', ink: '#2D2A26', mute: '#87837A', soft: '#6B6659', line: '#E4E1D6', field: '#FAF9F4', acc: '#D97757', acc2: '#BD5D3A', cream: '#FBF2E3', tint: '#FBEFE8' };

  return (
    <div className="rr" dir={currentLang.rtl ? 'rtl' : 'ltr'} style={{ background: C.bg, fontFamily: bodyFont, color: C.ink, minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;700&display=swap');
        .rr *{box-sizing:border-box}
        .rr a{text-decoration:none}
        .rr-wrap{max-width:1160px;margin:0 auto;padding:0 28px}
        .rr-nav{display:flex;align-items:center;justify-content:space-between;height:76px;gap:16px}
        .rr-brand{display:flex;align-items:center;gap:11px;font-weight:700;font-size:16.5px;letter-spacing:-.01em;color:${C.ink};background:none;border:0;cursor:pointer;padding:0;font-family:inherit}
        .rr-mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,${C.acc},${C.acc2});display:grid;place-items:center;box-shadow:0 6px 16px -6px rgba(189,93,58,.6)}
        .rr-links{display:flex;align-items:center;gap:26px;font-size:14px;color:${C.soft}}
        .rr-links button.l{background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0}
        .rr-links button.l:hover{color:${C.ink}}
        .rr-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;font-family:inherit;font-weight:600;border-radius:999px;transition:transform .15s ease,box-shadow .15s ease,background .15s ease}
        .rr-btn:hover{transform:translateY(-1px)}
        .rr-dark{background:${C.ink};color:#fff;padding:11px 20px;font-size:14px}
        .rr-acc{background:linear-gradient(135deg,${C.acc},${C.acc2});color:#fff;padding:16px 28px;font-size:15.5px;box-shadow:0 12px 28px -10px rgba(189,93,58,.6)}
        .rr-ghost{background:none;color:${C.ink};font-size:15px;font-weight:600;padding:14px 6px}
        .rr-lang{position:relative}
        .rr-lang>button{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid ${C.line};border-radius:999px;padding:8px 13px;font:inherit;font-size:13px;color:${C.soft};cursor:pointer}
        .rr-menu{position:absolute;top:calc(100% + 8px);inset-inline-end:0;background:#fff;border:1px solid ${C.line};border-radius:14px;box-shadow:0 20px 50px -18px rgba(45,42,38,.35);padding:6px;width:190px;max-height:320px;overflow:auto;z-index:40}
        .rr-menu button{display:block;width:100%;text-align:start;background:none;border:0;padding:8px 11px;border-radius:9px;font:inherit;font-size:13.5px;color:${C.ink};cursor:pointer}
        .rr-menu button:hover,.rr-menu button.on{background:${C.tint};color:${C.acc2}}
        .rr-hero{display:grid;grid-template-columns:1.02fr 1fr;gap:56px;align-items:center;padding:52px 0 80px;position:relative}
        .rr-pill{display:inline-flex;align-items:center;gap:9px;border:1px solid ${C.line};background:#fff;border-radius:999px;padding:5px 13px 5px 5px;font-size:13px;color:${C.soft}}
        .rr-pill b{background:${C.tint};color:${C.acc2};border-radius:999px;padding:3px 10px;font-weight:600;font-size:12px}
        .rr h1{font-size:60px;line-height:1.03;letter-spacing:-.04em;margin:22px 0 20px;font-weight:800}
        .rr h1 em{font-style:normal;background:linear-gradient(135deg,${C.acc},${C.acc2});-webkit-background-clip:text;background-clip:text;color:transparent}
        .rr-lead{font-size:19px;line-height:1.6;color:${C.soft};max-width:500px;margin:0 0 32px}
        .rr-ctas{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
        .rr-trust{display:flex;gap:22px;margin-top:32px;font-size:13.5px;color:${C.soft};flex-wrap:wrap}
        .rr-trust span{display:flex;gap:7px;align-items:center}
        .rr-trust i{width:17px;height:17px;border-radius:50%;background:#EAF3EC;color:#3D6B4A;display:grid;place-items:center;font-style:normal;font-size:10px;font-weight:700}
        .rr-stage{position:relative;height:540px}
        .rr-glow{position:absolute;inset:30px -30px 0 10px;background:radial-gradient(55% 50% at 60% 45%,rgba(217,119,87,.22),rgba(217,119,87,0) 70%);pointer-events:none}
        .rr-card{position:absolute;background:#fff;border:1px solid ${C.line};border-radius:20px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 28px 60px -26px rgba(80,50,30,.32)}
        .rr-review{inset-inline-start:0;top:0;width:345px;padding:20px 22px;transform:rotate(-2deg);animation:rrFade .8s ease both}
        .rr-out{inset-inline-end:0;top:165px;width:430px;padding:20px 22px;animation:rrIn .7s ease .25s both}
        .rr-note{inset-inline-start:36px;bottom:0;width:360px;padding:17px 19px;background:${C.ink};border:0;color:#F5F1EA;animation:rrIn .7s ease .5s both}
        .rr-time{position:absolute;inset-inline-end:14px;top:112px;background:#fff;border:1px solid ${C.line};border-radius:999px;padding:8px 15px;font-size:13px;font-weight:600;box-shadow:0 12px 30px -14px rgba(0,0,0,.25);animation:rrIn .7s ease .7s both}
        .rr-time span{color:#3D6B4A}
        .rr-tabs{display:flex;gap:6px;margin-bottom:14px}
        .rr-tabs span{font-size:12.5px;font-weight:500;padding:6px 12px;border-radius:999px;color:${C.soft};border:1px solid ${C.line};transition:all .3s ease}
        .rr-tabs span.on{background:${C.ink};color:#fff;border-color:${C.ink}}
        .rr-lbl{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:${C.mute};font-weight:600;display:flex;justify-content:space-between;gap:10px}
        .rr-reply{font-size:14.5px;line-height:1.62;margin:9px 0 16px;min-height:94px;animation:rrFade .5s ease both}
        .rr-acts{display:flex;gap:8px}.rr-acts span{font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:10px;background:${C.field};border:1px solid ${C.line}}
        .rr-acts span.p{background:${C.acc};border-color:${C.acc};color:#fff}
        .rr-strip{border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};padding:22px 0;display:flex;align-items:center;justify-content:space-between;gap:12px 22px;flex-wrap:wrap;color:#A8A397;font-size:15px;font-weight:600}
        .rr-strip small{font-weight:500;font-size:13px;color:${C.mute}}
        .rr-sec{padding:96px 0 0}
        .rr-eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${C.acc2};font-weight:700;text-align:center;margin:0 0 12px}
        .rr h2{font-size:42px;line-height:1.1;letter-spacing:-.035em;margin:0 auto 14px;text-align:center;font-weight:800;max-width:720px}
        .rr-sub{font-size:17px;color:${C.soft};text-align:center;margin:0 auto 48px;max-width:560px;line-height:1.55}
        .rr-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .rr-box{background:#fff;border:1px solid ${C.line};border-radius:20px;padding:28px;transition:transform .2s ease,box-shadow .2s ease}
        .rr-box:hover{transform:translateY(-3px);box-shadow:0 24px 50px -30px rgba(80,50,30,.35)}
        .rr-num{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,${C.acc},${C.acc2});color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px}
        .rr-ico{width:42px;height:42px;border-radius:12px;background:${C.tint};display:grid;place-items:center}
        .rr-box h3{font-size:18px;margin:20px 0 8px;letter-spacing:-.015em;font-weight:700}
        .rr-box p{margin:0;color:${C.soft};font-size:14.5px;line-height:1.6}
        .rr-tool{max-width:760px;margin:0 auto}
        .rr-split{display:grid;grid-template-columns:1fr 1.05fr;gap:40px;align-items:center;margin-bottom:36px}
        .rr-art{width:100%;height:auto;display:block}
        .rr-form{background:#fff;border:1px solid ${C.line};border-radius:24px;padding:30px;box-shadow:0 30px 70px -40px rgba(80,50,30,.4)}
        .rr-form label.f{display:block;font-size:13px;font-weight:600;margin-bottom:7px;color:${C.ink}}
        .rr-in{width:100%;border-radius:12px;padding:12px 14px;font:inherit;font-size:14.5px;background:${C.field};border:1px solid ${C.line};color:${C.ink};outline:none;transition:border-color .15s ease,box-shadow .15s ease}
        .rr-in:focus{border-color:${C.acc};box-shadow:0 0 0 4px rgba(217,119,87,.14);background:#fff}
        .rr-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:${C.field};border:1px solid ${C.line};border-radius:12px;padding:4px}
        .rr-seg button{border:0;border-radius:9px;padding:10px 0;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;background:none;color:${C.soft};transition:all .15s ease}
        .rr-seg button.on{background:#fff;color:${C.acc2};box-shadow:0 2px 8px -2px rgba(0,0,0,.12)}
        .rr-res{background:#fff;border:1px solid ${C.line};border-radius:18px;padding:20px 22px}
        .rr-price{display:grid;grid-template-columns:1.1fr 1fr;gap:0;background:#fff;border:1px solid ${C.line};border-radius:28px;overflow:hidden;max-width:920px;margin:0 auto;box-shadow:0 30px 70px -40px rgba(80,50,30,.4)}
        .rr-price .l{padding:44px}
        .rr-price .r{padding:44px;background:linear-gradient(160deg,${C.tint},${C.cream});display:flex;flex-direction:column;justify-content:center}
        .rr-price ul{list-style:none;padding:0;margin:22px 0 0;display:grid;gap:12px}
        .rr-price li{display:flex;gap:10px;font-size:15px;color:${C.ink}}
        .rr-price li i{flex-shrink:0;width:20px;height:20px;border-radius:50%;background:${C.acc};color:#fff;display:grid;place-items:center;font-style:normal;font-size:11px;font-weight:700;margin-top:1px}
        .rr-faq{max-width:760px;margin:0 auto}
        .rr-faq button{width:100%;text-align:start;background:none;border:0;cursor:pointer;padding:22px 2px;display:flex;align-items:center;justify-content:space-between;gap:16px;font:inherit}
        .rr-final{margin:110px 0 0;border-radius:32px;padding:64px 40px;text-align:center;background:${C.ink};color:#fff;position:relative;overflow:hidden}
        .rr-final:before{content:'';position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(217,119,87,.45),rgba(217,119,87,0) 65%);top:-260px;left:50%;transform:translateX(-50%)}
        .rr-final>*{position:relative}
        .rr-foot{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;padding:36px 0 18px;font-size:13px;color:${C.mute}}
        .rr-foot a,.rr-foot button{color:${C.soft};font-size:13px;background:none;border:0;cursor:pointer;font-family:inherit;padding:0}
        @keyframes rrIn{from{opacity:0;transform:translateY(14px)}to{opacity:1}}
                @keyframes rrFade{from{opacity:0}to{opacity:1}}
        @media(max-width:900px){
          .rr-wrap{padding:0 16px}
          .rr-links .hide{display:none}
          .rr-links{gap:10px}
          .rr-hero{grid-template-columns:1fr;gap:36px;padding:24px 0 52px}
          .rr h1{font-size:40px}
          .rr-lead{font-size:17px}
          .rr-stage{height:auto;display:flex;flex-direction:column;gap:14px}
          .rr-card,.rr-time{position:relative;inset:auto;width:auto;top:auto;bottom:auto}
          .rr-review{transform:none}
          .rr-time{display:none}
          .rr-glow{display:none}
          .rr-sec{padding-top:64px}
          .rr h2{font-size:30px}
          .rr-sub{margin-bottom:32px;font-size:16px}
          .rr-grid3{grid-template-columns:1fr}
          .rr-split{grid-template-columns:1fr;gap:8px;margin-bottom:20px}
          .rr-form{padding:20px;border-radius:20px}
          .rr-price{grid-template-columns:1fr}
          .rr-price .l,.rr-price .r{padding:28px}
          .rr-final{padding:44px 22px;margin-top:72px;border-radius:24px}
          .rr-strip{justify-content:flex-start;font-size:14px}
        }
      `}</style>

      {showWelcome && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(45,42,38,0.5)', backdropFilter: 'blur(4px)', animation: 'welcomeFadeIn 0.4s ease both',
        }}>
          <style>{`
            @keyframes welcomeFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes welcomeFadeOut { to { opacity: 0; } }
            @keyframes checkDraw { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
            @keyframes ringPop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes textRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes particleOut { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; } }
            .welcome-particle { position: absolute; border-radius: 50%; animation: particleOut 1.1s ease-out both; }
          `}</style>
          <div style={{ position: 'relative', textAlign: 'center', animation: 'welcomeFadeOut 0.4s ease 3.4s both' }}>
            {[...Array(10)].map((_, i) => {
              const angle = (i / 10) * Math.PI * 2;
              const dist = 70 + (i % 3) * 20;
              return (
                <span key={i} className="welcome-particle" style={{
                  left: '50%', top: '38%', width: 7 + (i % 3) * 2, height: 7 + (i % 3) * 2,
                  background: i % 2 === 0 ? '#D97757' : '#F2C57C', animationDelay: `${0.15 + i * 0.02}s`,
                  '--tx': `${Math.cos(angle) * dist}px`, '--ty': `${Math.sin(angle) * dist}px`,
                }} />
              );
            })}
            <div style={{
              width: 76, height: 76, borderRadius: '50%', margin: '0 auto 18px',
              background: 'linear-gradient(135deg, #D97757, #BD5D3A)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 32px rgba(217,119,87,0.4)', animation: 'ringPop 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 40, animation: 'checkDraw 0.5s ease 0.35s both' }} />
              </svg>
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px', animation: 'textRise 0.4s ease 0.5s both' }}>Welcome</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: 0, animation: 'textRise 0.4s ease 0.62s both' }}>
              You're all set — unlimited replies, let's go.
            </p>
          </div>
        </div>
      )}

      <div className="rr-wrap">
        {/* ----- NAV ----- */}
        <nav className="rr-nav">
          <button className="rr-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="rr-mark">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v11H8l-4 4V4z" /><path d="M8 9h2M8 11.5h5" />
              </svg>
            </span>
            ReviewReply AI
          </button>
          <div className="rr-links">
            <button className="l hide" onClick={() => scrollTo('how')}>How it works</button>
            <button className="l hide" onClick={() => scrollTo('pricing')}>Pricing</button>
            <button className="l hide" onClick={() => scrollTo('faq')}>FAQ</button>
            <div className="rr-lang" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setLangOpen(v => !v)} aria-label={t.languageLabel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" /></svg>
                {currentLang.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {langOpen && (
                <div className="rr-menu">
                  {languages.map(l => (
                    <button key={l.code} className={l.code === language ? 'on' : ''} onClick={() => { setLanguage(l.code); setLangOpen(false); }}>{l.label}</button>
                  ))}
                </div>
              )}
            </div>
            <button className="rr-btn rr-dark hide" onClick={() => scrollTo('try')}>Try it free</button>
          </div>
        </nav>

        {/* ----- HERO ----- */}
        <section className="rr-hero">
          <div>
            <span className="rr-pill"><b>New</b> Reads the problem behind the review</span>
            <h1>Answer every review <em>like you had all day.</em></h1>
            <p className="rr-lead">
              {language === 'en'
                ? 'Paste a review from Google, Yelp or TripAdvisor. Get three replies that sound like you, plus a private note on what the customer is really telling you.'
                : t.subtitle}
            </p>
            <div className="rr-ctas">
              <button className="rr-btn rr-acc" onClick={() => scrollTo('try')}>Reply to a review free →</button>
              <button className="rr-btn rr-ghost" onClick={() => scrollTo('how')}>See how it works</button>
            </div>
            <div className="rr-trust">
              <span><i>✓</i>No sign-up</span>
              <span><i>✓</i>20 languages</span>
              <span><i>✓</i>One payment, no subscription</span>
            </div>
          </div>

          <div className="rr-stage" aria-hidden="true">
            <div className="rr-glow" />
            <div className="rr-card rr-review">
              <span style={{ position: 'absolute', insetInlineEnd: 16, top: 18, fontSize: 11, fontWeight: 600, color: C.soft, background: C.field, border: `1px solid ${C.line}`, borderRadius: 7, padding: '3px 8px' }}>Google</span>
              <div style={{ display: 'flex', gap: 11, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#E9E2F5', color: '#5B4A9A', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>MR</div>
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>Maya R.</div><div style={{ fontSize: 12, color: C.mute }}>2 days ago</div></div>
              </div>
              <div style={{ color: '#E8A33B', letterSpacing: 2, fontSize: 15 }}>★★<span style={{ color: '#DDD6CA' }}>★★★</span></div>
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: '#3A3732' }}>Coffee was great but we waited 25 minutes on Saturday and nobody even said sorry. Probably won't come back on a weekend.</p>
            </div>

            <div className="rr-time">Written in <span>4 seconds</span></div>

            <div className="rr-card rr-out">
              <div className="rr-tabs">
                {DEMO.map((d, i) => <span key={d.tab} className={i === demoTab ? 'on' : ''}>{d.tab}</span>)}
              </div>
              <div className="rr-lbl"><span>Suggested reply</span><span>{demoTab + 1} of 3</span></div>
              <p key={demoTab} className="rr-reply">{DEMO[demoTab].text}</p>
              <div className="rr-acts"><span className="p">Copy reply</span><span>Turn into DM</span></div>
            </div>

            <div className="rr-card rr-note">
              <div className="rr-lbl" style={{ color: '#B9B2A6' }}><span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#F08A5D', marginInlineEnd: 7 }} />Private note, only you see this</span></div>
              <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55 }}>The coffee isn't the problem. Weekend wait times and nobody acknowledging the delay are. Worth a staffing look before this repeats.</p>
            </div>
          </div>
        </section>

        <div className="rr-strip">
          <small>Works with reviews from</small>
          <span>Google</span><span>Yelp</span><span>TripAdvisor</span><span>Booking.com</span><span>Trustpilot</span><span>Facebook</span><span>App Store</span>
        </div>

        {/* ----- HOW IT WORKS ----- */}
        <section id="how" className="rr-sec">
          <p className="rr-eyebrow">How it works</p>
          <h2>From review to reply in three steps</h2>
          <p className="rr-sub">No account, no setup. It takes less time than reading the review twice.</p>
          <div className="rr-grid3">
            {[
              ['Paste the review', 'Any platform, any language. Add the photos the customer posted if there are any.'],
              ['Pick a tone', 'Warm, professional or short. Every version names the real issue instead of a template apology.'],
              ['Copy and post', 'Plus a private note on what keeps coming up, so you fix the cause, not just the reply.'],
            ].map(([h, p], i) => (
              <div key={h} className="rr-box"><div className="rr-num">{i + 1}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </section>

        {/* ----- TOOL ----- */}
        <section id="try" className="rr-sec">
          <p className="rr-eyebrow">Try it now</p>
          <h2>Paste a real review</h2>
          <p className="rr-sub">{!unlocked && trialCount < FREE_TRIAL_LIMIT ? 'Your first reply is free. No code, no sign-up.' : 'Three replies and a private note in a few seconds.'}</p>

          <div className="rr-tool">
            {!unlocked && trialCount >= FREE_TRIAL_LIMIT && (
              <div style={{ background: '#FDECEC', border: '1px solid #F3C4C4', borderRadius: 16, padding: '16px 18px', marginBottom: 16, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <p style={{ color: '#8A4A38', margin: 0, fontWeight: 600, fontSize: 14 }}>Your free preview is over. Enter your code whenever you're ready to keep going.</p>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <a href="/buy.html" style={{ color: '#A56A45', fontSize: 13.5, fontWeight: 600 }}>{t.noCodeText}</a>
                  <a href="/unlock.html" className="rr-btn" style={{ background: C.acc, color: '#fff', padding: '10px 18px', fontSize: 13.5 }}>Enter your code →</a>
                </div>
              </div>
            )}

            <div className="rr-form">
              <div style={{ display: 'grid', gap: 20 }}>
                <div>
                  <label className="f">{t.businessLabel}</label>
                  <input type="text" className="rr-in" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t.businessPh} />
                </div>
                <div>
                  <label className="f">{t.reviewLabel}</label>
                  <textarea className="rr-in" value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder={t.reviewPh} rows={5} style={{ resize: 'vertical', lineHeight: 1.55 }} />
                </div>
                <div>
                  <label className="f">{t.toneLabel}</label>
                  <div className="rr-seg">
                    {tones.map(tn => (
                      <button key={tn.value} className={tone === tn.value ? 'on' : ''} onClick={() => setTone(tn.value)}>{tn.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="f">{t.photoLabel} <span style={{ color: C.mute, fontWeight: 400 }}>({photos.length}/3)</span></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {photos.map((p, i) => (
                      <div key={i} style={{ position: 'relative', width: 60, height: 60 }}>
                        <img src={p.preview} alt="" style={{ width: 60, height: 60, borderRadius: 12, objectFit: 'cover' }} />
                        <button type="button" onClick={() => removePhoto(i)} aria-label="Remove photo" style={{
                          position: 'absolute', top: -6, insetInlineEnd: -6, width: 21, height: 21, borderRadius: '50%',
                          background: C.ink, color: '#FFF', border: '2px solid #fff', fontSize: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                        }}>✕</button>
                      </div>
                    ))}
                    {photos.length < 3 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 9, borderRadius: 12, padding: '11px 15px', fontSize: 14, cursor: 'pointer', background: C.field, border: `1px dashed #D3CEC1`, color: C.soft }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.acc} strokeWidth="1.9" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-5-8 8" /></svg>
                        <span>{t.uploadPhoto}</span>
                        <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
                      </label>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, cursor: 'pointer', color: C.soft, marginInlineStart: 'auto' }}>
                      <input type="checkbox" checked={includeEmoji} onChange={(e) => setIncludeEmoji(e.target.checked)} style={{ accentColor: C.acc, width: 16, height: 16 }} />
                      {t.emojiToggle}
                    </label>
                  </div>
                </div>

                {error && <p style={{ color: '#B34B3C', fontSize: 14, margin: 0 }}>{error}</p>}

                <button onClick={handleGenerate} disabled={loading} className="rr-btn rr-acc" style={{ width: '100%', borderRadius: 14, opacity: loading ? 0.65 : 1 }}>
                  {loading ? t.generatingBtn : t.generateBtn}
                </button>
              </div>
            </div>

            {result && (
              <div style={{ marginTop: 28, display: 'grid', gap: 14 }}>
                {photos.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {photos.map((p, i) => (
                      <img key={i} src={p.preview} alt="" style={{
                        width: photos.length === 1 ? '100%' : `calc(${100 / Math.min(photos.length, 3)}% - 6px)`,
                        aspectRatio: '1.6 / 1', borderRadius: 14, objectFit: 'cover',
                      }} />
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 999,
                    background: sentimentStyles[result.sentiment]?.bg || '#F1EFE6', color: sentimentStyles[result.sentiment]?.text || '#6B6659',
                  }}>
                    {sentimentStyles[result.sentiment]?.label || result.sentiment}
                  </span>
                  {result.subtext && result.subtext.trim() && (
                    <span style={{ fontSize: 13.5, color: C.soft, fontStyle: 'italic' }}>{t.subtextLabel}: {result.subtext}</span>
                  )}
                </div>

                <p className="rr-lbl" style={{ margin: '4px 0 0' }}><span>{t.repliesHeading}</span></p>
                {result.replies.map((reply, idx) => (
                  <div key={idx} className="rr-res">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.acc2 }}>Option {idx + 1}</span>
                      <button onClick={() => handleCopy(reply, idx)} className="rr-btn" style={{
                        background: copiedIdx === idx ? '#EAF3EC' : C.tint, color: copiedIdx === idx ? '#3D6B4A' : C.acc2, padding: '6px 14px', fontSize: 12.5,
                      }}>
                        {copiedIdx === idx ? t.copiedBtn : t.copyBtn}
                      </button>
                    </div>
                    <p style={{ fontSize: 15, lineHeight: 1.65, margin: 0 }}>{reply}</p>
                  </div>
                ))}

                {result.insight && result.insight.trim() && (
                  <div style={{ background: C.ink, color: '#F5F1EA', borderRadius: 18, padding: '18px 22px' }}>
                    <div className="rr-lbl" style={{ color: '#B9B2A6', marginBottom: 8 }}>
                      <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#F08A5D', marginInlineEnd: 7 }} />For your eyes only</span>
                    </div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{result.insight}</p>
                  </div>
                )}

                {result.sentiment === 'positive' && !socialPost && (
                  <button onClick={handleGenerateSocialPost} disabled={socialLoading} className="rr-btn" style={{ width: '100%', borderRadius: 14, padding: '14px 0', fontSize: 14, background: '#fff', border: `1px solid ${C.acc}`, color: socialLoading ? C.mute : C.acc2 }}>
                    {socialLoading ? t.socialGeneratingBtn : t.socialBtnLabel}
                  </button>
                )}

                {socialPost && (
                  <div className="rr-res">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.acc2 }}>{t.socialHeading}</span>
                      <button onClick={handleCopySocial} className="rr-btn" style={{ background: socialCopied ? '#EAF3EC' : C.tint, color: socialCopied ? '#3D6B4A' : C.acc2, padding: '6px 14px', fontSize: 12.5 }}>
                        {socialCopied ? t.copiedBtn : t.copyBtn}
                      </button>
                    </div>
                    <p style={{ fontSize: 15, lineHeight: 1.65, margin: '0 0 10px' }}>{socialPost.caption}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {socialPost.hashtags.map((tag, i) => (
                        <span key={i} style={{ fontSize: 12.5, color: C.acc2, background: C.tint, borderRadius: 999, padding: '4px 10px' }}>#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {(result.sentiment === 'negative' || result.sentiment === 'mixed') && !followUpMsg && (
                  <button onClick={handleGenerateFollowUp} disabled={followUpLoading} className="rr-btn" style={{ width: '100%', borderRadius: 14, padding: '14px 0', fontSize: 14, background: '#fff', border: '1px solid #B34B3C', color: followUpLoading ? C.mute : '#B34B3C' }}>
                    {followUpLoading ? t.followUpGeneratingBtn : t.followUpBtnLabel}
                  </button>
                )}

                {followUpMsg && (
                  <div className="rr-res">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#B34B3C' }}>{t.followUpHeading}</span>
                      <button onClick={handleCopyFollowUp} className="rr-btn" style={{ background: followUpCopied ? '#EAF3EC' : '#FBEAE7', color: followUpCopied ? '#3D6B4A' : '#B34B3C', padding: '6px 14px', fontSize: 12.5 }}>
                        {followUpCopied ? t.copiedBtn : t.copyBtn}
                      </button>
                    </div>
                    <p style={{ fontSize: 15, lineHeight: 1.65, margin: 0 }}>{followUpMsg}</p>
                  </div>
                )}
              </div>
            )}

            <div style={{ maxWidth: 420, margin: '26px auto 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12.5, color: C.mute }}>
                <span>Today's free generations</span>
                <span style={{ fontWeight: 600 }}>{DAILY_GEN_LIMIT - dailyCount}/{DAILY_GEN_LIMIT} left</span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: C.line, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${(dailyCount / DAILY_GEN_LIMIT) * 100}%`, background: dailyCount >= DAILY_GEN_LIMIT ? '#B34B3C' : C.acc, transition: 'width 0.3s ease' }} />
              </div>
              {dailyCount >= DAILY_GEN_LIMIT && (
                <p style={{ fontSize: 12.5, textAlign: 'center', color: '#B34B3C', marginTop: 8 }}>Today's limit reached. Come back tomorrow for 50 more free generations.</p>
              )}
            </div>
          </div>
        </section>

        {/* ----- FEATURES ----- */}
        <section className="rr-sec">
          <div className="rr-split">
            <div>
              <p className="rr-eyebrow" style={{ textAlign: 'start' }}>What you get</p>
              <h2 style={{ textAlign: 'start', margin: '0 0 16px' }}>More than a reply. A read on what's really going on.</h2>
              <p className="rr-sub" style={{ textAlign: 'start', margin: '0 0 28px' }}>Every review is feedback someone took the time to write. ReviewReply AI turns each one into a reply you're proud of and a clear next step for your business.</p>
              <button className="rr-btn rr-acc" onClick={() => scrollTo('try')}>Try it on your review →</button>
            </div>
            <img src="/images/hero-rr.jpg" alt="One review in, thoughtful replies out" width="1200" height="900" loading="lazy" className="rr-art" />
          </div>
          <div className="rr-grid3">
            {FEATURES.map(f => (
              <div key={f.title} className="rr-box">
                <div className="rr-ico">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.acc2} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon} /></svg>
                </div>
                <h3>{f.title}</h3><p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ----- PRICING ----- */}
        <section id="pricing" className="rr-sec">
          <p className="rr-eyebrow">Pricing</p>
          <h2>Pay once. Reply forever.</h2>
          <p className="rr-sub">No subscription and no monthly bill. Try it free first.</p>
          <div className="rr-price">
            <div className="l">
              <div style={{ fontSize: 15, fontWeight: 700, color: C.acc2 }}>ReviewReply AI license</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '12px 0 4px' }}>
                <span style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 }}>$79</span>
                <span style={{ color: C.mute, fontSize: 15 }}>one time</span>
              </div>
              <ul>
                {['Unlimited replies, every day', 'Private note and tone reading on every review', 'Social posts and private follow-up messages', '20 languages and photo support', 'All future updates included'].map(x => (
                  <li key={x}><i>✓</i>{x}</li>
                ))}
              </ul>
            </div>
            <div className="r">
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: C.ink, margin: '0 0 24px' }}>Answering ten reviews by hand takes about an hour. With ReviewReply AI it takes a few minutes, and every reply still sounds like you.</p>
              <a href="/buy.html" className="rr-btn rr-acc" style={{ width: '100%' }}>Get lifetime access →</a>
              <a href="/unlock.html" style={{ display: 'block', textAlign: 'center', marginTop: 14, fontSize: 13.5, color: C.soft }}>{t.haveCodeLabel || 'Already have a code?'} <span style={{ color: C.acc2, fontWeight: 600 }}>Enter it here</span></a>
            </div>
          </div>
        </section>

        {/* ----- FAQ ----- */}
        <section id="faq" className="rr-sec">
          <p className="rr-eyebrow">FAQ</p>
          <h2>Questions, answered</h2>
          <p className="rr-sub">Everything people usually ask before trying ReviewReply AI.</p>
          <div className="rr-faq">
            {FAQ.map((item, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{item.q}</span>
                  <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: openFaq === i ? C.acc : C.tint, color: openFaq === i ? '#fff' : C.acc2, display: 'grid', placeItems: 'center', fontSize: 18, transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'all .2s ease' }}>+</span>
                </button>
                {openFaq === i && <p style={{ fontSize: 15, color: C.soft, lineHeight: 1.65, margin: '0 2px 22px' }}>{item.a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ----- FINAL CTA ----- */}
        <section className="rr-final">
          <h2 style={{ color: '#fff', margin: '0 auto 14px' }}>Your next review is already waiting.</h2>
          <p style={{ color: 'rgba(255,255,255,.72)', fontSize: 17, margin: '0 auto 30px', maxWidth: 480, lineHeight: 1.55 }}>Paste it in and see three replies and a private note in seconds. The first one is free.</p>
          <button className="rr-btn rr-acc" onClick={() => scrollTo('try')}>Reply to a review free →</button>
        </section>

        {/* ----- RATE ----- */}
        <div style={{ maxWidth: 420, margin: '56px auto 0' }}>
          {rateStars === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>How's ReviewReply AI working for you?</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRateStars(n)} aria-label={`Rate ${n} star`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D97757" strokeWidth="1.6"><path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.8 1.5 6.9-6.1-3.6-6.1 3.6 1.5-6.9-5.2-4.8 6.9-.7z" /></svg>
                  </button>
                ))}
              </div>
            </div>
          ) : rateStars >= 4 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
              <span style={{ fontSize: 14 }}>Thank you! That means a lot.</span>
              <a href="https://plainwork.website/#rate-us" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: '#A56A45' }}>Rate us on Plainwork →</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14, textAlign: 'center' }}>Sorry to hear that. What went wrong?</span>
              <textarea className="rr-in" value={rateProblem} onChange={(e) => setRateProblem(e.target.value)} placeholder="Describe the issue..." rows={3} style={{ resize: 'vertical' }} />
              <a href={`mailto:kssw117@gmail.com?subject=${encodeURIComponent('ReviewReply AI feedback')}&body=${encodeURIComponent(rateProblem)}`} className="rr-btn" style={{ color: '#fff', background: C.acc, padding: '11px 0', fontSize: 14 }}>Send feedback</a>
            </div>
          )}
        </div>

        {/* ----- FOOTER ----- */}
        <footer style={{ marginTop: 56, borderTop: `1px solid ${C.line}` }}>
          <div className="rr-foot">
            <span>Powered by Claude · Plainwork by Ksenia</span>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="/terms.html">Terms</a>
              <a href="/privacy.html">Privacy</a>
              <a href="/refund.html">Refunds</a>
              {!showSupportEmail
                ? <button onClick={() => setShowSupportEmail(true)}>Support</button>
                : <a href="mailto:kssw117@gmail.com">kssw117@gmail.com</a>}
            </div>
          </div>
          <p style={{ fontSize: 11, color: C.mute, opacity: 0.8, margin: '0 0 28px' }}>
            Грезина Ксения Викторовна (Ksenia Grezina) · Tax ID (ИНН) 710607167655
          </p>
        </footer>
      </div>

      {/* Плавающая кнопка "как пользоваться" */}
      <button
        onClick={() => { playPopSound(!showHelpBubble); setShowHelpBubble(v => !v); }}
        aria-label="How it works"
        style={{
          position: 'fixed', bottom: 20, insetInlineEnd: 20, width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, #D97757, #BD5D3A)', color: '#FFF', border: 'none',
          cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 22px rgba(189,93,58,0.4)', zIndex: 50,
        }}
      >
        {showHelpBubble ? '✕' : '?'}
      </button>
      {showHelpBubble && (
        <div style={{
          position: 'fixed', bottom: 80, insetInlineEnd: 20, width: 300, maxWidth: 'calc(100vw - 40px)',
          background: '#FFF', borderRadius: 16, padding: 18, boxShadow: '0 20px 50px -18px rgba(0,0,0,0.3)',
          border: `1px solid ${C.line}`, zIndex: 50,
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 700 }}>How ReviewReply AI works</p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: '#5B564C' }}>
            Paste a customer review. The AI reads it, checks the tone, and drafts three reply options, plus a private note only you see. Attach up to 3 photos for extra context. Turn a great review into a social post in one click.
          </p>
        </div>
      )}
    </div>
  );
}
