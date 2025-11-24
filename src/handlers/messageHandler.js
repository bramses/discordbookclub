async function handleMessage(message, prisma) {
  const quotePattern = /^>>\s*(.+?)\s*\[\[(.+?)\]\]$/;
  const quoteMatch = message.content.match(quotePattern);

  if (quoteMatch) {
    await handleQuoteMessage(message, quoteMatch, prisma);
    return;
  }

  const bookMentionPattern = /\[\[([^\]]+)\]\]/g;
  const bookMentions = [...message.content.matchAll(bookMentionPattern)];

  if (bookMentions.length > 0) {
    await handleBookMentions(message, bookMentions, prisma);
    return;
  }
}

async function handleQuoteMessage(message, match, prisma) {

  const [, quote, bookTitle] = match;

  let user = await prisma.user.findUnique({
    where: { discordId: message.author.id },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        discordId: message.author.id,
        username: message.author.username,
      },
    });
  }

  const books = await prisma.book.findMany({
    where: {
      title: {
        contains: bookTitle,
        mode: 'insensitive',
      },
    },
    orderBy: {
      title: 'asc',
    },
  });

  if (books.length === 0) {
    await message.reply(`📚 No books found matching "${bookTitle}". Would you like to:\n\n1. Add a new book with this title\n2. Try a different search term\n\nReply with "1" to add a new book or try rephrasing your search.`);

    await prisma.conversationState.upsert({
      where: {
        userId_channelId: {
          userId: user.id,
          channelId: message.channel.id,
        },
      },
      update: {
        state: 'AWAITING_BOOK_SOURCE',
        context: {
          content: quote,
          suggestedTitle: bookTitle,
          originalMessage: message.content,
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      create: {
        userId: user.id,
        channelId: message.channel.id,
        state: 'AWAITING_BOOK_SOURCE',
        context: {
          content: quote,
          suggestedTitle: bookTitle,
          originalMessage: message.content,
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return;
  }

  if (books.length === 1) {
    const book = books[0];

    await prisma.entry.create({
      data: {
        content: quote,
        type: 'QUOTE',
        userId: user.id,
        bookId: book.id,
        messageId: message.id,
        channelId: message.channel.id,
        isCompleted: true,
      },
    });

    await message.reply(`✅ **Added to Commonbase:**\n"${quote}"\n📚 From: **${book.title}**${book.author ? ` by ${book.author}` : ''}`);
    return;
  }

  const bookList = books.slice(0, 10).map((book, index) =>
    `**${index + 1}.** ${book.title}${book.author ? ` by ${book.author}` : ''}`
  ).join('\n');

  await message.reply(`📚 Multiple books found for "${bookTitle}":\n\n${bookList}\n\nReply with the number of the correct book.`);

  await prisma.conversationState.upsert({
    where: {
      userId_channelId: {
        userId: user.id,
        channelId: message.channel.id,
      },
    },
    update: {
      state: 'AWAITING_BOOK_SELECTION',
      context: {
        content: quote,
        books: books.slice(0, 10).map(book => ({ id: book.id, title: book.title, author: book.author })),
        originalMessage: message.content,
      },
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
    create: {
      userId: user.id,
      channelId: message.channel.id,
      state: 'AWAITING_BOOK_SELECTION',
      context: {
        content: quote,
        books: books.slice(0, 10).map(book => ({ id: book.id, title: book.title, author: book.author })),
        originalMessage: message.content,
      },
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
}

async function handleBookMentions(message, bookMentions, prisma) {
  const bookshelfUrl = process.env.BOOKSHELF_URL || 'http://localhost:3000';
  const mentionedBooks = [];
  const notFoundBooks = [];

  for (const mentionMatch of bookMentions) {
    const bookTitle = mentionMatch[1].trim();

    const books = await prisma.book.findMany({
      where: {
        title: {
          contains: bookTitle,
          mode: 'insensitive',
        },
      },
      orderBy: {
        title: 'asc',
      },
      take: 1,
    });

    if (books.length > 0) {
      const book = books[0];
      mentionedBooks.push({
        title: book.title,
        author: book.author,
        id: book.id,
        originalText: mentionMatch[0],
      });
    } else {
      notFoundBooks.push({
        title: bookTitle,
        originalText: mentionMatch[0],
      });
    }
  }

  if (mentionedBooks.length === 0 && notFoundBooks.length > 0) {
    const notFoundList = notFoundBooks.map(book => `"${book.title}"`).join(', ');
    await message.reply(`📚 Book(s) not found in database: ${notFoundList}\n\nUse \`/cr add\` to add them first!`);
    return;
  }

  let responseContent = message.content;

  for (const book of mentionedBooks) {
    const bookLink = `[${book.title}](${bookshelfUrl}/book/${book.id})`;
    responseContent = responseContent.replace(book.originalText, bookLink);
  }

  if (notFoundBooks.length > 0) {
    const notFoundList = notFoundBooks.map(book => `"${book.title}"`).join(', ');
    responseContent += `\n\n*Note: ${notFoundList} not found in database*`;
  }

  await message.reply({
    content: `📚 **Book mentions detected:**\n\n${responseContent}`,
    allowedMentions: { parse: [] },
  });
}

module.exports = { handleMessage };