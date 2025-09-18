const db = require('./db.js');

// Smart Recommendation Engine dengan logika terbaru
async function smartRecommendationEngine(nomorCustomer, kategoriYangDiminta) {
  console.log('🤖 SMART RECOMMENDATION ENGINE');
  console.log('='.repeat(60));
  console.log(`📱 Nomor Customer: ${nomorCustomer}`);
  console.log(`📦 Kategori Diminta: ${kategoriYangDiminta}`);
  console.log('-'.repeat(60));
  
  try {
    // Step 1: Cek apakah nomor sedang aktif
    console.log('\n🔍 STEP 1: Checking Active Status...');
    const activeStatus = await db.checkNumberActiveStatus(nomorCustomer);
    const activeItems = activeStatus.filter(item => item.status === 'active');
    
    if (activeItems.length > 0) {
      console.log(`⚠️  PERINGATAN: Nomor masih aktif di ${activeItems.length} pengelola:`);
      activeItems.forEach(item => {
        const expiredDate = new Date(item.expired_at);
        const daysLeft = Math.ceil((expiredDate - new Date()) / (1000 * 60 * 60 * 24));
        console.log(`   📍 ${item.pengelola} (${item.kategori}) - Sisa: ${daysLeft} hari`);
      });
      
      return {
        status: 'conflict',
        message: 'Nomor masih aktif, tidak bisa transaksi baru',
        activeAt: activeItems,
        recommendation: 'Tunggu sampai paket expired atau lakukan perpanjangan'
      };
    }
    
    console.log('✅ Nomor tidak sedang aktif, lanjut ke analisis...');
    
    // Step 2: Cari pengelola terakhir untuk kategori yang sama (30 hari)
    console.log('\n🔍 STEP 2: Finding Last Pengelola for Same Category...');
    const lastPengelolaSpec = await db.getLastPengelolaForNumber(nomorCustomer, kategoriYangDiminta, 30);
    
    if (lastPengelolaSpec.length > 0) {
      const recommended = lastPengelolaSpec[0];
      console.log(`✅ REKOMENDASI UTAMA: ${recommended.pengelola}`);
      console.log(`   📦 Kategori: ${recommended.kategori}`);
      console.log(`   📅 Terakhir: ${recommended.days_ago} hari yang lalu`);
      console.log(`   👤 Username: ${recommended.username || 'N/A'}`);
      
      return {
        status: 'recommended_specific',
        pengelola: recommended.pengelola,
        reason: `Pengelola terakhir untuk kategori ${kategoriYangDiminta}`,
        lastUsed: recommended.transaction_date || recommended.expired_at,
        daysAgo: recommended.days_ago,
        confidence: 'HIGH'
      };
    }
    
    console.log(`❌ Tidak ada riwayat untuk kategori ${kategoriYangDiminta} dalam 30 hari`);
    
    // Step 3: Cari pengelola terakhir untuk kategori apapun (30 hari)
    console.log('\n🔍 STEP 3: Finding Last Pengelola for Any Category...');
    const lastPengelolaAny = await db.getLastPengelolaForNumber(nomorCustomer, null, 30);
    
    if (lastPengelolaAny.length > 0) {
      const recommended = lastPengelolaAny[0];
      console.log(`💡 REKOMENDASI ALTERNATIF: ${recommended.pengelola}`);
      console.log(`   📦 Kategori terakhir: ${recommended.kategori}`);
      console.log(`   📅 Terakhir: ${recommended.days_ago} hari yang lalu`);
      console.log(`   ⚠️  Note: Beda kategori dengan yang diminta`);
      
      return {
        status: 'recommended_alternative',
        pengelola: recommended.pengelola,
        reason: `Pengelola terakhir (kategori ${recommended.kategori}, bukan ${kategoriYangDiminta})`,
        lastUsed: recommended.transaction_date || recommended.expired_at,
        daysAgo: recommended.days_ago,
        confidence: 'MEDIUM'
      };
    }
    
    console.log('❌ Tidak ada riwayat dalam 30 hari terakhir');
    
    // Step 4: Cari pengelola terpopuler (30 hari)
    console.log('\n🔍 STEP 4: Finding Most Popular Pengelola...');
    const popularPengelola = await db.getMostUsedPengelolaForNumber(nomorCustomer, 30);
    
    if (popularPengelola.length > 0) {
      const popular = popularPengelola[0];
      console.log(`⭐ REKOMENDASI POPULER: ${popular.pengelola}`);
      console.log(`   🔢 Digunakan: ${popular.usage_count} kali`);
      console.log(`   📦 Kategori: ${popular.categories_used}`);
      console.log(`   📅 Terakhir: ${popular.days_ago || 'N/A'} hari yang lalu`);
      
      return {
        status: 'recommended_popular',
        pengelola: popular.pengelola,
        reason: `Pengelola terpopuler (${popular.usage_count} kali penggunaan)`,
        usageCount: popular.usage_count,
        categories: popular.categories_used,
        confidence: 'MEDIUM'
      };
    }
    
    console.log('❌ Tidak ada data pengelola dalam 30 hari');
    
    // Step 5: Nomor baru atau data lama
    console.log('\n🔍 STEP 5: Check Historical Data (> 30 days)...');
    const historicalData = await db.getNumberTransactionHistory(nomorCustomer, 90);
    
    if (historicalData.length > 0) {
      console.log(`📊 Ditemukan ${historicalData.length} transaksi lama (> 30 hari)`);
      console.log('⚠️  Data sudah kadaluarsa, tidak direkomendasi');
      
      return {
        status: 'expired_data',
        message: 'Nomor memiliki riwayat lama tetapi sudah kadaluarsa (> 30 hari)',
        recommendation: 'Gunakan pengelola manapun yang tersedia',
        historicalCount: historicalData.length
      };
    }
    
    // Step 6: Nomor benar-benar baru
    console.log('\n🆕 NOMOR BARU: Tidak ada riwayat sama sekali');
    
    return {
      status: 'new_number',
      message: 'Nomor baru, tidak ada riwayat transaksi',
      recommendation: 'Gunakan pengelola manapun yang tersedia untuk kategori ' + kategoriYangDiminta
    };
    
  } catch (error) {
    console.error('❌ Error in smart recommendation:', error.message);
    return {
      status: 'error',
      message: error.message
    };
  }
}

