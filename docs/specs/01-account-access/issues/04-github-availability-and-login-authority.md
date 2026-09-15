# 04 — GitHub kesintisi ve login yetkisinin App'ten ayrı kalması

**What to build:** GitHub ulaşılamazken mevcut ve geçerli ürün oturumu olağan süresi dolana kadar özel veride okur ve yazar; süre uzamaz. Yeni giriş ve `Confirm GitHub Identity` görünür biçimde bekler; teyit isteyen yüksek risk uygulanmaz. Oturum iptali gibi erişimi azaltan eylemler GitHub'a bağlı değildir. GitHub login OAuth'unun kaldırılması ürün oturumlarını bitirir ve sonraki girişte yeniden onay ister; GitHub App kaldırma sinyali kimliği veya geçerli oturumu bozmaz.

**Blocked by:** 02 — Oturum listesi, iptal ve süre

**Status:** ready-for-agent

- [ ] GitHub kesintisinde geçerli oturum özel okuma/yazmaya devam eder ve expiry uzamaz; yeni giriş görünür biçimde bekler.
- [ ] Kesintide `Confirm GitHub Identity` bekler ve grant isteyen yüksek risk uygulanmaz; oturum iptali çalışmayı sürdürür.
- [ ] GitHub login OAuth'unun kaldırılması bütün ürün oturumlarını sona erdirir; sonraki giriş yeni OAuth onayı ister.
- [ ] GitHub App kaldırma veya repository izninin çekilmesi oturumu ve Hesap kimliğini bozmaz; giriş App installation'ına bakarak geçerlilik kararı vermez.
- [ ] GitHub eşitleme bekletme UI'si ve App kurulumu bu ticket'ta yoktur; invariant yalnız ürün oturumunun App durumundan bağımsız kalmasıdır.
- [ ] Kabul kanıtı Account Access seam'inde GitHub-down double, login-OAuth-revoked double ve App-uninstalled double ile: devam, uzamama, bekletme, iptalin açık kalması, login revoke'un oturumu bitirmesi, App sinyalinin oturumu bitirmemesi.
