import { RULES } from './rules';
import { TRAINING_GROUNDS, type MapDef } from './trainingGrounds';

export interface Mission {
  id: string;
  name: string;
  blurb: string;
  objective: string;
  map: MapDef;
}

/** Missions shown on the home screen. Add an entry here to add a mission. */
export const MISSIONS: Mission[] = [
  {
    id: 'training-grounds',
    name: TRAINING_GROUNDS.name,
    blurb: 'A test range that exercises every rule: sniper lane, street crossing, cover rows, bushes, a hidden room and a walled courtyard.',
    objective: `Interact with the terminal in the courtyard, then keep that unit standing next to it for ${RULES.objectiveHoldRounds} rounds. Or eliminate every enemy.`,
    map: TRAINING_GROUNDS,
  },
];
