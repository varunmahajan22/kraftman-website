# Admin content manager for the Kraftman Packaging website

Date: 2026-11-18. Status: approved in conversation by Varun ("option 1, go ahead").

## Intent

Kraftman's marketing team should be able to keep the website current without a
developer: put up product photographs, add client logos, and change the wording
on any page. Today they cannot. The site was rebuilt in November 2026 as
server-rendered pages whose text lives in code (`lib/content.js`,
`views/home.html`), while the admin panel (`admin/index.html`) still edits the
previous homepage. Most of what the admin shows now controls nothing visible.

## Who uses it

- **Owner** (Varun): everything.
- **Marketing team**: non-technical. They change product images, client logos
  and page content. They work from a desktop browser.

## Goals

1. Every word on the 13 public pages and the homepage can be changed from the
   admin, by filling in fields.
2. Each of the six product families has a main photo and a gallery of example
   photos with captions, managed from the admin and shown on its product page.
3. Client logos, certifications and contact details stay editable (they already
   are) and keep working.
4. An uploaded image always fits its slot. Nobody has to resize or crop a photo
   before uploading it.
5. A change can be seen on the real page before the public sees it.
6. The marketing login cannot change passwords, users or contact details.

## Non-goals

- Free-form page building: no rich-text editor, no moving sections about, no
  new page types, no custom HTML. Varun chose fill-in fields over a free-form
  editor so that the design and search structure cannot be broken.
- Creating or deleting pages, or changing their addresses.
- Editing the 3D Studio, the five box-construction pages, or the old homepage
  (`/classic.html`).
- Version history beyond one draft and one published copy per page.
- A blog or Resources section.

## Anti-goals

- An edit must never be able to break a page: no state of the fields may
  produce a page that fails to render, loses its heading structure, or drops
  its structured data.
- Certifications must never be typed into page text. They stay a single list,
  so hiding one removes it from every page, description and FAQ at once.
- Nothing on the shared server other than the website is touched.

## Constraints

- Node + Express, JSON file database (`data/db.json`, synchronous read/write),
  `sharp` for images, `multer` for uploads, JWT login. No new runtime
  dependencies unless unavoidable; no build step. The admin stays a single
  static page with inline script, served at `/admin`.
- `data/db.json` is tracked in git and written at runtime on the server.
  Deploys back it up and restore it. Therefore page content must not be lost
  or reset by a deploy: defaults live in code, edits live in the database.
- Helmet CSP: scripts only from self, cdnjs and Google Fonts.
- Static assets are cached for 7 days; every changed JS/CSS file needs its
  `?v=` bumped.
- Uploaded images exist only on the server (`public/uploads/` is not in git),
  so pages must render sensibly when an image is missing.
- Copy style (see `lib/content.js` header) and the facts Varun has confirmed:
  presses are Heidelberg CD 102 and SM 52 only; certifications are GMI, FSC,
  ISO, Sedex, SMETA.

## Approaches considered

**A. Defaults in code, edits in the database (chosen).** `lib/content.js`
stays as the default text for every page. The database gains a `pages` table
holding, per page, a draft and a published copy of the same structure. The
renderer uses the published copy when there is one and the code default when
there is not. Deploys never overwrite edits, a page can be reset to its
default, and new pages added in code appear without a migration.

**B. Move all content into the database.** One source of truth, but the
database is replaced by a backup on every deploy and content shipped in a
release would need a migration script each time. A bad edit or a lost file
leaves no fallback.

**C. Edit in place on the live page.** Click a sentence on the real page and
type. Pleasant for the team, but far more to build, hard to make safe for
lists and tables, and it needs the editor script on every public page.

A was chosen (my call, the how was left to me): it is the only one where a
deploy and an edit cannot destroy each other.

## Design

### Content model

A page is the structure `lib/content.js` already uses:

```
{ title, description,            // Google title and description
  kicker, h1, lead,
  sections: [ { h2, intro?, id?, link?: [href, label], after?,
                one of: paras | rows | steps | tiles | table | facts | bullets
                        | certs (the certification list) | catalogue (the gallery) } ],
  faqs: [ { q, a } ],
  cta: { h2, p } }
```

- The **kind** of each section is fixed by the page's default; the editor
  changes its text and adds, removes or reorders the items inside it (rows,
  bullets, FAQ entries, table rows, paragraphs). Sections themselves cannot be
  added, removed or reordered. This is what keeps the layout safe.
- Text may contain links written `[label](/path)`, as now.
- Text may contain these placeholders, replaced when the page is rendered, so
  facts held elsewhere are never retyped: `{address}`, `{email}`, `{phone}`,
  `{certifications}` (the sentence "GMI certified, FSC certified, …"). The
  defaults in `lib/content.js` are rewritten to use them where they currently
  splice in `ctx` values. A FAQ or section that exists only when there are
  certifications keeps that rule in code (`needs: 'certs'` on the item).
- Limits enforced on save: title ≤ 70 characters, description ≤ 180, h1 and
  every h2 non-empty, at least one item in every list. A save that breaks a
  limit is refused with a message naming the field.
- The homepage is one more page in the same table with its own fixed fields:
  tagline (h1), tagline second line, about heading, about lead, about
  paragraph, the four number-strip pairs, products heading and intro, studio
  band heading and text, capabilities heading and intro, rigid-line heading and
  intro and its four steps, the five rigid-box style descriptions,
  certifications heading, FAQ heading, contact heading and text, FAQs.
  `views/home.html` takes these as `{{ssr:…}}` tokens.

### Draft, preview, publish

