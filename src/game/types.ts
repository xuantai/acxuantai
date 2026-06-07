export enum Difficulty {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  EXPERT = 'Expert',
  CUSTOM = 'Custom'
}

export enum Language {
  VI = 'vi',
  EN = 'en'
}

export interface ScoreEntry {
  name: string;
  time: number;
  difficulty: Difficulty;
  date: number;
}

export interface GameSettings {
  rows: number;
  cols: number;
  mines: number;
}

export enum CellState {
  HIDDEN,
  REVEALED,
  FLAGGED,
}

export interface CellData {
  r: number;
  c: number;
  isMine: boolean;
  state: CellState;
  neighborMines: number;
}

export enum GameStatus {
  IDLE,
  PLAYING,
  WON,
  LOST
}
