# 01 — İzin bağlamı kapıları

**What to build:** Kullanıcı Araştırması Oturumu amaç, rehber, isteğe bağlı zaman ve izin bağlamını taşır. `Not allowed` atfedilen ifadeyi, tanımlayıcı kişisel notu, Dosya Ekini ve paylaşım/yayını kapatır. Sonradan genişleyen paylaşım eski izinsiz içeriği, konuşmacı etiketi, sayı veya ilişki ipucuyla açmaz. İzin hukuki uygunluk hükmü değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Oturum Proje ana kaydıdır; `Planned` / `Completed` / `Cancelled` takvim daveti veya CRM aşaması değildir. İngilizce `Research Session`, `Not asked`, `Allowed`, `Not allowed`, `Not applicable`.
- [ ] Bilinen katılımcı mevcut Contact’a bağlanabilir; bilinmeyen görüşme Contact zorlamaz.
- [ ] Dört Consent değeri kapıyı şöyle bağlar (workflow: izin yoksa kapılar kapanır; PRD 09 `Not allowed` yazma/paylaşım kapanışını yazar). `Not asked` ve `Not allowed`: katılımcıya atfedilen özgün ifade, tanımlayıcı kişisel not, Dosya Eki ve share/publish yazılamaz; convert aynı kapıyı kullanır. `Allowed` ve `Not applicable`: bu kapılar açık kalır (convert hâlâ önizleme ister). Sonradan `Allowed` veya daha geniş paylaşım, kapalıyken yazılamamış içeriği konuşmacı etiketi, sayı veya ilişki ipucuyla açmaz.
- [ ] Yeni snapshot veya genişleyen paylaşım eski izinsiz içeriği sızdırmaz (ADR-0001/0002 kapalı dünya).
- [ ] Kişisel veri export/silme UI’si 81’dedir; bu ticket izin kapısını sağlar. [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) `Kişisel veri` fixture’ı.
