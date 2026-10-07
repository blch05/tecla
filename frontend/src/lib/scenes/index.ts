/* Registro de escenas: el valor de EFFECT de cada objeto de la tienda → cómo se crea. */
import type { SceneDef } from '@/lib/scenes/types';
import { paisaje } from '@/lib/scenes/paisaje';
import { espadachin } from '@/lib/scenes/espadachin';
import { mago } from '@/lib/scenes/mago';
import { nave } from '@/lib/scenes/nave';
import { gato } from '@/lib/scenes/gato';
import { jardin } from '@/lib/scenes/jardin';
import { tren } from '@/lib/scenes/tren';
import { acuario } from '@/lib/scenes/acuario';
import { fantasma } from '@/lib/scenes/fantasma';
import { robot } from '@/lib/scenes/robot';

/** la escena gratis, la que se ve si no hay otra equipada */
export const DEFAULT_SCENE = 'paisaje';

export const SCENES: Record<string, SceneDef> = {
  paisaje: { name: 'paisaje', pixel: 1, make: paisaje },
  espadachin: { name: 'espadachín', pixel: 4, make: () => espadachin('normal') },
  sombra: { name: 'espadachín de sombra', pixel: 4, make: () => espadachin('sombra') },
  mago: { name: 'mago de runas', pixel: 4, make: mago },
  nave: { name: 'nave arcade', pixel: 4, make: nave },
  gato: { name: 'gatito que teje', pixel: 5, make: gato },
  jardin: { name: 'jardín', pixel: 5, make: jardin },
  tren: { name: 'tren nocturno', pixel: 3, make: tren },
  acuario: { name: 'acuario', pixel: 4, make: acuario },
  fantasma: { name: 'vos contra tu fantasma', pixel: 4, make: fantasma },
  robot: { name: 'robot que alienta', pixel: 5, make: robot },
};

export type { SceneDef, SceneEvent } from '@/lib/scenes/types';
