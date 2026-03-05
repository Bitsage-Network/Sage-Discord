import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from './types';
import { config } from './utils/config';
import { logger } from './utils/logger';

const commands: any[] = [];

// Load all command files
const commandsPath = join(__dirname, 'commands');
// When running with tsx, look for .ts files; when compiled, look for .js files
const isTypescript = __filename.endsWith('.ts');
const commandFiles = readdirSync(commandsPath).filter(file =>
  isTypescript ? file.endsWith('.ts') : (file.endsWith('.js') && !file.endsWith('.d.ts'))
);

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const commandModule = require(filePath);
  const command: Command = commandModule.command;

  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    logger.info(`Loaded command: ${command.data.name}`);
  } else {
    logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
  }
}

// Deploy commands
const rest = new REST().setToken(config.token);

(async () => {
  try {
    logger.info(`Started deploying ${commands.length} application (/) commands...`);

    if (config.globalCommands) {
      // Deploy commands globally (takes up to 1 hour to propagate)
      logger.info('Deploying commands GLOBALLY (may take up to 1 hour)');

      const data = await rest.put(
        Routes.applicationCommands(config.applicationId),
        { body: commands }
      ) as any[];

      logger.info(`✅ Successfully deployed ${data.length} global commands`);
    } else {
      // Deploy commands to specific guild (instant)
      if (!config.guildId) {
        logger.error('GUILD_ID is required for guild-specific command deployment');
        logger.error('Either set GUILD_ID in .env or set GLOBAL_COMMANDS=true');
        process.exit(1);
      }

      logger.info(`Deploying commands to guild: ${config.guildId}`);

      const data = await rest.put(
        Routes.applicationGuildCommands(config.applicationId, config.guildId),
        { body: commands }
      ) as any[];

      logger.info(`✅ Successfully deployed ${data.length} guild commands to ${config.guildId}`);
    }

    logger.info('Command deployment complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Error deploying commands', error);
    process.exit(1);
  }
})();
