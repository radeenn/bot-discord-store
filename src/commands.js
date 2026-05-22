import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Kirim panel toko ke channel yang dipilih')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel tempat panel toko dikirim')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('pesanan')
    .setDescription('Cek status pesanan')
    .addStringOption((option) =>
      option
        .setName('order_id')
        .setDescription('ID pesanan, contoh: ORD-XXXX')
        .setRequired(false)
    )
].map((command) => command.toJSON());

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('DISCORD_TOKEN, CLIENT_ID, dan GUILD_ID wajib diisi di file .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

try {
  console.log('Mendaftarkan slash command...');
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Slash command berhasil didaftarkan.');
} catch (error) {
  console.error('Gagal mendaftarkan slash command:', error);
  process.exit(1);
}
