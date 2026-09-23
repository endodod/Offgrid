import type { ClassId } from './units';

/** Recruit names (unit rework). First and last names are drawn separately from the campaign's seeded RNG. */
export const FIRST_NAMES = [
  'Mara', 'Dev', 'Jonah', 'Ines', 'Tomas', 'Priya', 'Ezra', 'Noor', 'Callum', 'Rosa', 'Idris', 'Wren', 'Mateo',
  'Suki', 'Anton', 'Leila', 'Owen', 'Hana', 'Kofi', 'Greta', 'Rafe', 'Yara', 'Silas', 'June', 'Dmitri', 'Esme',
  'Tariq', 'Bea', 'Lucan', 'Ada', 'Nico', 'Sol',
];
export const LAST_NAMES = [
  'Quill', 'Okafor', 'Reyes', 'Barros', 'Varga', 'Nakamura', 'Holt', 'Haddad', 'Brennan', 'Lindqvist', 'Mensah',
  'Castell', 'Duarte', 'Iyer', 'Kowalski', 'Moreau', 'Pike', 'Sato', 'Tran', 'Ward', 'Abara', 'Falk', 'Grieve',
  'Marsh', 'Novak', 'Ortega', 'Rook', 'Stroud',
];

/** The five people who start the campaign (STORY.md: "four people who are still here" plus you). */
export const FOUNDERS: Record<ClassId, string> = {
  sniper: 'Mara Quill', assault: 'Dev Okafor', soldier: 'Jonah Reyes', medic: 'Ines Barros', tank: 'Tomas Varga',
};
