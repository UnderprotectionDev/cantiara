# Kararlar

Kurucu Kararları gerekçesi ve ilişkileriyle kaydeder. Yerine geçirme zinciri atomik, döngüsüz ve tarihsel olarak okunabilir kalır.

Güncel karar ile tarihsel gerekçe karışmaz. Arama ve dış görünürlük yerine geçmiş kararı güncelmiş gibi göstermez.

Bu feature kararları tamamlar. Risk, varsayım ve spec inceleme kuyruğu karar zincirini örtük yazmaz.

## Alt Fazlar

### Karar yaşam döngüsü

Karar yaşamı Geçerli, yerine geçilmiş ve geri çekilmiş durumlarıyla yürür. Gerekçe ve ilişkiler kayıttadır.

Kurucu durumu açık eylemle değiştirir. İş kapanması Kararı sessizce geri çekmez.

Karar Risk veya Varsayım değildir. Hüküm kaydıdır.

### Kararın yerine geçirme

Yerine geçirme yeni Kararı öncekinin doğrudan ve tek halefi yapar. İşlem atomiktir; iki güncel Karar bırakmaz.

Kurucu zinciri önizler. Döngü veya çoklu halef reddedilir.

Bu alt faz sürüm etiketi veya Git revert değildir. Karar grafiğidir.

### Karar zinciri

Karar zinciri arama, detay ve dış görünürlükte güncel hükmü tarihsel gerekçeden ayırır. Yerine geçmiş karar silinmez.

Kurucu neden değiştiğini okur. Dış yüzey varsayılanı güncel Karardır.

Zincir değişiklik geçmişi satırları değildir. Karar nesilleridir.

## Tamamlanma Ölçütleri

- Geçerli, yerine geçilmiş ve geri çekilmiş Kararlar açık durumla yönetilir.
- Yeni Karar öncekinin doğrudan ve tek halefi olarak atomik bağlanır.
- Arama, detay ve dış görünürlük güncel Kararla tarihsel gerekçeyi karıştırmaz.

## Kapsam Sınırları

- Kararı toplantı notu veya Belge paragrafı sayma.
- Çoklu halef veya döngülü yerine geçirme.
- Yerine geçmiş kararı güncel gerçek gibi yayınlama.
