# 02 — 30 günlük dondurma, iptal grant'i, 82 çıkış paketi

**What to build:** `Closing` bitince sabit güvenlik olay sınırındaki veri kümesiyle 30 günlük Hesap kapanma dondurması başlar ve export açılır. Kurucu grant tüketerek kapatmayı iptal edebilir veya 82 `Workspace Exit Package` ile 79 seçili bağlantılarını alır. Dondurma paketi üretir ve 30 gün indirilebilir tutar. Kalıcı silme en az bir başarılı 82 üretiminden önce ilerlemez. Unutulan parola okunamazlık sınırı kapanışta açık yazılır. Yeni kullanıcı redaksiyonu için önce iptal gerekir; erişimi kapalı tutan güvenlik uygulaması ve restore replay yükümlülüğü devam eder.

**Blocked by:** 01 — Close Account: grant, yazılan ad, Kapanış tamamlanıyor

**Status:** ready-for-agent

- [ ] Dondurma yeni kurucu yazmalarını (iptal ve dondurulmuş export hariç) reddeder; dış erişim kapalı kalır.
- [ ] İptal 30 günlük dondurma boyunca açıktır; süre ürün sabiti 30 gündür, kullanıcı seçimi değildir (phase-context “kullanıcı tanımlı süre” karşıtı). İptal ayrı işlem kimliğiyle Account Access grant'i ister; başarı Hesabı yaşayan duruma döndürür.
- [ ] 82 üretimi zorunlu kapıdır; başarı yokken kalıcı silme zamanlayıcısı silmez. Paket 30 gün indirilir; restore vaadi yoktur.
- [ ] 79 seçili export dondurulan kümede kullanılabilir; kişi paketi (81) çıkış arşivi sayılmaz. PRD 13'teki "seçili Markdown/JSON/CSV export durur" cümlesi uygulanmaz; [Hesap kapatma](../../../prd/03-account-platform-operations.md#hesap-kapatma) export'u açık tutar.
- [ ] Yeni kullanıcı kaynaklı güvenlik redaksiyonu için önce kapatma iptal edilir; dış erişimi kapalı tutan güvenlik uygulaması (yüzey/oturum iptali) ve restore replay yükümlülüğü dondurmada devam eder.
- [ ] AB yerleşimi paket indirmeyle değişmez.
- [ ] Kabul kanıtı dondurma, iptal grant'i, 82 başarı kapısı, parola kaybı metni, 81/83 karışmama. [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) paket şartı.
