async function handleConversation(message, conversationState, prisma) {
  const { state, context } = conversationState;
  const content = message.content.trim().toLowerCase();

  try {
    switch (state) {
      case 'AWAITING_BOOK_SOURCE':
        await handleBookSourceResponse(message, conversationState, prisma);
        break;

      case 'AWAITING_BOOK_SELECTION':
        await handleBookSelection(message, conversationState, prisma);
        break;

      case 'OCR_TEXT_SELECTION':
        await handleOCRTextSelection(message, conversationState, prisma);
        break;

      default:
        await clearConversationState(conversationState.id, prisma);
    }
  } catch (error) {
    console.error('Error in conversation handler:', error);
    await message.reply('Sorry, there was an error processing your response. Please try again.');
    await clearConversationState(conversationState.id, prisma);
  }
}

async function handleBookSourceResponse(message, conversationState, prisma) {
  const { context } = conversationState;
  const response = message.content.trim();

  if (response.toLowerCase() === 'none') {
    await prisma.entry.create({
      data: {
        content: context.content,
        type: 'THOUGHT',
        userId: conversationState.userId,
        sourceUrl: context.sourceUrl,
        messageId: message.id,
        channelId: message.channel.id,
        isCompleted: true,
      },
    });

    await message.reply(`✅ **Stored to Commonbase:**\n"${context.content}"\n💭 As a general thought`);
    await clearConversationState(conversationState.id, prisma);
    return;
  }

  if (response === '1' && context.suggestedTitle) {
    const book = await prisma.book.create({
      data: {
        title: context.suggestedTitle,
      },
    });

    await prisma.entry.create({
      data: {
        content: context.content,
        type: 'QUOTE',
        userId: conversationState.userId,
        bookId: book.id,
        messageId: message.id,
        channelId: message.channel.id,
        isCompleted: true,
      },
    });

    await message.reply(`✅ **Created new book and stored to Commonbase:**\n"${context.content}"\n📚 From: **${book.title}**`);
    await clearConversationState(conversationState.id, prisma);
    return;
  }

  const books = await prisma.book.findMany({
    where: {
      title: {
        contains: response,
        mode: 'insensitive',
      },
    },
    orderBy: {
      title: 'asc',
    },
    take: 10,
  });

  if (books.length === 0) {
    await message.reply(`No books found for "${response}". Please try another search or reply "none" if this is a general thought.`);
    return;
  }

  if (books.length === 1) {
    const book = books[0];

    await prisma.entry.create({
      data: {
        content: context.content,
        type: 'QUOTE',
        userId: conversationState.userId,
        bookId: book.id,
        sourceUrl: context.sourceUrl,
        messageId: message.id,
        channelId: message.channel.id,
        isCompleted: true,
      },
    });

    await message.reply(`✅ **Stored to Commonbase:**\n"${context.content}"\n📚 From: **${book.title}**${book.author ? ` by ${book.author}` : ''}`);
    await clearConversationState(conversationState.id, prisma);
    return;
  }

  const bookList = books.map((book, index) =>
    `**${index + 1}.** ${book.title}${book.author ? ` by ${book.author}` : ''}`
  ).join('\n');

  await message.reply(`📚 Multiple books found:\n\n${bookList}\n\nReply with the number of the correct book.`);

  await prisma.conversationState.update({
    where: { id: conversationState.id },
    data: {
      state: 'AWAITING_BOOK_SELECTION',
      context: {
        ...context,
        books: books.map(book => ({ id: book.id, title: book.title, author: book.author })),
      },
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
}

async function handleBookSelection(message, conversationState, prisma) {
  const { context } = conversationState;
  const selection = parseInt(message.content.trim());

  if (isNaN(selection) || selection < 1 || selection > context.books.length) {
    await message.reply(`Please reply with a number between 1 and ${context.books.length}.`);
    return;
  }

  const selectedBook = context.books[selection - 1];
  const book = await prisma.book.findUnique({
    where: { id: selectedBook.id },
  });

  if (!book) {
    await message.reply('Selected book not found. Please try again.');
    await clearConversationState(conversationState.id, prisma);
    return;
  }

  await prisma.entry.create({
    data: {
      content: context.content,
      type: 'QUOTE',
      userId: conversationState.userId,
      bookId: book.id,
      sourceUrl: context.sourceUrl,
      messageId: message.id,
      channelId: message.channel.id,
      isCompleted: true,
    },
  });

  await message.reply(`✅ **Stored to Commonbase:**\n"${context.content}"\n📚 From: **${book.title}**${book.author ? ` by ${book.author}` : ''}`);
  await clearConversationState(conversationState.id, prisma);
}

async function handleOCRTextSelection(message, conversationState, prisma) {
  const { context } = conversationState;
  const selection = message.content.trim();

  let textToSave;
  if (selection.toLowerCase() === 'all') {
    textToSave = context.fullText;
  } else {
    textToSave = selection;
  }

  const thread = await message.reply({
    content: `📝 **Text selected for saving:**\n"${textToSave}"\n\n🤔 Which book is this from? You can:\n• Type a book title\n• Say "none" if it's a general note`,
  });

  await prisma.conversationState.update({
    where: { id: conversationState.id },
    data: {
      state: 'AWAITING_BOOK_SOURCE',
      context: {
        content: textToSave,
        threadId: thread.id,
      },
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
}

async function clearConversationState(conversationStateId, prisma) {
  try {
    await prisma.conversationState.delete({
      where: { id: conversationStateId },
    });
  } catch (error) {
    console.error('Error clearing conversation state:', error);
  }
}

module.exports = { handleConversation };