# Discord Shop Bot - Select Menu UI

Template bot toko Discord dengan 1 panel produk. User memilih produk dari menu pilihan, lalu bot membuat invoice QRIS, channel upload foto bukti pembayaran, dan channel khusus pembeli setelah admin mengonfirmasi pembayaran.

> Template ini untuk produk digital legal milikmu sendiri. Jangan gunakan untuk menjual akun atau akses layanan pihak ketiga tanpa izin.

## Fitur

- `/setup` mengirim 1 panel toko berisi semua pilihan produk.
- Produk dipilih lewat select menu, bukan banyak card terpisah.
- Invoice otomatis berisi produk, total tagihan, dan QRIS gambar.
- User upload foto bukti pembayaran langsung sebagai attachment gambar.
- Bukti pembayaran dikirim ke channel admin.
- Admin bisa konfirmasi atau tolak pembayaran.
- Setelah dikonfirmasi, bot membuat channel khusus pembeli.
- Tampilan produk tidak menampilkan format credential akun.

## Cara Run

```bash
npm install
cp .env.example .env
npm run deploy
npm start
```

## Isi `.env`

```env
DISCORD_TOKEN=ISI_TOKEN_BOT
CLIENT_ID=ISI_APPLICATION_CLIENT_ID
GUILD_ID=ISI_SERVER_ID
ADMIN_ROLE_ID=ISI_ROLE_ADMIN_ID
ADMIN_LOG_CHANNEL_ID=ISI_CHANNEL_LOG_ADMIN_ID
CATEGORY_PROOF_ID=
CATEGORY_PAID_ID=
QRIS_IMAGE_PATH=./assets/qris.png
STORE_NAME=Toko Akun Digital
```

## Ubah Produk

Edit file:

```bash
src/config/products.js
```

Contoh field produk:

```js
{
  id: 'ai_plus_7',
  name: 'AI ASSISTANT PLUS',
  variant: '1 Bulan - Garansi 7 Hari',
  price: 20000,
  warrantyDays: 7,
  stock: 'Tersedia',
  sold: 1341,
  description: ['1 akun: Rp 20.000'],
  image: './assets/products/logo-chatgpt-style.png'
}
```

## Ubah QRIS

Ganti file berikut dengan gambar QRIS kamu:

```bash
assets/qris.png
```

Atau ubah path di `.env`:

```env
QRIS_IMAGE_PATH=./assets/qris.png
```

## Penting

Aktifkan **Message Content Intent** di Discord Developer Portal agar bot bisa membaca pesan upload bukti pembayaran di channel bukti.
