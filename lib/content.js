/**
 * The words on every page except the homepage.
 *
 * House style, so the site reads like the plant talking and not like a brochure:
 *   - Say what a thing is, what it is made of and what it is for. Name the
 *     machine, the board, the number.
 *   - Short sentences, "we" and "you", British spelling. No slogans.
 *   - Only claim what is on the floor today. What is on order is called on order.
 *   - Certifications and contact details are never written here. They come
 *     from the admin panel and are dropped in through placeholders, so hiding
 *     a certification there removes it from every page.
 *
 * These are the DEFAULTS. The marketing team edits them in the admin; their
 * edits are kept in the database (lib/store.js) and laid over these, so a
 * deploy never overwrites an edit and any page can be reset to what is here.
 *
 * A page: { path, crumb, title, description, kicker, h1, lead, photoFrom?, sections, faqs, cta }
 * A section has an `h2`, an optional `intro`, `link` and `after`, and one body:
 *   paras | rows [[title, text, href?]] | steps [[title, text]] | table { head, rows }
 *   | facts [[label, value]] | bullets [text]
 *   | certs (the certification list) | catalogue (the product photo gallery) | families (the product tiles)
 * The kind of each section is fixed here; the admin changes what is inside it.
 * `fixed: true` also fixes how many items it has. `needs: 'certs'` (or
 * 'cert:gmi') drops a section or a question when that certification is hidden.
 * Copy may link with [label](/path), and use these placeholders:
 *   {address} {email} {phone}
 *   {certifications}         GMI certified, FSC certified, …
 *   {certified}              Kraftman Packaging is GMI certified, … .   (or nothing)
 *   {certification-details}  what each one means, as sentences
 */

const QUOTE_NEEDS = [
  'The product: what it is, its size and its weight.',
  'The pack size in millimetres, length × width × height, if you already have one.',
  'Quantity per order, and roughly how many orders a year.',
  'Board or material, if you have a preference.',
  'Number of colours and any finishes: lamination, foil, embossing, spot UV, a window.',
  'Artwork or a dieline as a PDF, if it exists. A photo of a current pack also helps.',
  'Where it has to be delivered.',
];

// The product families the site starts with: the tiles on the homepage and on /products, and the owners of
// the photo galleries. More can be added in the admin (Products); those get a page built by productPage().
const FAMILIES = [
  { slug: 'printed-mono-cartons', name: 'Printed Mono Cartons', blurb: 'Folding cartons in FBB, SBS and duplex board: tuck end, auto-bottom, windowed and hanging styles.', was: ['Mono Cartons'] },
  { slug: 'corrugated-boxes', name: 'Corrugated & Litho-Laminated Boxes', blurb: 'Offset-printed sheets laminated to corrugated board for retail boxes, and flexo-printed shipping cartons.', was: ['Corrugated Solutions', 'Litho Laminated'] },
  { slug: 'retail-display-packaging', name: 'PDQ & Retail Displays', blurb: 'Counter displays, PDQ trays and shelf-ready packaging that arrive filled and go straight on shelf.', was: ['Display Boxes'] },
  { slug: 'backer-cards', name: 'Cards & Inserts', blurb: 'Backer, header and blister cards, folded U, L and J cards, and printed inserts.', was: [] },
  { slug: 'hang-tags', name: 'Hang Tags', blurb: 'Die-cut hang tags and swing tags, with bellybands and sleeves.', was: ['Hangtags & Labels', 'Bellybands & Inserts'] },
  { slug: 'rigid-boxes', name: 'Rigid Boxes', blurb: 'Greyboard wrapped in printed paper: lid and base, magnetic, shoulder neck, drawer and collapsible.', was: [] },
];

