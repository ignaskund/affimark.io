#!/bin/bash

# =====================================================
# Install Required Packages for Chat-First MVP
# =====================================================

echo "📦 Installing frontend packages..."
cd "/Users/ignaskund/Desktop/FF /affimark/affimark-project/frontend"

npm install --save \
  ai \
  @ai-sdk/anthropic \
  recharts \
  @tanstack/react-table \
  react-markdown \
  remark-gfm \
  @radix-ui/react-avatar \
  @radix-ui/react-scroll-area \
  @radix-ui/react-separator \
  @radix-ui/react-tabs

echo "✅ Frontend packages installed!"

echo ""
echo "📦 Backend already has @anthropic-ai/sdk and @modelcontextprotocol/sdk"
echo "✅ All packages ready!"

echo ""
echo "🎉 Installation complete! Ready to build chat interface."

