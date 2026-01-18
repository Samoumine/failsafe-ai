import { TETROMINO_TYPES, type TetrominoType } from './tetrisTypes';

export class RNG {
  private bag: TetrominoType[] = [];
  private random: () => number;

  constructor(seed?: number) {
    this.random = seed !== undefined 
      ? this.seededRandom(seed) 
      : Math.random;
  }

  private seededRandom(seed: number): () => number {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  nextPiece(): TetrominoType {
    if (this.bag.length === 0) {
      this.bag = [...TETROMINO_TYPES].sort(() => this.random() - 0.5);
    }
    return this.bag.pop()!;
  }

  next(): number {
    return this.random();
  }
}

export const rng = new RNG();
