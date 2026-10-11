# NRS ilk migration: önceden alınmış canlı katalog kanıtı

Kaynak: 10.10.2026 tarihinde paylaşılan A01–A24 Supabase ham denetimi, `Yapıştırılan metin(2).txt`. Bu dosya **salt okunur tarihsel kayıt** aktarımıdır; canlı veritabanı tekrar sorgulanmamıştır.

## A15_ROLES: anon ve authenticated

Her iki rolde `rolsuper=false`, `rolcreaterole=false`, `rolcreatedb=false`, `rolreplication=false`, `rolbypassrls=false`. Ayrıca `public_usage=true`, `public_create=false`.

```json
[
  {
    "oid": "16484",
    "status": "REVIEW_ROLE_AND_MEMBERSHIP",
    "rolsuper": false,
    "role_name": "anon",
    "rolcreatedb": false,
    "public_usage": true,
    "rolbypassrls": false,
    "audit_section": "A15_ROLES",
    "public_create": false,
    "rolcreaterole": false,
    "rolreplication": false
  },
  {
    "oid": "16485",
    "status": "REVIEW_ROLE_AND_MEMBERSHIP",
    "rolsuper": false,
    "role_name": "authenticated",
    "rolcreatedb": false,
    "public_usage": true,
    "rolbypassrls": false,
    "audit_section": "A15_ROLES",
    "public_create": false,
    "rolcreaterole": false,
    "rolreplication": false
  }
]
```

## A17_EFFECTIVE_TABLE_ACL: admin_users yıkıcı tablo izinleri

`anon` ve `authenticated` için `DELETE`, `TRUNCATE`, `TRIGGER` etkin izinleri altı kontrolde de `false`.

```json
[
  {
    "role": "anon",
    "privilege": "DELETE",
    "effective": false
  },
  {
    "role": "anon",
    "privilege": "TRIGGER",
    "effective": false
  },
  {
    "role": "anon",
    "privilege": "TRUNCATE",
    "effective": false
  },
  {
    "role": "authenticated",
    "privilege": "DELETE",
    "effective": false
  },
  {
    "role": "authenticated",
    "privilege": "TRIGGER",
    "effective": false
  },
  {
    "role": "authenticated",
    "privilege": "TRUNCATE",
    "effective": false
  }
]
```

## A19_COLUMN_ACL: admin_users sütun yazma izinleri

Sütunlar `user_id`, `role`, `is_active`, `created_at`. İki tarayıcı rolü için her bir sütunda `INSERT=false` ve `UPDATE=false` (16 kayıt).

```json
[
  {
    "role": "anon",
    "column": "user_id",
    "privilege": "INSERT",
    "effective": false
  },
  {
    "role": "anon",
    "column": "user_id",
    "privilege": "UPDATE",
    "effective": false
  },
  {
    "role": "authenticated",
    "column": "user_id",
    "privilege": "INSERT",
    "effective": false
  },
  {
    "role": "authenticated",
    "column": "user_id",
    "privilege": "UPDATE",
    "effective": false
  },
  {
    "role": "anon",
    "column": "role",
    "privilege": "INSERT",
    "effective": false
  },
  {
    "role": "anon",
    "column": "role",
    "privilege": "UPDATE",
    "effective": false
  },
  {
    "role": "authenticated",
    "column": "role",
    "privilege": "INSERT",
    "effective": false
  },
  {
    "role": "authenticated",
    "column": "role",
    "privilege": "UPDATE",
    "effective": false
  },
  {
    "role": "anon",
    "column": "is_active",
    "privilege": "INSERT",
    "effective": false
  },
  {
    "role": "anon",
    "column": "is_active",
    "privilege": "UPDATE",
    "effective": false
  },
  {
    "role": "authenticated",
    "column": "is_active",
    "privilege": "INSERT",
    "effective": false
  },
  {
    "role": "authenticated",
    "column": "is_active",
    "privilege": "UPDATE",
    "effective": false
  },
  {
    "role": "anon",
    "column": "created_at",
    "privilege": "INSERT",
    "effective": false
  },
  {
    "role": "anon",
    "column": "created_at",
    "privilege": "UPDATE",
    "effective": false
  },
  {
    "role": "authenticated",
    "column": "created_at",
    "privilege": "INSERT",
    "effective": false
  },
  {
    "role": "authenticated",
    "column": "created_at",
    "privilege": "UPDATE",
    "effective": false
  }
]
```

## A13_EXPECTED_RPC: iki admin fonksiyonu metadata

- `public.nrs_is_active_admin()`: owner `postgres`; language **`sql`**; return `boolean`; SECURITY DEFINER `true`; `proconfig` search_path boş string (`search_path=""`); EXECUTE `anon=false`, `authenticated=true`, `service_role=true`; `prokind=f`.

- `public.nrs_admin_update_order_status(uuid,text)`: owner `postgres`; language `plpgsql`; return `void`; SECURITY DEFINER `true`; search_path boş string; EXECUTE `anon=false`, `authenticated=true`, `service_role=true`; `prokind=f`.

- **Önemli:** Bu A13 envanteri `nrs_admin_update_order_status` için eskiden kaynak-hash farkı bildirmişti. Sonraki bağımsız tam-kaynak karşılaştırmasında Codex ilk migration’ın kabul ettiği hash ile eşleşme bildirdi. Dolayısıyla bu dosya admin RPC’nin güncel *kaynak hash’ini* kanıtladığını iddia etmez; yalnızca tarihsel metadata kanıtını sağlar.

## Kalan güvenlik koşulu

Bu çıktı tek başına tüm migration guard’ları veya güncel sistem durumu için tam PASS belgesi değildir. İlk migration canlıda çalıştırılmadan önce yedek bütünlüğü ve **COMMIT sonrası geri dönüşün uygulama prosedürü** ayrıca doğrulanmalıdır. Arşiv açılabiliyor olması izole geri-yükleme testinin yapıldığı anlamına gelmez.

**Yasak:** Bu kanıt dosyasını GitHub’a push etme; canlı SQL çalıştırma; guard/ACL değiştirme.
