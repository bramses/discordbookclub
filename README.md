# Discord Book Club Bot

A Discord bot for managing a book club's shared knowledge base (commonbase). Members can store quotes, thoughts, and reading lists while the bot tracks books and provides multi-turn conversations for context gathering.

## Features

### Slash Commands
- `/store` - Store an entry to the Commonbase with book autocomplete
- `/cr` - Manage your currently reading list (add, list, mark finished)
- `/bookshelf` - Link to the shared bookshelf web interface
- `/graph` - Link to UMAP visualization of entries
- `/ocr` - Extract text from images with selection interface

### Message Reactions
- React with ➕ to any message to add it to the Commonbase

### Quote Syntax
- Use `>> quote [[book title]]` to quickly add quotes with book references

### Book Mentions
- Use `[[book title]]` anywhere in messages to create clickable links to the bookshelf
- Supports multiple book mentions in one message
- Example: "I just read [[Dune]] and think it's better than [[I, Robot]]"

### Multi-turn Conversations
- Book source clarification when information is missing
- OCR text selection interface
- Book selection from multiple matches

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Discord Bot Setup**

   **Create Discord Application & Bot:**
   1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
   2. Click "New Application" and give it a name (e.g., "Book Club Bot")
   3. Go to the "Bot" section in the left sidebar
   4. Click "Add Bot" then "Yes, do it!"
   5. **Enable Required Intents:**
      - Scroll down to "Privileged Gateway Intents"
      - Enable "MESSAGE CONTENT INTENT" (required for reading message content)
      - Save changes
   6. **Copy the Token** - this is your `DISCORD_TOKEN`
   7. Go to "General Information" in the left sidebar
   8. **Copy the Application ID** - this is your `DISCORD_CLIENT_ID`

   **Get Your Server ID:**
   1. In Discord, go to Settings > Advanced > Enable Developer Mode
   2. Right-click your server name and "Copy Server ID" - this is your `DISCORD_GUILD_ID`

   **Set OAuth2 Redirect (Required):**
   1. In Developer Portal, go to "OAuth2" > "General"
   2. Add a redirect URI: `http://localhost:3000/auth/callback`
   3. Click "Save Changes"

   *Note: This URL won't actually be used since the bot doesn't use OAuth2 login, but Discord requires at least one redirect URI to be set.*

   **Invite Bot to Server:**
   1. Go to "OAuth2" > "URL Generator"
   2. Select scopes: `bot` and `applications.commands`
   3. Select bot permissions: `Send Messages`, `Use Slash Commands`, `Read Message History`, `Add Reactions`
   4. Copy the generated URL and visit it to add bot to your server

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   Fill in the values you just collected:
   ```
   DISCORD_TOKEN=your_bot_token_from_step_2.6
   DISCORD_CLIENT_ID=your_application_id_from_step_2.8
   DISCORD_GUILD_ID=your_server_id_from_step_2.2
   ```

4. **PostgreSQL Database Setup**

   **Option A: Local PostgreSQL**
   ```bash
   # Install PostgreSQL (macOS)
   brew install postgresql
   brew services start postgresql

   # Create database
   createdb discordbookclub

   # Your DATABASE_URL will be:
   DATABASE_URL="postgresql://username:password@localhost:5432/discordbookclub"
   # Replace username/password with your PostgreSQL credentials
   ```

   **Option B: Docker PostgreSQL**
   ```bash
   # Run PostgreSQL in Docker
   docker run --name bookclub-db -e POSTGRES_DB=discordbookclub -e POSTGRES_USER=bookclub -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres

   # Your DATABASE_URL will be:
   DATABASE_URL="postgresql://bookclub:password@localhost:5432/discordbookclub"
   ```

   **Option C: Cloud PostgreSQL (Supabase/Railway/Render)**
   - Create a PostgreSQL instance on your preferred cloud provider
   - Copy the connection string they provide
   - It will look like: `postgresql://user:pass@host:5432/dbname`

5. **Run Database Migrations**
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

6. **Deploy Discord Commands**
   ```bash
   npm run deploy
   ```

7. **Start the Bot**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## Environment Variables

- `DISCORD_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID
- `DISCORD_GUILD_ID` - Your Discord server ID (optional, for guild-specific commands)
- `DATABASE_URL` - PostgreSQL connection string
- `BOOKSHELF_URL` - URL to your Next.js bookshelf app
- `GRAPH_URL` - URL to your UMAP visualization app

## Database Models

- **Users** - Discord user information
- **Books** - Book metadata (title, author, image, etc.)
- **Entries** - Quotes, thoughts, and reactions stored in the commonbase
- **UserBooks** - Reading status tracking (currently reading, finished)
- **ConversationState** - Multi-turn conversation management

## Usage Examples

### Store a quote with book context
```
/store content:"The fox went to the store" book:Dune
```

### Quick quote syntax
```
>> The fox went to the store [[Dune]]
```

### OCR workflow
1. Use `/ocr` with an image attachment
2. Bot extracts text and shows preview
3. Reply with specific text to save or "all" for everything
4. Specify which book the text is from

### Reading list management
```
/cr add title:"Dune" author:"Frank Herbert" image:"https://example.com/cover.jpg"
/cr existing book:Dune
/cr list
/cr finished book:Dune
```

## File Structure

```
src/
├── index.js              # Main bot file
├── deploy-commands.js    # Command deployment script
├── commands/             # Slash command implementations
│   ├── store.js
│   ├── cr.js
│   ├── bookshelf.js
│   ├── graph.js
│   └── ocr.js
├── handlers/             # Event handlers
│   ├── messageHandler.js
│   ├── reactionHandler.js
│   └── conversationHandler.js
└── utils/
    └── commandLoader.js
```

## Contributing

This bot is designed for a 5-person book club reading ~5 books per month each. The commonbase stores all shared knowledge for later exploration and visualization.