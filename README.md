# TikTok Helper

Text TikTok links to save and organize meals, events, and date ideas automatically.

## Features

- 📱 **SMS Integration** - Text TikTok links to your personal phone number
- 🤖 **AI-Powered Analysis** - Automatically extracts and categorizes content using Google Gemini
- 🍽️ **Meal Recipes** - Saves ingredients, steps, and cooking times
- 🎉 **Events** - Captures location, date/time, and ticket requirements
- 💕 **Date Ideas** - Organizes places and activities for date nights
- 🔐 **Phone Verification** - Secure access to your personal collection
- 📊 **Beautiful Dashboard** - Browse your saves in a modern, organized interface

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 1.5 Pro (video analysis)
- **SMS**: Twilio
- **Video Download**: RapidAPI TikTok Scraper
- **Styling**: Tailwind CSS + shadcn/ui
- **Deployment**: Vercel

## Setup

### 1. Clone and Install

```bash
git clone <your-repo>
cd tiktok-helper
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase/schema.sql`
3. Copy your project URL and keys from Settings > API

### 3. Set Up Twilio

1. Sign up at [twilio.com](https://twilio.com)
2. Buy a phone number with SMS capability (for receiving texts)
3. Copy your Account SID and Auth Token from the dashboard
4. **Create a Verify Service** (required for sending verification codes):
   - Go to [Twilio Verify Services](https://console.twilio.com/us1/develop/verify/services)
   - Click "Create new"
   - Name it something like "TikTok Helper"
   - Copy the Service SID (starts with `VA...`)

> **Why Twilio Verify?** Sending SMS from a regular Twilio phone number to US recipients requires [A2P 10DLC registration](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc), which involves a lengthy approval process. Twilio Verify uses pre-registered phone pools that bypass this requirement, making setup instant.

### 4. Set Up Google AI (Gemini)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Enable the Gemini API

### 5. Set Up RapidAPI (TikTok Scraper)

1. Sign up at [rapidapi.com](https://rapidapi.com)
2. Subscribe to the "TikTok Video No Watermark" API
3. Copy your RapidAPI key

### 6. Configure Environment Variables

Create a `.env.local` file:

```env
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_VERIFY_SERVICE_SID=VA...  # From Twilio Verify Services

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google AI (Gemini)
GOOGLE_AI_API_KEY=your_gemini_api_key

# RapidAPI (TikTok Scraper)
RAPIDAPI_KEY=your_rapidapi_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 7. Run Locally

```bash
npm run dev
```

### 8. Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add all environment variables (update `NEXT_PUBLIC_APP_URL` to your production URL)
4. Deploy

### 9. Configure Twilio Webhook

1. Go to your Twilio Console
2. Navigate to Phone Numbers > Manage > Active Numbers
3. Select your number
4. Under "Messaging", set the webhook URL:
   - **When a message comes in**: `https://your-app.vercel.app/api/twilio/webhook`
   - **HTTP Method**: POST

## Usage

1. **Text a TikTok link** to your Twilio phone number
2. Wait a few seconds for processing
3. **Visit the website** and enter your phone number
4. **Verify with the SMS code** sent to your phone
5. **Browse your organized content** in the dashboard

## API Routes

| Route                 | Method | Description                          |
| --------------------- | ------ | ------------------------------------ |
| `/api/twilio/webhook` | POST   | Receives SMS from Twilio             |
| `/api/process`        | POST   | Downloads and analyzes TikTok videos |
| `/api/auth/send-code` | POST   | Sends verification code              |
| `/api/auth/verify`    | POST   | Verifies code and creates session    |
| `/api/auth/session`   | GET    | Checks current session               |
| `/api/auth/logout`    | POST   | Ends session                         |
| `/api/content`        | GET    | Fetches user's saved content         |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── twilio/webhook/     # SMS receiver
│   │   ├── process/            # Video processing
│   │   ├── auth/               # Authentication
│   │   └── content/            # Content API
│   ├── dashboard/              # Dashboard page
│   ├── page.tsx                # Login page
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn components
│   ├── content-card.tsx        # Content display cards
│   └── category-tabs.tsx       # Category navigation
└── lib/
    ├── supabase.ts             # Database client
    ├── twilio.ts               # SMS client
    ├── tiktok.ts               # Video downloader
    └── gemini.ts               # AI analysis
```

## Content Categories

- **Meal** 🍽️ - Recipes with ingredients and cooking steps
- **Event** 🎉 - Events with location, date, and ticket info
- **Date Idea** 💕 - Places and activities for dates
- **Other** 📌 - Everything else

## License

MIT
