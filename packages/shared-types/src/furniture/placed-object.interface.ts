import { SceneObjectTransform } from './scene-object-transform.interface';

export interface PlacedObject {
  id: string;
  modelId: string;
  transform: SceneObjectTransform;
}
