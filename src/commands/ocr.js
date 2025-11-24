const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const Tesseract = require('tesseract.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ocr')
    .setDescription('Get text from an image')
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Image to extract text from')
        .setRequired(true)
    ),

  async execute(interaction, prisma) {
    await interaction.deferReply();

    const attachment = interaction.options.getAttachment('image');

    if (!attachment.contentType?.startsWith('image/')) {
      await interaction.editReply('Please provide a valid image file.');
      return;
    }

    try {
      let user = await prisma.user.findUnique({
        where: { discordId: interaction.user.id },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            discordId: interaction.user.id,
            username: interaction.user.username,
          },
        });
      }

      const response = await axios({
        method: 'get',
        url: attachment.url,
        responseType: 'arraybuffer'
      });

      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFile = path.join(tempDir, `ocr-${Date.now()}.${attachment.name.split('.').pop()}`);
      fs.writeFileSync(tempFile, Buffer.from(response.data));

      const { data: { text } } = await Tesseract.recognize(tempFile, 'eng', {
        logger: m => console.log('OCR Progress:', m)
      });

      fs.unlinkSync(tempFile);

      if (!text.trim()) {
        await interaction.editReply('No text could be extracted from the image.');
        return;
      }

      const cleanedText = text.trim();

      const thread = await interaction.editReply({
        content: `🔍 **OCR Complete!**\n\nExtracted text:\n\`\`\`\n${cleanedText}\n\`\`\`\n\n📝 Reply with the specific part you want to save, or "all" to save everything.`,
        fetchReply: true,
      });

      await prisma.conversationState.upsert({
        where: {
          userId_channelId: {
            userId: user.id,
            channelId: interaction.channelId,
          },
        },
        update: {
          state: 'OCR_TEXT_SELECTION',
          context: {
            fullText: cleanedText,
            threadId: thread.id,
          },
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
        create: {
          userId: user.id,
          channelId: interaction.channelId,
          threadId: thread.id,
          state: 'OCR_TEXT_SELECTION',
          context: { fullText: cleanedText },
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

    } catch (error) {
      console.error('OCR Error:', error);
      await interaction.editReply('Sorry, there was an error processing the image. Please try again.');
    }
  },
};