function pages() {
  const certified = '{certified}';
  const contactLine = 'Use the form on the [contact page](/contact), email {email} or call {phone}.';
  const quote = (h2, p) => ({ h2, p, buttons: [['/contact', 'Request a quote'], ['/studio.html', 'Kraftman 3D Studio']] });

  return [

    /* ══ ABOUT ═══════════════════════════════════════════════════════ */
    {
      path: '/about', crumb: 'About',
      title: 'About Kraftman Packaging | Packaging Manufacturer in Palwal',
      description: 'Kraftman Packaging Private Limited has printed and converted paperboard packaging in Palwal, Haryana since 2016: mono cartons, corrugated boxes, displays, cards and rigid boxes.',
      kicker: 'About us', h1: 'About Kraftman Packaging',
      lead: 'Kraftman Packaging Private Limited prints and converts paperboard packaging in Palwal, Haryana, in the Delhi NCR region. The plant has been running since 2016.',
      photoFrom: 'about',
      sections: [
        { h2: 'What we do', paras: [
          'We make the printed packaging a product is sold in and shipped in: [mono cartons](/products/printed-mono-cartons), [litho-laminated corrugated boxes](/products/corrugated-boxes), [PDQ and counter displays](/products/retail-display-packaging), [backer and header cards](/products/backer-cards), [hangtags](/products/hang-tags) and [rigid boxes](/products/rigid-boxes).',
          'Most of it is for consumer goods: hardware and tools, home improvement, electronics accessories, toys, household products, cosmetics and FMCG. A good share ends up on the shelves of large retail chains, in India and abroad, so we are used to working from a retailer packaging manual, a colour target and a transit test.',
          'Design, plates, printing, lamination, die-cutting, gluing and testing are all done in the one plant. When something needs sorting out, there is one team to call.',
        ] },
        { h2: 'How we work', rows: [
          ['We start from the product', 'Before we quote we ask what goes inside, what it weighs, how it will be shipped and where it will be sold. Those four answers decide the board, the structure and the finish.'],
          ['We show it before we print it', 'The structure is drawn in ArtiosCAD, rendered in 3D and cut as a plain sample on our sample table. You hold a sample in your hand before any plates are made.'],
          ['We measure colour', 'Colour is read with a spectrophotometer against the approved target and recorded as a Delta E value. Nobody signs off colour by eye alone.'],
          ['We check before we pack', 'Lamination, die-cutting, creasing, glue and dimensions are checked at each stage. Transit tests are run when your specification asks for them.'],
        ], link: ['/quality', 'How we control quality'] },
        { h2: 'The plant', facts: [
          ['Location', '{address}'],
          ['Running since', '2016'],
          ['Offset presses', 'Heidelberg CD 102, Heidelberg SM 52'],
          ['Flute lamination', 'Lamify Advanced SFC-1500, Lamify Ultra, FluteXpert 1650'],
          ['Die-cutting', 'Century MWB 1450 and MWZ 1450, sheets up to 52 × 72 inches'],
          ['Design', 'ESKO ArtiosCAD, 3D rendering, sample-making table'],
        ], link: ['/capabilities', 'Machines and capabilities'] },
        { h2: 'Certifications and audits', intro: 'Each of these is checked by an outside body, not by us.', certs: true, needs: 'certs', link: ['/quality', 'Quality and certifications'] },
        { h2: 'What we are aiming for', paras: [
          'We want to be the supplier a packaging buyer does not have to chase: samples on the day we said, colour inside tolerance, cartons at the dock when the purchase order says.',
          'The next step is a [fully automatic rigid box line](/products/rigid-boxes), which is on order.',
        ] },
      ],
      faqs: [
        ['Who is Kraftman Packaging?', 'Kraftman Packaging Private Limited is a paperboard packaging manufacturer in Palwal, Haryana, India. It prints and converts mono cartons, litho-laminated corrugated boxes, PDQ displays, backer and header cards, hangtags and rigid boxes, and has been in production since 2016.'],
        ['Where is Kraftman Packaging located?', 'The plant is at {address}.'],
        ['Does Kraftman Packaging export?', 'We make packaging for customers in India and for companies that supply retail chains overseas. Tell us the delivery point and we will quote to it.'],
        ['Which certifications does Kraftman Packaging hold?', 'We are {certifications}.', 'certs'],
      ],
      cta: quote('Want to see the plant or a sample?', 'Tell us what you are packing and we will send samples of similar work, or arrange a visit.'),
    },

    /* ══ PRODUCTS ════════════════════════════════════════════════════ */
    {
      path: '/products', crumb: 'Products',
      title: 'Packaging Products: Cartons, Corrugated, Displays | Kraftman',
      description: 'What Kraftman Packaging makes: printed mono cartons, litho-laminated corrugated boxes, PDQ displays, backer and header cards, hangtags and rigid boxes, all to your size and artwork.',
      kicker: 'Products', h1: 'What we make',
      lead: 'A wide range of printed paperboard packaging, all made to your size and artwork in our Palwal plant.',
      sections: [
        { h2: 'Product families', families: true },
        { h2: 'From the catalogue', intro: 'Recent examples of each.', catalogue: true },
        { h2: 'Not sure which you need?', paras: [
          'Send us the product and how it will be sold. A power tool on a pallet at a warehouse club, a lipstick on a counter and a pack of screws on a peg hook need three different packs, and we will tell you which one we would make.',
          'You can also build a pack in the [Kraftman 3D Studio](/studio.html): enter the size, upload artwork, add foil or a window, and send us the result.',
        ] },
      ],
      faqs: [
        ['What types of packaging does Kraftman Packaging manufacture?', 'Printed mono cartons, litho-laminated and flexo-printed corrugated boxes, PDQ and counter displays, shelf-ready trays, backer cards, header cards, blister cards, U, L and J cards, hangtags, bellybands, inserts and rigid boxes.'],
        ['Is everything custom made?', 'Yes. Every job is made to order, to the size, board, print and finish the customer specifies.'],
        ['How do I get a price?', 'Send the product details, pack size, quantity and finish. ' + contactLine],
      ],
      cta: quote('Have a pack in mind?', 'Send us the size, the quantity and the finish, or build it in 3D first.'),
    },

    {
      path: '/products/printed-mono-cartons', crumb: 'Printed mono cartons', parent: '/products',
      title: 'Printed Mono Carton Manufacturer in India | Kraftman Packaging',
      description: 'Custom printed mono cartons and folding cartons in FBB, SBS and duplex board. Tuck end, auto-bottom, windowed and hanging styles, offset printed in Palwal, Haryana.',
      kicker: 'Products', h1: 'Printed mono cartons',
      lead: 'A mono carton is a folding carton made from a single sheet of paperboard: printed, die-cut, folded and glued. We make them to your size and artwork, for retail shelves and for e-commerce.',
      photoFrom: 'family',
      sections: [
        { h2: 'Styles we make', rows: [
          ['Straight tuck end', 'Both tuck flaps fold from the same panel, so the front edge stays clean. The usual choice when the carton has a window.'],
          ['Reverse tuck end', 'The top and bottom tucks fold from opposite panels. It nests more tightly on the sheet, so it normally uses a little less board.'],
          ['Auto-bottom (crash-lock)', 'The base is glued and folds flat. It snaps into place when the carton is opened, which makes hand packing quick and carries a heavier product.'],
          ['Lock bottom (1-2-3 bottom)', 'The base flaps lock into each other without glue. It costs less than an auto-bottom and takes a few seconds longer to erect.'],
          ['Window cartons', 'A die-cut opening in the front, left open or closed with a clear film patched behind it.'],
          ['Hanging cartons', 'A carton with a hang tab and a euro slot or round hole, for peg display.'],
          ['Sleeves', 'An open-ended printed wrap that slides over a tray, a tub or another carton.'],
        ] },
        { h2: 'Board', intro: 'We will suggest a board once we know the product. These are the ones we use most.', table: {
          head: ['Board', 'What it is', 'Where it is used'],
          rows: [
            ['FBB (folding box board)', 'Several plies of virgin fibre with a coated white face. Stiff for its weight.', 'Cosmetics, pharmaceutical and food cartons, and anything that has to feel substantial.'],
            ['SBS (solid bleached sulphate)', 'Bleached fibre right through the sheet, white on both sides. The cleanest print surface.', 'Cartons with foil, embossing or fine type, where the inside is seen.'],
            ['Duplex board (CCNB)', 'Recycled-fibre board with a coated white face and a grey or white back.', 'Hardware, household goods and cartons where cost matters most.'],
          ],
        }, after: 'Most folding cartons use board between 250 and 400 gsm. Tell us what the product weighs and we will recommend one.' },
        { h2: 'Print and finish', bullets: [
          'Offset printing in CMYK, with Pantone spot colours where a brand colour has to be exact.',
          'Gloss or matt lamination, and UV coating over the whole sheet or on chosen areas (spot UV).',
          'Hot foil stamping, embossing and debossing.',
          'Window patching with clear film.',
          'Blister coating for cartons and cards that are heat-sealed to a plastic blister.',
        ], link: ['/capabilities', 'See the presses and finishing equipment'] },
        { h2: 'What to send for a quote', bullets: QUOTE_NEEDS },
      ],
      faqs: [
        ['What is a mono carton?', 'A mono carton, also called a folding carton, is a box made from one layer of paperboard that is printed, die-cut, creased and glued. It ships flat and is erected when it is filled. Toothpaste, medicine, cosmetics and small hardware are usually sold in one.'],
        ['What is the difference between FBB, SBS and duplex board?', 'FBB is a multi-ply virgin-fibre board that is stiff for its weight. SBS is bleached virgin fibre throughout, white on both sides, and gives the cleanest print. Duplex board is made from recycled fibre with a coated white face and is the most economical of the three.'],
        ['Can you match a Pantone colour on a carton?', 'Yes. Brand colours are printed as Pantone spot inks and measured against the target with a spectrophotometer. The result is reported as a Delta E value. See [how we control colour](/quality).'],
        ['Do you make mono cartons with a window?', 'Yes. The window is die-cut to any shape and can be left open or patched with clear film. You can try window sizes in the [Kraftman 3D Studio](/studio.html).'],
        ['Which costs less, a straight tuck or a reverse tuck carton?', 'Usually the reverse tuck, because it nests more closely on the printed sheet and wastes less board. The difference is small, and a straight tuck is worth it when the front edge has to look clean.'],
      ],
      cta: quote('Need a mono carton?', 'Send us the product size and quantity, or enter them in Kraftman 3D Studio and see the carton first.'),
    },

    {
      path: '/products/corrugated-boxes', crumb: 'Corrugated boxes', parent: '/products',
      title: 'Corrugated Box Manufacturer in India | Kraftman Packaging',
      description: 'Litho-laminated corrugated boxes with offset print, and flexo-printed shipping cartons in A, B, C and E flute up to 5-ply. Made by Kraftman Packaging in Palwal, Haryana.',
      kicker: 'Products', h1: 'Corrugated and litho-laminated boxes',
      lead: 'We make printed corrugated boxes two ways. Litho-laminated boxes carry an offset-printed sheet on corrugated board, for packs that sit on a shop floor. Flexo-printed boxes are for shipping.',
      photoFrom: 'family',
      sections: [
        { h2: 'Litho-laminated boxes', paras: [
          'The outer sheet is printed on our offset presses, exactly as a carton would be. It is then mounted on single-face corrugated board on a flute laminator, and die-cut. The result has the print quality of a carton and the strength to hold a power tool, a small appliance or a boxed toy.',
          'Three flute laminators do this work: a Lamify Advanced SFC-1500, a Lamify Ultra and a FluteXpert 1650. Sheets up to 52 × 72 inches are die-cut afterwards.',
        ] },
        { h2: 'Shipping cartons', rows: [
          ['Regular slotted carton (RSC)', 'The standard shipper: four flaps top and bottom that meet in the middle. FEFCO style 0201.'],
          ['Die-cut boxes and mailers', 'Self-locking boxes cut to shape, for e-commerce and for products that need a snug fit.'],
          ['Trays and master shippers', 'Outer cases that carry a set number of retail packs, sized to the pallet.'],
          ['Printing', 'Two-colour direct flexo print on brown or white board, for logos, handling marks and barcodes.'],
        ] },
        { h2: 'Flute and ply', intro: 'We run A, B, C and E flute, in 3-ply and 5-ply.', table: {
          head: ['Flute', 'Thickness', 'What it is good at'],
          rows: [
            ['E flute', 'about 1.5 mm', 'A flat surface for print. Retail boxes, mailers and litho-laminated packs.'],
            ['B flute', 'about 3 mm', 'Resists crushing. Shippers, trays and displays.'],
            ['C flute', 'about 4 mm', 'Stacking strength. General-purpose master shippers.'],
            ['A flute', 'about 5 mm', 'Cushioning. Fragile or heavy contents.'],
            ['5-ply (double wall)', 'two flutes combined', 'Heavy loads, tall stacks and export shipping.'],
          ],
        } },
        { h2: 'How we size a box', paras: [
          'A box is specified from four things: what the contents weigh, how many go in, how high the boxes will be stacked, and how they travel, whether by courier, on a pallet or in a container. From that we choose the flute, the ply and the paper.',
          'Burst strength and compression are tested in our own lab. Drop and transit tests are run when the customer or the retailer specifies them.',
        ], link: ['/quality', 'Testing and quality control'] },
        { h2: 'What to send for a quote', bullets: QUOTE_NEEDS },
      ],
      faqs: [
        ['What is a litho-laminated box?', 'A litho-laminated box is a corrugated box whose outer face is a sheet printed by offset lithography and then glued to the corrugated board. It gives photographic print quality on a box strong enough for heavy products.'],
        ['When should I choose litho lamination over flexo printing?', 'Choose litho lamination when the box is what the shopper sees: full-colour images, fine type, gloss or matt finishes. Choose flexo printing for shipping cartons that carry a logo and handling marks.'],
        ['Which flute should I use?', 'E flute for retail boxes and mailers that need a good print surface, B flute for shippers and displays, C flute for general master shippers, and a 5-ply double wall for heavy or stacked loads. Tell us the weight and the stack height and we will recommend one.'],
        ['What is the difference between 3-ply and 5-ply board?', '3-ply board is one fluted layer between two liners. 5-ply board has two fluted layers and three liners, which makes it stiffer and much better at carrying weight in a stack.'],
        ['How large a corrugated box can you make?', 'We die-cut sheets up to 52 × 72 inches. Send the box size and we will confirm how it fits on our presses and die-cutters.'],
      ],
      cta: quote('Need a printed corrugated box?', 'Send us the contents, the weight and the quantity and we will specify the board.'),
    },

    {
      path: '/products/retail-display-packaging', crumb: 'PDQ and retail displays', parent: '/products',
      title: 'PDQ Display Box Manufacturer in India | Kraftman Packaging',
      description: 'PDQ trays, counter display units and shelf-ready packaging designed, printed and die-cut by Kraftman Packaging in Palwal, Haryana, to retailer shelf and transit requirements.',
      kicker: 'Products', h1: 'PDQ and retail display packaging',
      lead: 'A PDQ is a printed tray or box that reaches the store already filled and goes straight onto the shelf or the counter. We design, print and die-cut PDQs, counter displays and shelf-ready trays.',
      photoFrom: 'family',
      sections: [
        { h2: 'What we make', rows: [
          ['PDQ trays', 'A tray with a low front lip and a printed header card behind the product.'],
          ['Counter display units', 'Small displays for the till point, often with tiers or dividers to hold the product upright.'],
          ['Shelf-ready packaging', 'A shipper with a tear-away front. Staff pull off the perforated panel and slide the tray onto the shelf.'],
          ['Floor displays', 'Free-standing corrugated units for promotions and seasonal lines.'],
          ['Display trays and dividers', 'Inserts that keep each product in its place during transit and on display.'],
        ] },
        { h2: 'What a display has to do', rows: [
          ['Fit the shelf', 'The retailer gives a shelf depth and a height between shelves. The tray is drawn to those first, and to the product second.'],
          ['Travel full', 'A display is shipped with the product in it. It has to pass the same drop and vibration tests as a shipper.'],
          ['Open without a knife', 'Perforations are tuned so the front tears off cleanly by hand and does not tear in transit.'],
          ['Show the product', 'The front lip is kept as low as the product allows, so the shopper sees the product and not the cardboard.'],
        ] },
        { h2: 'How we develop one', steps: [
          ['Brief', 'You send the product, the pack count and the retailer shelf or planogram dimensions.'],
          ['Structure', 'We draw the display in ArtiosCAD and send a 3D render.'],
          ['Plain sample', 'A white sample is cut on our sample table and filled with your product.'],
          ['Test', 'The filled sample is checked for fit and, where specified, drop and transit tested.'],
          ['Print and convert', 'The display is offset printed or litho-laminated, die-cut and packed flat or pre-glued.'],
        ], link: ['/packaging-development', 'More on packaging development'] },
        { h2: 'What to send for a quote', bullets: QUOTE_NEEDS },
      ],
      faqs: [
        ['What does PDQ mean in packaging?', 'PDQ is retail shorthand for a display that can be put on the shelf "pretty darn quick". It is a printed tray or box that arrives filled with product, so store staff place it on the shelf or counter without unpacking anything.'],
        ['What is the difference between a PDQ and shelf-ready packaging?', 'A PDQ is a display tray, usually with a header, that sits on a counter or shelf. Shelf-ready packaging is a shipping case with a perforated front that tears away to turn the case itself into the shelf tray.'],
        ['Do you design the display or only print it?', 'Both. We design the structure in ArtiosCAD, cut a sample, test it with your product, and then print and convert it. We can also work from your dieline.'],
        ['Can I see a display before ordering?', 'Yes. You get a 3D render and then a plain cut sample. You can also try a PDQ in your own size in the [Kraftman 3D Studio](/studio.html).'],
      ],
      cta: quote('Planning a retail display?', 'Send the product, the pack count and the shelf size.'),
    },

    {
      path: '/products/backer-cards', crumb: 'Backer and header cards', parent: '/products',
      title: 'Backer Card Manufacturer in India | Kraftman Packaging',
      description: 'Printed backer cards, header cards, blister cards and folded U, L and J cards for peg-hook retail display, made by Kraftman Packaging in Palwal, Haryana.',
      kicker: 'Products', h1: 'Backer cards, header cards and blister cards',
      lead: 'Printed paperboard cards that carry a product on a peg hook. We print, coat and die-cut them to the product and to the retailer hang-hole specification.',
      sections: [
        { h2: 'Types of card', rows: [
          ['Backer card', 'A flat printed card the product is tied, clipped or stapled to. Also used as an insert behind a product in a clear bag or clamshell.'],
          ['Header card', 'A card folded over the top of a polybag and stapled or sealed, with the hang hole in the fold.'],
          ['Blister card', 'A card with a heat-seal coating. A formed plastic blister holding the product is sealed onto its face.'],
          ['U-card', 'A card folded twice into a U, so the product sits between a back panel and a front panel of the same height.'],
          ['J-card', 'Folded like a U-card with a shorter front panel, which leaves most of the product visible.'],
          ['L-card', 'A back panel and a base, folded once. The product stands on the base.'],
        ] },
        { h2: 'Hang holes', paras: [
          'The hole is cut to whatever the store fixture needs: a euro slot, a round hole or a slot for a peg hook. If the retailer has a hang-hole drawing, send it and we will cut to it.',
          'Heavy products need the hole further from the top edge and a stiffer board, or the card tears on the hook. We check this on the sample.',
        ] },
        { h2: 'Board and finish', bullets: [
          'SBS, FBB or duplex board, usually between 300 and 450 gsm depending on the weight the card carries.',
          'Printed one side or both sides, in CMYK and Pantone spot colours.',
          'Gloss or matt varnish, UV coating or lamination.',
          'Blister coating on the face of cards that are sealed to a blister.',
        ] },
        { h2: 'What to send for a quote', bullets: QUOTE_NEEDS },
      ],
      faqs: [
        ['What is a backer card?', 'A backer card is a printed paperboard card that a product is fixed to, or placed behind, so it can hang on a peg hook and carry the branding, barcode and product information.'],
        ['What is the difference between a backer card and a header card?', 'A backer card sits behind the product and is roughly the size of the whole pack. A header card is a narrow card folded over the top of a bag, and only covers the top.'],
        ['What is blister coating?', 'Blister coating is a heat-seal lacquer printed onto the face of a card. When a plastic blister is pressed onto it with heat, the coating melts and bonds the blister to the card.'],
        ['What are U-cards, J-cards and L-cards?', 'They are folded cards. A U-card has a back and a front panel of equal height, a J-card has a shorter front panel, and an L-card has only a back panel and a base. All three can be tried in the [Kraftman 3D Studio](/studio.html).'],
      ],
      cta: quote('Need printed cards?', 'Send the product, the card size and the hang-hole drawing if you have one.'),
    },

    {
      path: '/products/hang-tags', crumb: 'Hangtags and bellybands', parent: '/products',
      title: 'Hang Tag Manufacturer in India | Kraftman Packaging',
      description: 'Custom printed paperboard hangtags, swing tags, bellybands, sleeves and inserts with foil, embossing and spot UV, made by Kraftman Packaging in Palwal, Haryana.',
      kicker: 'Products', h1: 'Hangtags, bellybands and printed inserts',
      lead: 'The small printed pieces that travel with a product: hangtags and swing tags, bellybands and sleeves that wrap it, and inserts that sit inside the pack.',
      sections: [
        { h2: 'What we make', rows: [
          ['Hangtags and swing tags', 'Die-cut to any shape, single or folded, with a drilled or die-cut hole for string.'],
          ['Bellybands', 'A printed band that wraps round a product or a plain box and holds it shut.'],
          ['Sleeves', 'A full wrap, open at both ends, that slides over a tray or carton.'],
          ['Inserts and leaflets', 'Printed cards that sit inside a pack to hold the product or carry instructions.'],
        ] },
        { h2: 'Board and finish', bullets: [
          'Coated and uncoated boards, and kraft board for a natural look.',
          'Printed both sides in CMYK and Pantone spot colours.',
          'Hot foil stamping, embossing, debossing and spot UV.',
          'Matt, gloss or soft-touch lamination.',
        ], link: ['/capabilities', 'See printing and finishing equipment'] },
        { h2: 'Small formats, short runs', paras: [
          'Tags and bands are printed many-up on a sheet. Smaller quantities and small formats run on our Heidelberg SM 52, which keeps the make-ready short.',
        ] },
        { h2: 'What to send for a quote', bullets: QUOTE_NEEDS },
      ],
      faqs: [
        ['What is a hangtag?', 'A hangtag, or swing tag, is a printed card tied to a product with string or a plastic fastener. It carries the brand, the price and product details, and is most common on clothing, accessories and gifts.'],
        ['What is a bellyband?', 'A bellyband is a strip of printed paper or board that wraps round a product or a plain box. It brands the pack and can hold it closed, at less cost than printing the whole box.'],
        ['Can hangtags have foil or embossing?', 'Yes. Tags can be hot foil stamped, embossed, debossed and spot UV coated. You can preview these finishes in the [Kraftman 3D Studio](/studio.html).'],
      ],
      cta: quote('Need tags or bands?', 'Send the size, the quantity and the finish.'),
    },

    {
      path: '/products/rigid-boxes', crumb: 'Rigid boxes', parent: '/products',
      title: 'Rigid Box Manufacturer in India | Kraftman Packaging',
      description: 'Rigid boxes in five styles: lid and base, magnetic closure, shoulder neck, drawer and collapsible. See how each is made, step by step. Kraftman Packaging, Palwal, Haryana.',
      kicker: 'Products', h1: 'Rigid boxes',
      lead: 'A rigid box is made from thick greyboard wrapped in printed paper. It keeps its shape, it feels heavier than a carton, and it is the box people keep.',
      sections: [
        { h2: 'Five styles', intro: 'Each style has a page that shows how it is built, step by step.', rows: [
          ['Lid and base', 'Two wrapped trays. The lid is cut slightly larger so it slides down over the base. Used for gifting, apparel, confectionery and electronics.', '/lid-base-box.html'],
          ['Magnetic closure (book style)', 'A wrapped tray glued into a hinged case. Magnets hidden in the flap and the front wall pull it shut.', '/rigid-box.html'],
          ['Shoulder neck', 'An inner neck stands above the rim of the base, so the lid and the base meet flush with a band of contrast colour between them.', '/shoulder-box.html'],
          ['Drawer', 'A tray with a ribbon pull that slides out of a rigid sleeve. Used for jewellery, accessories and chocolates.', '/drawer-box.html'],
          ['Collapsible', 'Every board sits on one wrap with hinge gaps between them. The box ships flat and is erected in seconds, which saves freight and storage.', '/collapsible-box.html'],
        ], fixed: true },
        { h2: 'A fully automatic line, on order', paras: [
          'We have ordered a fully automatic rigid box line. It feeds and glues the printed wrap, places the board tray on it with a camera-guided robot, then wraps and forms the box, with nobody handling the product in between.',
          'It is not running yet. This page will be updated when the line is commissioned.',
        ] },
        { h2: 'Wraps and finishes', bullets: [
          'Printed art paper wraps in CMYK and Pantone colours.',
          'Matt, gloss or soft-touch lamination.',
          'Hot foil stamping, embossing, debossing and spot UV on the lid.',
          'Printed or coloured paper linings, ribbon pulls and magnetic closures.',
        ] },
        { h2: 'What to send for a quote', bullets: QUOTE_NEEDS },
      ],
      faqs: [
        ['What is a rigid box?', 'A rigid box is a box made from greyboard, usually 1.5 to 3 mm thick, wrapped in printed paper. Unlike a folding carton it does not collapse, which is why it is used for phones, watches, cosmetics and gifts.'],
        ['Which styles of rigid box does Kraftman Packaging make?', 'Five: lid and base, magnetic closure (book style), shoulder neck, drawer, and collapsible.'],
        ['What is the difference between a magnetic rigid box and a collapsible rigid box?', 'A magnetic rigid box is a fixed tray glued into a book-style case, so it arrives ready to use but ships at full volume. A collapsible rigid box carries every board on one wrap with hinge gaps between them, so it ships flat and is erected in seconds. Both close with hidden magnets.'],
        ['Does Kraftman Packaging have a fully automatic rigid box line?', 'It is on order and not yet running. The line feeds and glues the wrap, positions the board tray with a camera-guided robot, then wraps and forms the box.'],
      ],
      cta: quote('Thinking about a rigid box?', 'Build one in Kraftman 3D Studio, open the lid, and send us the result.'),
    },

    /* ══ CAPABILITIES ════════════════════════════════════════════════ */
    {
      path: '/capabilities', crumb: 'Capabilities',
      title: 'Offset Printing and Packaging Machinery | Kraftman Packaging',
      description: 'The machines at Kraftman Packaging: Heidelberg CD 102 and SM 52 offset presses, Century die-cutters, flute laminators, folder-gluers and testing.',
      kicker: 'Capabilities', h1: 'Machines and capabilities',
      lead: 'This page lists what is on our floor, stage by stage, so a buyer or a packaging engineer can check whether a job fits before asking.',
      photoFrom: 'cap:1',
      sections: [
        { id: 'prepress', h2: 'Pre-press and design', bullets: [
          'Structural design in ESKO ArtiosCAD, with dielines and 3D renders.',
          'A sample-making table that cuts plain and printed samples from the same file the die is made from.',
          'Artwork preflight, ICC colour management and computer-to-plate.',
        ], link: ['/packaging-development', 'How a pack is developed'] },
        { id: 'offset-printing', h2: 'Offset printing', rows: [
          ['Heidelberg CD 102', 'A 72 × 102 cm press built for board. Most cartons, cards and litho sheets run here.'],
          ['Heidelberg SM 52', 'A 37 × 52 cm press for small formats and shorter runs: hangtags, bands and small cartons.'],
        ] },
        { id: 'flute-lamination', h2: 'Flute lamination', paras: [
          'Printed sheets are mounted on corrugated board on three flute laminators: a Lamify Advanced SFC-1500, a Lamify Ultra and a FluteXpert 1650. This is how [litho-laminated boxes](/products/corrugated-boxes) and displays are made.',
        ] },
        { id: 'die-cutting', h2: 'Die-cutting', paras: [
          'Two Century automatic flatbed die-cutters, an MWB 1450 and an MWZ 1450, cut and crease the sheets. The largest sheet we die-cut is 52 × 72 inches.',
        ] },
        { id: 'finishing', h2: 'Coating and finishing', bullets: [
          'Gloss, matt and soft-touch lamination.',
          'UV coating, over the whole sheet or as spot UV.',
          'Blister coating for heat-sealed cards.',
          'Hot foil stamping, embossing and debossing.',
          'Window patching.',
        ] },
        { id: 'folding-gluing', h2: 'Folding and gluing', paras: [
          'Folder-gluers fold and glue straight-line and auto-bottom cartons, with quality checks on the line.',
        ] },
        { id: 'corrugation', h2: 'Corrugated board', paras: [
          'A, B, C and E flute board in 3-ply and 5-ply, with two-colour direct flexo printing for shipping cartons.',
        ] },
        { id: 'testing', h2: 'Measurement and testing', bullets: [
          'X-Rite spectrophotometers for colour, with results recorded as Delta E.',
          'Burst strength and compression testing for board and boxes.',
          'Drop and transit testing when the specification asks for it.',
        ], link: ['/quality', 'Quality and certifications'] },
        { id: 'rigid-line', h2: 'On order: automatic rigid box line', paras: [
          'A fully automatic line for [rigid boxes](/products/rigid-boxes) is on order and will be added to this list once it is commissioned.',
        ] },
      ],
      faqs: [
        ['What printing presses does Kraftman Packaging have?', 'Two sheet-fed offset presses: a Heidelberg CD 102 and a Heidelberg SM 52.'],
        ['What is the largest sheet Kraftman Packaging can print and die-cut?', 'The Heidelberg CD 102 prints a sheet up to 72 × 102 cm. The largest sheet we die-cut is 52 × 72 inches.'],
        ['Can you print Pantone spot colours?', 'Yes. Brand colours are printed as Pantone spot inks alongside CMYK, and every spot colour is measured against its Pantone target.'],
        ['Is the work done in house?', 'Design, plate-making, printing, lamination, flute lamination, die-cutting, gluing and testing are all done in the Palwal plant.'],
      ],
      cta: quote('Not sure if your job fits?', 'Send the sheet size, the board and the quantity and we will tell you straight away.'),
    },

    /* ══ PACKAGING DEVELOPMENT ═══════════════════════════════════════ */
    {
      path: '/packaging-development', crumb: 'Packaging development',
      title: 'Packaging Design and Development | Kraftman Packaging, India',
      description: 'Structural packaging design, dielines, board selection, 3D renders and cut samples from Kraftman Packaging. A pack is designed round your product before any plates are made.',
      kicker: 'Packaging development', h1: 'Packaging design and development',
      lead: 'Send us a product and we will design the pack round it: the structure, the board, the dieline, a 3D render and a cut sample, all before any plates are made.',
      photoFrom: 'cap:0',
      sections: [
        { h2: 'How a pack is developed', steps: [
          ['Brief', 'What the product is, what it weighs, how many go in a pack, how it ships and where it is sold. If a retailer has a packaging manual, we work to it.'],
          ['Structure', 'We draw the pack in ESKO ArtiosCAD, from a standard style or from scratch.'],
          ['Board', 'We choose the board grade and weight for the load, the print and the budget.'],
          ['3D render', 'You see the pack with your artwork on it. You can do a first version yourself in the [Kraftman 3D Studio](/studio.html).'],
          ['Cut sample', 'The sample table cuts the pack from the real board. You fill it, close it and send it back with comments.'],
          ['Test', 'Fit is checked with the product. Drop, compression and transit tests are run where the specification calls for them.'],
          ['Dieline', 'Your designer receives the approved dieline to lay the artwork on.'],
          ['Proof and production', 'Artwork is preflighted, colour targets are agreed, and the job goes to press.'],
        ] },
        { h2: 'Where development saves money', rows: [
          ['Sheet yield', 'A carton that is two millimetres narrower can mean one more row on the printed sheet. We check how each size nests before we fix it.'],
          ['The right board', 'Over-specified board is the commonest waste we see. We size the board to the load and test it, in place of adding a safety margin by guesswork.'],
          ['Pack-out', 'The count per shipper and the shipper size decide how many units fit on a pallet and in a container. We work the pack back from the pallet.'],
          ['One die, several products', 'Where a range shares a footprint, one cutting die can serve all of it.'],
        ] },
        { h2: 'Files we work with', bullets: [
          'ArtiosCAD files (.ard) and DXF drawings.',
          'PDF or Illustrator artwork with the dieline on its own layer.',
          'A physical sample of a current pack, if there is no drawing.',
        ] },
      ],
      faqs: [
        ['Does Kraftman Packaging design packaging or only manufacture it?', 'Both. We design the structure, choose the board, produce the dieline, render it in 3D and cut a sample. We also manufacture from a customer dieline when one already exists.'],
        ['What is a dieline?', 'A dieline is the flat drawing of a pack that shows where it is cut and where it is creased. The designer places artwork on it, and the cutting die is made from it.'],
        ['Can I see my packaging before it is printed?', 'Yes, twice. First as a 3D render, which you can also build yourself in the [Kraftman 3D Studio](/studio.html), and then as a physical sample cut from the real board.'],
        ['What do you need to start?', 'The product or its dimensions and weight, the quantity per pack, how it will be shipped, and any retailer packaging requirements.'],
      ],
      cta: quote('Have a product that needs a pack?', 'Send us the product details and we will come back with a structure and a sample.'),
    },

    /* ══ QUALITY ═════════════════════════════════════════════════════ */
    {
      path: '/quality', crumb: 'Quality',
      title: 'Packaging Quality Control and Certifications | Kraftman Packaging',
      description: 'How Kraftman Packaging controls quality: spectrophotometer colour measurement, Delta E reporting and transit testing.',
      kicker: 'Quality', h1: 'Quality control and certifications',
      lead: 'Colour is measured with instruments, structure is checked at every stage, and the plant is audited by outside bodies. {certified}',
      photoFrom: 'cap:3',
      sections: [
        { h2: 'Colour', paras: [
          'Every job has a colour target: a Pantone reference, a brand standard or an approved proof. On press, printed sheets are read with an X-Rite spectrophotometer and compared with the target in LAB values.',
          'The difference is reported as Delta E 2000, a single number for how far a printed colour is from where it should be. Below about 1 the eye cannot see the difference. The tolerance we print to is the one in your brand standard or the retailer specification.',
        ] },
        { h2: 'Structure', rows: [
          ['Incoming board', 'Weight (gsm), thickness and surface are checked against the purchase specification.'],
          ['Lamination', 'Bond and flatness are checked after film lamination and flute lamination.'],
          ['Die-cutting', 'Cut register against print, crease depth and nicks are checked on the first sheets and through the run.'],
          ['Gluing', 'Glue line position and bond are checked on the folder-gluer.'],
          ['Finished pack', 'Dimensions, squareness and count are checked before packing.'],
        ] },
        { h2: 'Testing', paras: [
          'Burst strength and compression are tested in our lab. Drop and transit tests are run to the procedure the customer names, such as ISTA 1A or ISTA 3A, and we keep the reports with the job.',
        ] },
        { h2: 'Certifications and audits', intro: 'Copies of current certificates and audit reports are sent to customers on request.', certs: true, needs: 'certs' },
      ],
      faqs: [
        ['Which certifications does Kraftman Packaging hold?', 'We are {certifications}. {certification-details}', 'certs'],
        ['Is Kraftman Packaging GMI certified?', 'Yes. GMI (Graphic Measures International) audits packaging printers on behalf of retailers and brands, covering print quality, colour consistency and process control.', 'cert:gmi'],
        ['Is Kraftman Packaging SMETA audited?', 'Yes. SMETA is the Sedex Members Ethical Trade Audit, an on-site social audit covering labour standards and health and safety.', 'cert:smeta'],
        ['What is Delta E in printing?', 'Delta E is a number that states how different two colours are. In packaging it compares a printed colour with its target. Under about 1 the difference is invisible, and brand standards usually set a limit of a few units.'],
        ['Does Kraftman Packaging do transit testing?', 'Burst strength and compression are tested in house. Drop and transit tests are run to the procedure the customer specifies, for example ISTA 1A or ISTA 3A.'],
      ],
      cta: quote('Have a quality specification?', 'Send it with your enquiry and we will quote to it.'),
    },

    /* ══ INDUSTRIES ══════════════════════════════════════════════════ */
    {
      path: '/industries', crumb: 'Industries',
      title: 'Packaging for Retail Brands and Manufacturers | Kraftman Packaging',
      description: 'Packaging by industry from Kraftman Packaging: hardware and tools, home improvement, electronics, toys, consumer goods, cosmetics, pharma and e-commerce.',
      kicker: 'Industries', h1: 'Industries we pack for',
      lead: 'A drill, a lipstick and a box of screws are sold in different places and travel in different ways. This is what we usually make for each.',
      sections: [
        { h2: 'By industry', table: {
          head: ['Industry', 'What we usually make'],
          rows: [
            ['Hardware and tools', 'Litho-laminated boxes for power tools, blister cards and backer cards for hand tools and fixings, hang-sell cartons.'],
            ['Home improvement', 'Printed corrugated boxes, PDQ trays for counter and aisle display, header cards.'],
            ['Electronics and accessories', 'Mono cartons with windows or hang tabs, printed inserts, rigid boxes for premium items.'],
            ['Toys and recreation', 'Window cartons, litho-laminated boxes, display trays.'],
            ['Consumer goods and FMCG', 'Mono cartons, shelf-ready packaging, master shippers.'],
            ['Cosmetics and personal care', 'SBS and FBB cartons with foil and embossing, rigid boxes, sleeves.'],
            ['Pharmaceutical', 'Mono cartons and printed inserts.'],
            ['Apparel and gifting', 'Hangtags, bellybands, lid and base and magnetic rigid boxes.'],
            ['E-commerce', 'Die-cut mailers and printed shipping cartons.'],
          ],
        } },
        { h2: 'Retail programmes', paras: [
          'Much of our packaging is made for companies that supply large retail chains. That work comes with a packaging manual: board and print specifications, colour targets, barcode placement, hang-hole drawings and transit tests.',
          'We are set up for it. Colour is measured and reported, samples are approved before production, and test reports are kept with the job. {certified}',
        ], link: ['/quality', 'How we control quality'] },
      ],
      faqs: [
        ['Which industries does Kraftman Packaging serve?', 'Hardware and tools, home improvement, electronics, toys, consumer goods and FMCG, cosmetics and personal care, pharmaceutical, apparel and gifting, and e-commerce.'],
        ['Can Kraftman Packaging make packaging to a retailer specification?', 'Yes. We work to retailer packaging manuals, including their colour targets, barcode and hang-hole requirements and transit tests.'],
        ['Do you make packaging for export?', 'Yes. We make packaging for customers in India and for companies whose products are sold by retail chains overseas.'],
      ],
      cta: quote('Tell us what you sell.', 'We will send examples of packs we have made for similar products.'),
    },

    /* ══ CONTACT ═════════════════════════════════════════════════════ */
    {
      path: '/contact', crumb: 'Contact',
      title: 'Contact Kraftman Packaging | Palwal, Haryana, India',
      description: 'Request a packaging quote from Kraftman Packaging, Palwal, Haryana, India. Phone, email, plant address and what to send for a quick, accurate price.',
      kicker: 'Contact', h1: 'Contact us and request a quote',
      lead: 'Tell us what you are packing. We reply within one working day.',
      contact: true,
      sections: [
        { h2: 'What to send for a quote', intro: 'The more of this we have, the closer the first price will be.', bullets: QUOTE_NEEDS },
      ],
      faqs: [
        ['How do I request a quote from Kraftman Packaging?', 'Send the product details, pack size, quantity and finish through the form on this page, by email to {email}, or by phone on {phone}.'],
        ['Where is the Kraftman Packaging plant?', '{address}.'],
        ['Can I visit the plant?', 'Yes, by appointment. Call or email to arrange a time.'],
      ],
    },
  ].map(page => {
    // Every product page shows its family's photo gallery straight after its first section,
    // and its family's main photo at the top, unless the page is given one of its own.
    if (page.parent === '/products') { page.sections.splice(1, 0, { h2: 'Examples of our work', catalogue: true }); page.photoFrom = 'family'; }
    return Object.assign(page, { faqs: (page.faqs || []).map(([q, a, needs]) => (needs ? { q, a, needs } : { q, a })) });
  });
}

