const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('store')
    .setDescription('Store an entry to the Commonbase')
    .addStringOption(option =>
      option.setName('content')
        .setDescription('The content to store')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('book')
        .setDescription('The book this entry is from')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('source')
        .setDescription('URL or additional source information')
        .setRequired(false)
    ),

  async autocomplete(interaction, prisma) {
    const focusedValue = interaction.options.getFocused();

    const books = await prisma.book.findMany({
      where: {
        title: {
          contains: focusedValue,
          mode: 'insensitive',
        },
      },
      take: 25,
      orderBy: {
        title: 'asc',
      },
    });

    await interaction.respond(
      books.map(book => ({
        name: `${book.title}${book.author ? ` by ${book.author}` : ''}`,
        value: book.id,
      })),
    );
  },

  async execute(interaction, prisma) {
    const content = interaction.options.getString('content');
    const bookId = interaction.options.getString('book');
    const sourceUrl = interaction.options.getString('source');

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

    if (!bookId) {
      const thread = await interaction.reply({
        content: `📝 **Entry received:** "${content}"\n\n🤔 Which book is this from? You can:\n• Type a book title\n• Say "none" if it's a general thought`,
        fetchReply: true,
      });

      await prisma.conversationState.upsert({
        where: {
          userId_channelId: {
            userId: user.id,
            channelId: thread.channelId,
          },
        },
        update: {
          state: 'AWAITING_BOOK_SOURCE',
          context: { content, sourceUrl, threadId: thread.id },
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
        create: {
          userId: user.id,
          channelId: thread.channelId,
          threadId: thread.id,
          state: 'AWAITING_BOOK_SOURCE',
          context: { content, sourceUrl },
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      return;
    }

    const book = await prisma.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      await interaction.reply({ content: 'Book not found!', ephemeral: true });
      return;
    }

    await prisma.entry.create({
      data: {
        content,
        type: 'QUOTE',
        userId: user.id,
        bookId: book.id,
        sourceUrl,
        isCompleted: true,
        messageId: interaction.id,
        channelId: interaction.channelId,
      },
    });

    await interaction.reply(`✅ **Stored to Commonbase**\n"${content}"\n📚 From: **${book.title}**`);
  },
};