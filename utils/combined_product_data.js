// Menggabungkan API list_product (detail) dengan API cek_stock (stok)
require('dotenv').config();
const axios = require('axios');

// Import fungsi fetchRawStokData dari cek_stok_global
const { fetchRawStokData } = require('../menu/cek_stok_global');

async function fetchCombinedProductData() {
  try {
    console.log('🔄 Fetching combined product data...');
    
    // Fetch detail produk dari list_product API
    const listProductUrl = 'https://panel.khfy-store.com/api_v2/list_product?provider=KUBER&token=' + process.env.APIKEYG;
    const listResponse = await axios.get(listProductUrl);
    const productDetails = listResponse.data.data || [];
    
    // Fetch stok dari cek_stock API
    const stockData = await fetchRawStokData();
    
    // Gabungkan data berdasarkan kode_produk
    const combinedData = productDetails.map(product => {
      const stockInfo = stockData.find(stock => stock.kode_produk === product.kode_produk);
      
      return {
        kode_produk: product.kode_produk,
        nama_produk: product.nama_produk.toUpperCase(), // Gunakan nama dari list_product API (konsisten dengan display)
        deskripsi: product.deskripsi,
        harga_final: product.harga_final,
        kode_provider: product.kode_provider,
        gangguan: product.gangguan,
        kosong: product.kosong,
        // Data stok dari API terpisah
        stok: stockInfo ? stockInfo.stok : 0,
        stok_kosong: stockInfo ? stockInfo.kosong : 1,
        stok_gangguan: stockInfo ? stockInfo.gangguan : 0
      };
    });
    
    // Filter hanya produk bulanan (non-BPA)
    const bulanProducts = combinedData.filter(product => 
      !product.kode_produk.includes('BPA')
    );
    
    return bulanProducts;
    
  } catch (error) {
    console.error('❌ Error fetching combined data:', error.message);
    return [];
  }
}

async function testCombinedData() {
  console.log('🧪 Testing combined product data...\n');
  
  const products = await fetchCombinedProductData();
  
  console.log(`✅ Total combined products: ${products.length}\n`);
  
  products.forEach((product, index) => {
    console.log(`--- Product ${index + 1} ---`);
    console.log(`Kode: ${product.kode_produk}`);
    console.log(`Nama: ${product.nama_produk}`);
    console.log(`Harga: Rp ${product.harga_final?.toLocaleString('id-ID')}`);
    console.log(`Stok: ${product.stok}`);
    console.log(`Kosong: ${product.kosong} / Stok Kosong: ${product.stok_kosong}`);
    console.log(`Gangguan: ${product.gangguan} / Stok Gangguan: ${product.stok_gangguan}`);
    console.log(`Deskripsi: ${product.deskripsi ? product.deskripsi.substring(0, 100) + '...' : 'N/A'}`);
    console.log('');
  });
  
  // Sample full data
  if (products.length > 0) {
    console.log('=== SAMPLE COMBINED DATA ===');
    console.log(JSON.stringify(products[0], null, 2));
  }
}

module.exports = { fetchCombinedProductData };

// Run test if called directly
if (require.main === module) {
  testCombinedData();
}
