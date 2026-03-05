/**
 * BitSage Discord Bot - Role Manager Service
 *
 * Manages verified roles and waiting room roles for bot protection
 */

import { Guild, Role, GuildMember, PermissionFlagsBits, ColorResolvable } from 'discord.js';
import { logger } from '../../utils/logger';
import { query } from '../../utils/database';

// ============================================================
// Constants
// ============================================================

const VERIFIED_ROLE_NAME = 'Verified';
const VERIFIED_ROLE_COLOR: ColorResolvable = '#43b581'; // Discord green

const WAITING_ROOM_ROLE_NAME = 'Waiting Room';
const WAITING_ROOM_ROLE_COLOR: ColorResolvable = '#faa61a'; // Discord yellow/orange

// ============================================================
// Verified Role Management
// ============================================================

/**
 * Get or create verified role for a guild
 */
export async function getOrCreateVerifiedRole(guild: Guild): Promise<Role | null> {
  try {
    // Check if guild has verified role configured
    const configResult = await query(
      `SELECT verified_role_id, verified_role_name, auto_create_verified_role
       FROM guild_bot_protection_config
       WHERE guild_id = $1`,
      [guild.id]
    );

    let roleId: string | null = null;
    let roleName = VERIFIED_ROLE_NAME;
    let autoCreate = true;

    if (configResult.rowCount > 0) {
      const config = configResult.rows[0];
      roleId = config.verified_role_id;
      roleName = config.verified_role_name || VERIFIED_ROLE_NAME;
      autoCreate = config.auto_create_verified_role;
    }

    // If role ID is configured, try to fetch it
    if (roleId) {
      try {
        const existingRole = await guild.roles.fetch(roleId);
        if (existingRole) {
          logger.debug('Found existing verified role', {
            guild_id: guild.id,
            role_id: roleId,
            role_name: existingRole.name,
          });
          return existingRole;
        }
      } catch (error) {
        logger.warn('Configured verified role not found, will create new one', {
          guild_id: guild.id,
          role_id: roleId,
        });
      }
    }

    // Check if role exists by name
    const roleByName = guild.roles.cache.find(r => r.name === roleName);
    if (roleByName) {
      // Update config with found role
      await query(
        `UPDATE guild_bot_protection_config
         SET verified_role_id = $1
         WHERE guild_id = $2`,
        [roleByName.id, guild.id]
      );

      logger.info('Found existing verified role by name', {
        guild_id: guild.id,
        role_id: roleByName.id,
        role_name: roleByName.name,
      });

      return roleByName;
    }

    // Create new verified role if auto-create is enabled
    if (!autoCreate) {
      logger.debug('Auto-create verified role disabled', {
        guild_id: guild.id,
      });
      return null;
    }

    const newRole = await guild.roles.create({
      name: roleName,
      color: VERIFIED_ROLE_COLOR,
      reason: 'Auto-created by BitSage Bot for member verification',
      permissions: [],
      mentionable: false,
    });

    // Update config
    await query(
      `INSERT INTO guild_bot_protection_config (guild_id, verified_role_id, verified_role_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id) DO UPDATE
       SET verified_role_id = $2, verified_role_name = $3, updated_at = NOW()`,
      [guild.id, newRole.id, roleName]
    );

    logger.info('Created new verified role', {
      guild_id: guild.id,
      role_id: newRole.id,
      role_name: newRole.name,
    });

    return newRole;
  } catch (error: any) {
    logger.error('Failed to get or create verified role', {
      error: error.message,
      guild_id: guild.id,
    });
    return null;
  }
}

/**
 * Set verified role for a guild (admin configuration)
 */
export async function setVerifiedRole(
  guild: Guild,
  roleId: string,
  autoAssign: boolean = true
): Promise<{ success: boolean; message: string; role?: Role }> {
  try {
    // Fetch the role
    const role = await guild.roles.fetch(roleId);

    if (!role) {
      return {
        success: false,
        message: 'Role not found in this server',
      };
    }

    // Check if role is @everyone
    if (role.id === guild.id) {
      return {
        success: false,
        message: 'Cannot use @everyone as verified role',
      };
    }

    // Check if role is managed (bot role, integration role, etc.)
    if (role.managed) {
      return {
        success: false,
        message: 'Cannot use a managed role (bot roles, integration roles, etc.)',
      };
    }

    // Update config
    await query(
      `INSERT INTO guild_bot_protection_config (
        guild_id, verified_role_id, verified_role_name, auto_assign_verified_role
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (guild_id) DO UPDATE
      SET verified_role_id = $2,
          verified_role_name = $3,
          auto_assign_verified_role = $4,
          updated_at = NOW()`,
      [guild.id, role.id, role.name, autoAssign]
    );

    logger.info('Verified role configured', {
      guild_id: guild.id,
      role_id: role.id,
      role_name: role.name,
      auto_assign: autoAssign,
    });

    return {
      success: true,
      message: `Verified role set to **${role.name}**`,
      role,
    };
  } catch (error: any) {
    logger.error('Failed to set verified role', {
      error: error.message,
      guild_id: guild.id,
      role_id: roleId,
    });

    return {
      success: false,
      message: `Failed to set verified role: ${error.message}`,
    };
  }
}

