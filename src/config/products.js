// Ubah produk di sini sesuai produk legal yang kamu jual.
// Template ini tidak dibuat untuk menjual akun/akses layanan pihak ketiga tanpa izin.

export const products = [
  {
    id: 'ai_plus_7',
    name: 'Chatgpt Plus',
    variant: '1 Bulan Garansi 7 Hari',
    price: 20000,
    warrantyDays: 7,
    stock: 'Tersedia',
    sold: 1341,
    description: ['1 akun: Rp 20.000'],
    image: './assets/products/logo-chatgpt-style.png'
  },
  {
    id: 'ai_plus_30',
    name: 'Chatgpt Plus',
    variant: '1 Bulan Garansi 30 Hari',
    price: 30000,
    warrantyDays: 30,
    stock: 'Tersedia',
    sold: 729,
    description: ['1 akun: Rp 30.000'],
    image: './assets/products/logo-chatgpt-style.png'
  }
  // {
  //   id: 'ai_private_7',
  //   name: 'Chatgpt Plus Private',
  //   variant: '1 Bulan - Garansi 7 Hari',
  //   price: 50000,
  //   warrantyDays: 7,
  //   stock: 'Tersedia',
  //   sold: 320,
  //   description: ['1 akun: Rp 50.000'],
  //   image: './assets/products/logo-chatgpt-style.png'
  // },
  // {
  //   id: 'ai_private_30',
  //   name: 'AI ASSISTANT PRIVATE',
  //   variant: '1 Bulan - Garansi 30 Hari',
  //   price: 80000,
  //   warrantyDays: 30,
  //   stock: 'Tersedia',
  //   sold: 144,
  //   description: ['1 akun: Rp 80.000'],
  //   image: './assets/products/logo-chatgpt-style.png'
  // }
];

export function getProductById(id) {
  return products.find((product) => product.id === id);
}
