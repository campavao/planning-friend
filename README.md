# Planning Friend 📒✨

**Text it. Save it. Plan it.**

Your planning friend! Text links from TikTok, Instagram, and more to save and organize meals, events, and date ideas in your personal scrapbook.

## Features

- 📱 **SMS Integration** - Text links to your personal phone number
- 🤖 **AI-Powered Analysis** - Automatically extracts and categorizes content using Google Gemini
- 🍽️ **Meal Recipes** - Saves ingredients, steps, and cooking times
- 🍹 **Drink Recipes** - Cocktails, smoothies, and beverage creations
- 🎉 **Events** - Captures location, date/time, and ticket requirements
- 💕 **Date Ideas** - Organizes places and activities for date nights
- ✈️ **Travel** - Saves destinations and travel recommendations
- 🎁 **Gift Ideas** - Track gift ideas with prices and purchase links
- 📅 **Weekly Planner** - Drag and drop your saves into a weekly schedule
- 🏷️ **Tags** - AI-suggested and custom tags for easy filtering
- 🤝 **Sharing** - Share your planner with friends via share codes
- 📒 **Scrapbook Design** - Beautiful, playful interface

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.5 Flash (video/image analysis)
- **SMS**: Twilio
- **Video Download**: RapidAPI TikTok Scraper
- **Styling**: Tailwind CSS + shadcn/ui
- **Deployment**: Vercel

## Setup

### 1. Clone and Install

```bash
git clone <your-repo>
cd planning-friend
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run these schema files in order:
   - `supabase/schema.sql` - Core tables
   - `supabase/schema-planner.sql` - Planner tables
   - `supabase/schema-gifts.sql` - Gift planner tables
   - `supabase/schema-tags.sql` - Tags system
   - `supabase/schema-v2.sql` - Travel, drinks, settings, sharing
3. Copy your project URL and keys from Settings > API

### 3. Set Up Twilio

1. Sign up at [twilio.com](https://twilio.com)
2. Buy a phone number with SMS capability
3. Copy your Account SID and Auth Token
4. **Create a Verify Service** for sending verification codes:
   - Go to [Twilio Verify Services](https://console.twilio.com/us1/develop/verify/services)
   - Click "Create new" and name it "Planning Friend"
   - Copy the Service SID (starts with `VA...`)

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
TWILIO_VERIFY_SERVICE_SID=VA...

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
3. Add all environment variables
4. Deploy

### 9. Configure Twilio Webhook

1. Go to your Twilio Console > Phone Numbers
2. Select your number
3. Set the webhook URL: `https://your-app.vercel.app/api/twilio/webhook` (POST)

## Usage

1. **Text a link** to your Planning Friend phone number
2. Wait a few seconds for processing
3. **Visit the website** and verify with your phone number
4. **Browse your scrapbook** in the dashboard
5. **Plan your week** with the weekly planner

## Content Categories

- 🍽️ **Meal** - Recipes with ingredients and steps
- 🍹 **Drink** - Cocktails, smoothies, coffee drinks
- 🎉 **Event** - Events with location and dates
- 💕 **Date Idea** - Places and activities for dates
- 🎁 **Gift Idea** - Products and gift recommendations
- ✈️ **Travel** - Destinations outside your home region
- 📌 **Other** - Everything else

## License

MIT
