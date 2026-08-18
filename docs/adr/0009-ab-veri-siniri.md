# Özel verinin otomatik failover'ını AB sınırı içinde tut

## Bağlam

AB bölgesi kesintisinde küresel bir replica kullanılabilirliği artırabilir ancak özel Workspace verisini, yedekleri, logları ve bağlantıyla sınırlı içeriği kullanıcı kararı olmadan söz verilen bölgenin dışına taşır.

## Karar

Özel veri ve onu taşıyan operasyonel kopyalar onaylı AB sınırının dışına otomatik failover yapmaz. AB dışına geçiş ayrı, açık ve önceden planlanmış veri taşıma kararı gerektirir; bölgesel kesinti ilgili hizmette fail-closed yaşanır.

## Sonuçlar

- Veri bölgesi garantisi kullanılabilirlik hedefinden önce gelir.
- AB sağlayıcı kesintisi hizmet göstergesinde gerçek downtime sayılır.
- Bilerek herkese açık onaylı statik içerik, özel bağımlılık açmadan mevcut teslim noktasında kalabilir.

## İlgili belgeler

- [Ürün ve ilk sürüm sözleşmesi](../prd/01-product-vision-and-scope.md)
- [Veri güvenliği ve taşınabilirlik](../prd/13-data-security-and-portability.md)
