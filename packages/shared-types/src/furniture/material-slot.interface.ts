export type TMaterialFinish = 'matte' | 'satin' | 'gloss' | 'metallic';

export interface IMaterialSlot {
  label: string;
  color: string;
  finish: TMaterialFinish;
}
