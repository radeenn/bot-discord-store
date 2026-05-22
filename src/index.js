import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { products, getProductById } from './config/products.js';
import { createOrder, findOrder, getUserOrders, readOrders, updateOrder } from './utils/storage.js';
import { formatRupiah, makeOrderId, safeChannelName } from './utils/format.js';
import { isAdmin } from './utils/permissions.js';

const requiredEnv = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'ADMIN_LOG_CHANNEL_ID'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`${key} wajib diisi di file .env`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

function resolveFile(filePath) {
  if (!filePath) return null;
  const fullPath = path.resolve(process.cwd(), filePath);
  return fs.existsSync(fullPath) ? fullPath : null;
}

function makeAttachment(filePath, name) {
  const resolved = resolveFile(filePath);
  if (!resolved) return null;
  return new AttachmentBuilder(resolved, { name });
}

function buildIntroPayload() {
  const storeName = process.env.STORE_NAME || 'Toko Akun Digital';
  const logoAttachment = makeAttachment('./assets/products/logo-chatgpt-style.png', 'logo.png');

  const productLines = products.map((product, index) => {
    return (
      `**${index + 1}. ${product.name}**\n` +
      `${product.variant}\n` +
      `Harga: **${formatRupiah(product.price)}** Garansi: **${product.warrantyDays} Hari** Stok: **${product.stock || 'Tersedia'}** Terjual: **${product.sold ?? 0}**`
    );
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(storeName)
    .setDescription(
      'Pembayaran via QRIS.\n' +
      'Pilih produk yang ingin dibeli lewat menu pilihan di bawah.\n' +
      'Setelah bayar, bot akan membuat channel khusus untuk upload foto bukti pembayaran.\n\n' +
      productLines
    )
    .setColor(0x2b2d31);

  if (logoAttachment) embed.setThumbnail('attachment://logo.png');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_product')
    .setPlaceholder('Select Product')
    .addOptions(
      products.map((product) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${product.name} - ${product.variant}`.slice(0, 100))
          .setDescription(`${formatRupiah(product.price)} | Garansi ${product.warrantyDays} hari`.slice(0, 100))
          .setValue(product.id)
      )
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);
  const payload = { embeds: [embed], components: [row] };
  if (logoAttachment) payload.files = [logoAttachment];
  return payload;
}

function buildProductCardPayload(product) {
  const imageName = `${product.id}.png`;
  const productAttachment = makeAttachment(product.image, imageName);

  const priceLines = Array.isArray(product.description)
    ? product.description.map((item) => `• ${item}`).join('\n')
    : `• ${formatRupiah(product.price)}`;

  const embed = new EmbedBuilder()
    .setTitle(product.name)
    .setDescription(
      `**${product.variant}**\n\n` +
      `**Stok:** ${product.stock || 'Tersedia'}\n` +
      `**Terjual:** ${product.sold ?? 0}\n\n` +
      `**Harga:**\n${priceLines}`
    )
    .setColor(0x2b2d31);

  if (productAttachment) embed.setThumbnail(`attachment://${imageName}`);

  const buyButton = new ButtonBuilder()
    .setCustomId(`buy:${product.id}`)
    .setLabel(`Buy ${product.name}`.slice(0, 80))
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(buyButton);
  const payload = { embeds: [embed], components: [row] };
  if (productAttachment) payload.files = [productAttachment];
  return payload;
}

function buildInvoicePayload(order, product) {
  const productAttachment = makeAttachment(product.image, 'product.png');
  const qrisAttachment = makeAttachment(process.env.QRIS_IMAGE_PATH, 'qris.png');
  const files = [productAttachment, qrisAttachment].filter(Boolean);

  const priceLines = Array.isArray(product.description)
    ? product.description.map((item) => `• ${item}`).join('\n')
    : `• ${formatRupiah(product.price)}`;

  const productEmbed = new EmbedBuilder()
    .setTitle(`${product.name}`)
    .setDescription(
      `**${product.variant}**\n\n` +
      `**Stok:** ${product.stock || 'Tersedia'}\n` +
      `**Terjual:** ${product.sold ?? 0}\n\n` +
      `**Harga:**\n${priceLines}`
    )
    .setColor(0x2b2d31);

  if (productAttachment) productEmbed.setThumbnail('attachment://product.png');

  const paymentEmbed = new EmbedBuilder()
    .setTitle('Invoice Pembayaran')
    .setDescription(
      'Silakan bayar sesuai total tagihan melalui QRIS di bawah.\n' +
      'Setelah membayar, klik tombol **Saya Sudah Bayar**. Bot akan membuat channel khusus untuk upload foto bukti pembayaran.'
    )
    .addFields(
      { name: 'ID Pesanan', value: order.id, inline: false },
      { name: 'Pembeli', value: `<@${order.userId}>`, inline: true },
      { name: 'Produk', value: `${product.name} - ${product.variant}`, inline: false },
      { name: 'Total Tagihan', value: formatRupiah(order.price), inline: true },
      { name: 'Status', value: 'Menunggu pembayaran', inline: false },
      { name: 'Catatan', value: 'QRIS gambar statis tidak bisa diverifikasi otomatis oleh bot. Admin tetap perlu mengonfirmasi pembayaran setelah user upload foto bukti.', inline: false }
    )
    .setColor(0x2b2d31)
    .setTimestamp();

  if (qrisAttachment) paymentEmbed.setImage('attachment://qris.png');

  const payButton = new ButtonBuilder()
    .setCustomId(`pay:${order.id}`)
    .setLabel('Saya Sudah Bayar')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(payButton);
  return { embeds: [productEmbed, paymentEmbed], components: [row], files, ephemeral: true };
}

async function sendProofToAdmin(guild, order, product, proofUrl, note, proofMessageUrl = null) {
  const adminChannel = await guild.channels.fetch(process.env.ADMIN_LOG_CHANNEL_ID).catch(() => null);
  if (!adminChannel || !adminChannel.isTextBased()) {
    throw new Error('Channel log admin tidak ditemukan atau bukan text channel.');
  }

  const embed = new EmbedBuilder()
    .setTitle('Bukti Pembayaran Masuk')
    .setDescription('Periksa foto bukti pembayaran. Jika valid, klik **Konfirmasi Pembayaran** untuk membuat channel khusus pembeli.')
    .addFields(
      { name: 'ID Pesanan', value: order.id, inline: false },
      { name: 'Pembeli', value: `<@${order.userId}>`, inline: true },
      { name: 'Produk', value: `${product.name} - ${product.variant}`, inline: true },
      { name: 'Total', value: formatRupiah(order.price), inline: true },
      { name: 'Foto Bukti', value: `[Buka gambar](${proofUrl})`, inline: false },
      { name: 'Pesan Bukti', value: proofMessageUrl ? `[Buka pesan upload](${proofMessageUrl})` : '-', inline: false },
      { name: 'Catatan', value: note || '-', inline: false }
    )
    .setImage(proofUrl)
    .setColor(0xf1c40f)
    .setTimestamp();

  const confirmButton = new ButtonBuilder()
    .setCustomId(`confirm:${order.id}`)
    .setLabel('Konfirmasi Pembayaran')
    .setStyle(ButtonStyle.Success);

  const rejectButton = new ButtonBuilder()
    .setCustomId(`reject:${order.id}`)
    .setLabel('Tolak Pembayaran')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(confirmButton, rejectButton);
  await adminChannel.send({ embeds: [embed], components: [row] });
}

async function createProofUploadChannel(interaction, order, product) {
  if (order.proofChannelId) {
    const existing = await interaction.guild.channels.fetch(order.proofChannelId).catch(() => null);
    if (existing?.isTextBased()) return existing;
  }

  const channelName = safeChannelName(`bukti-${order.id}-${interaction.user.username}`);
  const overwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: order.userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];

  if (process.env.ADMIN_ROLE_ID) {
    overwrites.push({
      id: process.env.ADMIN_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageChannels
      ]
    });
  }

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: process.env.CATEGORY_PROOF_ID || process.env.CATEGORY_PAID_ID || null,
    permissionOverwrites: overwrites,
    topic: `Channel upload bukti pembayaran untuk pesanan ${order.id}`
  });

  await updateOrder(order.id, {
    status: 'WAITING_PROOF_UPLOAD',
    proofChannelId: channel.id,
    proofRequestedAt: new Date().toISOString()
  });

  const embed = new EmbedBuilder()
    .setTitle('Upload Foto Bukti Pembayaran')
    .setDescription('Kirim foto atau screenshot bukti pembayaran langsung di channel ini sebagai attachment gambar. Bot akan meneruskan bukti ke admin untuk dicek.')
    .addFields(
      { name: 'ID Pesanan', value: order.id, inline: false },
      { name: 'Produk', value: `${product.name} - ${product.variant}`, inline: true },
      { name: 'Total Tagihan', value: formatRupiah(order.price), inline: true },
      { name: 'Format', value: 'PNG, JPG, JPEG, WEBP, atau GIF', inline: false },
      { name: 'Catatan', value: 'Tulis nama pengirim atau jam pembayaran di pesan yang sama jika diperlukan.', inline: false }
    )
    .setColor(0x2b2d31)
    .setTimestamp();

  await channel.send({ content: `<@${order.userId}>`, embeds: [embed] });
  return channel;
}

