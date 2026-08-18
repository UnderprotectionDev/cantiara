---
name: underprotection-upgrade
description: Açık `$underprotection-upgrade` çağrısında UnderprotectionDev/my-skills origin/main kaynak kütüphanesindeki değişmiş skill paketlerini yerel Codex skill kütüphanesinde kaynak sürümle günceller. Manuel çağrı dışında çalıştırma.
---

# Underprotection Upgrade

Bu skill'i yalnız kullanıcı açıkça `$underprotection-upgrade` çağırdığında kullan. Amaç, Underprotection kaynak kütüphanesindeki değişmiş skill paketlerini yerel Codex skill kütüphanesinde kaynak sürümle güncellemektir.

Kaynak otoritesi `https://github.com/UnderprotectionDev/my-skills` reposunun `origin/main` durumudur. Yerel kütüphane varsayılan olarak `~/.codex/skills` dizinidir.

## Required Script

Bu skill'in deterministic işlemleri için bundled script kullan. Değişiklikleri uygulamadan önce read-only durum görmek istersen `status` veya eşdeğer `dry-run` çalıştır:

```bash
python3 skills/underprotection-upgrade/scripts/underprotection_upgrade.py status
```

Güncelleme yapmak için:

```bash
python3 skills/underprotection-upgrade/scripts/underprotection_upgrade.py apply
```

Skill yerel kütüphaneye kuruluysa script yolu genellikle:

```bash
python3 ~/.codex/skills/underprotection-upgrade/scripts/underprotection_upgrade.py apply
```

## Workflow

1. İstenirse önce `status` çalıştır; bu komut source/local karşılaştırması yapar ve yerel dosya oluşturmaz veya değiştirmez.
2. Güncelleme için `apply` çalıştır.
3. Script Source Library envanterini çıkarır.
4. Source Library içinde `skills/<skill-name>/SKILL.md` bulunan her paketi yerel kütüphaneyle dosya listesi ve dosya içeriği üzerinden karşılaştırır.
5. `apply`, herhangi bir replace yapmadan önce tüm source paketlerini validate eder. Source validation fail olursa hiçbir paket güncellenmez.
6. Yalnız yerelde eksik veya kaynak sürümden farklı olan paketleri kaynak sürümle değiştirir. Değişim aynı local library altında atomic swap ile yapılır; başarısız kopya eski paketi yerinde bırakmalıdır.
7. Yeni adla karşılığı kaynakta bulunan eski Underprotection paket adlarını replacement doğrulandıktan sonra; kaynakta artık bulunmayan retired paketleri ise source validation başarıyla tamamlandıktan sonra yerel kütüphaneden kaldırır.
8. Script `Missing`, `Different`, `Updated`, `Unchanged`, `Legacy`, `Retired`, `Removed legacy` ve `Removed retired` alanlarında tam olarak hangi skill paketlerinin etkilendiğini raporlar.
9. İşlem sonunda script raporunu kısa Türkçe özetle ve Codex restart gerekebileceğini belirt.

## Reporting

Final cevabı kısa Türkçe özet olsun:

```text
Underprotection skill güncellemesi tamamlandı.

Kaynak: ...
Yerel kütüphane: ...
Kontrol edilen: ...
Eksik/farklı: ...
Güncellenen: ...
Değişmeyen: ...
Kaldırılan eski adlar: ...
Kaldırılan retired paketler: ...
Doğrulama: ...
Güvenlik: Source validation apply öncesi yapıldı; değişen paketler atomic swap ile değiştirildi.

Not: Yeni veya güncellenen skill'lerin tamamen yüklenmesi için Codex'i yeniden başlat.
```
