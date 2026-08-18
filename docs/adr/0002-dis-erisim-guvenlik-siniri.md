# Dış erişimi ürün kontrollü ve anında iptal edilebilir tut

## Bağlam

Uzun ömürlü bearer bağlantıları, CDN cache'i ve doğrudan nesne depolama adresleri iptal edilen içeriğin erişilebilir kalmasına yol açabilir. Yalnız cache temizliğine veya gizli URL varsayımına güvenmek yeterli değildir.

## Karar

İlk bağlantı doğrulaması Dış yüzeye bağlı kısa ömürlü `HttpOnly` ziyaretçi oturumuna çevrilir. Sayfa, dosya ve byte-range istekleri ürün kontrollü adreslerden geçerek etkin yüzeyi, oturumu ve onaylı kesin dosya sürümünü cache tesliminden önce yeniden doğrular; ham public R2 veya yeniden kullanılabilir origin/CDN nesne URL'si açıklanmaz. İptal yeni istekleri cache temizliğini beklemeden fail-closed reddeder; stale veya offline erişim penceresi yoktur.

## Sonuçlar

- Her dış istek ek yetkilendirme ve kötüye kullanım sınırı taşır.
- Cache temizliği güvenlik bariyeri değil, artalan hijyen işlemidir.
- Süresi dolmuş bağlantıyı yeniden açma ile yeni kitle için yeni bağlantı üretme ayrılır; açık iptal edilen token yeniden kullanılamaz.

## İlgili belgeler

- [Paylaşım sözleşmesi](../prd/14-sharing-and-public-publishing.md)
- [Veri güvenliği ve taşınabilirlik](../prd/13-data-security-and-portability.md)
