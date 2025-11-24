const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cr')
    .setDescription('Manage books you are currently reading')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Show books you are currently reading')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a book to your currently reading list')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Book title')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('author')
            .setDescription('Book author')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('image')
            .setDescription('Book cover image URL')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('existing')
        .setDescription('Add an existing book from database to your reading list')
        .addStringOption(option =>
          option.setName('book')
            .setDescription('Select a book from the database')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('finished')
        .setDescription('Mark a book as finished')
        .addStringOption(option =>
          option.setName('book')
            .setDescription('Select from your currently reading books')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction, prisma) {
    const subcommand = interaction.options.getSubcommand();
    const focusedValue = interaction.options.getFocused();

    let user = await prisma.user.findUnique({
      where: { discordId: interaction.user.id },
    });

    if (!user) {
      await interaction.respond([]);
      return;
    }

    if (subcommand === 'existing') {
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
    } else if (subcommand === 'finished') {
      const userBooks = await prisma.userBook.findMany({
        where: {
          userId: user.id,
          status: 'CURRENTLY_READING',
        },
        include: {
          book: true,
        },
        orderBy: {
          book: {
            title: 'asc',
          },
        },
      });

      const filtered = userBooks.filter(userBook =>
        userBook.book.title.toLowerCase().includes(focusedValue.toLowerCase())
      );

      await interaction.respond(
        filtered.slice(0, 25).map(userBook => ({
          name: `${userBook.book.title}${userBook.book.author ? ` by ${userBook.book.author}` : ''}`,
          value: userBook.id,
        })),
      );
    }
  },

  async execute(interaction, prisma) {
    const subcommand = interaction.options.getSubcommand();

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

    if (subcommand === 'list') {
      const currentlyReading = await prisma.userBook.findMany({
        where: {
          userId: user.id,
          status: 'CURRENTLY_READING',
        },
        include: {
          book: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (currentlyReading.length === 0) {
        await interaction.reply('📚 You are not currently reading any books. Use `/cr add` to add some!');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📚 Currently Reading')
        .setDescription(
          currentlyReading.map((userBook, index) =>
            `**${index + 1}.** ${userBook.book.title}${userBook.book.author ? ` by ${userBook.book.author}` : ''}`
          ).join('\n')
        )
        .setColor(0x00AE86);

      await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'add') {
      const title = interaction.options.getString('title');
      const author = interaction.options.getString('author');
      const imageUrl = interaction.options.getString('image');

      // Create new book
      let book;
      try {
        book = await prisma.book.create({
          data: {
            title,
            author,
            imageUrl,
          },
        });
      } catch (error) {
        if (error.code === 'P2002') {
          await interaction.reply({
            content: `A book with the title "${title}" already exists. Use \`/cr existing\` to add it to your reading list instead.`,
            ephemeral: true
          });
          return;
        }
        throw error;
      }

      await prisma.userBook.upsert({
        where: {
          userId_bookId: {
            userId: user.id,
            bookId: book.id,
          },
        },
        create: {
          userId: user.id,
          bookId: book.id,
          status: 'CURRENTLY_READING',
          startDate: new Date(),
        },
        update: {
          status: 'CURRENTLY_READING',
          startDate: new Date(),
          endDate: null,
        },
      });

      await interaction.reply(`📖 Added "${book.title}" to your currently reading list and the database!`);

    } else if (subcommand === 'existing') {
      const bookId = interaction.options.getString('book');

      const book = await prisma.book.findUnique({
        where: { id: bookId },
      });

      if (!book) {
        await interaction.reply({ content: 'Book not found!', ephemeral: true });
        return;
      }

      const existing = await prisma.userBook.findUnique({
        where: {
          userId_bookId: {
            userId: user.id,
            bookId: book.id,
          },
        },
      });

      if (existing && existing.status === 'CURRENTLY_READING') {
        await interaction.reply({
          content: `You are already reading "${book.title}"!`,
          ephemeral: true
        });
        return;
      }

      await prisma.userBook.upsert({
        where: {
          userId_bookId: {
            userId: user.id,
            bookId: book.id,
          },
        },
        create: {
          userId: user.id,
          bookId: book.id,
          status: 'CURRENTLY_READING',
          startDate: new Date(),
        },
        update: {
          status: 'CURRENTLY_READING',
          startDate: new Date(),
          endDate: null,
        },
      });

      await interaction.reply(`📖 Added "${book.title}" to your currently reading list!`);

    } else if (subcommand === 'finished') {
      const userBookId = interaction.options.getString('book');

      const userBook = await prisma.userBook.findUnique({
        where: { id: userBookId },
        include: { book: true },
      });

      if (!userBook || userBook.userId !== user.id) {
        await interaction.reply({ content: 'Book not found in your currently reading list!', ephemeral: true });
        return;
      }

      await prisma.userBook.update({
        where: { id: userBookId },
        data: {
          status: 'FINISHED',
          endDate: new Date(),
        },
      });

      await interaction.reply(`✅ Marked "${userBook.book.title}" as finished! Great job! 🎉`);
    }
  },
};