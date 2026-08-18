# Yalın Prototip Doğrulama Sözleşmesi

Bu dosyayı üç alternatif uygulandıktan sonra tamamen oku. Kontrolleri aşağıdaki
sırayla yürüt; sonraki kontrol öncekinin kanıtı değildir.

## İçindekiler

- [Zorunlu Akış](#zorunlu-akış)
- [`verification.md` Çıktısı](#verificationmd-çıktısı)
- [Sonuç Kapısı](#sonuç-kapısı)

## Zorunlu Akış

1. Tarayıcı doğrulamasından önce yapısal draft coverage üret:

   ```bash
   node <skill-root>/scripts/validate-coverage.mjs \
     <prototype-root>/requirements.json \
     --stage draft \
     --write <prototype-root>/coverage.md
   ```

2. Proje kökünde `npm run build` çalıştır.
3. Production build'i yerel preview ile açık tut. Tam komut ve URL'yi kaydet.
4. Tarayıcı viewport'unu `1440x1024` yap ve `/`, `/alternative-a`,
   `/alternative-b`, `/alternative-c` rotalarını ayrı ayrı aç.
5. Kaynak destekli ana kullanıcı akışlarını üç yönde de dene. Her rotada
   engelleyici runtime ve console hatalarını kontrol et.
6. Her alternatif için gerçek render screenshot'ı kaydet:
   - `evidence/alternative-a.png`
   - `evidence/alternative-b.png`
   - `evidence/alternative-c.png`
7. A↔B, A↔C ve B↔C çiftlerinin her birinde render edilmiş yüzeylerden:
   - bilgi mimarisi, gezinme, görev akışı veya etkileşim modelinde en az bir
     yapısal fark;
   - layout, hiyerarşi, yoğunluk veya başka seçili eksende ikinci bir yüksek
     etkili fark gözle.
8. Bir çift yalnız tema, renk, font, radius veya kart stiliyle ayrışıyorsa ilgili
   yönleri revize et ve bütün etkilenen kanıtları yeniden üret. Ayrışma
   doğrulanamıyorsa sonucu `blocked` yap.
9. `kind: visual` gereksinimleri varsa açık bağlayıcı marka ve tasarım sistemi
   kurallarını her rotada kontrol et. Kaynak ayrıca bağlayıcı ilan etmedikçe örnek
   layoutu piksel hassasiyetinde eşleşme şartı yapma.
10. Görünür gereksinimlerin `alternatives.*.verification` alanlarını gözlenen
    sonuca göre `passed` veya `blocked` yap.
11. Rotalar, akışlar, console, üç screenshot, bütün çift ayrışmaları ve bağlayıcı
    görsel kurallar geçtiyse final coverage üret:

    ```bash
    node <skill-root>/scripts/validate-coverage.mjs \
      <prototype-root>/requirements.json \
      --stage final \
      --write <prototype-root>/coverage.md
    ```

12. Herhangi bir zorunlu kanıt bloke ise `--stage draft` ile coverage raporunu
    yeniden üret. Final validator'ı geçmiş gibi sunma.
13. Aşağıdaki sözleşmeyle `<prototype-root>/verification.md` yaz. Kanıtlanmayan
    kontrolü geçmiş gösterme ve preview sürecini teslim sırasında açık bırak.

HTTP health, build başarısı veya screenshot dosyasının varlığı tek başına
tarayıcı doğrulaması değildir. Açılmış rota, denenmiş davranış ve gözlenen render
kanıtı gerekir.

## `verification.md` Çıktısı

```markdown
# Verification

- Coverage stage: final | draft
- Coverage validation: passed | blocked
- Production build: passed | blocked
- Viewport: 1440x1024
- Preview command: <exact command>
- Preview URL: <local URL>

## Routes
- `/`: opened | blocked
- `/alternative-a`: opened | blocked
- `/alternative-b`: opened | blocked
- `/alternative-c`: opened | blocked

## Core flows
- <flow>: A passed | blocked; B passed | blocked; C passed | blocked

## Console
- Blocking errors: none | <evidence>

## Screenshots
- A: evidence/alternative-a.png
- B: evidence/alternative-b.png
- C: evidence/alternative-c.png

## Rendered divergence
| Pair | Structural axis and observed difference | Second axis and observed difference | Evidence | Result |
| --- | --- | --- | --- | --- |
| A ↔ B | <axis>: <observed difference> | <axis>: <observed difference> | A and B routes/screenshots | passed \| blocked |
| A ↔ C | ... | ... | A and C routes/screenshots | passed \| blocked |
| B ↔ C | ... | ... | B and C routes/screenshots | passed \| blocked |

## Binding visual constraints
- <visual REQ id>: A passed | blocked; B passed | blocked; C passed | blocked — <observed evidence>
- None, if the sources contain no binding visual requirement.

## Non-visual requirements
- <REQ id>: <prototype dışında kalma gerekçesi>

## Final result
passed | blocked
```

## Sonuç Kapısı

Yalnız final validator sıfır hata ile bittiğinde, build geçtiğinde, dört rota
tarayıcıda açıldığında, ana akışlar üç alternatifte denendiğinde, engelleyici
console hatası kalmadığında, üç screenshot kaydedildiğinde, her alternatif çifti
iki gerekli ayrışmayı gösterdiğinde ve bütün bağlayıcı görsel kurallar geçtiğinde
`Final result: passed` yaz.

`design-directions.md` içindeki taahhüt veya yalnız dosya varlığı gözlenen kanıt
değildir. Prototip kapsamı dışındaki eksiksiz izlenmiş `non-visual` gereksinimler
sonucu tek başına bloke etmez.