- `pages[path] = { draft, published, draft_at, published_at, by }`.
- Saving writes the draft. **Preview** opens the real page at
  `<path>?preview=<token>`; the token is a short-lived signed value from the
  admin API, and a preview response is never cached and carries `noindex`.
- **Publish** copies draft to published. **Discard draft** drops it.
  **Reset to default** removes the page's row, returning it to the code text.
- The Pages list shows, per page: Published, Draft waiting, or Default.

### Products

- The six product families are fixed (they are the six product pages).
- Each family has: a **main photo** (shown in the page header, 4:3) and a
  **gallery** of items `{ image, caption, sort, active }` (shown on its page as
  a grid, 4:3, and on `/products`).
- The old flat `products` table is migrated once: each existing product becomes
  a gallery item in the family matching its category (Mono Cartons → printed
  mono cartons; Corrugated Solutions and Litho Laminated → corrugated boxes;
  Display Boxes → retail display; Hangtags & Labels and Bellybands & Inserts →
  hang tags), its name and description becoming the caption. Items whose image
  is the placeholder are migrated without an image and stay hidden until one is
  uploaded. The old table is left in place, unused.

### Images that fit

- Every upload goes through one function with a **slot**: `product` 1200×900
  cover, `page` 1600×1200 cover, `logo` 400×200 contain on white, `cert`
  400×400 contain on white.
- Cover slots crop to the slot's shape. The crop is centred on a **focus
  point** (default: the middle; `sharp`'s attention strategy picks the first
  guess). In the admin, after upload, the picture is shown with the crop frame;
  dragging sets a new focus point and the image is re-cut from the kept
  original.
- Originals are kept under `public/uploads/originals/` so re-cropping never
  loses quality. Output is JPEG, and WebP alongside it; pages use `<picture>`.
- The **image library** lists every uploaded image with where it is used, and
  only lets an unused image be deleted.

### Clients, certifications, contact details, enquiries

- Clients and certifications keep their current tables and API. Their screens
  are redrawn in the new admin, with drag-to-reorder.
- Contact details (phones, email, address, logo) are a screen of their own,
  owner only.
- Enquiries keep status and delete, gain a CSV export, and show 3D Studio
  specifications in a readable block.

### Users

- `admins` rows gain `role`: `owner` or `editor`. Existing rows become
  `owner`.
- Editors can use: Dashboard, Products, Clients, Pages, Certifications, Image
  library, Enquiries (read and status). Owner only: Contact details, Users,
  passwords of other users, deleting enquiries.
- The role is in the JWT and checked on the server for every owner-only route.
- Owners create and remove editor logins and reset their passwords. Every user
  can change their own password.

### The admin screen

A new single-page admin replaces `admin/index.html`, in the site's own visual
language (Inter and Lexend Exa, ink, paper, gold). Left menu:

```
Dashboard · Products · Clients · Pages · Certifications
Enquiries · Image library · Contact details* · Users*      (* owner only)
```

The Pages editor shows one page at a time: Google title and description with
live character counts at the top, then each section as a card with its heading
and its items, FAQs at the bottom, and a bar with Save draft, Preview, Publish,
Discard draft and Reset to default.

Removed: Page Sections, Cert Badges, Gallery, Capabilities and Site Settings'
hero fields. Their data stays in the database untouched; `/classic.html` goes
on reading it.

The homepage's four capability tabs become homepage fields, replacing the
`capabilities` table for the new site.

## What is left to the builder

- The exact look of the admin, within the visual language above.
- How drag-to-reorder and the focus-point picker are implemented.
- File layout of the new server code.
- Whether the old admin is kept reachable at another address during the
  switch.

## Calls made without asking (for Varun to check)

1. Sections cannot be added, removed or reordered; only their contents can.
2. One draft and one published copy per page; no older history.
3. Old products become gallery items under the six families.
4. The four homepage capability tabs become plain homepage fields.
5. Editors can change certifications and enquiry status, but not contact
   details, users or passwords.
6. Originals of uploaded images are kept on the server for re-cropping.

## Settled after the builder check (2026-11-18)

A reviewer read this document as someone who had to build from it. Its
questions were settled as follows, all as my calls:

1. **"Every word" means the content of the pages**, not the site's furniture.
   Menu and footer labels, button labels, breadcrumbs, the fixed headings
   ("Questions we are asked."), form labels and the 404 page stay in code.
   The six product tiles are edited under Products (name and one line each).
2. **Page photos are part of the page.** Every inner page has an optional
   header photo, edited in Pages, saved with the draft and published with it.
   A page with none keeps the photo it showed before (its product family's,
   the About picture, or a capability's).
3. **Preview covers words, not pictures.** Product photos, client logos and
   certifications go live when saved; each has Show/Hide for holding one back.
4. **Everyone can change their own password.** Only an owner can set someone
   else's. Each person can have their own login.
5. **Certifications in page text are made unnecessary, not forbidden.** The
   placeholders `{certifications}` and `{certified}` exist so nobody needs to
   type them; nothing stops an editor typing one.

## As built

- `lib/content.js` defaults, `lib/store.js` edits over them, `lib/render.js`
  rendering, `lib/images.js` fitting and cropping, `routes/cms.js` the API at
  `/admin/api/cms`, `admin/index.html` the screen. The previous admin is kept
  as `admin/classic.html` and is not served.
- Not built: WebP copies and `<picture>`. Images are JPEG only. The saving
  would be modest and it doubles the files to track; it can be added later
  inside `lib/images.js` without touching anything else.
- Reordering sections' items uses up and down buttons; photos, clients and
  certifications reorder by dragging.
