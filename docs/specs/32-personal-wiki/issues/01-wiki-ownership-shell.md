# 01 — Wiki sahiplik sınırı ve kabuk

**What to build:** Kişisel Wiki, Projeden ayrı sahiplik kapsamıdır. Kurucu kişisel erişim kabuğundan Proje seçmeden Wiki Belgesi oluşturur. Belge 31’in yeteneklerini Wiki kapsamında kullanır; ikinci belge türü veya editör yoktur. Wiki içeriği Proje gerçeğinin paralel ikinci doğruluk kaynağı, Proje şablonu, İş veya kanonik ürün spec’i olmaz. Bu kabuk Dış yüzey, ziyaretçi HTML veya public slug üretmez. Hiç yayımlanmamış Wiki’nin ziyaretçi URL’si yoktur; canlı Wiki herkese açık kopya değildir. Unpublish `410 Gone` leak-nothing 74’tedir; bu kabuk canlı herkese açık kopya tutmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Wiki belgesi Proje kapsamı almadan oluşur; sahiplik `Personal Wiki` kalır.
- [ ] Kişisel erişim kabuğunda Proje girmeden birinci sınıf hedef olarak açılır.
- [ ] Aynı Documents komutları Wiki kapsamında çalışır; ikinci şema yoktur.
- [ ] Wiki belgesi Proje belgesinin paralel ikinci doğruluk kaynağı veya bütün Projelerde kanonik ürün spec’i olmaz.
- [ ] İngilizce UI `Personal Wiki` kullanır; yayın/unpublish eylemi, Dış yüzey, public slug veya ziyaretçi HTML yoktur.
- [ ] Hiç yayımlanmamış Wiki Belgesinin ziyaretçi URL’si yoktur; bu kabuktan kimliği doğrulanmamış GET gövde, ad veya ek baytı sızdırmaz.
- [ ] 74 unpublish sonrası bu kabuk canlı herkese açık kopya tutmaz ve iptal URL’sini yeniden açmaz; `410 Gone` boş gövde, `noindex` ve özel içeriğe yönlendirmeme 74’ün Dış yüzey sözleşmesidir.
- [ ] Ekip daveti, sayfa rolü veya ortak düzenleme yoktur.
- [ ] Kabul kanıtı Personal Wiki seam’inde Projesiz oluşturma, tür karşıtı ve leak-nothing. Kanıt [Dogfooding](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) wiki kanıtına bağlanır; `410 Gone` [Herkese açık yayın](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunda 74’tedir.
