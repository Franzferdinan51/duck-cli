/**
 * 🦆 Duck Agent - Buddy Sprites
 * ASCII art sprites for companion species
 */

import type { Species, Eye, Hat } from './types.js';

// Each sprite is 5 lines tall, variable width
type Sprite = string[][];

const EYE_SUB = '{E}';

// Sprite frames for idle animation
const BODIES: Record<Species, Sprite> = {
  duck: [
    [
      '            ',
      '    __      ',
      '  <({E} )___  ',
      '   (  ._>   ',
      '    `--´    ',
    ],
    [
      '            ',
      '    __      ',
      '  <({E} )___  ',
      '   (  ._>~  ',
      '    `--´    ',
    ],
    [
      '            ',
      '    __      ',
      '  <({E} )___  ',
      '   (  .__>  ',
      '    `--´    ',
    ],
  ],
  
  blob: [
    [
      '            ',
      '   .----.   ',
      '  ( {E}  {E} )  ',
      '  (      )  ',
      '   `----´   ',
    ],
    [
      '            ',
      '  .------.  ',
      ' (  {E}  {E}  ) ',
      ' (        ) ',
      '  `------´  ',
    ],
    [
      '            ',
      '    .--.   ',
      '   ({E}  {E})   ',
      '   (    )   ',
      '    `--´    ',
    ],
  ],
  
  cat: [
    [
      '            ',
      '   /\\_/\\   ',
      '  ( {E}   {E})  ',
      '  (  ω  )   ',
      '  (")_(")   ',
    ],
    [
      '            ',
      '   /\\_/\\   ',
      '  ( {E}   {E})  ',
      '  (  ω  )~  ',
      '  (")_(")   ',
    ],
    [
      '            ',
      '   /\\-/\\   ',
      '  ( {E}   {E})  ',
      '  (  ω  )   ',
      '  (")_(")   ',
    ],
  ],
  
  dragon: [
    [
      '            ',
      '  /^\\  /^\\  ',
      ' <  {E}  {E}  > ',
      ' (   ~~   ) ',
      '  `-vvvv-´  ',
    ],
    [
      '            ',
      '  /^\\  /^\\  ',
      ' <  {E}  {E}  > ',
      ' (        ) ',
      '  `-vvvv-´  ',
    ],
    [
      '   ~    ~   ',
      '  /^\\  /^\\  ',
      ' <  {E}  {E}  > ',
      ' (   ~~   ) ',
      '  `-vvvv-´  ',
    ],
  ],
  
  owl: [
    [
      '            ',
      '   /\\  /\\   ',
      '  ({E})({E}))  ',
      '  (  ><  )  ',
      '   `----´   ',
    ],
    [
      '            ',
      '   /\\  /\\   ',
      '  ({E})({E}))  ',
      '  (  ><  )~  ',
      '   .----.   ',
    ],
    [
      '            ',
      '   /\\  /\\   ',
      '  ({E})(-))  ',
      '  (  ><  )  ',
      '   `----´   ',
    ],
  ],
  
  ghost: [
    [
      '            ',
      '    ____    ',
      '   /    \\   ',
      '  ( {E}  {E} )  ',
      '   \\____/   ',
    ],
    [
      '            ',
      '    ____    ',
      '   /    \\   ',
      '  ( {E}  {E} )~ ',
      '   \\____/   ',
    ],
    [
      '            ',
      '   ~____~   ',
      '   /    \\   ',
      '  ( {E}  {E} )  ',
      '   \\____/   ',
    ],
  ],
  
  robot: [
    [
      '            ',
      '   .----.   ',
      '  ( {E}  {E} )  ',
      '  | === |   ',
      '  |_____|   ',
    ],
    [
      '            ',
      '   .----.   ',
      '  ( {E}  {E} )  ',
      '  | === |~  ',
      '  |_____|   ',
    ],
    [
      '            ',
      '   .----.   ',
      '  ( {E}  {E} )  ',
      '  | === |   ',
      '  |_____|   ',
    ],
  ],
  
  rabbit: [
    [
      '            ',
      '  /|   |\\  ',
      ' ( \\ {E} {E} / ) ',
      '  (  > <  )  ',
      '   (___)    ',
    ],
    [
      '            ',
      '  /|   |\\  ',
      ' ( \\ {E} {E} / )~ ',
      '  (  > <  )  ',
      '   (___)    ',
    ],
    [
      '            ',
      '  /|   |\\  ',
      ' ( \\ {E} {E} / ) ',
      '  (  > <  )~  ',
      '   (___)    ',
    ],
  ],
  
  cactus: [
    [
      '            ',
      '    _  _    ',
      '   (_)(_)   ',
      '   _|  |_   ',
      '  |______|  ',
    ],
    [
      '            ',
      '    _  _    ',
      '   (_)(_)~  ',
      '   _|  |_   ',
      '  |______|  ',
    ],
    [
      '            ',
      '    _  _    ',
      '   (_)(_)   ',
      '   _|  |_~  ',
      '  |______|  ',
    ],
  ],
  
  snail: [
    [
      '            ',
      '    ____    ',
      '   /    )   ',
      '  ( {E}     )  ',
      '   `--´    ',
    ],
    [
      '            ',
      '    ____    ',
      '   /    )~  ',
      '  ( {E}     )  ',
      '   `--´    ',
    ],
    [
      '            ',
      '    ____    ',
      '   /    )   ',
      '  ( {E}     )~ ',
      '   `--´    ',
    ],
  ],
};

