#!/bin/bash

echo "🔧 Creating frontend/.env.local file..."

cat > "/Users/ignaskund/Desktop/FF /affimark/affimark-project/frontend/.env.local" << 'EOF'
# Core
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://pquedymrcxfzqwfpbrmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdWVkeW1yY3hmenF3ZnBicm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MzA1MTYsImV4cCI6MjA3NjIwNjUxNn0.Bve2Em_49ANI_p10ueQ2_hOTV7qZs_jLabrP0ygeQmA
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdWVkeW1yY3hmenF3ZnBicm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDYzMDUxNiwiZXhwIjoyMDc2MjA2NTE2fQ.W5mInWou4dtz3sKL2VOETivVGp_D9YSNOCRJVI1dZfw

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=Td8HoWZmWJK8iduhMakq7SQZtwBtJXXruGSNLFwrGwM=

# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:8787
BACKEND_API_KEY=66b52ffcf11682a4971bf11e0c24c818ada4114ab8524e1b15672e5c238c9b3e

# Anthropic Claude API
ANTHROPIC_API_KEY=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

# YouTube OAuth
YOUTUBE_CLIENT_ID=701918515261-loi4h1ndrhlkno22jit7lmdkfq4b6jom.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=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

# Twitter/X OAuth
TWITTER_CLIENT_ID=placeholder
TWITTER_CLIENT_SECRET=placeholder

# TikTok OAuth
TIKTOK_CLIENT_KEY=awctcsyr0ki0f5bo
TIKTOK_CLIENT_SECRET=vF02rObp8EJG8FYVeELxb1AmarVaczy3
EOF

echo "✅ File created at: frontend/.env.local"
echo ""
echo "🚀 Next steps:"
echo "1. Open Terminal 1: cd backend && npm run dev"
echo "2. Open Terminal 2: cd frontend && npm run dev"
echo "3. Visit http://localhost:3000"
echo ""
echo "✨ You're ready to go!"

