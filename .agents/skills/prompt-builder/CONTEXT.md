# Prompt Builder Package Context

Bu dosya yalnız paket değişikliklerini sınıflandıran bakım notudur; runtime
sırasında okunmaz. Runtime davranışının otoritesi `SKILL.md` ile onun koşullu
olarak bağladığı runtime referanslarıdır. Regresyon verileri, araçlar ve platform
metadata'sı bu sözleşmeyi doğrular veya sunar; yeniden tanımlamaz.

Platformdaki implicit invocation ayarı, `SKILL.md` frontmatter'ındaki çağrı
politikasıyla aynı kalmalıdır.

## Değişiklik Sınıfları

**Yapısal sadeleştirme**, aynı davranışı tek kaynağa taşır, tekrarları siler veya
referans koşulunu görünür kılar. Beklenen model davranışı değişmiyorsa yeni vaka
gerektirmez; paket sözleşmesi testiyle korunabilir.

**Davranış değişikliği**, çağrı, ayıklama, kapsam, sözleşme okuma, mod, prompt
içeriği veya çıktı biçimindeki beklenen sonucu değiştirir. İlgili
`regression-cases.json` vakasını ekle ya da güncelle; denetleyici özelliği değişirse
birim testini de güncelle.
