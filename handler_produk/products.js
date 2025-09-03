// Daftar produk yang akan ditampilkan
const FILTERED_PRODUCTS = [
  "Kuota Reguler 1 GB",
  "Kuota Reguler 2.8 GB", 
  "Masaaktif 1 Bulan",
  "Masaaktif 1 Tahun",
  "Xtra Combo Flex S",
  "Akrab L Kuber 75GB 3 anggota",
  "Edukasi 2GB"
];

// Mapping callback ke info produk
const PRODUCT_INFO = {
  "beli_kuota_1gb": {
    nama: "Kuota Reguler 1 GB",
    harga: "Rp 1.000",
    kode: "no_pancingan",
    payment: "dana, shopee, gopay, qris, pulsa",
    customDetail: `<code>❗Tidak bisa semua nomor.
📧 Siapkan E-Wallet Rp.500
✨ Nama       : Kuota Reguler 1 GB
💰 Harga      : Rp 1.000
⌚️ Masa aktif : 2 Hari
💳 Payment    : DANA, Shopee-Pay, Gopay, QRIS, Pulsa</code>`
  },
  "beli_kuota_2gb": {
    nama: "Kuota Reguler 2.8 GB",
    harga: "Rp 2.000", 
    kode: "addon_500",
    payment: "dana, shopee, gopay, qris, pulsa",
    customDetail: `<code>✅ Bisa semua nomor.
📧 Siapkan E-Wallet Rp.1000
✨ Nama       : Kuota Reguler 2.8 GB
💰 Harga      : Rp 2.000
⌚️ Masa aktif : 2 Hari
💳 Payment    : DANA, Shopee-Pay, Gopay, QRIS, Pulsa</code>`
  },
  "beli_masa_1bulan": {
    nama: "Masaaktif 1 Bulan",
    harga: "Rp 10.000",
    kode: "addon_500", 
    payment: "dana, shopee, gopay, qris, pulsa",
    customDetail: `<code>✅ Bisa semua nomor.
📧 Siapkan E-Wallet Rp.500
✨ Nama    : Masaaktif 1 Bulan
💰 Harga   : Rp 10.000
💳 Payment : DANA, Shopee-Pay, Gopay, QRIS, Pulsa</code>`
  },
  "beli_masa_1tahun": {
    nama: "Masaaktif 1 Tahun",
    harga: "Rp 50.000",
    kode: "pancinganv2",
    payment: "dana, shopee, gopay, qris, pulsa",
    customDetail: `<code>✅ Bisa semua nomor.
📧 Siapkan E-Wallet Rp.1000
✨ Nama       : Masaaktif 1 Tahun
💰 Harga      : Rp 50.000
⌚️ Masa aktif : 1 Tahun (PPJ Perbulan)
💳 Payment    : DANA, Shopee-Pay, Gopay, QRIS, Pulsa</code>`
  },
  "beli_xtra_flex": {
    nama: "Xtra Combo Flex S",
    harga: "Rp 8.000",
    kode: "pancinganv1",
    payment: "dana, shopee, gopay, qris, pulsa",
    customDetail: `<code>✅ Bisa semua nomor.
📧 Siapkan E-Wallet Rp.16.000
✨ Nama       : Xtra Combo Flex S
💰 Harga      : Rp 8.000
⌚️ Masa aktif : 30 Hari
💳 Payment    : DANA, Shopee-Pay, Gopay, QRIS, Pulsa</code>`
  },
  "beli_akrab_kuber": {
    nama: "Akrab L Kuber 75GB 3 anggota",
    harga: "Rp 5.000",
    kode: "no_pancingan",
    payment: "dana, shopee, gopay, qris, pulsa",
    customDetail: `<code>✅ Bisa semua nomor.
📧 Siapkan E-Wallet Rp.140.000
✨ Nama       : Akrab L Kuber 75GB 3 anggota
💰 Harga      : Rp 5.000
⌚️ Masa aktif : 30 Hari
💳 Payment    : DANA, Shopee-Pay, Gopay, QRIS, Pulsa</code>`
  },
  "beli_edukasi_2gb": {
    nama: "Edukasi 2GB",
    harga: "Rp 500",
    kode: "no_pancingan",
    payment: "dana, shopee, gopay, qris, pulsa",
    customDetail: `<code>✅ Bisa semua nomor.
📧 Siapkan E-Wallet Rp.1000
✨ Nama       : Edukasi 2GB
⌚️ Masa aktif : 1 Hari
💰 Harga      : Rp 500
💳 Payment    : DANA, Shopee-Pay, Gopay, QRIS, Pulsa</code>`
  }
};

// Mapping untuk API data
const API_MAPPING = {
  "beli_kuota_1gb": {
    kode: "no_pancingan",
    nama_paket: "Kuota Reguler 1 GB"
  },
  "beli_kuota_2gb": {
    kode: "addon_500", 
    nama_paket: "Kuota Reguler 2.8 GB"
  },
  "beli_masa_1bulan": {
    kode: "addon_500",
    nama_paket: "Masaaktif 1 Bulan"
  },
  "beli_masa_1tahun": {
    kode: "pancinganv2",
    nama_paket: "Masaaktif 1 Tahun"
  },
  "beli_xtra_flex": {
    kode: "pancinganv1",
    nama_paket: "Xtra Combo Flex S"
  },
  "beli_akrab_kuber": {
    kode: "no_pancingan",
    nama_paket: "Akrab L Kuber 75GB 3 anggota"
  },
  "beli_edukasi_2gb": {
    kode: "no_pancingan",
    nama_paket: "Edukasi 2GB"
  }
};

function filterProducts(products) {
  return products.filter(item => 
    FILTERED_PRODUCTS.includes(item.nama_paket)
  );
}

function getProductInfo(callbackData) {
  return PRODUCT_INFO[callbackData];
}

function getAPIMapping(produkType) {
  return API_MAPPING[produkType];
}

function getProdukNama(produkType) {
  const info = PRODUCT_INFO[produkType];
  return info ? info.nama : "Unknown";
}

module.exports = {
  FILTERED_PRODUCTS,
  PRODUCT_INFO,
  API_MAPPING,
  filterProducts,
  getProductInfo,
  getAPIMapping,
  getProdukNama
};
