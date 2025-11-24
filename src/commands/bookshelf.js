const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bookshelf')
    .setDescription('Link to the shared bookshelf'),

  async execute(interaction, prisma) {
    const bookshelfUrl = process.env.BOOKSHELF_URL || 'http://localhost:3000';

    const embed = new EmbedBuilder()
      .setTitle('📚 Book Club Bookshelf')
      .setDescription(`Check out our shared bookshelf to see all the books we've read!\n\n[Visit the Bookshelf](${bookshelfUrl})`)
      .setColor(0x00AE86)
      .setThumbnail('https://cdn.discordapp.com/attachments/123/456/bookshelf-icon.png');

    await interaction.reply({ embeds: [embed] });
  },
};