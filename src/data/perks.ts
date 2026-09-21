import type { ClassId } from './units';

/**
 * Perks (8): flat stat bonuses, one class's worth of ids per class - the same `EnvModifier`-style "small,
 * additive, data-driven modifier" pattern equipment (7) already uses, just keyed by unit instead of by mission.
 */
export type PerkId =
  | 'sniperFocus' | 'sniperEagleEye' | 'sniperSteadyHands' | 'sniperFieldcraft'
  | 'assaultSprinter' | 'assaultTrigger' | 'assaultBulwark' | 'assaultReflexes'
  | 'soldierGrit' | 'soldierMarksman' | 'soldierScout' | 'soldierHustle'
  | 'medicTriage' | 'medicSharpshooter' | 'medicFleetfoot' | 'medicWard'
  | 'tankPlating' | 'tankBrace' | 'tankStrider' | 'tankVigilance';

export interface PerkEffect {
  accuracyBonus?: number; // flat percentage points added to hit chance
  damageBonus?: number; // flat added to weapon damage, before armor
  armorBonus?: number; // flat added to effective armor
  moveBonus?: number; // flat tiles
  visionBonus?: number; // flat tiles
  medkitBonus?: number; // extra medkits at mission start
}

export interface PerkDef {
  cls: ClassId;
  name: string;
  blurb: string;
  effect: PerkEffect;
}

export const PERKS: Record<PerkId, PerkDef> = {
  sniperFocus: { cls: 'sniper', name: 'Focus', blurb: '+10% accuracy.', effect: { accuracyBonus: 10 } },
  sniperEagleEye: { cls: 'sniper', name: 'Eagle Eye', blurb: '+2 vision.', effect: { visionBonus: 2 } },
  sniperSteadyHands: { cls: 'sniper', name: 'Steady Hands', blurb: '+1 damage.', effect: { damageBonus: 1 } },
  sniperFieldcraft: { cls: 'sniper', name: 'Fieldcraft', blurb: '+1 move.', effect: { moveBonus: 1 } },

  assaultSprinter: { cls: 'assault', name: 'Sprinter', blurb: '+2 move.', effect: { moveBonus: 2 } },
  assaultTrigger: { cls: 'assault', name: 'Trigger Discipline', blurb: '+10% accuracy.', effect: { accuracyBonus: 10 } },
  assaultBulwark: { cls: 'assault', name: 'Bulwark', blurb: '+1 armor.', effect: { armorBonus: 1 } },
  assaultReflexes: { cls: 'assault', name: 'Reflexes', blurb: '+1 damage.', effect: { damageBonus: 1 } },

  soldierGrit: { cls: 'soldier', name: 'Grit', blurb: '+1 armor.', effect: { armorBonus: 1 } },
  soldierMarksman: { cls: 'soldier', name: 'Marksman', blurb: '+10% accuracy.', effect: { accuracyBonus: 10 } },
  soldierScout: { cls: 'soldier', name: 'Scout', blurb: '+1 vision.', effect: { visionBonus: 1 } },
  soldierHustle: { cls: 'soldier', name: 'Hustle', blurb: '+1 move.', effect: { moveBonus: 1 } },

  medicTriage: { cls: 'medic', name: 'Triage', blurb: '+1 medkit at mission start.', effect: { medkitBonus: 1 } },
  medicSharpshooter: { cls: 'medic', name: 'Sharpshooter', blurb: '+10% accuracy.', effect: { accuracyBonus: 10 } },
  medicFleetfoot: { cls: 'medic', name: 'Fleetfoot', blurb: '+1 move.', effect: { moveBonus: 1 } },
  medicWard: { cls: 'medic', name: 'Ward', blurb: '+1 armor.', effect: { armorBonus: 1 } },

  tankPlating: { cls: 'tank', name: 'Plating', blurb: '+2 armor.', effect: { armorBonus: 2 } },
  tankBrace: { cls: 'tank', name: 'Brace', blurb: '+1 damage.', effect: { damageBonus: 1 } },
  tankStrider: { cls: 'tank', name: 'Strider', blurb: '+1 move.', effect: { moveBonus: 1 } },
  tankVigilance: { cls: 'tank', name: 'Vigilance', blurb: '+1 vision.', effect: { visionBonus: 1 } },
};