// Demo dengan berbagai skenario
async function runRecommendationDemo() {
  console.log('🚀 SMART RECOMMENDATION ENGINE DEMO');
  console.log('='.repeat(80));
  
  // Test Case 1: Nomor yang sedang aktif
  console.log('\n📱 TEST CASE 1: Nomor yang sedang aktif');
  const result1 = await smartRecommendationEngine('087824020816', 'BULANAN');
  console.log('\n📄 RESULT 1:');
  console.log(JSON.stringify(result1, null, 2));
  
  // Test Case 2: Nomor yang tidak ada
  console.log('\n' + '='.repeat(80));
  console.log('\n📱 TEST CASE 2: Nomor yang tidak ada riwayat');
  const result2 = await smartRecommendationEngine('081234567890', 'BEKASAN');
  console.log('\n📄 RESULT 2:');
  console.log(JSON.stringify(result2, null, 2));
  
  // Test Case 3: Coba dengan kategori yang berbeda
  console.log('\n' + '='.repeat(80));
  console.log('\n📱 TEST CASE 3: Nomor aktif dengan kategori berbeda');
  const result3 = await smartRecommendationEngine('087824020816', '5H');
  console.log('\n📄 RESULT 3:');
  console.log(JSON.stringify(result3, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 SUMMARY LOGIKA SMART RECOMMENDATION:');
  console.log('1️⃣ Cek status aktif → TOLAK jika masih aktif');
  console.log('2️⃣ Cari pengelola terakhir kategori sama (30 hari) → PRIORITAS UTAMA');
  console.log('3️⃣ Cari pengelola terakhir kategori lain (30 hari) → ALTERNATIF');
  console.log('4️⃣ Cari pengelola terpopuler (30 hari) → POPULER');
  console.log('5️⃣ Cek data historis (> 30 hari) → KADALUARSA');
  console.log('6️⃣ Nomor baru → BEBAS PILIH');
  console.log('\n💡 Hanya data dalam 30 hari yang dianggap relevan!');
  
  process.exit(0);
}

runRecommendationDemo();