// ============================================================
// Waiting Room Role Management
// ============================================================

/**
 * Get or create waiting room role for a guild
 */
export async function getOrCreateWaitingRoomRole(guild: Guild): Promise<Role | null> {
  try {
    // Check if guild has waiting room role configured
    const configResult = await query(
      `SELECT waiting_room_role_id, waiting_room_enabled
       FROM guild_bot_protection_config
       WHERE guild_id = $1`,
      [guild.id]
    );

    let roleId: string | null = null;
    let enabled = false;

    if (configResult.rowCount > 0) {
      const config = configResult.rows[0];
      roleId = config.waiting_room_role_id;
      enabled = config.waiting_room_enabled;
    }

    if (!enabled) {
      logger.debug('Waiting room disabled', {
        guild_id: guild.id,
      });
      return null;
    }

    // If role ID is configured, try to fetch it
    if (roleId) {
      try {
        const existingRole = await guild.roles.fetch(roleId);
        if (existingRole) {
          logger.debug('Found existing waiting room role', {
            guild_id: guild.id,
            role_id: roleId,
            role_name: existingRole.name,
          });
          return existingRole;
        }
      } catch (error) {
        logger.warn('Configured waiting room role not found, will create new one', {
          guild_id: guild.id,
          role_id: roleId,
        });
      }
    }

    // Check if role exists by name
    const roleByName = guild.roles.cache.find(r => r.name === WAITING_ROOM_ROLE_NAME);
    if (roleByName) {
      // Update config with found role
      await query(
        `UPDATE guild_bot_protection_config
         SET waiting_room_role_id = $1
         WHERE guild_id = $2`,
        [roleByName.id, guild.id]
      );

      logger.info('Found existing waiting room role by name', {
        guild_id: guild.id,
        role_id: roleByName.id,
        role_name: roleByName.name,
      });

      return roleByName;
    }

    // Create new waiting room role
    const newRole = await guild.roles.create({
      name: WAITING_ROOM_ROLE_NAME,
      color: WAITING_ROOM_ROLE_COLOR,
      reason: 'Auto-created by BitSage Bot for unverified members',
      permissions: [],
      mentionable: false,
    });

    // Update config
    await query(
      `UPDATE guild_bot_protection_config
       SET waiting_room_role_id = $1, updated_at = NOW()
       WHERE guild_id = $2`,
      [newRole.id, guild.id]
    );

    logger.info('Created new waiting room role', {
      guild_id: guild.id,
      role_id: newRole.id,
      role_name: newRole.name,
    });

    return newRole;
  } catch (error: any) {
    logger.error('Failed to get or create waiting room role', {
      error: error.message,
      guild_id: guild.id,
    });
    return null;
  }
}

/**
 * Set waiting room role for a guild (admin configuration)
 */
export async function setWaitingRoomRole(
  guild: Guild,
  roleId: string,
  channelId?: string
): Promise<{ success: boolean; message: string; role?: Role }> {
  try {
    // Fetch the role
    const role = await guild.roles.fetch(roleId);

    if (!role) {
      return {
        success: false,
        message: 'Role not found in this server',
      };
    }

    // Check if role is @everyone
    if (role.id === guild.id) {
      return {
        success: false,
        message: 'Cannot use @everyone as waiting room role',
      };
    }

    // Check if role is managed
    if (role.managed) {
      return {
        success: false,
        message: 'Cannot use a managed role',
      };
    }

    // Verify channel if provided
    if (channelId) {
      const channel = await guild.channels.fetch(channelId);
      if (!channel) {
        return {
          success: false,
          message: 'Waiting room channel not found',
        };
      }
    }

    // Update config
    await query(
      `UPDATE guild_bot_protection_config
       SET waiting_room_role_id = $1,
           waiting_room_channel_id = $2,
           waiting_room_enabled = TRUE,
           updated_at = NOW()
       WHERE guild_id = $3`,
      [role.id, channelId || null, guild.id]
    );

    logger.info('Waiting room role configured', {
      guild_id: guild.id,
      role_id: role.id,
      role_name: role.name,
      channel_id: channelId,
    });

    return {
      success: true,
      message: `Waiting room role set to **${role.name}**`,
      role,
    };
  } catch (error: any) {
    logger.error('Failed to set waiting room role', {
      error: error.message,
      guild_id: guild.id,
      role_id: roleId,
    });

    return {
      success: false,
      message: `Failed to set waiting room role: ${error.message}`,
    };
  }
}