function findImageAttachment(message) {
  return message.attachments.find((attachment) => {
    const contentType = attachment.contentType || '';
    const fileName = attachment.name || '';
    return contentType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fileName);
  }) ?? null;
}

async function createPaidChannel(interaction, order, product) {
  const buyerName = safeChannelName(order.username || order.userId).slice(0, 24) || order.userId;
  const channelName = safeChannelName(`paid-${order.id}-${buyerName}`);

  const overwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: order.userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];

  if (process.env.ADMIN_ROLE_ID) {
    overwrites.push({
      id: process.env.ADMIN_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels
      ]
    });
  }

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: process.env.CATEGORY_PAID_ID || null,
    permissionOverwrites: overwrites,
    topic: `Channel khusus pesanan ${order.id}`
  });

  const embed = new EmbedBuilder()
    .setTitle('Pembayaran Dikonfirmasi')
    .setDescription('Channel ini dibuat otomatis setelah pembayaran dikonfirmasi admin.')
    .addFields(
      { name: 'ID Pesanan', value: order.id, inline: false },
      { name: 'Produk', value: `${product.name} - ${product.variant}`, inline: true },
      { name: 'Total', value: formatRupiah(order.price), inline: true },
      { name: 'Pembeli', value: `<@${order.userId}>`, inline: false },
      { name: 'Instruksi', value: 'Admin dapat mengirim detail produk, panduan, atau informasi garansi di channel ini.', inline: false }
    )
    .setColor(0x2ecc71)
    .setTimestamp();

  await channel.send({ content: `<@${order.userId}>`, embeds: [embed] });
  return channel;
}

