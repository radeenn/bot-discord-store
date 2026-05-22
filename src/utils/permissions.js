import { PermissionFlagsBits } from 'discord.js';

export function isAdmin(interaction) {
  const adminRoleId = process.env.ADMIN_ROLE_ID;

  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  if (!adminRoleId) return false;
  return interaction.member?.roles?.cache?.has(adminRoleId) ?? false;
}
