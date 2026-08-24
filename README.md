This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Google Drive as a database (gdrive-db)

DataLens can treat a folder in your own Google Drive as a live database,
using [`gdrive-db`](https://www.npmjs.com/package/gdrive-db) — an
open-source SDK that stores each collection as a JSON file under
`DataLens/<database>/` in your Drive.

```bash
npm i gdrive-db
```

- Repo: https://github.com/syedmuhammadali-dev/G-Drive-DB
- Only requests the least-privilege `drive.file` scope (access to files/
  folders the app itself creates — never your whole Drive).

### What it enables in this app

- **Sign in with Google** from the Sidebar "Drive database" panel in
  `/workspace`.
- **Connect a database** (a Drive folder). Its collections list like tables.
- **Import a collection as a table** — browse and query it exactly like a
  CSV/Excel/JSON import, including with SQL.
- **Push a local table to Drive** to create a new collection from it.
- **Edit and delete**:
  - via SQL — run `INSERT`/`UPDATE`/`DELETE` in the SQL console, then hit the
    cloud/sync icon next to a linked table to push the changes back to Drive.
  - via a MongoDB-style panel — click a collection to open a document view
    with `insert`/`find`/`update`/`delete`, calling the `gdrive-db`
    `Collection` API directly.

### Setup

1. Create a Google Cloud project, enable the **Google Drive API**.
2. Create an OAuth **Web application** client ID, add your dev/prod origins
   under "Authorized JavaScript origins".
3. Copy `.env.example` to `.env.local` and set
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to that client ID.
4. Restart `npm run dev`. The Drive database panel activates automatically
   once the client ID is present.

`gdrive-db` caches its access token in memory only — reloading the page
requires signing in again, consistent with this app's no-persistence rule.
It has no transactions and is not a replacement for Postgres/Mongo/Firebase;
see the package docs for its filter/concurrency limits.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