async function handleSetup(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: 'Kamu tidak punya izin untuk menjalankan perintah ini.', ephemeral: true });
    return;
  }

  const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel;
  if (!targetChannel?.isTextBased()) {
    await interaction.reply({ content: 'Channel tujuan harus berupa text channel.', ephemeral: true });
    return;
  }

  await targetChannel.send(buildIntroPayload());

  await interaction.reply({ content: `Panel toko pilihan produk berhasil dikirim ke ${targetChannel}.`, ephemeral: true });
}

async function handleOrderStatus(interaction) {
  const orderId = interaction.options.getString('order_id');

  if (orderId) {
    const order = await findOrder(orderId);
    if (!order) {
      await interaction.reply({ content: 'Pesanan tidak ditemukan.', ephemeral: true });
      return;
    }

    if (order.userId !== interaction.user.id && !isAdmin(interaction)) {
      await interaction.reply({ content: 'Kamu hanya bisa melihat pesanan milikmu sendiri.', ephemeral: true });
      return;
    }

    const product = getProductById(order.productId);
    const embed = new EmbedBuilder()
      .setTitle('Status Pesanan')
      .addFields(
        { name: 'ID Pesanan', value: order.id, inline: false },
        { name: 'Produk', value: product ? `${product.name} - ${product.variant}` : order.productId, inline: true },
        { name: 'Total', value: formatRupiah(order.price), inline: true },
        { name: 'Status', value: order.status, inline: false },
        { name: 'Channel Pembeli', value: order.channelId ? `<#${order.channelId}>` : '-', inline: false },
        { name: 'Channel Upload Bukti', value: order.proofChannelId ? `<#${order.proofChannelId}>` : '-', inline: false }
      )
      .setColor(0x2b2d31);

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const orders = await getUserOrders(interaction.user.id, 5);
  if (orders.length === 0) {
    await interaction.reply({ content: 'Belum ada pesanan.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Pesanan Terakhir')
    .setDescription(
      orders
        .map((order) => `${order.id} — ${formatRupiah(order.price)} — ${order.status}${order.channelId ? ` — <#${order.channelId}>` : ''}`)
        .join('\n')
    )
    .setColor(0x2b2d31);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function createInvoice(interaction, productId) {
  const product = getProductById(productId);

  if (!product) {
    await interaction.reply({ content: 'Produk tidak ditemukan.', ephemeral: true });
    return;
  }

  const order = await createOrder({
    id: makeOrderId(),
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.tag,
    productId: product.id,
    price: product.price,
    status: 'WAITING_PAYMENT',
    createdAt: new Date().toISOString()
  });

  await interaction.reply(buildInvoicePayload(order, product));
}

async function createInvoiceFromButton(interaction) {
  const productId = interaction.customId.split(':')[1];
  await createInvoice(interaction, productId);
}

async function createInvoiceFromSelect(interaction) {
  const productId = interaction.values?.[0];
  await createInvoice(interaction, productId);
}

async function handlePayButton(interaction) {
  const orderId = interaction.customId.split(':')[1];
  const order = await findOrder(orderId);

  if (!order) {
    await interaction.reply({ content: 'Pesanan tidak ditemukan.', ephemeral: true });
    return;
  }

  if (order.userId !== interaction.user.id) {
    await interaction.reply({ content: 'Tombol ini hanya bisa digunakan oleh pembeli pesanan tersebut.', ephemeral: true });
    return;
  }

  if (order.status === 'PAID') {
    await interaction.reply({ content: `Pesanan sudah dibayar. Channel: <#${order.channelId}>`, ephemeral: true });
    return;
  }

  const product = getProductById(order.productId);
  if (!product) {
    await interaction.reply({ content: 'Produk pesanan tidak ditemukan di konfigurasi.', ephemeral: true });
    return;
  }

  if (order.status === 'WAITING_ADMIN_CONFIRMATION') {
    await interaction.reply({ content: 'Bukti pembayaran sudah dikirim ke admin. Tunggu konfirmasi pembayaran.', ephemeral: true });
    return;
  }

  const channel = await createProofUploadChannel(interaction, order, product);
  await interaction.reply({ content: `Silakan upload foto bukti pembayaran di ${channel}.`, ephemeral: true });
}

async function handleProofUploadMessage(message) {
  if (!message.guild || message.author.bot) return;

  const orders = await readOrders();
  const order = orders.find((item) => item.proofChannelId === message.channelId);
  if (!order) return;

  if (message.author.id !== order.userId) {
    await message.reply('Channel ini hanya menerima bukti pembayaran dari pembeli pesanan ini.').catch(() => null);
    return;
  }

  if (!['WAITING_PROOF_UPLOAD', 'PAYMENT_REJECTED'].includes(order.status)) {
    await message.reply('Bukti pembayaran untuk pesanan ini sudah dikirim. Tunggu konfirmasi admin.').catch(() => null);
    return;
  }

  const attachment = findImageAttachment(message);
  if (!attachment) {
    await message.reply('Kirim foto bukti pembayaran sebagai attachment gambar, bukan link. Format yang didukung: PNG, JPG, JPEG, WEBP, atau GIF.').catch(() => null);
    return;
  }

  const product = getProductById(order.productId);
  if (!product) {
    await message.reply('Produk pesanan tidak ditemukan di konfigurasi. Hubungi admin.').catch(() => null);
    return;
  }

  const note = message.content?.trim() || '';
  const proofUrl = attachment.url;
  const proofMessageUrl = message.url;

  const updatedOrder = await updateOrder(order.id, {
    proofUrl,
    proofFileName: attachment.name || 'bukti-pembayaran',
    proofMessageId: message.id,
    proofMessageUrl,
    note,
    status: 'WAITING_ADMIN_CONFIRMATION',
    proofSubmittedAt: new Date().toISOString()
  });

  await sendProofToAdmin(message.guild, updatedOrder, product, proofUrl, note, proofMessageUrl);
  await message.reply('Foto bukti pembayaran berhasil dikirim ke admin. Tunggu konfirmasi pembayaran.').catch(() => null);
}

async function handleConfirmPayment(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: 'Kamu tidak punya izin untuk konfirmasi pembayaran.', ephemeral: true });
    return;
  }

  const orderId = interaction.customId.split(':')[1];
  const order = await findOrder(orderId);

  if (!order) {
    await interaction.reply({ content: 'Pesanan tidak ditemukan.', ephemeral: true });
    return;
  }

  if (order.status === 'PAID') {
    await interaction.reply({ content: `Pesanan sudah dikonfirmasi. Channel: <#${order.channelId}>`, ephemeral: true });
    return;
  }

  const product = getProductById(order.productId);
  if (!product) {
    await interaction.reply({ content: 'Produk pesanan tidak ditemukan di konfigurasi.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  try {
    const channel = await createPaidChannel(interaction, order, product);
    await updateOrder(order.id, {
      status: 'PAID',
      channelId: channel.id,
      paidAt: new Date().toISOString(),
      confirmedBy: interaction.user.id
    });

    await interaction.message.edit({
      content: `Pembayaran ${order.id} dikonfirmasi oleh ${interaction.user}. Channel khusus: ${channel}`,
      components: []
    });

    await interaction.followUp({ content: `Channel khusus berhasil dibuat: ${channel}`, ephemeral: true });
  } catch (error) {
    console.error(error);
    await interaction.followUp({ content: `Gagal membuat channel khusus: ${error.message}`, ephemeral: true });
  }
}

async function handleRejectPayment(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: 'Kamu tidak punya izin untuk menolak pembayaran.', ephemeral: true });
    return;
  }

  const orderId = interaction.customId.split(':')[1];
  const order = await findOrder(orderId);

  if (!order) {
    await interaction.reply({ content: 'Pesanan tidak ditemukan.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();
  await updateOrder(order.id, {
    status: 'PAYMENT_REJECTED',
    rejectedAt: new Date().toISOString(),
    rejectedBy: interaction.user.id
  });

  await interaction.message.edit({
    content: `Pembayaran ${order.id} ditolak oleh ${interaction.user}.`,
    components: []
  });

  if (order.proofChannelId) {
    const proofChannel = await interaction.guild.channels.fetch(order.proofChannelId).catch(() => null);
    if (proofChannel?.isTextBased()) {
      await proofChannel.send({ content: `<@${order.userId}> bukti pembayaran ditolak admin. Silakan upload ulang foto bukti pembayaran yang benar di channel ini.` }).catch(() => null);
    }
  }

  await interaction.followUp({ content: 'Pembayaran ditolak dan user bisa upload ulang bukti pembayaran.', ephemeral: true });
}

client.once('ready', () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup') await handleSetup(interaction);
      if (interaction.commandName === 'pesanan') await handleOrderStatus(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_product') await createInvoiceFromSelect(interaction);
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('buy:')) await createInvoiceFromButton(interaction);
      if (interaction.customId.startsWith('pay:')) await handlePayButton(interaction);
      if (interaction.customId.startsWith('confirm:')) await handleConfirmPayment(interaction);
      if (interaction.customId.startsWith('reject:')) await handleRejectPayment(interaction);
    }
  } catch (error) {
    console.error(error);
    const message = `Terjadi error: ${error.message}`;

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
    }
  }
});

client.on('messageCreate', async (message) => {
  try {
    await handleProofUploadMessage(message);
  } catch (error) {
    console.error(error);
    await message.reply(`Terjadi error saat memproses bukti pembayaran: ${error.message}`).catch(() => null);
  }
});

client.login(process.env.DISCORD_TOKEN);
