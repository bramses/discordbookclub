const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('graph')
    .setDescription('Link to the UMAP visualization of the entries'),

  async execute(interaction, prisma) {
    const graphUrl = process.env.GRAPH_URL || 'http://localhost:3001';

    const totalEntries = await prisma.entry.count({
      where: { isCompleted: true },
    });

    const userEntries = await prisma.entry.count({
      where: {
        userId: (await prisma.user.findUnique({
          where: { discordId: interaction.user.id },
        }))?.id,
        isCompleted: true,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('🗺️ Commonbase Graph')
      .setDescription(`Explore the UMAP visualization of our shared knowledge!\n\n[View the Graph](${graphUrl})`)
      .addFields(
        { name: 'Total Entries', value: totalEntries.toString(), inline: true },
        { name: 'Your Entries', value: userEntries.toString(), inline: true }
      )
      .setColor(0x7289DA)
      .setThumbnail('https://cdn.discordapp.com/attachments/123/456/graph-icon.png');

    await interaction.reply({ embeds: [embed] });
  },
};