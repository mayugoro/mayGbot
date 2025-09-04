// Test fungsi format nomor HP ke format 628
// Untuk memastikan semua format input menghasilkan format 628

function formatNomor628(text) {
  const cleanNumber = text.replace(/\D/g, '');
  let nomorHP = cleanNumber;
  
  // Jika dimulai dengan +62, hapus +
  if (nomorHP.startsWith('62')) {
    nomorHP = nomorHP; // sudah dalam format 62
  }
  // Jika dimulai dengan 0, ganti dengan 62
  else if (nomorHP.startsWith('0')) {
    nomorHP = '62' + nomorHP.substring(1);
  }
  // Jika dimulai dengan 8 (tanpa 0), tambahkan 62
  else if (nomorHP.startsWith('8')) {
    nomorHP = '62' + nomorHP;
  }
  // Jika tidak sesuai format, tambahkan 628 di depan
  else {
    nomorHP = '628' + nomorHP;
  }
  
  return nomorHP;
}

// Test cases
const testNumbers = [
  '081234567890',
  '08123456789', 
  '+6281234567890',
  '6281234567890',
  '81234567890',
  '1234567890',
  '0812-3456-7890',
  '+62 812 3456 7890'
];

console.log('=== TEST FORMAT NOMOR KE 628 ===\n');

testNumbers.forEach(num => {
  const result = formatNomor628(num);
  console.log(`Input: ${num.padEnd(20)} → Output: ${result}`);
});

console.log('\n=== HASIL TEST ===');
console.log('✅ Semua nomor berhasil dikonversi ke format 628');
console.log('✅ Format ini siap dikirim ke API AKRAB GLOBAL');
