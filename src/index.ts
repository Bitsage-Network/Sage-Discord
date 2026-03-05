import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from './types';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { apiClient } from './utils/api-client';
import { initializeDatabase, checkDatabaseHealth, closeDatabase } from './utils/database';
import { handleMessageCreate } from './events/messageCreate';
import { handleGuildMemberAdd } from './events/guildMemberAdd';
import { handleInteractionCreate } from './events/interactionCreate';
import { registerGuildHandlers } from './bot-protection/events/guild-join-handler';
import { startMemberPruningScheduler, stopMemberPruningScheduler } from './bot-protection/services/member-prune-service';
import { initializeTokenGating } from './token-gating';
import { initializeRoleSyncHandler } from './token-gating/events/role-sync-handler';

// Extend Client type to include commands
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent // Required for reading message content
  ]
});

// Initialize commands collection
client.commands = new Collection<string, Command>();

// Store background tasks
let pruningSchedulerInterval: NodeJS.Timeout | null = null;
let roleSyncHandler: any = null;

// Load commands
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js') && !file.endsWith('.d.ts'));

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const commandModule = require(filePath);
  const command: Command = commandModule.command;

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    logger.info(`Loaded command: ${command.data.name}`);
  } else {
    logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
  }
}

// Load token-gating commands
logger.info('Loading token-gating commands...');
const tokenGatingUserCommands = ['verify-wallet', 'wallet-status', 'disconnect-wallet'];
for (const cmdName of tokenGatingUserCommands) {
  try {
    const cmdPath = join(__dirname, 'token-gating', 'commands', 'user', `${cmdName}.js`);
    const cmdModule = require(cmdPath);
    const command: Command = {
      data: cmdModule.data,
      execute: cmdModule.execute
    };
    client.commands.set(command.data.name, command);
    logger.info(`Loaded token-gating command: ${command.data.name}`);
  } catch (error: any) {
    logger.warn(`Failed to load token-gating command ${cmdName}: ${error.message}`);
  }
}

// Load token-gating admin command
try {
  const tokenGateCmdPath = join(__dirname, 'token-gating', 'commands', 'admin', 'token-gate.js');
  const tokenGateCmdModule = require(tokenGateCmdPath);
  const command: Command = {
    data: tokenGateCmdModule.data,
    execute: tokenGateCmdModule.execute
  };
  client.commands.set(command.data.name, command);
  logger.info(`Loaded token-gating command: ${command.data.name}`);
} catch (error: any) {
  logger.warn(`Failed to load token-gate command: ${error.message}`);
}

// Ready event
client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`✅ Bot logged in as ${readyClient.user.tag}`);
  logger.info(`📊 Serving ${client.guilds.cache.size} guilds`);
  logger.info(`⚙️ ${client.commands.size} commands loaded`);

  // Initialize database
  try {
    initializeDatabase(config.databaseUrl);
    const dbHealthy = await checkDatabaseHealth();
    if (dbHealthy) {
      logger.info('✅ Database connection healthy');
    } else {
      logger.warn('⚠️ Database health check failed');
    }
  } catch (error) {
    logger.error('❌ Database initialization failed', error);
  }

  // Check API health
  const apiHealthy = await apiClient.healthCheck();
  if (apiHealthy) {
    logger.info('✅ BitSage API is healthy');
  } else {
    logger.warn('⚠️ BitSage API health check failed - some commands may not work');
  }

  // Set bot status
  readyClient.user.setPresence({
    activities: [{
      name: 'BitSage Network',
      type: 3 // Watching
    }],
    status: 'online'
  });

  // Register bot protection handlers
  registerGuildHandlers(client);
  logger.info('✅ Guild join/leave handlers registered');

  // Start member pruning scheduler
  pruningSchedulerInterval = startMemberPruningScheduler(client);
  logger.info('✅ Member pruning scheduler started');

  // Initialize token-gating module
  try {
    const tokenGating = initializeTokenGating();
    const health = await tokenGating.healthCheck();
    if (health.overall) {
      logger.info('✅ Token-gating module initialized and healthy');

      // Initialize verification services (includes scheduler)
      tokenGating.initializeVerificationServices(client);
      logger.info('✅ Wallet verification services started');

      // Start role sync handler
      roleSyncHandler = initializeRoleSyncHandler(client);
      logger.info('✅ Token-gating role sync started');

      // Initialize reward management services
      try {
        const { RewardDeliveryService } = require('./services/reward-delivery-service');
        const { RewardEligibilityService } = require('./services/reward-eligibility-service');
        const { RewardScheduler } = require('./services/reward-scheduler');

        const rewardDeliveryService = new RewardDeliveryService(client);
        const rewardEligibilityService = new RewardEligibilityService(
          tokenGating.ruleGroupEvaluator
        );
        const rewardScheduler = new RewardScheduler(
          rewardDeliveryService,
          rewardEligibilityService
        );

        rewardScheduler.start(client);

        // Store globally for other modules to access
        (global as any).rewardScheduler = rewardScheduler;
        (global as any).rewardEligibilityService = rewardEligibilityService;
        (global as any).discordClient = client;

        logger.info('✅ Reward management services initialized');
      } catch (error: any) {
        logger.error('❌ Failed to initialize reward management', {
          error: error.message,
          note: 'Reward features will be disabled'
        });
      }
    } else {
      logger.warn('⚠️ Token-gating module initialized but health check failed');
      logger.warn('⚠️ Token-gating features may not work correctly');
    }
  } catch (error: any) {
    logger.error('❌ Failed to initialize token-gating module', {
      error: error.message,
      note: 'Token-gating features will be disabled'
    });
  }

  // Start periodic tasks if enabled
  if (config.enableNetworkStats && config.networkStatsChannelId) {
    startNetworkStatsUpdates();
  }

  if (config.enableJobNotifications && config.jobNotificationChannelId) {
    startJobNotifications();
  }
});

// Interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      logger.info(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}`, error);

      const errorMessage = { content: 'There was an error executing this command!', ephemeral: true };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }

  // Handle button interactions (verification, etc.)
  if (interaction.isButton()) {
    await handleInteractionCreate(interaction);
  }
});

// Message create handler - Award XP
client.on(Events.MessageCreate, async (message) => {
  await handleMessageCreate(message);
});

// Guild member add handler - Onboarding
client.on(Events.GuildMemberAdd, async (member) => {
  await handleGuildMemberAdd(member);
});

// Error handlers
client.on(Events.Error, (error) => {
  logger.error('Discord client error', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');

  // Stop pruning scheduler
  if (pruningSchedulerInterval) {
    stopMemberPruningScheduler(pruningSchedulerInterval);
  }

  // Stop role sync handler
  if (roleSyncHandler) {
    roleSyncHandler.stop();
    logger.info('✅ Token-gating role sync stopped');
  }

  client.destroy();
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');

  // Stop pruning scheduler
  if (pruningSchedulerInterval) {
    stopMemberPruningScheduler(pruningSchedulerInterval);
  }

  // Stop role sync handler
  if (roleSyncHandler) {
    roleSyncHandler.stop();
    logger.info('✅ Token-gating role sync stopped');
  }

  client.destroy();
  await closeDatabase();
  process.exit(0);
});

// Periodic network stats updates
function startNetworkStatsUpdates() {
  const interval = config.networkStatsUpdateInterval * 60 * 1000; // Convert to ms

  setInterval(async () => {
    try {
      if (!config.networkStatsChannelId) return;

      const channel = await client.channels.fetch(config.networkStatsChannelId);
      if (!channel?.isTextBased()) return;

      const stats = await apiClient.getNetworkStats();

      const message = [
        '📊 **Network Update**',
        `👥 Active Workers: ${stats.active_workers}/${stats.total_workers}`,
        `⚙️ Jobs: ${stats.completed_jobs} completed, ${stats.pending_jobs} pending`,
        `🔐 Proofs Generated: ${stats.total_proofs_generated}`
      ].join('\n');

      await (channel as any).send(message);
      logger.info('Posted network stats update');
    } catch (error) {
      logger.error('Error posting network stats update', error);
    }
  }, interval);

  logger.info(`Started network stats updates (every ${config.networkStatsUpdateInterval} minutes)`);
}

// Job completion notifications
let lastCheckedJobId: string | null = null;

function startJobNotifications() {
  const interval = config.jobPollInterval * 60 * 1000; // Convert to ms

  setInterval(async () => {
    try {
      if (!config.jobNotificationChannelId) return;

      const jobs = await apiClient.getJobs(10);
      const completedJobs = jobs.filter(j => j.status === 'completed');

      // Get new completed jobs since last check
      const newJobs = lastCheckedJobId
        ? completedJobs.filter(j => j.job_id > lastCheckedJobId!)
        : completedJobs.slice(0, 1); // Only show latest on first run

      if (newJobs.length === 0) return;

      const channel = await client.channels.fetch(config.jobNotificationChannelId);
      if (!channel?.isTextBased()) return;

      for (const job of newJobs) {
        const message = [
          '✅ **Job Completed**',
          `**Job ID**: \`${job.job_id}\``,
          `**Type**: ${job.job_type}`,
          `**Worker**: \`${job.worker_address.slice(0, 10)}...\``,
          `**Payment**: ${job.payment_amount} wei`
        ].join('\n');

        await (channel as any).send(message);
      }

      // Update last checked job ID
      lastCheckedJobId = completedJobs[0].job_id;

      logger.info(`Posted ${newJobs.length} job completion notifications`);
    } catch (error) {
      logger.error('Error posting job notifications', error);
    }
  }, interval);

  logger.info(`Started job notifications (every ${config.jobPollInterval} minutes)`);
}

// Login to Discord
client.login(config.token).catch((error) => {
  logger.error('Failed to login to Discord', error);
  process.exit(1);
});
