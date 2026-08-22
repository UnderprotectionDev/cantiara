# 01 — GitHub ile giriş, Hesap ve tek Çalışma Alanı

**What to build:** Kurucu yalnız `Continue with GitHub` ile girer. Değişmez GitHub kullanıcı kimliği Hesaba bağlanır; ilk başarıda tek Çalışma Alanı oluşur ve kurucu o sınıra alınır. Aynı kimlikle sonraki giriş aynı çifti yeniden kullanır. E-posta/şifre ve sihirli bağlantı yoktur. Giriş repository yetkisi, App kurulumu veya issue yazma açmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] GitHub login OAuth, Better Auth üzerinden tek Hesap oluşturma ve giriş yoludur; e-posta/şifre ve başka sağlayıcı kapalıdır.
- [ ] İlk başarılı callback Hesap ile tek Çalışma Alanını birlikte oluşturur; aynı değişmez GitHub kullanıcı kimliği mevcut çifti yeniden kullanır ve ikinci Çalışma Alanı üretmez.
- [ ] Web oturum çerezi `Secure`, `HttpOnly` ve `SameSite=Lax` olur; oturum veya GitHub token'ı URL'ye yazılmaz.
- [ ] Giriş başlatma ve callback IP ile Hesap kimliği kapsamında hız sınırlıdır; başarısız yanıt Hesap veya Çalışma Alanı varlığını açıklamaz.
- [ ] Login OAuth yalnız kimlik bağlamak için gereken kapsamı ister; repository/App izinleri istemez ve App installation oturum geçerliliğine karışmaz.
- [ ] İngilizce UI `Continue with GitHub` ve `Sign Out` kullanır; eksik etiketler PRD terim sözlüğüne aynı değişiklikle eklenir. Locale/tercih yüzeyi açılmaz.
- [ ] Kabul kanıtı Account Access seam'inde GitHub test double ile: ilk giriş, tekrar giriş, e-posta/şifre yokluğu, kapsam karşıtı, varlığı sızdırmayan hata. Sentetik fixture, [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
