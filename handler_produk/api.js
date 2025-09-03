const axios = require('axios');

// Fungsi untuk mengambil daftar produk dari API
async function getProductList() {
  try {
    const response = await axios.get('https://api.hidepulsa.com/api/v1/produk', {
      headers: {
        'Authorization': process.env.API_KEY
      },
      timeout: 15000
    });

    return response.data;
    
  } catch (error) {
    throw error;
  }
}

// Fungsi untuk proses pembelian via API
async function processPurchase(nomorHP, produkData, paymentMethod) {
  try {
    const response = await axios.post('https://api.hidepulsa.com/api/v1/dor', {
      kode: produkData.kode,
      nama_paket: produkData.nama_paket,
      nomor_hp: nomorHP,
      payment: paymentMethod,
      id_telegram: process.env.ADMIN_ID,
      password: process.env.PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.API_KEY
      },
      timeout: 30000
    });

    return response.data;
    
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getProductList,
  processPurchase
};
