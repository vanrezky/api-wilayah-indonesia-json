# API Wilayah Indonesia JSON

Static JSON API untuk **Provinsi → Kabupaten/Kota → Kecamatan → Desa/Kelurahan** di Indonesia. Project ini dibuat supaya aplikasi tidak perlu membawa database master wilayah atau menjalankan seeder setiap fresh deployment.

> Dataset berasal dari export database dan dapat tertinggal dari perubahan administratif terbaru. Raw source dipertahankan apa adanya; kontrak API dinormalisasi saat build.

## Konsep

Data source lama menggunakan istilah database berikut:

| Raw source | API publik | Arti |
| --- | --- | --- |
| `provinces.json` | `provinces` | Provinsi |
| `districts.json` | `regencies` | Kabupaten/Kota |
| `sub_districts.json` | `districts` | Kecamatan |
| `villages.json` | `villages` | Desa/Kelurahan |

`apicoid_code` dipublikasikan sebagai `code`. ID database tetap disertakan untuk kompatibilitas, tetapi aplikasi baru sebaiknya menggunakan `code` sebagai identifier wilayah.

## Endpoint

```text
GET /api/v1/provinces.json
GET /api/v1/regencies/{province_code}.json
GET /api/v1/districts/{regency_code}.json
GET /api/v1/villages/{district_code}.json
GET /api/v1/meta.json
```

Flat dataset juga tersedia untuk kebutuhan importer/seeder:

```text
GET /api/v1/data/provinces.json
GET /api/v1/data/regencies.json
GET /api/v1/data/districts.json
GET /api/v1/data/villages.json
```

Contoh response:

```json
{
  "data": [
    {
      "id": 1,
      "code": "5103",
      "province_code": "51",
      "type": "Kabupaten",
      "name": "Badung",
      "postal_code": "80351",
      "external_codes": {
        "rajaongkir": "17"
      }
    }
  ],
  "meta": {
    "count": 1,
    "api_version": "v1",
    "parent_code": "51"
  }
}
```

Nilai placeholder seperti `postal_code: "0"` atau `rajaongkir: "0"` dinormalisasi menjadi `null`/tidak dimasukkan sebagai external code.

## Mengganti sample dengan dataset lengkap

Replace isi file di `data/raw/` dengan export database Anda:

```text
data/raw/provinces.json
data/raw/districts.json
data/raw/sub_districts.json
data/raw/villages.json
```

Lalu jalankan:

```bash
npm run validate
npm run build
```

Generator akan memvalidasi duplicate ID/code dan foreign key yang orphan. Build akan gagal apabila relasi data tidak valid.

## Development

Tidak ada runtime dependency. Dibutuhkan Node.js 20+.

```bash
npm run build
npx serve public
```

Buka URL local server dan gunakan API Playground di halaman utama.

## GitHub Pages

Workflow `.github/workflows/deploy.yml` akan build dataset dan deploy folder `public` pada setiap push ke `main`.

Jika Pages belum aktif, buka **Settings → Pages** pada repository lalu pilih **GitHub Actions** sebagai source.

## Struktur

```text
data/raw/                  # export database, source of truth
scripts/build.mjs          # validate + normalize + generate static JSON
public/                    # website + generated API
.github/workflows/         # GitHub Pages deployment
```

## License

Tambahkan lisensi yang sesuai sebelum mendistribusikan dataset secara publik, terutama bila sebagian data berasal dari provider eksternal.