/* ── The homepage: the same shape, with a `key` on each section so views/home.html can find it ── */
function home() {
  return {
    path: '/', crumb: 'Home', home: true,
    title: 'Paperboard Packaging Manufacturer in India | Kraftman Packaging',
    description: 'Paperboard packaging manufacturer in Palwal, Haryana: mono cartons, corrugated boxes, PDQ displays, cards and rigid boxes. {certified}',
    // The hero carries the headline alone, on one line. The supporting line is empty by default; if the
    // team fills it in under Pages → Home it appears beneath the headline. The brand tagline ("Printed with
    // Precision, Packed with Pride, Delivered with Trust") is kept for other uses, not shown here.
    h1: 'Packaging Engineered to Perform.',
    lead: '',
    sections: [
      { key: 'about', h2: 'A paperboard packaging manufacturer in Palwal, Haryana, since 2016.', paras: [
        'Kraftman Packaging Private Limited is a paperboard packaging manufacturer in Palwal, Haryana, India. We have printed and converted packaging here since 2016, for consumer brands and for the companies that supply large retail chains.',
        'Design, plates, printing, lamination, die-cutting, gluing and testing all happen on our own floor. When something needs sorting out, there is one team to call. {certified}',
      ], fixed: true },
      { key: 'products', h2: 'A wide range of packaging products.', intro: 'All made to your size and artwork. Each has its own page.' },
      { key: 'studio', h2: 'See your pack before we print it.', intro: 'Enter the size, upload your artwork as a PDF, choose the colour and finishes, and turn the result round in 3D.' },
      { key: 'caps', h2: 'What happens on our floor.', intro: 'Each stage is done in the Palwal plant, so colour, structure and delivery dates stay with one team.', rows: [
        ['Pre-press and design', 'Structural design in ESKO ArtiosCAD, dielines and 3D renders, artwork preflight, colour management and plate-making. Samples are cut on our sample table before production.'],
        ['Printing', 'Sheet-fed offset printing on Heidelberg CD 102 and SM 52 presses, with colour measured by spectrophotometer against the approved target. Direct flexo printing for shipping cartons.'],
        ['Converting and finishing', 'Flute lamination, die-cutting up to 52 × 72 inches, lamination, UV and blister coating, hot foil stamping, embossing, window patching and folder-gluing.'],
        ['Testing', 'Inspection at each stage, burst strength and compression testing in our lab, and drop and transit tests when the specification asks for them.'],
      ] },
      { key: 'line', h2: 'A fully automatic rigid box line.', intro: 'We have ordered a fully automatic line for rigid boxes. It makes the box in one continuous run, watched from a screen, with nobody handling the product. It is not running yet.', steps: [
        ['Wrap feeding', 'Printed wraps are fed into the line one sheet at a time.'],
        ['Gluing', 'Each wrap is coated with an even film of adhesive.'],
        ['Robotic positioning', 'Cameras find the wrap and a robotic arm sets the board tray on it.'],
        ['Wrapping and forming', 'The edges are folded, turned in and pressed, and the finished box leaves the line.'],
      ] },
      { key: 'styles', h2: 'Five styles of rigid box.', intro: 'A rigid box is greyboard wrapped in printed paper, so it keeps its shape. Pick a style to watch how it is built.', rows: [
        ['Lid & base rigid box', 'Two wrapped trays. The lid is cut slightly larger so it slides down over the base. Used for gifting, apparel, confectionery and electronics.'],
        ['Magnetic & book-style rigid box', 'A wrapped tray glued into a hinged case. Magnets hidden in the flap and the front wall pull it shut.'],
        ['Shoulder-neck rigid box', 'An inner neck stands above the rim of the base, so the lid and base meet flush with a band of contrast colour between them.'],
        ['Drawer rigid box', 'A tray with a ribbon pull that slides out of a rigid sleeve. Used for jewellery, accessories and chocolates.'],
        ['Collapsible rigid box', 'Every board sits on one wrap with hinge gaps between them. It ships flat and is erected in seconds, which saves freight and storage.'],
      ], fixed: true },
      { key: 'certs', h2: 'Checked by outside bodies.' },
      { key: 'contact', h2: 'Tell us what you are packing.', intro: 'Send the product size, the quantity, and the pack style and finish you want. We reply within one working day.' },
    ],
    faqs: [
      ['What does Kraftman Packaging make?', 'Printed mono cartons, litho-laminated and flexo-printed corrugated boxes, PDQ and counter displays, backer, header and blister cards, hangtags and bellybands, and rigid boxes. Everything is made to the customer\'s size, print and finish.'],
      ['Where is Kraftman Packaging located?', 'The plant is at {address}. It has been in production since 2016.'],
      ['Which certifications does Kraftman Packaging hold?', 'Kraftman Packaging is {certifications}. {certification-details}', 'certs'],
      ['What printing and finishing can Kraftman Packaging do?', 'Sheet-fed offset printing on Heidelberg CD 102 and SM 52 presses, with flute lamination, die-cutting up to 52 × 72 inches, lamination, UV and blister coating, hot foil stamping, embossing and window patching. Corrugated board runs in A, B, C and E flute up to 5-ply.'],
      ['Which industries does Kraftman Packaging serve?', 'Hardware and tools, home improvement, electronics, toys, consumer goods and FMCG, cosmetics, pharmaceutical, apparel and e-commerce, including companies that supply large retail chains.'],
      ['Can Kraftman Packaging design the packaging as well as make it?', 'Yes. Structures are drawn in ESKO ArtiosCAD, rendered in 3D and cut as physical samples on a sample table before production starts.'],
      ['Can I see my packaging before it is printed?', 'Yes. Kraftman 3D Studio, our online tool, lets you enter a size, upload artwork as a PDF or image, add foil, embossing, spot UV or a window, and see the result in 3D and as a flat layout.'],
      ['Does Kraftman Packaging have a fully automatic rigid box line?', 'It is on order and not yet running. The line feeds and glues the wrap, positions the board tray with a camera-guided robot, then wraps and forms the box.'],
      ['How do I get a packaging quote from Kraftman Packaging?', 'Send the product dimensions, the quantity, and the pack style and finish you want through the enquiry form, email {email}, or call {phone}. We reply within one working day.'],
    ].map(([q, a, needs]) => (needs ? { q, a, needs } : { q, a })),
  };
}

// The page for a product range added in the admin: the same shape as the ones above, started from its
// name and one line, and editable under Pages like any other.
function productPage(f) {
  return {
    path: '/products/' + f.slug, crumb: f.name, parent: '/products', photoFrom: 'family',
    title: (f.name + ' | Kraftman Packaging').slice(0, 70),
    description: (f.blurb || f.name + ' made to your size and artwork by Kraftman Packaging, Palwal, Haryana, India.').slice(0, 180),
    kicker: 'Products', h1: f.name, lead: f.blurb || 'Made to your size and artwork in our Palwal plant.',
    sections: [
      { h2: 'About this product', paras: ['Tell us what you are packing and we will suggest the board, the structure and the finish.'] },
      { h2: 'Examples of our work', catalogue: true },
      { h2: 'What to send for a quote', bullets: QUOTE_NEEDS },
    ],
    faqs: [],
    cta: { h2: 'Need ' + f.name.toLowerCase() + '?', p: 'Send us the size, the quantity and the finish.', buttons: [['/contact', 'Request a quote'], ['/studio.html', 'Kraftman 3D Studio']] },
  };
}

module.exports = { pages, home, FAMILIES, productPage };
