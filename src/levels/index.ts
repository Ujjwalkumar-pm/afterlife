import { validateLevel, type LevelData } from '../engine';
import busStop from './01-bus-stop.json';
import rooftop from './02-rooftop.json';
import petrolStation from './03-petrol-station.json';
import railwayPlatform from './04-railway-platform.json';
import playground from './05-playground.json';

export const LEVELS: LevelData[] = [busStop, rooftop, petrolStation, railwayPlatform, playground].map((raw) => validateLevel(raw));
