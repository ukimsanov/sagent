# WhatsApp AI Sales Agent - Dashboard

Admin dashboard for managing the WhatsApp AI Sales Agent platform. Built with Next.js 15 and deployed on Cloudflare Pages.

## Features

- **Conversations** - Browse and view customer conversation threads
- **Leads** - Track lead scores, status progression, and engagement
- **Products** - Full CRUD operations with image upload to R2
- **Settings** - Configure brand tone, escalation keywords, working hours

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **React**: 19.1.0
- **Styling**: TailwindCSS v4
- **Components**: Radix UI primitives
- **Deployment**: Cloudflare Pages via OpenNext
- **Auth**: WorkOS AuthKit
- **Database**: Cloudflare D1 (shared with worker)
- **Storage**: Cloudflare R2 (product images)

## Development

```bash
# Install dependencies
npm install

# Run development server (with Turbopack)
npm run dev

# Open http://localhost:3000
```

## Preview (Local Cloudflare Runtime)

```bash
npm run preview
```

## Deployment

```bash
# Build and deploy to Cloudflare Pages
npm run deploy
```

## Project Structure

```
dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Dashboard home
│   │   ├── conversations/        # Conversation browser
│   │   │   ├── page.tsx          # List view
│   │   │   └── [id]/page.tsx     # Thread detail
│   │   ├── leads/page.tsx        # Lead management
│   │   ├── products/
│   │   │   ├── page.tsx          # Product catalog
│   │   │   ├── new/page.tsx      # Create product
│   │   │   └── [id]/page.tsx     # Edit product
│   │   ├── settings/page.tsx     # Business config
│   │   └── account/page.tsx      # User account
│   ├── components/               # Shared UI components
│   ├── lib/                      # Utilities
│   └── middleware.ts             # WorkOS auth middleware
├── wrangler.jsonc                # Cloudflare Pages config
└── open-next.config.ts           # OpenNext adapter config
```

## Environment Variables

Set in `wrangler.jsonc` or via Cloudflare dashboard:

```bash
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://your-dashboard.pages.dev/auth/callback
WORKOS_COOKIE_DOMAIN=your-domain.com
```

## Bindings

The dashboard shares bindings with the main worker:

- **D1**: `whatsapp-ai-agent-db` - Same database as worker
- **R2**: `product-images` - Product image storage

## Related

- [Main Worker README](../README.md)
- [Architecture Documentation](../ARCHITECTURE.md)
- [Testing Guide](../TESTING.md)
