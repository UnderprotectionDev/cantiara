# 01 — İzin bağlamı kapıları

**What to build:** Kullanıcı Araştırması Oturumu amaç, rehber, isteğe bağlı zaman ve izin bağlamını taşır. `Not allowed` atfedilen ifadeyi, tanımlayıcı kişisel notu, Dosya Ekini ve paylaşım/yayını kapatır. Sonradan genişleyen paylaşım eski izinsiz içeriği, konuşmacı etiketi, sayı veya ilişki ipucuyla açmaz. İzin hukuki uygunluk hükmü değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Oturum Proje ana kaydıdır; `Planned` / `Completed` / `Cancelled` takvim daveti veya CRM aşaması değildir. İngilizce `Research Session`, `Not asked`, `Allowed`, `Not allowed`, `Not applicable`.
- [ ] Bilinen katılımcı mevcut Contact’a bağlanabilir; bilinmeyen görüşme Contact zorlamaz.
- [ ] `Not allowed` iken atıf, tanımlayıcı not, dosya ve share/publish yazılamaz.
- [ ] Yeni snapshot veya genişleyen paylaşım eski izinsiz içeriği sızdırmaz (ADR-0001/0002 kapalı dünya).
- [ ] Kişisel veri export/silme UI’si 81’dedir; bu ticket izin kapısını sağlar. [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) `Kişisel veri` fixture’ı.
