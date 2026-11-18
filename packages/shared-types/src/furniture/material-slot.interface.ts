export type TMaterialFinish = 'matte' | 'satin' | 'gloss' | 'metallic' | 'glass';

export interface IMaterialSlot {
  label: string;
  color: string;
  finish: TMaterialFinish;
}
