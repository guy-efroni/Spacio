import { ISceneObjectTransform } from './scene-object-transform.interface';

export interface IPlacedObject {
  id: string;
  modelId: string;
  transform: ISceneObjectTransform;
}
