const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const prisma = new PrismaClient();
client.commands = new Collection();
client.prisma = prisma;

const { loadCommands } = require('./utils/commandLoader');
const { handleReaction } = require('./handlers/reactionHandler');
const { handleMessage } = require('./handlers/messageHandler');
const { handleConversation } = require('./handlers/conversationHandler');

loadCommands(client);

client.once('ready', async () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);

  try {
    await prisma.$connect();
    console.log('Connected to database');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, prisma);
    } catch (error) {
      console.error('Error executing command:', error);
      const reply = { content: 'There was an error executing this command!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction, prisma);
    } catch (error) {
      console.error('Error in autocomplete:', error);
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name === '➕') {
    await handleReaction(reaction, user, prisma);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const conversationState = await prisma.conversationState.findUnique({
    where: {
      userId_channelId: {
        userId: message.author.id,
        channelId: message.channel.id,
      },
    },
  });

  if (conversationState) {
    await handleConversation(message, conversationState, prisma);
  } else {
    await handleMessage(message, prisma);
  }
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);