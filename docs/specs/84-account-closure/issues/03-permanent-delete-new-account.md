# 03 — Kalıcı silme (78), yeni Hesap kimliği, AB'ye kadar kalış

**What to build:** Süre sonunda Hesap ve Çalışma Alanı 78'in redaksiyon ve silme sözleşmesiyle kaldırılır; geri dönüş yoktur. 82 başarı bayrağı yoksa silme çalışmaz. Dış yüzeyler ve oturumlar kapalı kalır. Yedekte kalan kopyalar 85 replay kurallarına bağlıdır; bu ticket olay/tombstone üretir. Aynı kararlı GitHub kullanıcı kimliği daha sonra açıkça yeni ve farklı kimlikli Hesap + Çalışma Alanı oluşturabilir (01 first-sign-in); eski çift dirilmez. Kalıcı silmeye kadar üretim ve özel içerik AB bölgesinde kalır.

**Blocked by:** 02 — 30 günlük dondurma, iptal grant'i, 82 çıkış paketi

**Status:** ready-for-agent

- [ ] Kalıcı silme 78 apply + silme sözleşmesini çağırır; kopya redaksiyon motoru yoktur. 82 başarı yoksa iş çalışmaz. 30 gün dolmadan silme çalışmaz; erken Hesap kalıcı silme yolu yoktur.
- [ ] Silme sonrası eski Hesap kimliğiyle oturum, yüzey veya workspace yazması yetkisizdir.
- [ ] Aynı GitHub id ile sonraki ilk giriş yeni Hesap/Çalışma Alanı kimliği üretir; silinen çifti diriltmez.
- [ ] Account-delete tombstone içeriksiz takma kimlikle irreversible loga yazılır (85 pencere + 30 gün). Paket indirme bölge taşımaz.
- [ ] Kabul kanıtı silme zaman çizelgesi, 78 çağrısı, 82 kapısı, yeni-Hesap kimliği, diriltmeme. [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) silme dilimi; 85 restore tatbikatı burada yoktur.
