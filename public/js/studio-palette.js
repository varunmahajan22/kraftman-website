/* ═══════════════════════════════════════════════════════════════════
   Box Studio — colour and finish libraries

   Spot colours are listed by their PANTONE reference with an approximate
   sRGB value for on-screen preview. A screen cannot reproduce a spot ink:
   the printed result is always matched to a physical PANTONE guide.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // [reference, approximate sRGB]
  const SPOT_COLOURS = [
    ['White', '#FFFFFF'], ['Black C', '#2D2926'], ['Black 6 C', '#101820'],
    ['Cool Gray 1 C', '#D9D9D6'], ['Cool Gray 5 C', '#B1B3B3'], ['Cool Gray 9 C', '#75787B'], ['Cool Gray 11 C', '#53565A'],
    ['432 C', '#333F48'], ['Yellow C', '#FEDD00'], ['109 C', '#FFD100'], ['116 C', '#FFCD00'], ['123 C', '#FFC72C'],
    ['137 C', '#FFA300'], ['151 C', '#FF8200'], ['165 C', '#FF671F'], ['Orange 021 C', '#FE5000'],
    ['Warm Red C', '#F9423A'], ['185 C', '#E4002B'], ['186 C', '#C8102E'], ['199 C', '#D50032'],
    ['200 C', '#BA0C2F'], ['188 C', '#76232F'], ['202 C', '#862633'], ['7421 C', '#651D32'],
    ['Rubine Red C', '#CE0058'], ['219 C', '#DA1884'], ['Rhodamine Red C', '#E10098'], ['233 C', '#C6007E'],
    ['Purple C', '#BB29BB'], ['266 C', '#753BBD'], ['Violet C', '#440099'], ['2685 C', '#330072'],
    ['Blue 072 C', '#10069F'], ['Reflex Blue C', '#001489'], ['286 C', '#0033A0'], ['287 C', '#003087'],
    ['293 C', '#003DA5'], ['300 C', '#005EB8'], ['Process Blue C', '#0085CA'], ['299 C', '#00A3E0'],
    ['306 C', '#00B5E2'], ['289 C', '#0C2340'], ['282 C', '#041E42'], ['3125 C', '#00AEC7'],
    ['320 C', '#009CA6'], ['326 C', '#00B2A9'], ['Green C', '#00AB84'], ['347 C', '#009A44'],
    ['348 C', '#00843D'], ['349 C', '#046A38'], ['355 C', '#009639'], ['361 C', '#43B02A'],
    ['368 C', '#78BE20'], ['375 C', '#97D700'], ['382 C', '#C4D600'], ['7407 C', '#CBA052'],
    ['871 C', '#84754E'], ['877 C', '#8A8D8F'], ['476 C', '#4E3629'], ['4625 C', '#4F2C1D'],
  ].map(([ref, hex]) => ({ name: ref === 'White' ? 'White' : 'PANTONE ' + ref, hex }));

  // Unprinted stocks, for the outside of a shipper or the inside of any box.
  const STOCKS = [
    { name: 'White board', hex: '#F6F3EC' },
    { name: 'Kraft board', hex: '#B88E60' },
    { name: 'Greyboard', hex: '#A39C90' },
    { name: 'Black board', hex: '#1F1F21' },
    { name: 'Gold lining', hex: '#C9A24B' },
  ];

  // Overall coating: how matt or glossy the whole surface reads (0 mirror, 1 chalky).
  const COATINGS = [
    { id: 'matt-lam', name: 'Matt lamination', roughness: 0.62 },
    { id: 'gloss-lam', name: 'Gloss lamination', roughness: 0.16 },
    { id: 'soft-touch', name: 'Soft-touch lamination', roughness: 0.88 },
    { id: 'gloss-varnish', name: 'Gloss varnish', roughness: 0.3 },
    { id: 'matt-varnish', name: 'Matt varnish', roughness: 0.55 },
    { id: 'uncoated', name: 'Uncoated', roughness: 0.82 },
  ];

  // What a piece of text or a logo can be finished in.
  // metal: how metallic it reads; rough: its own gloss; colour: what it lays down.
  const FINISHES = [
    { id: 'print', name: 'Printed colour' },
    { id: 'foil-gold', name: 'Gold foil', colour: '#E2BB52', metal: 1, rough: 0.2 },
    { id: 'foil-silver', name: 'Silver foil', colour: '#D2D6DB', metal: 1, rough: 0.18 },
    { id: 'foil-rose', name: 'Rose-gold foil', colour: '#E0A592', metal: 1, rough: 0.2 },
    { id: 'foil-copper', name: 'Copper foil', colour: '#C27B45', metal: 1, rough: 0.22 },
    { id: 'spot-uv', name: 'Spot UV', rough: 0.03 },
    { id: 'emboss', name: 'Blind emboss', relief: 1 },
    { id: 'deboss', name: 'Blind deboss', relief: -1 },
  ];

  window.StudioPalette = { SPOT_COLOURS, STOCKS, COATINGS, FINISHES };
})();
