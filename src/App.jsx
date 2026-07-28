import React, { useState } from 'react';

export default function ReviewReplyAI() {
  const [businessName, setBusinessName] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [tone, setTone] = useState('warm');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [licenseCode, setLicenseCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [licenseError, setLicenseError] = useState('');
  const [includeEmoji, setIncludeEmoji] = useState(true);
  const [photo, setPhoto] = useState(null);

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
    en: { title: 'ReviewReply AI', subtitle: 'Paste any customer review, get thoughtful replies in seconds.', businessLabel: 'Your business name', businessPh: 'e.g. Morning Coffee Shop', reviewLabel: "Paste the customer's review", reviewPh: 'e.g. Loved the coffee but service was slow on Saturday...', toneLabel: 'Reply tone', toneWarm: 'Warm', toneProfessional: 'Professional', toneBrief: 'Short', languageLabel: 'Reply language', generateBtn: 'Generate replies', generatingBtn: 'Writing replies...', fillError: 'Please fill in your business name and paste the review.', genError: 'Could not generate. Please try again.', positiveLabel: 'Positive review', negativeLabel: 'Negative review', mixedLabel: 'Mixed review', copyBtn: 'Copy', copiedBtn: 'Copied!', repliesHeading: 'Reply options' , licenseGateTitle: 'Enter your access code', licensePh: 'Access code', unlockBtn: 'Unlock', licenseInvalid: 'Invalid or inactive code', photoLabel: 'Attach a photo (optional)', uploadPhoto: 'Add photo', changePhoto: 'Change photo', emojiToggle: 'Emoji'},
    ru: { title: 'ReviewReply AI', subtitle: 'Вставьте отзыв клиента — получите готовые варианты ответа за секунды.', businessLabel: 'Название бизнеса', businessPh: 'Например: кофейня «Утро»', reviewLabel: 'Вставьте отзыв клиента', reviewPh: 'Например: кофе понравился, но обслуживание было медленным в субботу...', toneLabel: 'Тон ответа', toneWarm: 'Тёплый', toneProfessional: 'Деловой', toneBrief: 'Короткий', languageLabel: 'Язык ответа', generateBtn: 'Сгенерировать ответы', generatingBtn: 'Пишу ответы...', fillError: 'Заполните название бизнеса и вставьте отзыв.', genError: 'Не удалось сгенерировать. Попробуйте ещё раз.', positiveLabel: 'Положительный отзыв', negativeLabel: 'Отрицательный отзыв', mixedLabel: 'Смешанный отзыв', copyBtn: 'Копировать', copiedBtn: 'Скопировано!', repliesHeading: 'Варианты ответа' , licenseGateTitle: 'Введите код доступа', licensePh: 'Код доступа', unlockBtn: 'Разблокировать', licenseInvalid: 'Неверный или неактивный код', photoLabel: 'Прикрепить фото (необязательно)', uploadPhoto: 'Загрузить фото', changePhoto: 'Сменить фото', emojiToggle: 'Эмодзи'},
    ar: { title: 'ReviewReply AI', subtitle: 'الصق أي تقييم من العميل واحصل على ردود مدروسة خلال ثوانٍ.', businessLabel: 'اسم نشاطك التجاري', businessPh: 'مثال: مقهى الصباح', reviewLabel: 'الصق تقييم العميل', reviewPh: 'مثال: أحببت القهوة لكن الخدمة كانت بطيئة يوم السبت...', toneLabel: 'نبرة الرد', toneWarm: 'ودود', toneProfessional: 'احترافي', toneBrief: 'مختصر', languageLabel: 'لغة الرد', generateBtn: 'إنشاء الردود', generatingBtn: 'جارٍ كتابة الردود...', fillError: 'يرجى إدخال اسم النشاط ولصق التقييم.', genError: 'تعذر الإنشاء. حاول مرة أخرى.', positiveLabel: 'تقييم إيجابي', negativeLabel: 'تقييم سلبي', mixedLabel: 'تقييم مختلط', copyBtn: 'نسخ', copiedBtn: 'تم النسخ!', repliesHeading: 'خيارات الرد' , licenseGateTitle: 'أدخل رمز الوصول', licensePh: 'رمز الوصول', unlockBtn: 'فتح', licenseInvalid: 'رمز غير صالح أو غير مفعّل', photoLabel: 'إرفاق صورة (اختياري)', uploadPhoto: 'رفع صورة', changePhoto: 'تغيير الصورة', emojiToggle: 'الرموز التعبيرية'},
    fa: { title: 'ReviewReply AI', subtitle: 'نظر مشتری را وارد کنید و در چند ثانیه پاسخ‌های مناسب دریافت کنید.', businessLabel: 'نام کسب‌وکار', businessPh: 'مثال: کافه صبح', reviewLabel: 'نظر مشتری را وارد کنید', reviewPh: 'مثال: قهوه عالی بود اما سرویس روز شنبه کند بود...', toneLabel: 'لحن پاسخ', toneWarm: 'گرم', toneProfessional: 'حرفه‌ای', toneBrief: 'کوتاه', languageLabel: 'زبان پاسخ', generateBtn: 'ایجاد پاسخ‌ها', generatingBtn: 'در حال نوشتن...', fillError: 'لطفاً نام کسب‌وکار و نظر را وارد کنید.', genError: 'ایجاد نشد. دوباره امتحان کنید.', positiveLabel: 'نظر مثبت', negativeLabel: 'نظر منفی', mixedLabel: 'نظر ترکیبی', copyBtn: 'کپی', copiedBtn: 'کپی شد!', repliesHeading: 'گزینه‌های پاسخ' , licenseGateTitle: 'کد دسترسی را وارد کنید', licensePh: 'کد دسترسی', unlockBtn: 'باز کردن', licenseInvalid: 'کد نامعتبر یا غیرفعال', photoLabel: 'پیوست عکس (اختیاری)', uploadPhoto: 'آپلود عکس', changePhoto: 'تغییر عکس', emojiToggle: 'ایموجی'},
    es: { title: 'ReviewReply AI', subtitle: 'Pega cualquier reseña y obtén respuestas listas en segundos.', businessLabel: 'Nombre del negocio', businessPh: 'Ej: Cafetería Mañana', reviewLabel: 'Pega la reseña del cliente', reviewPh: 'Ej: Me encantó el café pero el servicio fue lento el sábado...', toneLabel: 'Tono de la respuesta', toneWarm: 'Cálido', toneProfessional: 'Profesional', toneBrief: 'Breve', languageLabel: 'Idioma de la respuesta', generateBtn: 'Generar respuestas', generatingBtn: 'Escribiendo...', fillError: 'Completa el nombre del negocio y la reseña.', genError: 'No se pudo generar. Intenta de nuevo.', positiveLabel: 'Reseña positiva', negativeLabel: 'Reseña negativa', mixedLabel: 'Reseña mixta', copyBtn: 'Copiar', copiedBtn: '¡Copiado!', repliesHeading: 'Opciones de respuesta' , licenseGateTitle: 'Introduce tu código de acceso', licensePh: 'Código de acceso', unlockBtn: 'Desbloquear', licenseInvalid: 'Código inválido o inactivo', photoLabel: 'Adjuntar foto (opcional)', uploadPhoto: 'Subir foto', changePhoto: 'Cambiar foto', emojiToggle: 'Emoji'},
    fr: { title: 'ReviewReply AI', subtitle: 'Collez un avis client, obtenez des réponses réfléchies en quelques secondes.', businessLabel: "Nom de l'entreprise", businessPh: 'Ex : Café du Matin', reviewLabel: "Collez l'avis du client", reviewPh: 'Ex : Café excellent mais service lent le samedi...', toneLabel: 'Ton de la réponse', toneWarm: 'Chaleureux', toneProfessional: 'Professionnel', toneBrief: 'Court', languageLabel: 'Langue de la réponse', generateBtn: 'Générer les réponses', generatingBtn: 'Rédaction en cours...', fillError: "Remplissez le nom de l'entreprise et l'avis.", genError: 'Échec de la génération. Réessayez.', positiveLabel: 'Avis positif', negativeLabel: 'Avis négatif', mixedLabel: 'Avis mitigé', copyBtn: 'Copier', copiedBtn: 'Copié !', repliesHeading: 'Options de réponse' , licenseGateTitle: "Entrez votre code d'accès", licensePh: "Code d'accès", unlockBtn: 'Déverrouiller', licenseInvalid: 'Code invalide ou inactif', photoLabel: 'Joindre une photo (facultatif)', uploadPhoto: 'Ajouter une photo', changePhoto: 'Changer la photo', emojiToggle: 'Emoji'},
    de: { title: 'ReviewReply AI', subtitle: 'Bewertung einfügen, in Sekunden durchdachte Antworten erhalten.', businessLabel: 'Firmenname', businessPh: 'z.B. Café Morgen', reviewLabel: 'Kundenbewertung einfügen', reviewPh: 'z.B. Kaffee war super, aber der Service war samstags langsam...', toneLabel: 'Tonfall der Antwort', toneWarm: 'Herzlich', toneProfessional: 'Professionell', toneBrief: 'Kurz', languageLabel: 'Antwortsprache', generateBtn: 'Antworten generieren', generatingBtn: 'Schreibe Antworten...', fillError: 'Firmenname und Bewertung ausfüllen.', genError: 'Generierung fehlgeschlagen. Erneut versuchen.', positiveLabel: 'Positive Bewertung', negativeLabel: 'Negative Bewertung', mixedLabel: 'Gemischte Bewertung', copyBtn: 'Kopieren', copiedBtn: 'Kopiert!', repliesHeading: 'Antwortoptionen' , licenseGateTitle: 'Zugangscode eingeben', licensePh: 'Zugangscode', unlockBtn: 'Entsperren', licenseInvalid: 'Ungültiger oder inaktiver Code', photoLabel: 'Foto anhängen (optional)', uploadPhoto: 'Foto hochladen', changePhoto: 'Foto ändern', emojiToggle: 'Emoji'},
    it: { title: 'ReviewReply AI', subtitle: "Incolla una recensione e ottieni risposte pronte in pochi secondi.", businessLabel: 'Nome attività', businessPh: 'Es: Caffetteria Mattino', reviewLabel: 'Incolla la recensione del cliente', reviewPh: 'Es: Caffè ottimo ma servizio lento il sabato...', toneLabel: 'Tono della risposta', toneWarm: 'Caloroso', toneProfessional: 'Professionale', toneBrief: 'Breve', languageLabel: 'Lingua della risposta', generateBtn: 'Genera risposte', generatingBtn: 'Scrittura in corso...', fillError: "Inserisci nome attività e recensione.", genError: 'Generazione non riuscita. Riprova.', positiveLabel: 'Recensione positiva', negativeLabel: 'Recensione negativa', mixedLabel: 'Recensione mista', copyBtn: 'Copia', copiedBtn: 'Copiato!', repliesHeading: 'Opzioni di risposta' , licenseGateTitle: 'Inserisci il codice di accesso', licensePh: 'Codice di accesso', unlockBtn: 'Sblocca', licenseInvalid: 'Codice non valido o inattivo', photoLabel: 'Allega una foto (facoltativo)', uploadPhoto: 'Carica foto', changePhoto: 'Cambia foto', emojiToggle: 'Emoji'},
    pt: { title: 'ReviewReply AI', subtitle: 'Cole uma avaliação e receba respostas prontas em segundos.', businessLabel: 'Nome do negócio', businessPh: 'Ex: Cafeteria Manhã', reviewLabel: 'Cole a avaliação do cliente', reviewPh: 'Ex: Adorei o café mas o atendimento foi lento no sábado...', toneLabel: 'Tom da resposta', toneWarm: 'Caloroso', toneProfessional: 'Profissional', toneBrief: 'Curto', languageLabel: 'Idioma da resposta', generateBtn: 'Gerar respostas', generatingBtn: 'Escrevendo...', fillError: 'Preencha o nome do negócio e a avaliação.', genError: 'Não foi possível gerar. Tente novamente.', positiveLabel: 'Avaliação positiva', negativeLabel: 'Avaliação negativa', mixedLabel: 'Avaliação mista', copyBtn: 'Copiar', copiedBtn: 'Copiado!', repliesHeading: 'Opções de resposta' , licenseGateTitle: 'Insira seu código de acesso', licensePh: 'Código de acesso', unlockBtn: 'Desbloquear', licenseInvalid: 'Código inválido ou inativo', photoLabel: 'Anexar foto (opcional)', uploadPhoto: 'Carregar foto', changePhoto: 'Alterar foto', emojiToggle: 'Emoji'},
    tr: { title: 'ReviewReply AI', subtitle: 'Bir müşteri yorumu yapıştırın, saniyeler içinde yanıt seçenekleri alın.', businessLabel: 'İşletme adı', businessPh: 'Örn: Sabah Kahve Dükkanı', reviewLabel: 'Müşteri yorumunu yapıştırın', reviewPh: 'Örn: Kahve harikaydı ama cumartesi hizmet yavaştı...', toneLabel: 'Yanıt tonu', toneWarm: 'Samimi', toneProfessional: 'Profesyonel', toneBrief: 'Kısa', languageLabel: 'Yanıt dili', generateBtn: 'Yanıtları oluştur', generatingBtn: 'Yazılıyor...', fillError: 'İşletme adını ve yorumu girin.', genError: 'Oluşturulamadı. Tekrar deneyin.', positiveLabel: 'Olumlu yorum', negativeLabel: 'Olumsuz yorum', mixedLabel: 'Karışık yorum', copyBtn: 'Kopyala', copiedBtn: 'Kopyalandı!', repliesHeading: 'Yanıt seçenekleri' , licenseGateTitle: 'Erişim kodunuzu girin', licensePh: 'Erişim kodu', unlockBtn: 'Kilidi aç', licenseInvalid: 'Geçersiz veya etkin olmayan kod', photoLabel: 'Fotoğraf ekle (isteğe bağlı)', uploadPhoto: 'Fotoğraf yükle', changePhoto: 'Fotoğrafı değiştir', emojiToggle: 'Emoji'},
    zh: { title: 'ReviewReply AI', subtitle: '粘贴任意客户评价，几秒内获得回复建议。', businessLabel: '企业名称', businessPh: '例如：晨光咖啡馆', reviewLabel: '粘贴客户评价', reviewPh: '例如：咖啡很棒，但周六服务较慢……', toneLabel: '回复语气', toneWarm: '亲切', toneProfessional: '专业', toneBrief: '简短', languageLabel: '回复语言', generateBtn: '生成回复', generatingBtn: '生成中...', fillError: '请填写企业名称并粘贴评价。', genError: '生成失败，请重试。', positiveLabel: '正面评价', negativeLabel: '负面评价', mixedLabel: '中性评价', copyBtn: '复制', copiedBtn: '已复制！', repliesHeading: '回复选项' , licenseGateTitle: '输入访问码', licensePh: '访问码', unlockBtn: '解锁', licenseInvalid: '无效或未激活的代码', photoLabel: '附加照片（可选）', uploadPhoto: '上传照片', changePhoto: '更换照片', emojiToggle: '表情符号'},
    hi: { title: 'ReviewReply AI', subtitle: 'कोई भी ग्राहक समीक्षा पेस्ट करें, सेकंडों में जवाब पाएं।', businessLabel: 'व्यवसाय का नाम', businessPh: 'उदा: मॉर्निंग कॉफी शॉप', reviewLabel: 'ग्राहक की समीक्षा पेस्ट करें', reviewPh: 'उदा: कॉफी बढ़िया थी लेकिन शनिवार को सेवा धीमी थी...', toneLabel: 'जवाब का लहजा', toneWarm: 'आत्मीय', toneProfessional: 'व्यावसायिक', toneBrief: 'संक्षिप्त', languageLabel: 'जवाब की भाषा', generateBtn: 'जवाब बनाएं', generatingBtn: 'लिखा जा रहा है...', fillError: 'व्यवसाय का नाम और समीक्षा भरें।', genError: 'जनरेट नहीं हो सका। फिर से प्रयास करें।', positiveLabel: 'सकारात्मक समीक्षा', negativeLabel: 'नकारात्मक समीक्षा', mixedLabel: 'मिश्रित समीक्षा', copyBtn: 'कॉपी करें', copiedBtn: 'कॉपी हो गया!', repliesHeading: 'जवाब विकल्प' , licenseGateTitle: 'अपना एक्सेस कोड डालें', licensePh: 'एक्सेस कोड', unlockBtn: 'अनलॉक करें', licenseInvalid: 'अमान्य या निष्क्रिय कोड', photoLabel: 'फोटो जोड़ें (वैकल्पिक)', uploadPhoto: 'फोटो अपलोड करें', changePhoto: 'फोटो बदलें', emojiToggle: 'इमोजी'},
    ja: { title: 'ReviewReply AI', subtitle: 'お客様のレビューを貼り付けるだけで、数秒で返信案が届きます。', businessLabel: 'ビジネス名', businessPh: '例：モーニングコーヒーショップ', reviewLabel: 'お客様のレビューを貼り付け', reviewPh: '例：コーヒーは最高でしたが、土曜日のサービスが遅かったです…', toneLabel: '返信のトーン', toneWarm: '温かい', toneProfessional: 'プロフェッショナル', toneBrief: '簡潔', languageLabel: '返信言語', generateBtn: '返信を生成', generatingBtn: '作成中...', fillError: 'ビジネス名とレビューを入力してください。', genError: '生成できませんでした。もう一度お試しください。', positiveLabel: '好意的なレビュー', negativeLabel: '否定的なレビュー', mixedLabel: '中立的なレビュー', copyBtn: 'コピー', copiedBtn: 'コピーしました！', repliesHeading: '返信オプション' , licenseGateTitle: 'アクセスコードを入力', licensePh: 'アクセスコード', unlockBtn: '解除', licenseInvalid: '無効または無効化されたコード', photoLabel: '写真を添付（任意）', uploadPhoto: '写真をアップロード', changePhoto: '写真を変更', emojiToggle: '絵文字'},
    sv: { title: 'ReviewReply AI', subtitle: 'Klistra in en recension, få genomtänkta svar på sekunder.', businessLabel: 'Företagsnamn', businessPh: 'T.ex: Morgon Kaffehus', reviewLabel: 'Klistra in kundens recension', reviewPh: 'T.ex: Älskade kaffet men servicen var långsam på lördagen...', toneLabel: 'Svarston', toneWarm: 'Varm', toneProfessional: 'Professionell', toneBrief: 'Kort', languageLabel: 'Svarsspråk', generateBtn: 'Generera svar', generatingBtn: 'Skriver svar...', fillError: 'Fyll i företagsnamn och recension.', genError: 'Kunde inte generera. Försök igen.', positiveLabel: 'Positiv recension', negativeLabel: 'Negativ recension', mixedLabel: 'Blandad recension', copyBtn: 'Kopiera', copiedBtn: 'Kopierat!', repliesHeading: 'Svarsalternativ' , licenseGateTitle: 'Ange din åtkomstkod', licensePh: 'Åtkomstkod', unlockBtn: 'Lås upp', licenseInvalid: 'Ogiltig eller inaktiv kod', photoLabel: 'Bifoga foto (valfritt)', uploadPhoto: 'Ladda upp foto', changePhoto: 'Byt foto', emojiToggle: 'Emoji'},
    no: { title: 'ReviewReply AI', subtitle: 'Lim inn en anmeldelse, få gjennomtenkte svar på sekunder.', businessLabel: 'Bedriftsnavn', businessPh: 'F.eks: Morgen Kaffebar', reviewLabel: 'Lim inn kundens anmeldelse', reviewPh: 'F.eks: Elsket kaffen men service var treg på lørdag...', toneLabel: 'Svartone', toneWarm: 'Varm', toneProfessional: 'Profesjonell', toneBrief: 'Kort', languageLabel: 'Svarspråk', generateBtn: 'Generer svar', generatingBtn: 'Skriver svar...', fillError: 'Fyll inn bedriftsnavn og anmeldelse.', genError: 'Kunne ikke generere. Prøv igjen.', positiveLabel: 'Positiv anmeldelse', negativeLabel: 'Negativ anmeldelse', mixedLabel: 'Blandet anmeldelse', copyBtn: 'Kopier', copiedBtn: 'Kopiert!', repliesHeading: 'Svaralternativer' , licenseGateTitle: 'Angi tilgangskoden din', licensePh: 'Tilgangskode', unlockBtn: 'Lås opp', licenseInvalid: 'Ugyldig eller inaktiv kode', photoLabel: 'Legg ved bilde (valgfritt)', uploadPhoto: 'Last opp bilde', changePhoto: 'Bytt bilde', emojiToggle: 'Emoji'},
    da: { title: 'ReviewReply AI', subtitle: 'Indsæt en anmeldelse, få gennemtænkte svar på sekunder.', businessLabel: 'Virksomhedsnavn', businessPh: 'F.eks: Morgen Kaffebar', reviewLabel: 'Indsæt kundens anmeldelse', reviewPh: 'F.eks: Elskede kaffen men service var langsom lørdag...', toneLabel: 'Svartone', toneWarm: 'Varm', toneProfessional: 'Professionel', toneBrief: 'Kort', languageLabel: 'Svarsprog', generateBtn: 'Generer svar', generatingBtn: 'Skriver svar...', fillError: 'Udfyld virksomhedsnavn og anmeldelse.', genError: 'Kunne ikke generere. Prøv igen.', positiveLabel: 'Positiv anmeldelse', negativeLabel: 'Negativ anmeldelse', mixedLabel: 'Blandet anmeldelse', copyBtn: 'Kopier', copiedBtn: 'Kopieret!', repliesHeading: 'Svarmuligheder' , licenseGateTitle: 'Indtast din adgangskode', licensePh: 'Adgangskode', unlockBtn: 'Lås op', licenseInvalid: 'Ugyldig eller inaktiv kode', photoLabel: 'Vedhæft foto (valgfrit)', uploadPhoto: 'Upload foto', changePhoto: 'Skift foto', emojiToggle: 'Emoji'},
    fi: { title: 'ReviewReply AI', subtitle: 'Liitä asiakasarvostelu, saat harkittuja vastauksia sekunneissa.', businessLabel: 'Yrityksen nimi', businessPh: 'Esim: Aamu Kahvila', reviewLabel: 'Liitä asiakkaan arvostelu', reviewPh: 'Esim: Kahvi oli mahtavaa mutta palvelu hidasta lauantaina...', toneLabel: 'Vastauksen sävy', toneWarm: 'Lämmin', toneProfessional: 'Ammattimainen', toneBrief: 'Lyhyt', languageLabel: 'Vastauksen kieli', generateBtn: 'Luo vastaukset', generatingBtn: 'Kirjoitetaan...', fillError: 'Täytä yrityksen nimi ja arvostelu.', genError: 'Luonti epäonnistui. Yritä uudelleen.', positiveLabel: 'Myönteinen arvostelu', negativeLabel: 'Kielteinen arvostelu', mixedLabel: 'Sekalainen arvostelu', copyBtn: 'Kopioi', copiedBtn: 'Kopioitu!', repliesHeading: 'Vastausvaihtoehdot' , licenseGateTitle: 'Anna käyttöoikeuskoodisi', licensePh: 'Käyttöoikeuskoodi', unlockBtn: 'Avaa lukitus', licenseInvalid: 'Virheellinen tai passiivinen koodi', photoLabel: 'Liitä kuva (valinnainen)', uploadPhoto: 'Lataa kuva', changePhoto: 'Vaihda kuva', emojiToggle: 'Emoji'},
    uk: { title: 'ReviewReply AI', subtitle: 'Вставте відгук клієнта — отримайте варіанти відповіді за секунди.', businessLabel: 'Назва бізнесу', businessPh: 'Наприклад: кавʼярня «Ранок»', reviewLabel: 'Вставте відгук клієнта', reviewPh: 'Наприклад: кава чудова, але обслуговування в суботу було повільним...', toneLabel: 'Тон відповіді', toneWarm: 'Теплий', toneProfessional: 'Діловий', toneBrief: 'Короткий', languageLabel: 'Мова відповіді', generateBtn: 'Згенерувати відповіді', generatingBtn: 'Пишу відповіді...', fillError: 'Заповніть назву бізнесу і вставте відгук.', genError: 'Не вдалося згенерувати. Спробуйте ще раз.', positiveLabel: 'Позитивний відгук', negativeLabel: 'Негативний відгук', mixedLabel: 'Змішаний відгук', copyBtn: 'Копіювати', copiedBtn: 'Скопійовано!', repliesHeading: 'Варіанти відповіді' , licenseGateTitle: 'Введіть код доступу', licensePh: 'Код доступу', unlockBtn: 'Розблокувати', licenseInvalid: 'Невірний або неактивний код', photoLabel: 'Додати фото (необовʼязково)', uploadPhoto: 'Завантажити фото', changePhoto: 'Змінити фото', emojiToggle: 'Емодзі'},
    be: { title: 'ReviewReply AI', subtitle: 'Устаўце водгук кліента — атрымайце варыянты адказу за секунды.', businessLabel: 'Назва бізнесу', businessPh: 'Напрыклад: кавярня «Раніца»', reviewLabel: 'Устаўце водгук кліента', reviewPh: 'Напрыклад: кава выдатная, але абслугоўванне ў суботу было павольным...', toneLabel: 'Тон адказу', toneWarm: 'Цёплы', toneProfessional: 'Дзелавы', toneBrief: 'Кароткі', languageLabel: 'Мова адказу', generateBtn: 'Згенераваць адказы', generatingBtn: 'Пішу адказы...', fillError: 'Запоўніце назву бізнесу і ўстаўце водгук.', genError: 'Не атрымалася згенераваць. Паспрабуйце яшчэ раз.', positiveLabel: 'Станоўчы водгук', negativeLabel: 'Адмоўны водгук', mixedLabel: 'Змешаны водгук', copyBtn: 'Капіяваць', copiedBtn: 'Скапіявана!', repliesHeading: 'Варыянты адказу' , licenseGateTitle: 'Увядзіце код доступу', licensePh: 'Код доступу', unlockBtn: 'Разблакаваць', licenseInvalid: 'Няправільны або неактыўны код', photoLabel: 'Дадаць фота (неабавязкова)', uploadPhoto: 'Загрузіць фота', changePhoto: 'Змяніць фота', emojiToggle: 'Эмодзі'},
    el: { title: 'ReviewReply AI', subtitle: 'Επικολλήστε μια κριτική πελάτη και λάβετε απαντήσεις σε δευτερόλεπτα.', businessLabel: 'Όνομα επιχείρησης', businessPh: 'Π.χ. Καφετέρια Πρωί', reviewLabel: 'Επικολλήστε την κριτική του πελάτη', reviewPh: 'Π.χ. Λάτρεψα τον καφέ αλλά η εξυπηρέτηση ήταν αργή το Σάββατο...', toneLabel: 'Τόνος απάντησης', toneWarm: 'Θερμός', toneProfessional: 'Επαγγελματικός', toneBrief: 'Σύντομος', languageLabel: 'Γλώσσα απάντησης', generateBtn: 'Δημιουργία απαντήσεων', generatingBtn: 'Σύνταξη απαντήσεων...', fillError: 'Συμπληρώστε το όνομα της επιχείρησης και την κριτική.', genError: 'Αποτυχία δημιουργίας. Δοκιμάστε ξανά.', positiveLabel: 'Θετική κριτική', negativeLabel: 'Αρνητική κριτική', mixedLabel: 'Μικτή κριτική', copyBtn: 'Αντιγραφή', copiedBtn: 'Αντιγράφηκε!', repliesHeading: 'Επιλογές απάντησης' , licenseGateTitle: 'Εισαγάγετε τον κωδικό πρόσβασης', licensePh: 'Κωδικός πρόσβασης', unlockBtn: 'Ξεκλείδωμα', licenseInvalid: 'Μη έγκυρος ή ανενεργός κωδικός', photoLabel: 'Επισύναψη φωτογραφίας (προαιρετικό)', uploadPhoto: 'Μεταφόρτωση φωτογραφίας', changePhoto: 'Αλλαγή φωτογραφίας', emojiToggle: 'Emoji'},
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
    setError('');
    setLoading(true);
    setResult(null);
    setCopiedIdx(null);

    const toneInstruction = {
      warm: 'Write in a warm, personal, genuinely appreciative tone.',
      professional: 'Write in a polished, professional, business-appropriate tone.',
      brief: 'Write a short, simple, natural-sounding reply -- 1-2 sentences max.',
    }[tone];

    const emojiInstruction = includeEmoji
      ? 'Include one relevant emoji per reply, used naturally, not excessively.'
      : 'Do not use any emojis.';

    const photoInstruction = photo
      ? 'A photo was attached to this review. Look at it carefully and reference something specific and true about what you actually see in the photo, if it adds something genuine to the reply -- do not force it if it does not fit naturally.'
      : '';

    const promptText = `You are helping a small business owner named "${businessName}" reply to a customer review. Here is the review:

"${reviewText}"

${toneInstruction} ${emojiInstruction} Write the reply in ${currentLang.englishName}. ${photoInstruction}

Read the review carefully and reference specific details the customer actually mentioned (a product name, a staff member, a specific issue or compliment) instead of generic phrases like "thank you for your feedback." Be precise, not generic.

If the review is positive, thank the customer specifically for what they mentioned, and invite them back naturally. If the review is negative or mixed, acknowledge their specific concern without being defensive, briefly explain or apologize where appropriate, and offer a concrete next step (e.g. contact directly to resolve it) -- never argue or make excuses.

Write 3 different reply options, varying in phrasing and structure (not just synonyms of the same sentence).

Respond ONLY with valid JSON, no markdown, no code fences, in this exact shape:
{"sentiment": "positive" or "negative" or "mixed", "replies": ["reply option 1", "reply option 2", "reply option 3"]}`;

    let content = promptText;
    if (photo) {
      content = [
        { type: 'image', source: { type: 'base64', media_type: photo.mediaType, data: photo.base64 } },
        { type: 'text', text: promptText }
      ];
    }

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseCode, content })
      });

      if (response.status === 403) {
        throw new Error('license');
      }

      const data = await response.json();
      const text = data.content.map(b => b.text || '').join('');
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
    } catch (err) {
      if (err.message === 'license') {
        setUnlocked(false);
        setLicenseError(t.licenseInvalid);
      } else {
        setError(t.genError);
      }
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setPhoto({ preview: reader.result, base64, mediaType: file.type });
    };
    reader.readAsDataURL(file);
  }

  function handleUnlock() {
    if (!licenseCode.trim()) return;
    setLicenseError('');
    setUnlocked(true);
  }

  function handleCopy(replyText, idx) {
    navigator.clipboard.writeText(replyText).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }

  const sentimentStyles = {
    positive: { bg: '#EAF3EC', text: '#3D6B4A', label: t.positiveLabel },
    negative: { bg: '#FBEAE7', text: '#B34B3C', label: t.negativeLabel },
    mixed: { bg: '#FBF2E3', text: '#A56A45', label: t.mixedLabel },
  };

  const bodyFont = currentLang.rtl ? "'Cairo', sans-serif" : 'inherit';

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" dir={currentLang.rtl ? 'rtl' : 'ltr'} style={{ background: '#F5F4EE', fontFamily: bodyFont }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Cairo:wght@400;700&display=swap');`}</style>
        <div className="w-full max-w-sm rounded-xl p-6" style={{ background: '#FFFFFF', border: '1px solid #E4E1D6' }}>
          <div className="flex justify-end mb-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-xs rounded-lg px-2 py-1 focus:outline-none"
              style={{ background: '#FAF9F4', border: '1px solid #E4E1D6', color: '#6B6659' }}
            >
              {languages.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <h1
            className="text-2xl mb-4"
            style={{ fontFamily: currentLang.rtl ? "'Cairo', sans-serif" : "'Fraunces', serif", fontWeight: 600, color: '#2D2A26' }}
          >
            {t.licenseGateTitle}
          </h1>
          <input
            type="text"
            value={licenseCode}
            onChange={(e) => setLicenseCode(e.target.value)}
            placeholder={t.licensePh}
            className="w-full rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none"
            style={{ background: '#FAF9F4', border: '1px solid #E4E1D6', color: '#2D2A26' }}
          />
          {licenseError && <p className="text-sm mb-3" style={{ color: '#B34B3C' }}>{licenseError}</p>}
          <button
            onClick={handleUnlock}
            className="w-full font-medium py-2.5 rounded-lg text-sm"
            style={{ background: '#D97757', color: '#FFFFFF' }}
          >
            {t.unlockBtn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4 relative overflow-hidden" dir={currentLang.rtl ? 'rtl' : 'ltr'} style={{ background: '#F5F4EE', fontFamily: bodyFont }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Cairo:wght@400;700&display=swap');`}</style>

      <div className="absolute rounded-full pointer-events-none" style={{ width: 280, height: 280, background: '#D97757', filter: 'blur(90px)', opacity: 0.10, top: -80, left: -60 }} />
      <div className="absolute rounded-full pointer-events-none" style={{ width: 240, height: 240, background: '#BD5D3A', filter: 'blur(90px)', opacity: 0.10, bottom: -60, right: -40 }} />

      <div className="max-w-xl mx-auto relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h16v11H8l-4 4V4z" stroke="#D97757" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M8 9h2M8 11.5h5" stroke="#D97757" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <h1
              className="text-3xl"
              style={{ fontFamily: currentLang.rtl ? "'Cairo', sans-serif" : "'Fraunces', serif", fontWeight: 600, color: '#2D2A26' }}
            >
              {t.title}
            </h1>
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            style={{ background: '#FFFFFF', border: '1px solid #E4E1D6', color: '#6B6659' }}
          >
            {languages.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <p className="text-sm mb-6" style={{ color: '#87837A' }}>{t.subtitle}</p>

        <div className="rounded-xl p-5 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E4E1D6' }}>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#6B6659' }}>{t.businessLabel}</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t.businessPh}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: '#FAF9F4', border: '1px solid #E4E1D6', color: '#2D2A26' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#6B6659' }}>{t.reviewLabel}</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={t.reviewPh}
              rows={4}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ background: '#FAF9F4', border: '1px solid #E4E1D6', color: '#2D2A26' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#6B6659' }}>{t.toneLabel}</label>
            <div className="flex gap-2">
              {tones.map(tn => (
                <button
                  key={tn.value}
                  onClick={() => setTone(tn.value)}
                  className="flex-1 text-xs py-2 rounded-lg font-medium"
                  style={{
                    background: tone === tn.value ? '#D97757' : '#FAF9F4',
                    color: tone === tn.value ? '#FFFFFF' : '#6B6659',
                    border: '1px solid ' + (tone === tn.value ? '#D97757' : '#E4E1D6'),
                  }}
                >
                  {tn.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#6B6659' }}>{t.photoLabel}</label>
            <label
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer"
              style={{ background: '#FAF9F4', border: '1px dashed #E4E1D6', color: '#87837A' }}
            >
              {photo ? (
                <img src={photo.preview} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <span style={{ width: 32, height: 32, borderRadius: 6, background: '#F1EFE6', flexShrink: 0 }} />
              )}
              <span>{photo ? t.changePhoto : t.uploadPhoto}</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#6B6659' }}>
              <input
                type="checkbox"
                checked={includeEmoji}
                onChange={(e) => setIncludeEmoji(e.target.checked)}
                style={{ accentColor: '#D97757' }}
              />
              {t.emojiToggle}
            </label>
          </div>

          {error && <p className="text-sm" style={{ color: '#B34B3C' }}>{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full font-medium py-2.5 rounded-lg text-sm transition"
            style={{
              background: loading ? '#E4E1D6' : '#D97757',
              color: loading ? '#87837A' : '#FFFFFF',
            }}
          >
            {loading ? t.generatingBtn : t.generateBtn}
          </button>
        </div>

        {result && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{
                  background: sentimentStyles[result.sentiment]?.bg || '#F1EFE6',
                  color: sentimentStyles[result.sentiment]?.text || '#6B6659',
                }}
              >
                {sentimentStyles[result.sentiment]?.label || result.sentiment}
              </span>
            </div>
            <h2 className="text-sm font-semibold mb-2" style={{ color: '#D97757' }}>{t.repliesHeading}</h2>
            <div className="space-y-2">
              {result.replies.map((reply, idx) => (
                <div key={idx} className="rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E4E1D6' }}>
                  <p className="text-sm leading-relaxed mb-3" style={{ color: '#2D2A26' }}>{reply}</p>
                  <button
                    onClick={() => handleCopy(reply, idx)}
                    className="text-xs font-medium"
                    style={{ color: copiedIdx === idx ? '#3D6B4A' : '#A56A45' }}
                  >
                    {copiedIdx === idx ? t.copiedBtn : t.copyBtn}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mt-10 pt-6" style={{ borderTop: '1px solid #E4E1D6' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#87837A" strokeWidth="1.5">
            <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" />
          </svg>
          <span className="text-xs" style={{ color: '#87837A' }}>Powered by Claude &middot; Plainwork by Ksenia</span>
        </div>
      </div>
    </div>
  );
}
