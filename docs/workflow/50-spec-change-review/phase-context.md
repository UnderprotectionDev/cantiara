# Spec Değişikliği İnceleme Kuyruğu

Birincil spec'in yeni kesin sürümü, yalnız kayıtlı bağlardan türetilen etkilenme adaylarıyla karşılaştırılır. İnceleme sonucu hedef kaydı veya planı örtük değiştirmez.

Spec değişince neyin etkilenebileceği görünür. Aday bekliyor, gözden geçirildi veya etkilenmedi üstverisiyle ayrı kalır; takip İş ancak açık önizlemeyle doğar.

Bu feature spec değişikliği inceleme kuyruğunu tamamlar. Gelecek yönü olan çürütülen varsayım kuyruğu ve test açıkları burada yoktur.

## Alt Fazlar

### Kesin spec farkı

Kesin spec farkı önceki ve yeni Belge sürümünü değişen bölüm bağlamıyla gösterir. Fark, serbest metin karşılaştırması değil sürüme bağlıdır.

Kurucu neyin değiştiğini bölüm içinde okur. Fark kaydı spec'in yerine geçmez.

Bu alt faz Git diff veya dış review aracı değildir. Ürün içi Belge sürüm farkıdır.

### Aday incelemesi

Aday incelemesi yalnız kayıtlı bağlardan türetilir. Her aday bekliyor, gözden geçirildi veya etkilenmedi üstverisini taşır.

Kurucu adayı tek tek değerlendirir. Toplu "hepsi etkilendi" örtük yazılmaz.

İnceleme üstverisi hedef kaydın durumunu değiştirmez. Yalnız kuyruk değerlendirmesidir.

### Takip İşi

Takip İşi seçilen adaydan tam olarak bir İş olarak önizlemeyle oluşur. Kuyruk satırı kendiliğinden İş olmaz.

Oluşan İş bağımsız kimlik kazanır ve spec sürümüne görünür bağlanır. İnceleme sonucu kapanmaz.

Takip, otomasyon kuralı veya test açığı değildir. Kullanıcının açtığı İştir.

## Tamamlanma Ölçütleri

- Önceki ve yeni Belge sürümü değişen bölüm bağlamıyla gösterilir.
- Her aday bekliyor, gözden geçirildi veya etkilenmedi üstverisiyle ayrı değerlendirilir.
- Seçilen adaydan tam olarak bir İş önizlemeyle oluşturulur; inceleme sonucu kendiliğinden kapanmaz.

## Kapsam Sınırları

- İnceleme sonucunu hedef İşe, plana veya sürüme otomatik yazma.
- Kayıtsız tahminle aday üretme.
- Çürütülen Varsayım incelemesini bu kuyruk sayma.
