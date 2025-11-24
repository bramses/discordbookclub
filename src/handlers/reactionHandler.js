async function handleReaction(reaction, user, prisma) {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the message:', error);
      return;
    }
  }

  const message = reaction.message;
  if (!message.content || message.content.trim() === '') {
    return;
  }

  let dbUser = await prisma.user.findUnique({
    where: { discordId: user.id },
  });

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        discordId: user.id,
        username: user.username,
      },
    });
  }

  try {
    await prisma.entry.create({
      data: {
        content: message.content,
        type: 'REACTION',
        userId: dbUser.id,
        messageId: message.id,
        channelId: message.channel.id,
        isCompleted: true,
      },
    });

    await message.reply(`✅ Added "${message.content}" to the Commonbase! 📚`);
  } catch (error) {
    if (error.code === 'P2002') {
      await message.reply('This message has already been added to the Commonbase.');
    } else {
      console.error('Error adding reaction to commonbase:', error);
      await message.reply('There was an error adding this to the Commonbase. Please try again.');
    }
  }
}

module.exports = { handleReaction };