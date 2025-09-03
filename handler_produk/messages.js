// Format pesan daftar produk
function formatProductList(filteredProduk) {
  let produkText = `🛍️ <b>DAFTAR PRODUK TERSEDIA</b>\n`;
  produkText += `📊 Total: ${filteredProduk.length} produk\n\n`;

  filteredProduk.forEach((item, index) => {
    produkText += `${index + 1}. <b>${item.nama_paket}</b>\n`;
    produkText += `💰 Harga Panel: Rp ${item.harga_panel.toLocaleString('id-ID')}\n`;
    produkText += `🔑 Kode Buy: ${item.kode_buy}\n`;
    produkText += `💳 Payment: ${item.payment_suport}\n`;
    
    // Format deskripsi dengan batasan karakter
    let deskripsi = item.deskripsi.replace(/\n/g, ' ').trim();
    if (deskripsi.length > 150) {
      deskripsi = deskripsi.substring(0, 150) + '...';
    }
    produkText += `📝 ${deskripsi}\n\n`;
  });

  produkText += `<i>💡 Pilih produk di bawah untuk membeli</i>`;
  return produkText;
}

// Buat inline keyboard untuk daftar produk
function createProductKeyboard() {
  return [
    [
      { text: "🛒 Kuota Reguler 1GB", callback_data: "beli_kuota_1gb" },
      { text: "🛒 Kuota Reguler 2.8GB", callback_data: "beli_kuota_2gb" }
    ],
    [
      { text: "🛒 Masaaktif 1 Bulan", callback_data: "beli_masa_1bulan" },
      { text: "🛒 Masaaktif 1 Tahun", callback_data: "beli_masa_1tahun" }
    ],
    [
      { text: "🛒 Xtra Combo Flex S", callback_data: "beli_xtra_flex" }
    ],
    [
      { text: "🛒 Akrab L Kuber 75GB", callback_data: "beli_akrab_kuber" }
    ],
    [
      { text: "🛒 Edukasi 2GB", callback_data: "beli_edukasi_2gb" }
    ]
  ];
}

// Format pesan detail produk
function formatProductDetail(produk) {
  let detailText = `🛍️ <b>DETAIL PRODUK</b>\n\n`;
  detailText += `📦 <b>${produk.nama_paket}</b>\n`;
  detailText += `💰 Harga Panel: Rp ${produk.harga_panel.toLocaleString('id-ID')}\n`;
  detailText += `🔑 Kode Buy: <code>${produk.kode_buy}</code>\n`;
  detailText += `💳 Payment Support: ${produk.payment_suport}\n\n`;
  detailText += `📝 <b>Deskripsi:</b>\n${produk.deskripsi}`;
  return detailText;
}

// Format pesan pembelian produk
function formatPurchaseMessage(produkInfo) {
  let beliText = `🛒 <b>PEMBELIAN PRODUK</b>\n\n`;
  beliText += `📦 Produk: <b>${produkInfo.nama}</b>\n`;
  beliText += `💰 Harga: ${produkInfo.harga}\n`;
  beliText += `🔑 Kode Buy: <code>${produkInfo.kode}</code>\n`;
  beliText += `💳 Payment: ${produkInfo.payment}\n\n`;
  beliText += `📝 <b>Langkah Selanjutnya:</b>\n`;
  beliText += `1. Siapkan nomor HP target\n`;
  beliText += `2. Siapkan saldo/pulsa sesuai kebutuhan\n`;
  beliText += `3. Klik tombol "Lanjut Beli" untuk memproses\n\n`;
  beliText += `⚠️ <i>Pastikan nomor dalam kondisi normal dan saldo mencukupi</i>`;
  
  return beliText;
}

// Buat keyboard untuk pembelian produk
function createPurchaseKeyboard(callbackData) {
  return [
    [
      { text: "🔙 KEMBALI", callback_data: "back_to_produk" },
      { text: "✅ LANJUT BELI", callback_data: `proses_${callbackData}` }
    ]
  ];
}

// Buat keyboard untuk detail produk
function createProductDetailKeyboard(callbackData) {
  return [
    [
      { text: "KEMBALI", callback_data: "back_to_produk" },
      { text: "✅ LANJUT BELI", callback_data: `proses_${callbackData}` }
    ]
  ];
}

// Format pesan input nomor HP
function formatInputMessage(produkNama) {
  let inputText = `<i>❗Masukan nomor.\n\n`;
  inputText += `Ketik "batal"untuk membatalkan.</i>`;
  
  return inputText;
}

// Mapping seri nomor XL dan Axis
const xlAxisSeries = [
  '0817', '0818', '0819', // XL
  '0859', '0877', '0878', // XL
  '0831', '0832', '0833', '0838' // Axis
];

// Function untuk cek apakah nomor adalah XL/Axis
const isXLAxisNumber = (nomor) => {
  // Pastikan nomor dalam format 08xxx
  let checkNumber = nomor;
  if (checkNumber.startsWith('62')) {
    checkNumber = '0' + checkNumber.substring(2);
  } else if (checkNumber.length === 10 && !checkNumber.startsWith('0')) {
    checkNumber = '0' + checkNumber;
  }
  
  // Cek 4 digit pertama
  const prefix = checkNumber.substring(0, 4);
  return xlAxisSeries.includes(prefix);
};

// Validasi format nomor HP dengan normalisasi dan cek XL/Axis
function validatePhoneNumber(text) {
  const { normalizePhoneNumber, isValidIndonesianPhone } = require('../utils/normalize');
  
  // Normalisasi nomor menggunakan sistem yang sudah ada
  const normalizedNumber = normalizePhoneNumber(text);
  
  // Validasi format dasar menggunakan sistem yang sudah ada
  const isValidFormat = normalizedNumber && isValidIndonesianPhone(normalizedNumber);
  
  if (!isValidFormat) {
    return {
      isValid: false,
      cleanNumber: text.replace(/\D/g, ''), // fallback ke clean basic
      errorMessage: "Format nomor tidak valid"
    };
  }
  
  // Cek apakah nomor adalah XL/Axis menggunakan fungsi lokal
  const isXLAxis = isXLAxisNumber(normalizedNumber);
  
  if (!isXLAxis) {
    return {
      isValid: false,
      cleanNumber: normalizedNumber,
      errorMessage: "Nomor harus XL atau Axis"
    };
  }
  
  return {
    isValid: true,
    cleanNumber: normalizedNumber,
    errorMessage: null
  };
}

module.exports = {
  formatProductList,
  createProductKeyboard,
  formatProductDetail,
  formatPurchaseMessage,
  createPurchaseKeyboard,
  createProductDetailKeyboard,
  formatInputMessage,
  validatePhoneNumber
};