// Hat sprites (5 lines tall, 12 wide)
const HATS: Record<Exclude<Hat, 'none'>, string[]> = {
  crown: [
    '   \\  |  /   ',
    '    \\ | /    ',
    '  ===*===    ',
    '    / | \\    ',
    '   /  |  \\   ',
  ],
  tophat: [
    '   .____.    ',
    '  |      |   ',
    '  |______|   ',
    '            ',
    '            ',
  ],
  halo: [
    '    (  )    ',
    '   (    )   ',
    '            ',
    '            ',
    '            ',
  ],
  wizard: [
    '    _  _    ',
    '   /  |  \\   ',
    '  |   |   |  ',
    '  |   |   |  ',
    '   \\__|__/   ',
  ],
  beanie: [
    '   .----.   ',
    '  /  /\\  \\  ',
    ' |  /  \\  |  ',
    '  \\/    \\/  ',
    '            ',
  ],
  tinyduck: [
    '            ',
    '  <({E})      ',
    '   `--´      ',
    '            ',
    '            ',
  ],
};

export interface SpriteOptions {
  species: Species;
  eye: Eye;
  hat: Hat;
  shiny: boolean;
  frame?: number;
}

export function renderSprite(options: SpriteOptions): string {
  const { species, eye, hat, shiny, frame = 0 } = options;
  
  // Get sprite frames
  const frames = BODIES[species] || BODIES.duck;
  let sprite = frames[frame % frames.length];
  
  // Substitute eye
  sprite = sprite.map(line => line.replace(EYE_SUB, eye));
  
  // Add hat if present
  if (hat !== 'none' && HATS[hat]) {
    const hatLines = HATS[hat];
    for (let i = 0; i < 5 && i < hatLines.length; i++) {
      sprite[i] = hatLines[i] + sprite[i].slice(hatLines[i].length);
    }
  }
  
  // Apply shine effect (bold/color for shiny)
  if (shiny) {
    sprite = sprite.map(line => `✨ ${line} ✨`);
  }
  
  return sprite.join('\n');
}

export function renderCompanion(
  options: SpriteOptions,
  name: string,
  status: string
): string {
  const sprite = renderSprite(options);
  const shinyTag = options.shiny ? ' ✨' : '';
  
  return `
┌─────────────────────────┐
│ 🐤 ${name}${shinyTag}                │
├─────────────────────────┤
${sprite.split('\n').map(line => `│ ${line.padEnd(23)} │`).join('\n')}
├─────────────────────────┤
│ ${status.padEnd(23)} │
└─────────────────────────┘
`;
}

export function getAnimationFrames(species: Species): number {
  return BODIES[species]?.length || 3;
}

export default {
  renderSprite,
  renderCompanion,
  getAnimationFrames,
};
