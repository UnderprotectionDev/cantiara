# Dış Yüzey ve Snapshot Güvenliği

Paylaşım ve yayın yalnız kullanıcının gözden geçirip onayladığı kapalı dünya snapshotını gösterir. İptal, redaksiyon ve asset erişimi cache sonucundan önce fail-closed doğrulanır.

Dışarı çıkan içerik sürpriz yapmaz. Önizlenen küme ile onaylı revizyon aynıdır; eski cache iptali aşamaz.

Bu feature dış yüzey ve snapshot güvenliğini tamamlar. Bağlantı paylaşımı, wiki yayını ve build in public bu kapıdan geçer; kendi yaşamları ayrıdır.

## Alt Fazlar

### Kapalı dünya önizlemesi

Kapalı dünya önizlemesi dışarı çıkacak kesin kayıt, sürüm, alan ve dosyaları kullanıcıya gösterir. Görünmeyen ilişki sızmaz.

Kurucu onaylamadan yüzey oluşmaz. Önizleme ziyaretçi oturumu değildir.

Küme, evrensel dışa aktarma veya çalışma alanı çıkış paketi değildir. O yüzeyin donmuş içeriğidir.

### Onaylı snapshot revizyonu

Onaylı snapshot revizyonu değişmez içerik manifestidir. Dış yüzey yalnız bu revizyonu gösterir.

Kurucu yeni revizyon onaylamadan canlı kayıtlar dışarı akmaz. Eski revizyon tarihsel kalır.

Revizyon Git tag veya Dosya Eki sürümü değildir. Dış yüzey sözleşmesidir.

### Anlık dış erişim kapısı

Anlık dış erişim kapısı her HTML ve asset isteğini güncel yüzey durumuna göre kabul veya reddeder. İptal ve redaksiyon cache'den önce gelir.

Ziyaretçi eski bağlantıyla kapanmış içeriği görmez. Varlık sızdıran 404 davranışı kontrollüdür.

Kapı analitik, rate limit ürünü veya WAF panosu değildir. Fail-closed erişimdir.

## Tamamlanma Ölçütleri

- Dışarı çıkacak kesin kayıt, sürüm, alan ve dosyalar kullanıcıya gösterilir.
- Dış yüzey yalnız değişmez ve onaylı içerik manifestini gösterir.
- Her HTML ve asset isteği güncel yüzey durumuna göre güvenle kabul veya reddedilir.

## Kapsam Sınırları

- Canlı kayıtları onaylı snapshot olmadan dışarı açma.
- Cache veya CDN'in iptali ezmesine izin verme.
- Redaksiyonu istemci gizleme sayma.