/**
 * Disable waiting room
 */
export async function disableWaitingRoom(guildId: string): Promise<void> {
  await query(
    `UPDATE guild_bot_protection_config
     SET waiting_room_enabled = FALSE, updated_at = NOW()
     WHERE guild_id = $1`,
    [guildId]
  );

  logger.info('Waiting room disabled', { guild_id: guildId });
}

// ============================================================
// Member Role Assignment
// ============================================================

/**
 * Assign verified role to a member
 */
export async function assignVerifiedRole(member: GuildMember): Promise<boolean> {
  try {
    const verifiedRole = await getOrCreateVerifiedRole(member.guild);

    if (!verifiedRole) {
      logger.debug('No verified role configured', {
        guild_id: member.guild.id,
        user_id: member.id,
      });
      return false;
    }

    // Check if member already has the role
    if (member.roles.cache.has(verifiedRole.id)) {
      logger.debug('Member already has verified role', {
        guild_id: member.guild.id,
        user_id: member.id,
      });
      return true;
    }

    // Assign role
    await member.roles.add(verifiedRole, 'Member verified');

    logger.info('Assigned verified role', {
      guild_id: member.guild.id,
      user_id: member.id,
      role_id: verifiedRole.id,
      role_name: verifiedRole.name,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to assign verified role', {
      error: error.message,
      guild_id: member.guild.id,
      user_id: member.id,
    });
    return false;
  }
}

/**
 * Remove waiting room role from a member
 */
export async function removeWaitingRoomRole(member: GuildMember): Promise<boolean> {
  try {
    const configResult = await query(
      `SELECT waiting_room_role_id FROM guild_bot_protection_config
       WHERE guild_id = $1 AND waiting_room_enabled = TRUE`,
      [member.guild.id]
    );

    if (configResult.rowCount === 0) {
      return false;
    }

    const roleId = configResult.rows[0].waiting_room_role_id;

    if (!roleId) {
      return false;
    }

    // Check if member has the role
    if (!member.roles.cache.has(roleId)) {
      return true; // Already doesn't have it
    }

    // Remove role
    await member.roles.remove(roleId, 'Member verified');

    logger.info('Removed waiting room role', {
      guild_id: member.guild.id,
      user_id: member.id,
      role_id: roleId,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to remove waiting room role', {
      error: error.message,
      guild_id: member.guild.id,
      user_id: member.id,
    });
    return false;
  }
}

/**
 * Assign waiting room role to a member
 */
export async function assignWaitingRoomRole(member: GuildMember): Promise<boolean> {
  try {
    const waitingRoomRole = await getOrCreateWaitingRoomRole(member.guild);

    if (!waitingRoomRole) {
      logger.debug('Waiting room not enabled', {
        guild_id: member.guild.id,
        user_id: member.id,
      });
      return false;
    }

    // Check if member already has the role
    if (member.roles.cache.has(waitingRoomRole.id)) {
      return true;
    }

    // Assign role
    await member.roles.add(waitingRoomRole, 'New member - awaiting verification');

    logger.info('Assigned waiting room role', {
      guild_id: member.guild.id,
      user_id: member.id,
      role_id: waitingRoomRole.id,
      role_name: waitingRoomRole.name,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to assign waiting room role', {
      error: error.message,
      guild_id: member.guild.id,
      user_id: member.id,
    });
    return false;
  }
}

// ============================================================
// Exports
// ============================================================

export default {
  getOrCreateVerifiedRole,
  setVerifiedRole,
  getOrCreateWaitingRoomRole,
  setWaitingRoomRole,
  disableWaitingRoom,
  assignVerifiedRole,
  removeWaitingRoomRole,
  assignWaitingRoomRole,
};
