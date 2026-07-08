"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const TILE = 16;
const SCALE = 3;
const SCALED_TILE = TILE * SCALE;
const CHUNK_SIZE = 16;

// ─── Color Palettes ─────────────────────────────────────────────────────────

const COLORS = {
  grass1: "#4a6741",
  grass2: "#567a4a",
  grass3: "#3d5a36",
  path1: "#c4a882",
  path2: "#b89b72",
  pathEdge: "#a88d65",
  water: "#3d6b8e",
  waterLight: "#4a7fa6",
  waterDark: "#2d5a7a",
  wood: "#8b6f4e",
  woodDark: "#6b5238",
  woodLight: "#a68a60",
  door: "#5a3a2a",
  lanternBody: "#cc3333",
  lanternGlow: "#ff6644",
  lanternPole: "#4a3a2a",
  trunkDark: "#5a3e2b",
  trunk: "#6b4e38",
  leaves1: "#8b4060",
  leaves2: "#a85070",
  leaves3: "#c06080",
  petal: "#ffb0c0",
  stone: "#8a8a7a",
  stoneDark: "#6a6a5a",
  bridgeRail: "#7a5a3a",
  toriRed: "#cc2222",
  toriRedDark: "#991a1a",
  fenceWood: "#9a7a5a",
  bamboo: "#5a8a4a",
  bambooDark: "#3a6a2a",
  bushLight: "#5a7a4a",
  bushDark: "#3a5a2a",
  flowerPink: "#e090a0",
  flowerWhite: "#e8e0d0",
  flowerYellow: "#e0c060",
};

// ─── Time of Day ────────────────────────────────────────────────────────────

function getTimeOfDay() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const blend = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t));

  //              tintR  tintG  tintB  tintA  vigA   bgR  bgG  bgB  glow
  const night  = [15,    20,    60,    0.35,  0.6,   8,   8,   25,  0.18];
  const dawn   = [200,   120,   80,    0.12,  0.42,  25,  18,  32,  0.06];
  const day    = [0,     0,     0,     0,     0.35,  26,  26,  46,  0   ];
  const sunset = [255,   130,   40,    0.15,  0.42,  28,  18,  28,  0   ];
  const dusk   = [40,    25,    80,    0.28,  0.55,  12,  10,  30,  0.12];

  let p: number[];
  if      (h < 5)  p = night;
  else if (h < 7)  p = blend(night, dawn, (h - 5) / 2);
  else if (h < 9)  p = blend(dawn, day, (h - 7) / 2);
  else if (h < 16) p = day;
  else if (h < 18) p = blend(day, sunset, (h - 16) / 2);
  else if (h < 20) p = blend(sunset, dusk, (h - 18) / 2);
  else if (h < 22) p = blend(dusk, night, (h - 20) / 2);
  else             p = night;

  return {
    tint: `rgba(${Math.round(p[0])},${Math.round(p[1])},${Math.round(p[2])},${p[3].toFixed(3)})`,
    vignetteAlpha: p[4],
    bg: `rgb(${Math.round(p[5])},${Math.round(p[6])},${Math.round(p[7])})`,
    bgRgb: [Math.round(p[5]), Math.round(p[6]), Math.round(p[7])] as [number, number, number],
    playerGlow: p[8],
  };
}

// ─── House Color Palettes (per-block variation) ─────────────────────────────

const HOUSE_PALETTES = [
  { wallBase: "#d4c4a0", wallDark: "#b8a888", wallLight: "#e8dcc0", roofDark: "#6b2d2d", roofMid: "#8b3d3d", roofLight: "#a04848" },
  { wallBase: "#c8bfa0", wallDark: "#a8a080", wallLight: "#ddd8c0", roofDark: "#2d4a6b", roofMid: "#3d5a7b", roofLight: "#4a6a8b" },
  { wallBase: "#d8cbb0", wallDark: "#bca888", wallLight: "#ede0cc", roofDark: "#4a4a2d", roofMid: "#5a5a3d", roofLight: "#6a6a48" },
  { wallBase: "#ccc0b0", wallDark: "#b0a090", wallLight: "#e0d8c8", roofDark: "#5b2d5b", roofMid: "#7b3d6b", roofLight: "#8b487b" },
  { wallBase: "#ddd0b8", wallDark: "#c0b098", wallLight: "#f0e8d8", roofDark: "#6b4a2d", roofMid: "#8b5a3d", roofLight: "#a06848" },
  { wallBase: "#c0c4b8", wallDark: "#a0a898", wallLight: "#d8dcd0", roofDark: "#2d3a3a", roofMid: "#3d4a4a", roofLight: "#4a5a5a" },
  { wallBase: "#d8c8b0", wallDark: "#c0a890", wallLight: "#f0e0c8", roofDark: "#7a2a2a", roofMid: "#9a3a3a", roofLight: "#b04848" },
  { wallBase: "#e0d4bc", wallDark: "#c4b89c", wallLight: "#f4ead0", roofDark: "#3a2d5a", roofMid: "#4a3d6a", roofLight: "#5a487a" },
];

// ─── Golden Bamboo & Zozi's House ─────────────────────────────────────────

const GOLDEN_BAMBOO_POS = { x: 54, y: 52 };
const ZOZI_HOUSE_ORIGIN = { x: 84, y: 63 };
const ZOZI_DOOR_KEYS = new Set(["87,68", "88,68"]);
const ZOZI_BLOCK = { bx: Math.floor(84 / 16), by: Math.floor(63 / 12) };
const ZOZI_PALETTE = {
  wallBase: "#f0e8d0", wallDark: "#d4c4a0", wallLight: "#fff4e0",
  roofDark: "#b8860b", roofMid: "#d4a017", roofLight: "#ffd700",
};

// ─── Fish Types ──────────────────────────────────────────────────────────────

type FishingState = "idle" | "casting" | "waiting" | "bite" | "caught";

const FISH_TYPES = [
  { name: "common carp", weight: 35, color: "#8b6914", holdTime: 200 },
  { name: "sweetfish", weight: 25, color: "#7a9bb5", holdTime: 350 },
  { name: "koi", weight: 18, color: "#cc5533", holdTime: 500 },
  { name: "catfish", weight: 12, color: "#3a3a3a", holdTime: 700 },
  { name: "golden koi", weight: 7, color: "#d4a017", holdTime: 1000 },
  { name: "spirit fish", weight: 3, color: "#8844aa", holdTime: 1300 },
];

const FISH_TOTAL_WEIGHT = FISH_TYPES.reduce((s, f) => s + f.weight, 0);

function rollFish(): { name: string; color: string; holdTime: number } {
  let r = Math.random() * FISH_TOTAL_WEIGHT;
  for (const f of FISH_TYPES) {
    r -= f.weight;
    if (r <= 0) return { name: f.name, color: f.color, holdTime: f.holdTime };
  }
  return FISH_TYPES[0];
}

// ─── Jump ────────────────────────────────────────────────────────────────────

const JUMP_MS = 460;
const JUMP_DIST = 1.9;

// ─── City ────────────────────────────────────────────────────────────────────

const CITY_UNLOCK_MS = 150000; // 2:30 of walking
const VILLAGE_CORE_CHUNKS = 6; // chunks within this radius of origin stay village forever

const CITY_PALETTES = [
  { wall: "#8a8f98", wallDark: "#6d727b" },
  { wall: "#9a8a7a", wallDark: "#7d6f61" },
  { wall: "#7d8894", wallDark: "#626c77" },
  { wall: "#a89888", wallDark: "#8a7c6e" },
  { wall: "#75797f", wallDark: "#5c6065" },
  { wall: "#94847c", wallDark: "#786a63" },
];

const NEON_COLORS = [
  { r: 255, g: 77, b: 157 },
  { r: 77, g: 215, b: 255 },
  { r: 255, g: 210, b: 77 },
  { r: 125, g: 255, b: 106 },
];

// ─── Pandas ──────────────────────────────────────────────────────────────────

type CritterKind = "panda" | "redpanda" | "villager" | "cat";

interface Critter {
  kind: CritterKind;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  moving: boolean;
  stateTimer: number;
  walkAcc: number;
  facingLeft: boolean;
  blockKey: string;
  following?: boolean;
  say?: string;
  sayUntil?: number;
  hash?: number;
}

const PANDA_MAX = 4;
const VILLAGER_MAX = 8;
const CRITTER_SPEED = 0.0011; // tiles per ms — a lazy waddle
const FOLLOW_SPEED = 0.0032; // companions trot to keep up

// The red panda lives somewhere secret: 45-65 tiles from spawn, in a
// seed-dependent direction. Villagers drop compass hints.
function redPandaHomeFor(seed: number): { x: number; y: number } {
  const rng = seededRandom(seed ^ 0x9e3779);
  const ang = rng() * Math.PI * 2;
  const dist = 45 + rng() * 20;
  return { x: Math.floor(Math.cos(ang) * dist) + 0.5, y: Math.floor(Math.sin(ang) * dist) + 0.5 };
}

// The stray cat lives out in the city ring, past the village core.
function catHomeFor(seed: number): { x: number; y: number } {
  const rng = seededRandom(seed ^ 0x51ed27);
  const ang = rng() * Math.PI * 2;
  const dist = 135 + rng() * 25;
  return { x: Math.floor(Math.cos(ang) * dist) + 0.5, y: Math.floor(Math.sin(ang) * dist) + 0.5 };
}

const VILLAGER_KIMONOS = ["#7a4a5a", "#4a6a5a", "#5a5a8a", "#8a6a3a", "#6a4a7a", "#3a6a7a"];

function compassDir(dx: number, dy: number): string {
  const ang = Math.atan2(dy, dx);
  const dirs = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];
  return dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
}

const VILLAGER_LINES: ((ctx: { redPandaDir: string; catKnown: boolean }) => string)[] = [
  () => "the koi gather if you stand still by the water...",
  (c) => `a red panda naps somewhere to the ${c.redPandaDir}. lucky souls have seen it.`,
  () => "hold F when the bobber sinks — the rare ones fight longer.",
  () => "walk far enough and you'll find a place of lights and concrete.",
  () => "zozi's house? follow the golden road, if you can find its beginning.",
  () => "the golden bamboo grows where the grove opens up.",
  () => "rainy days make the lanterns prettier.",
  () => "i heard a stray cat lives in the city. it likes fish.",
  () => "sometimes you just have to jump.",
  () => "the spirit fish only bites for the patient.",
  () => "press V and see the world through zozi's eyes.",
];

// ─── Seasons & Weather ──────────────────────────────────────────────────────

type Season = "spring" | "summer" | "autumn" | "winter";
type SeasonMode = Season | "auto";
type WeatherMode = "auto" | "rain" | "clear";

// zozi lives in the southern hemisphere 🇦🇷
function seasonFromDate(): Season {
  const m = new Date().getMonth(); // 0-11
  if (m === 11 || m <= 1) return "summer";
  if (m <= 4) return "autumn";
  if (m <= 7) return "winter";
  return "spring";
}

const SEASON_PETAL: Record<Season, { color: string; rate: number; vyMul: number }> = {
  spring: { color: "#ffb0c0", rate: 0.03, vyMul: 1 },
  summer: { color: "#a8d08a", rate: 0.01, vyMul: 0.8 },
  autumn: { color: "#e08c4a", rate: 0.035, vyMul: 1.1 },
  winter: { color: "#f0f4ff", rate: 0.05, vyMul: 0.55 },
};

interface Raindrop { x: number; y: number; speed: number; len: number }
interface Firefly { x: number; y: number; vx: number; vy: number; phase: number; life: number }

// ─── Save / Load ────────────────────────────────────────────────────────────

const SAVE_KEY = "zozi-save";

interface SaveData {
  v: number;
  seed: number;
  x: number;
  y: number;
  walkMs: number;
  city: boolean;
  bamboo: boolean;
  redPandaFound: boolean;
  redPandaFollowing: boolean;
  catFound: boolean;
  catFollowing: boolean;
  fish: Record<string, number>;
  weatherMode: WeatherMode;
  seasonMode: SeasonMode;
}

function loadSave(): Partial<SaveData> | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d === "object" ? d : null;
  } catch {
    return null;
  }
}

interface OverlayTile { type: TileType; solid: boolean }

function isRoadTile(wx: number, wy: number): boolean {
  return ((wy % 12) + 12) % 12 < 2 || ((wx % 16) + 16) % 16 < 2;
}

function buildInitialOverlay(): Map<string, OverlayTile> {
  const m = new Map<string, OverlayTile>();
  // Bamboo park: open grove with scattered bamboo around golden bamboo
  // Garden floor throughout so the player can walk freely
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      const px = GOLDEN_BAMBOO_POS.x + dx;
      const py = GOLDEN_BAMBOO_POS.y + dy;
      if (isRoadTile(px, py)) continue; // don't cover roads
      m.set(`${px},${py}`, { type: TileType.Garden, solid: false });
    }
  }
  // Scattered bamboo — placed at corners and edges, leaving clear paths
  const bambooSpots = [
    [-3, -3], [-3, -1], [-3, 2], [-3, 3],
    [3, -3], [3, -1], [3, 2], [3, 3],
    [-1, -3], [2, -3],
    [-1, 3], [2, 3],
    [-2, -2], [2, -2], [-2, 2], [2, 2],
  ];
  for (const [dx, dy] of bambooSpots) {
    const px = GOLDEN_BAMBOO_POS.x + dx;
    const py = GOLDEN_BAMBOO_POS.y + dy;
    if (isRoadTile(px, py)) continue; // don't block roads
    m.set(`${px},${py}`, { type: TileType.Bamboo, solid: true });
  }
  m.set(`${GOLDEN_BAMBOO_POS.x},${GOLDEN_BAMBOO_POS.y}`, { type: TileType.GoldenBamboo, solid: false });
  return m;
}

function revealZoziPath(overlay: Map<string, OverlayTile>) {
  const yb = (): OverlayTile => ({ type: TileType.YellowBrick, solid: false });
  // Yellow brick road: follows existing streets (2 tiles wide to fill roads)
  // 1. Connector from bamboo park north to road (2 tiles wide)
  for (let y = GOLDEN_BAMBOO_POS.y; y >= 48; y--) {
    overlay.set(`${GOLDEN_BAMBOO_POS.x},${y}`, yb());
    overlay.set(`${GOLDEN_BAMBOO_POS.x + 1},${y}`, yb());
  }
  // 2. East on horizontal road y=48,49 (full 2-tile road width)
  for (let x = GOLDEN_BAMBOO_POS.x; x <= 81; x++) {
    overlay.set(`${x},48`, yb());
    overlay.set(`${x},49`, yb());
  }
  // 3. South on vertical road x=80,81 (full 2-tile road width)
  for (let y = 48; y <= 73; y++) {
    overlay.set(`80,${y}`, yb());
    overlay.set(`81,${y}`, yb());
  }
  // 4. East on horizontal road y=72,73 (full 2-tile road width)
  for (let x = 80; x <= 88; x++) {
    overlay.set(`${x},72`, yb());
    overlay.set(`${x},73`, yb());
  }
  // 5. Connector from road north to house door (2 tiles wide, matching door)
  for (let y = 71; y >= 69; y--) {
    overlay.set(`87,${y}`, yb());
    overlay.set(`88,${y}`, yb());
  }
  // Zozi's house structure (8×6)
  for (let dy = 0; dy < 6; dy++) {
    for (let dx = 0; dx < 8; dx++) {
      const wx = ZOZI_HOUSE_ORIGIN.x + dx, wy = ZOZI_HOUSE_ORIGIN.y + dy;
      const key = `${wx},${wy}`;
      if (dy < 2) overlay.set(key, { type: TileType.HouseRoof, solid: true });
      else if (dy === 5 && (dx === 3 || dx === 4)) overlay.set(key, { type: TileType.HouseDoor, solid: false });
      else overlay.set(key, { type: TileType.HouseWall, solid: true });
    }
  }
  // Lanterns
  overlay.set("83,64", { type: TileType.Lantern, solid: true });
  overlay.set("92,64", { type: TileType.Lantern, solid: true });
}

// ─── Interior Room Layout ────────────────────────────────────────────────

const ROOM_W = 12;
const ROOM_H = 10;
// 0=tatami 1=wall 2=exit 3=table 4=cushion 5=futon 6=tokonoma 7=shoji
const ROOM_LAYOUT = [
  [1,1,1,7,7,1,1,7,7,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,6,6,0,1],
  [1,0,0,3,3,0,0,0,0,0,0,1],
  [1,0,4,3,3,4,0,0,0,0,0,1],
  [1,0,0,3,3,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,5,5,0,0,1],
  [1,0,0,0,0,0,0,5,5,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,2,2,1,1,1,1,1],
];
const ROOM_SOLID = new Set([1, 3, 6, 7]);

function isRoomSolid(rx: number, ry: number): boolean {
  const ix = Math.floor(rx), iy = Math.floor(ry);
  if (ix < 0 || ix >= ROOM_W || iy < 0 || iy >= ROOM_H) return true;
  return ROOM_SOLID.has(ROOM_LAYOUT[iy][ix]);
}

// ─── Seeded Random ──────────────────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// The world seed makes every fresh browser generate a different town. It is
// mixed into every coordinate hash, and persisted in the save so the same
// world regenerates identically across reloads. Kept small (< 2^20) so the
// multiplications below stay well inside float53 precision.
let WORLD_SEED = 0;

function setWorldSeed(s: number) {
  WORLD_SEED = s & 0xfffff;
}

function newWorldSeed(): number {
  return Math.floor(Math.random() * 0x100000);
}

function hashCoord(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263 + WORLD_SEED * 987643;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h ^ (h >> 16)) ^ WORLD_SEED;
}

// ─── Tile Types ─────────────────────────────────────────────────────────────

const enum TileType {
  Grass,
  Path,
  Water,
  HouseWall,
  HouseRoof,
  HouseDoor,
  TreeTrunk,
  TreeCanopy,
  Lantern,
  Bridge,
  Torii,
  StoneWall,
  Fence,
  Bamboo,
  Bush,
  Garden,
  Empty,
  GoldenBamboo,
  YellowBrick,
  Asphalt,
  Sidewalk,
  BuildingWall,
  BuildingRoof,
  BuildingDoor,
  StreetLight,
}

// Helper: is walkable surface "stone-like"?
function isStoneSurface(t: TileType): boolean {
  return t === TileType.Path || t === TileType.Bridge || t === TileType.Garden ||
    t === TileType.YellowBrick || t === TileType.Asphalt || t === TileType.Sidewalk;
}

// ─── World Generation ───────────────────────────────────────────────────────

interface Chunk {
  cx: number;
  cy: number;
  tiles: TileType[][];
  solid: boolean[][];
  city: boolean;
}

function generateChunk(cx: number, cy: number, city = false): Chunk {
  if (city) return generateCityChunk(cx, cy);
  const tiles: TileType[][] = [];
  const solid: boolean[][] = [];
  const rng = seededRandom(hashCoord(cx, cy));

  for (let y = 0; y < CHUNK_SIZE; y++) {
    tiles[y] = [];
    solid[y] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      tiles[y][x] = TileType.Grass;
      solid[y][x] = false;
    }
  }

  const wx = cx * CHUNK_SIZE;
  const wy = cy * CHUNK_SIZE;

  // roads
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = wx + x;
      const worldY = wy + y;
      if (((worldY % 12) + 12) % 12 < 2) tiles[y][x] = TileType.Path;
      if (((worldX % 16) + 16) % 16 < 2) tiles[y][x] = TileType.Path;
    }
  }

  // water canals
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = wx + x;
      const worldY = wy + y;
      const modX = ((worldX % 48) + 48) % 48;
      const modY = ((worldY % 48) + 48) % 48;
      if (modY >= 22 && modY <= 24 && tiles[y][x] !== TileType.Path) {
        tiles[y][x] = TileType.Water;
        solid[y][x] = true;
      }
      if (modY >= 22 && modY <= 24 && ((worldX % 16) + 16) % 16 < 2) {
        tiles[y][x] = TileType.Bridge;
        solid[y][x] = false;
      }
      if (modX >= 38 && modX <= 40 && modY >= 8 && modY <= 10 && tiles[y][x] === TileType.Grass) {
        tiles[y][x] = TileType.Water;
        solid[y][x] = true;
      }
    }
  }

  // place structures in blocks between roads
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = wx + x;
      const worldY = wy + y;
      const blockX = ((worldX % 16) + 16) % 16;
      const blockY = ((worldY % 12) + 12) % 12;

      if (tiles[y][x] !== TileType.Grass) continue;

      const bx = Math.floor(worldX / 16);
      const by = Math.floor(worldY / 12);
      const blockRng = seededRandom(hashCoord(bx * 7 + 3, by * 13 + 7));
      const blockType = blockRng();

      if (blockType < 0.55) {
        // house block
        const houseStartX = 4;
        const houseEndX = 12;
        const houseStartY = 3;
        const houseEndY = 9;

        if (blockX >= houseStartX && blockX < houseEndX && blockY >= houseStartY && blockY < houseEndY) {
          const relX = blockX - houseStartX;
          const relY = blockY - houseStartY;
          const houseW = houseEndX - houseStartX;
          const houseH = houseEndY - houseStartY;

          if (relY < 2) {
            tiles[y][x] = TileType.HouseRoof;
            solid[y][x] = true;
          } else if (relY < houseH) {
            if (relY === houseH - 1 && relX >= houseW / 2 - 1 && relX <= houseW / 2) {
              tiles[y][x] = TileType.HouseDoor;
              solid[y][x] = true;
            } else {
              tiles[y][x] = TileType.HouseWall;
              solid[y][x] = true;
            }
          }
        }

        // lanterns at corners of house — SOLID
        if (blockX === 3 && blockY === 4) {
          tiles[y][x] = TileType.Lantern;
          solid[y][x] = true;
        }
        if (blockX === 12 && blockY === 4) {
          tiles[y][x] = TileType.Lantern;
          solid[y][x] = true;
        }

        // fence around some houses
        const hasFence = blockRng() > 0.5;
        if (hasFence) {
          if ((blockX === 3 || blockX === 13) && blockY >= 3 && blockY <= 9) {
            if (tiles[y][x] === TileType.Grass) {
              tiles[y][x] = TileType.Fence;
              solid[y][x] = true;
            }
          }
          if ((blockY === 2 || blockY === 10) && blockX >= 3 && blockX <= 13) {
            if (tiles[y][x] === TileType.Grass) {
              tiles[y][x] = TileType.Fence;
              solid[y][x] = true;
            }
          }
        }
      } else if (blockType < 0.7) {
        // garden / park block
        if ((blockX === 5 || blockX === 10) && (blockY === 4 || blockY === 8)) {
          tiles[y][x] = TileType.TreeTrunk;
          solid[y][x] = true;
        }
        if (
          ((blockX >= 4 && blockX <= 6) || (blockX >= 9 && blockX <= 11)) &&
          ((blockY >= 3 && blockY <= 3) || (blockY >= 7 && blockY <= 7))
        ) {
          if (tiles[y][x] === TileType.Grass) {
            tiles[y][x] = TileType.TreeCanopy;
            solid[y][x] = true;
          }
        }
        if (blockX >= 7 && blockX <= 8 && blockY >= 3 && blockY <= 9) {
          tiles[y][x] = TileType.Garden;
        }
        if (blockX === 3 && blockY >= 3 && blockY <= 9 && blockY % 2 === 0) {
          if (tiles[y][x] === TileType.Grass) {
            tiles[y][x] = TileType.Bush;
            solid[y][x] = true;
          }
        }
        if (blockX === 12 && blockY >= 3 && blockY <= 9 && blockY % 2 === 0) {
          if (tiles[y][x] === TileType.Grass) {
            tiles[y][x] = TileType.Bush;
            solid[y][x] = true;
          }
        }
      } else if (blockType < 0.82) {
        // bamboo grove
        const bHash = hashCoord(worldX * 3, worldY * 5);
        if (blockX >= 4 && blockX <= 12 && blockY >= 3 && blockY <= 9) {
          if ((bHash & 7) < 3) {
            tiles[y][x] = TileType.Bamboo;
            solid[y][x] = true;
          }
        }
      } else if (blockType < 0.88) {
        // torii gate block
        if (blockX === 7 && blockY === 4) {
          tiles[y][x] = TileType.Torii;
          solid[y][x] = true;
        }
        if (blockX === 9 && blockY === 4) {
          tiles[y][x] = TileType.Torii;
          solid[y][x] = true;
        }
        if (blockX === 8 && blockY >= 3 && blockY <= 8) {
          tiles[y][x] = TileType.Garden;
        }
        // lanterns — SOLID
        if (blockX === 6 && blockY === 6) {
          tiles[y][x] = TileType.Lantern;
          solid[y][x] = true;
        }
        if (blockX === 10 && blockY === 6) {
          tiles[y][x] = TileType.Lantern;
          solid[y][x] = true;
        }
      } else {
        // stone wall / ruins block
        if (blockX >= 4 && blockX <= 12 && (blockY === 3 || blockY === 9)) {
          tiles[y][x] = TileType.StoneWall;
          solid[y][x] = true;
        }
        if ((blockX === 4 || blockX === 12) && blockY >= 3 && blockY <= 9) {
          tiles[y][x] = TileType.StoneWall;
          solid[y][x] = true;
        }
        if (blockX >= 7 && blockX <= 9 && blockY === 9) {
          tiles[y][x] = TileType.Garden;
          solid[y][x] = false;
        }
      }
    }
  }

  // scatter decorative bushes
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      if (tiles[y][x] === TileType.Grass && rng() < 0.015) {
        tiles[y][x] = TileType.Bush;
        solid[y][x] = true;
      }
    }
  }

  return { cx, cy, tiles, solid, city: false };
}

// ─── City Generation ─────────────────────────────────────────────────────────

function generateCityChunk(cx: number, cy: number): Chunk {
  const tiles: TileType[][] = [];
  const solid: boolean[][] = [];
  const rng = seededRandom(hashCoord(cx, cy));

  for (let y = 0; y < CHUNK_SIZE; y++) {
    tiles[y] = [];
    solid[y] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      tiles[y][x] = TileType.Grass;
      solid[y][x] = false;
    }
  }

  const wx = cx * CHUNK_SIZE;
  const wy = cy * CHUNK_SIZE;

  // asphalt roads on the same street grid, with sidewalks alongside
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = wx + x;
      const worldY = wy + y;
      const mx = ((worldX % 16) + 16) % 16;
      const my = ((worldY % 12) + 12) % 12;
      if (my < 2 || mx < 2) {
        tiles[y][x] = TileType.Asphalt;
        continue;
      }
      if (my === 2 || my === 11 || mx === 2 || mx === 15) tiles[y][x] = TileType.Sidewalk;
    }
  }

  // the river canals survive in the city
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = wx + x;
      const worldY = wy + y;
      const modX = ((worldX % 48) + 48) % 48;
      const modY = ((worldY % 48) + 48) % 48;
      const mx = ((worldX % 16) + 16) % 16;
      if (modY >= 22 && modY <= 24 && tiles[y][x] !== TileType.Asphalt) {
        tiles[y][x] = TileType.Water;
        solid[y][x] = true;
      }
      if (modY >= 22 && modY <= 24 && mx < 2) {
        tiles[y][x] = TileType.Bridge;
        solid[y][x] = false;
      }
      if (modX >= 38 && modX <= 40 && modY >= 8 && modY <= 10 && tiles[y][x] === TileType.Grass) {
        tiles[y][x] = TileType.Water;
        solid[y][x] = true;
      }
    }
  }

  // city blocks: buildings, pocket parks, fenced lots
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = wx + x;
      const worldY = wy + y;
      if (tiles[y][x] !== TileType.Grass) continue;
      const mx = ((worldX % 16) + 16) % 16;
      const my = ((worldY % 12) + 12) % 12;
      const bx = Math.floor(worldX / 16);
      const by = Math.floor(worldY / 12);
      const blockRng = seededRandom(hashCoord(bx * 7 + 3, by * 13 + 7));
      const blockType = blockRng();

      if (blockType < 0.72) {
        // building block
        if (mx >= 4 && mx <= 13 && my >= 3 && my <= 9) {
          if (my <= 4) {
            tiles[y][x] = TileType.BuildingRoof;
            solid[y][x] = true;
          } else if (my === 9 && (mx === 8 || mx === 9)) {
            tiles[y][x] = TileType.BuildingDoor;
            solid[y][x] = true;
          } else {
            tiles[y][x] = TileType.BuildingWall;
            solid[y][x] = true;
          }
        }
        if ((mx === 3 && my === 3) || (mx === 14 && my === 10)) {
          tiles[y][x] = TileType.StreetLight;
          solid[y][x] = true;
        }
      } else if (blockType < 0.88) {
        // pocket park
        if ((mx === 5 || mx === 10) && (my === 4 || my === 8)) {
          tiles[y][x] = TileType.TreeTrunk;
          solid[y][x] = true;
        }
        if (((mx >= 4 && mx <= 6) || (mx >= 9 && mx <= 11)) && (my === 3 || my === 7)) {
          tiles[y][x] = TileType.TreeCanopy;
          solid[y][x] = true;
        }
        if (mx >= 7 && mx <= 8 && my >= 3 && my <= 9) tiles[y][x] = TileType.Garden;
        if ((mx === 3 || mx === 12) && my >= 4 && my <= 8 && my % 2 === 0) {
          tiles[y][x] = TileType.Bush;
          solid[y][x] = true;
        }
      } else {
        // fenced empty lot
        if (mx >= 4 && mx <= 12 && (my === 3 || my === 9)) {
          tiles[y][x] = TileType.StoneWall;
          solid[y][x] = true;
        }
        if ((mx === 4 || mx === 12) && my >= 3 && my <= 9) {
          tiles[y][x] = TileType.StoneWall;
          solid[y][x] = true;
        }
        if (tiles[y][x] === TileType.Grass && rng() < 0.05) {
          tiles[y][x] = TileType.Bush;
          solid[y][x] = true;
        }
      }
    }
  }

  return { cx, cy, tiles, solid, city: true };
}

// ─── House palette lookup ───────────────────────────────────────────────────

function getHousePalette(worldX: number, worldY: number) {
  const bx = Math.floor(worldX / 16);
  const by = Math.floor(worldY / 12);
  if (bx === ZOZI_BLOCK.bx && by === ZOZI_BLOCK.by) return ZOZI_PALETTE;
  const idx = Math.abs(hashCoord(bx * 11 + 5, by * 17 + 3)) % HOUSE_PALETTES.length;
  return HOUSE_PALETTES[idx];
}

function getCityPalette(worldX: number, worldY: number) {
  const bx = Math.floor(worldX / 16);
  const by = Math.floor(worldY / 12);
  return CITY_PALETTES[Math.abs(hashCoord(bx * 13 + 1, by * 29 + 9)) % CITY_PALETTES.length];
}

// ─── Tile Rendering ─────────────────────────────────────────────────────────

function drawTile(
  ctx: CanvasRenderingContext2D,
  type: TileType,
  sx: number,
  sy: number,
  worldX: number,
  worldY: number,
  time: number,
  pulsating?: boolean
) {
  const s = SCALE;
  const hash = hashCoord(worldX, worldY);
  const variant = Math.abs(hash) % 4;

  switch (type) {
    case TileType.Grass: {
      ctx.fillStyle = variant === 0 ? COLORS.grass1 : variant === 1 ? COLORS.grass2 : COLORS.grass3;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      const grassRng = seededRandom(hash);
      ctx.fillStyle = COLORS.grass2;
      for (let i = 0; i < 3; i++) {
        const gx = Math.floor(grassRng() * 14) * s;
        const gy = Math.floor(grassRng() * 14) * s;
        ctx.fillRect(sx + gx, sy + gy, s, s * 2);
      }
      if (variant === 0 && (hash & 15) < 2) {
        const fc = (hash & 1) === 0 ? COLORS.flowerPink : COLORS.flowerWhite;
        ctx.fillStyle = fc;
        ctx.fillRect(sx + 6 * s, sy + 6 * s, s * 2, s * 2);
        ctx.fillStyle = COLORS.flowerYellow;
        ctx.fillRect(sx + 6 * s + s / 2, sy + 6 * s + s / 2, s, s);
      }
      break;
    }

    case TileType.Path: {
      ctx.fillStyle = variant < 2 ? COLORS.path1 : COLORS.path2;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.pathEdge;
      if (variant === 0) {
        ctx.fillRect(sx + 2 * s, sy + 5 * s, s * 3, s);
        ctx.fillRect(sx + 10 * s, sy + 11 * s, s * 4, s);
      }
      if (variant === 1) {
        ctx.fillRect(sx + 7 * s, sy + 3 * s, s * 2, s);
        ctx.fillRect(sx + 1 * s, sy + 12 * s, s * 3, s);
      }
      break;
    }

    case TileType.Water: {
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      const wave = Math.sin(time * 0.002 + worldX * 0.5 + worldY * 0.3);
      ctx.fillStyle = COLORS.waterLight;
      const wy2 = Math.floor((wave + 1) * 3) * s;
      ctx.fillRect(sx + 2 * s, sy + wy2, s * 4, s);
      ctx.fillRect(sx + 9 * s, sy + wy2 + 4 * s, s * 3, s);
      const wave2 = Math.sin(time * 0.0015 + worldX * 0.7);
      ctx.fillStyle = COLORS.waterDark;
      ctx.fillRect(sx + 6 * s, sy + Math.floor((wave2 + 1) * 4) * s, s * 5, s);
      break;
    }

    case TileType.HouseWall: {
      const hp = getHousePalette(worldX, worldY);
      ctx.fillStyle = hp.wallBase;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.woodDark;
      ctx.fillRect(sx, sy, s, SCALED_TILE);
      ctx.fillRect(sx + 15 * s, sy, s, SCALED_TILE);
      if (variant < 2) {
        ctx.fillStyle = COLORS.woodDark;
        ctx.fillRect(sx + 4 * s, sy + 4 * s, s * 8, s * 6);
        ctx.fillStyle = "#2a3a4a";
        ctx.fillRect(sx + 5 * s, sy + 5 * s, s * 6, s * 4);
        const glow = 0.5 + Math.sin(time * 0.001 + hash) * 0.2;
        ctx.fillStyle = `rgba(255, 200, 100, ${glow * 0.4})`;
        ctx.fillRect(sx + 5 * s, sy + 5 * s, s * 6, s * 4);
        ctx.fillStyle = COLORS.wood;
        ctx.fillRect(sx + 7 * s, sy + 5 * s, s * 2, s * 4);
        ctx.fillRect(sx + 5 * s, sy + 6 * s, s * 6, s);
      }
      break;
    }

    case TileType.HouseRoof: {
      const hp = getHousePalette(worldX, worldY);
      ctx.fillStyle = hp.roofDark;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      for (let ry = 0; ry < 16; ry += 3) {
        for (let rx = (ry % 6 === 0 ? 0 : 3); rx < 16; rx += 6) {
          ctx.fillStyle = hp.roofMid;
          ctx.fillRect(sx + rx * s, sy + ry * s, s * 5, s * 2);
          ctx.fillStyle = hp.roofLight;
          ctx.fillRect(sx + rx * s, sy + ry * s, s * 5, s);
        }
      }
      break;
    }

    case TileType.HouseDoor: {
      const hp = getHousePalette(worldX, worldY);
      // Wall base background
      ctx.fillStyle = hp.wallBase;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // Wood frame borders (matching HouseWall)
      ctx.fillStyle = COLORS.woodDark;
      ctx.fillRect(sx, sy, s, SCALED_TILE);
      ctx.fillRect(sx + 15 * s, sy, s, SCALED_TILE);
      // Door frame
      ctx.fillStyle = COLORS.woodDark;
      ctx.fillRect(sx + 4 * s, sy + s, s * 8, s);
      ctx.fillRect(sx + 4 * s, sy + s, s, s * 14);
      ctx.fillRect(sx + 11 * s, sy + s, s, s * 14);
      // Door background
      ctx.fillStyle = COLORS.door;
      ctx.fillRect(sx + 5 * s, sy + 2 * s, s * 6, s * 13);
      // Noren curtain — shorter and narrower with slits
      ctx.fillStyle = hp.roofDark;
      ctx.fillRect(sx + 5 * s, sy + 2 * s, s * 6, s * 5);
      // Noren center slit
      ctx.fillStyle = COLORS.door;
      ctx.fillRect(sx + 7 * s, sy + 4 * s, s * 2, s * 3);
      // Noren decorative marks
      ctx.fillStyle = hp.wallLight;
      ctx.fillRect(sx + 6 * s, sy + 3 * s, s, s);
      ctx.fillRect(sx + 9 * s, sy + 3 * s, s, s);
      // Stone threshold
      ctx.fillStyle = COLORS.stone;
      ctx.fillRect(sx + 4 * s, sy + 15 * s, s * 8, s);
      break;
    }

    case TileType.TreeTrunk: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.trunkDark;
      ctx.fillRect(sx + 6 * s, sy, s * 4, SCALED_TILE);
      ctx.fillStyle = COLORS.trunk;
      ctx.fillRect(sx + 7 * s, sy, s * 2, SCALED_TILE);
      break;
    }

    case TileType.TreeCanopy: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.leaves1;
      ctx.fillRect(sx + s, sy + s, s * 14, s * 14);
      ctx.fillStyle = COLORS.leaves2;
      ctx.fillRect(sx + 2 * s, sy + 2 * s, s * 12, s * 10);
      ctx.fillStyle = COLORS.leaves3;
      ctx.fillRect(sx + 3 * s, sy + 3 * s, s * 8, s * 6);
      const petalRng = seededRandom(hash + Math.floor(time / 2000));
      ctx.fillStyle = COLORS.petal;
      for (let i = 0; i < 5; i++) {
        const px = Math.floor(petalRng() * 12 + 2) * s;
        const py = Math.floor(petalRng() * 10 + 2) * s;
        ctx.fillRect(sx + px, sy + py, s * 2, s);
      }
      break;
    }

    case TileType.Lantern: {
      const isZoziLantern = (worldX === 83 && worldY === 64) || (worldX === 92 && worldY === 64);
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      if (pulsating) {
        const outerGlow = 0.15 + Math.sin(time * 0.006) * 0.12;
        ctx.fillStyle = isZoziLantern
          ? `rgba(255, 215, 0, ${outerGlow})`
          : `rgba(255, 120, 60, ${outerGlow})`;
        ctx.fillRect(sx - 3 * s, sy - 3 * s, SCALED_TILE + 6 * s, SCALED_TILE + 6 * s);
      }
      ctx.fillStyle = COLORS.lanternPole;
      ctx.fillRect(sx + 7 * s, sy + 6 * s, s * 2, s * 10);
      ctx.fillStyle = isZoziLantern && pulsating ? "#d4a017" : COLORS.lanternBody;
      ctx.fillRect(sx + 5 * s, sy + 2 * s, s * 6, s * 5);
      if (pulsating) {
        const glowI = 0.5 + Math.sin(time * 0.006) * 0.4;
        ctx.fillStyle = isZoziLantern
          ? `rgba(255, 200, 50, ${glowI})`
          : `rgba(255, 100, 50, ${glowI})`;
        ctx.fillRect(sx + 1 * s, sy - 2 * s, s * 14, s * 12);
      } else {
        const glowI = 0.3 + Math.sin(time * 0.003 + hash * 0.1) * 0.15;
        ctx.fillStyle = `rgba(255, 100, 50, ${glowI})`;
        ctx.fillRect(sx + 3 * s, sy, s * 10, s * 9);
      }
      ctx.fillStyle = COLORS.lanternPole;
      ctx.fillRect(sx + 4 * s, sy + s, s * 8, s);
      ctx.fillRect(sx + 4 * s, sy + 7 * s, s * 8, s);
      break;
    }

    case TileType.Bridge: {
      ctx.fillStyle = COLORS.wood;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.woodDark;
      for (let py = 0; py < 16; py += 4) {
        ctx.fillRect(sx, sy + py * s, SCALED_TILE, s);
      }
      ctx.fillStyle = COLORS.bridgeRail;
      ctx.fillRect(sx, sy, s * 2, SCALED_TILE);
      ctx.fillRect(sx + 14 * s, sy, s * 2, SCALED_TILE);
      break;
    }

    case TileType.Torii: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.toriRed;
      ctx.fillRect(sx + 5 * s, sy, s * 3, SCALED_TILE);
      ctx.fillStyle = COLORS.toriRedDark;
      ctx.fillRect(sx, sy, SCALED_TILE, s * 3);
      ctx.fillStyle = COLORS.toriRed;
      ctx.fillRect(sx, sy + s, SCALED_TILE, s * 2);
      ctx.fillRect(sx + 2 * s, sy + 5 * s, s * 12, s * 2);
      break;
    }

    case TileType.StoneWall: {
      ctx.fillStyle = COLORS.stone;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.stoneDark;
      for (let ry = 0; ry < 16; ry += 4) {
        for (let rx = (ry % 8 === 0 ? 0 : 4); rx < 16; rx += 8) {
          ctx.fillRect(sx + rx * s, sy + ry * s, s, s * 3);
        }
        ctx.fillRect(sx, sy + ry * s + 3 * s, SCALED_TILE, s);
      }
      break;
    }

    case TileType.Fence: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.fenceWood;
      ctx.fillRect(sx, sy + 4 * s, SCALED_TILE, s * 2);
      ctx.fillRect(sx, sy + 10 * s, SCALED_TILE, s * 2);
      ctx.fillStyle = COLORS.woodDark;
      ctx.fillRect(sx + 6 * s, sy + 2 * s, s * 3, s * 12);
      break;
    }

    case TileType.Bamboo: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.bamboo;
      ctx.fillRect(sx + 6 * s, sy, s * 3, SCALED_TILE);
      ctx.fillStyle = COLORS.bambooDark;
      ctx.fillRect(sx + 6 * s, sy + 5 * s, s * 3, s);
      ctx.fillRect(sx + 6 * s, sy + 11 * s, s * 3, s);
      ctx.fillStyle = COLORS.bamboo;
      ctx.fillRect(sx + 3 * s, sy + s, s * 4, s * 2);
      ctx.fillRect(sx + 9 * s, sy + 3 * s, s * 5, s * 2);
      ctx.fillRect(sx + 2 * s, sy + 7 * s, s * 4, s * 2);
      break;
    }

    case TileType.Bush: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.bushDark;
      ctx.fillRect(sx + 2 * s, sy + 4 * s, s * 12, s * 10);
      ctx.fillStyle = COLORS.bushLight;
      ctx.fillRect(sx + 3 * s, sy + 5 * s, s * 10, s * 6);
      if ((hash & 3) === 0) {
        ctx.fillStyle = COLORS.flowerWhite;
        ctx.fillRect(sx + 5 * s, sy + 6 * s, s * 2, s * 2);
        ctx.fillRect(sx + 10 * s, sy + 7 * s, s * 2, s * 2);
      }
      break;
    }

    case TileType.Garden: {
      ctx.fillStyle = COLORS.grass2;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.stone;
      ctx.fillRect(sx + 3 * s, sy + 3 * s, s * 4, s * 4);
      ctx.fillRect(sx + 9 * s, sy + 9 * s, s * 4, s * 4);
      break;
    }

    case TileType.GoldenBamboo: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      const glow = 0.5 + Math.sin(time * 0.003) * 0.3;
      ctx.fillStyle = `rgba(255,215,0,${glow * 0.12})`;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = "#d4a017";
      ctx.fillRect(sx + 6 * s, sy, s * 3, SCALED_TILE);
      ctx.fillStyle = "#b8860b";
      ctx.fillRect(sx + 6 * s, sy + 5 * s, s * 3, s);
      ctx.fillRect(sx + 6 * s, sy + 11 * s, s * 3, s);
      ctx.fillStyle = "#ffd700";
      ctx.fillRect(sx + 7 * s, sy, s, SCALED_TILE);
      ctx.fillStyle = "#d4a017";
      ctx.fillRect(sx + 3 * s, sy + s, s * 4, s * 2);
      ctx.fillRect(sx + 9 * s, sy + 3 * s, s * 5, s * 2);
      ctx.fillStyle = `rgba(255,223,0,${glow * 0.2})`;
      ctx.fillRect(sx + 2 * s, sy + 2 * s, s * 12, s * 12);
      break;
    }

    case TileType.YellowBrick: {
      ctx.fillStyle = "#d4a017";
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      for (let ry = 0; ry < 16; ry += 4) {
        ctx.fillStyle = "#c4941a";
        for (let rx = (ry % 8 === 0 ? 0 : 4); rx < 16; rx += 8) {
          ctx.fillRect(sx + rx * s, sy + ry * s, s * 7, s * 3);
        }
        ctx.fillStyle = "#b8860b";
        ctx.fillRect(sx, sy + ry * s + 3 * s, SCALED_TILE, s);
      }
      if (Math.sin(time * 0.005 + hash) > 0.7) {
        ctx.fillStyle = "rgba(255,255,200,0.4)";
        ctx.fillRect(sx + (Math.abs(hash) % 10 + 3) * s, sy + (Math.abs(hash >> 4) % 10 + 3) * s, s * 2, s * 2);
      }
      break;
    }

    case TileType.Asphalt: {
      ctx.fillStyle = "#2e2f35";
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      const aRng = seededRandom(hash);
      ctx.fillStyle = "#383941";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(sx + Math.floor(aRng() * 14) * s, sy + Math.floor(aRng() * 14) * s, s * 2, s);
      }
      const mx = ((worldX % 16) + 16) % 16;
      const my = ((worldY % 12) + 12) % 12;
      const onH = my < 2;
      const onV = mx < 2;
      // dashed center lines
      ctx.fillStyle = "#c9a13b";
      if (onH && !onV && my === 1 && ((worldX % 2) + 2) % 2 === 0) {
        ctx.fillRect(sx + 3 * s, sy, s * 8, s);
      }
      if (onV && !onH && mx === 1 && ((worldY % 2) + 2) % 2 === 0) {
        ctx.fillRect(sx, sy + 3 * s, s, s * 8);
      }
      // crosswalks where roads meet sidewalks
      ctx.fillStyle = "rgba(230,230,235,0.75)";
      if (onH && !onV && (mx === 2 || mx === 15)) {
        for (let i = 0; i < 4; i++) ctx.fillRect(sx + (1 + i * 4) * s, sy + s, s * 2, s * 14);
      }
      if (onV && !onH && (my === 2 || my === 11)) {
        for (let i = 0; i < 4; i++) ctx.fillRect(sx + s, sy + (1 + i * 4) * s, s * 14, s * 2);
      }
      break;
    }

    case TileType.Sidewalk: {
      ctx.fillStyle = variant < 2 ? "#9c9ca4" : "#94949c";
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = "#7e7e86";
      ctx.fillRect(sx + 7 * s, sy, s, SCALED_TILE);
      ctx.fillRect(sx, sy + 7 * s, SCALED_TILE, s);
      if (variant === 3) {
        ctx.fillRect(sx + 3 * s, sy + 11 * s, s * 4, s);
      }
      break;
    }

    case TileType.BuildingWall: {
      const cp = getCityPalette(worldX, worldY);
      ctx.fillStyle = cp.wall;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = cp.wallDark;
      ctx.fillRect(sx, sy, s, SCALED_TILE);
      ctx.fillRect(sx + 15 * s, sy, s, SCALED_TILE);
      // two windows, some lit
      for (let wI = 0; wI < 2; wI++) {
        const wxp = sx + (wI === 0 ? 3 : 9) * s;
        ctx.fillStyle = "#141c28";
        ctx.fillRect(wxp, sy + 4 * s, s * 4, s * 6);
        const lit = wI === 0 ? (hash & 3) !== 0 : ((hash >> 2) & 3) !== 0;
        if (lit) {
          const glow = 0.35 + Math.sin(time * 0.0008 + hash + wI * 3) * 0.1;
          ctx.fillStyle = `rgba(255, 214, 120, ${glow})`;
          ctx.fillRect(wxp, sy + 4 * s, s * 4, s * 6);
        }
        ctx.fillStyle = cp.wallDark;
        ctx.fillRect(wxp, sy + 6 * s, s * 4, s);
      }
      // neon signs on some ground-floor walls
      const myB = ((worldY % 12) + 12) % 12;
      if (myB === 8 && Math.abs(hash) % 5 === 0) {
        const neon = NEON_COLORS[Math.abs(hash >> 3) % NEON_COLORS.length];
        const pulse = 0.55 + Math.sin(time * 0.004 + hash) * 0.25;
        ctx.fillStyle = `rgba(${neon.r},${neon.g},${neon.b},${pulse * 0.35})`;
        ctx.fillRect(sx, sy + 10 * s, SCALED_TILE, s * 6);
        ctx.fillStyle = `rgba(${neon.r},${neon.g},${neon.b},${pulse})`;
        ctx.fillRect(sx + 2 * s, sy + 12 * s, s * 12, s * 2);
        ctx.fillStyle = "#101018";
        for (let i = 0; i < 3; i++) ctx.fillRect(sx + (4 + i * 4) * s, sy + 12 * s, s, s * 2);
      }
      break;
    }

    case TileType.BuildingRoof: {
      ctx.fillStyle = "#3c3e46";
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = "#484a54";
      ctx.fillRect(sx, sy, SCALED_TILE, s);
      ctx.fillStyle = "#32343c";
      for (let ry = 4; ry < 16; ry += 6) ctx.fillRect(sx, sy + ry * s, SCALED_TILE, s);
      if ((hash & 7) === 0) {
        // AC unit
        ctx.fillStyle = "#8a8a92";
        ctx.fillRect(sx + 5 * s, sy + 5 * s, s * 6, s * 5);
        ctx.fillStyle = "#5a5a62";
        ctx.fillRect(sx + 6 * s, sy + 6 * s, s * 4, s * 3);
        ctx.fillStyle = "#2c2c32";
        ctx.fillRect(sx + 7 * s, sy + 7 * s, s * 2, s);
      }
      break;
    }

    case TileType.BuildingDoor: {
      const cp = getCityPalette(worldX, worldY);
      ctx.fillStyle = cp.wall;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = cp.wallDark;
      ctx.fillRect(sx, sy, s, SCALED_TILE);
      ctx.fillRect(sx + 15 * s, sy, s, SCALED_TILE);
      // awning
      ctx.fillStyle = "#7a2a2a";
      ctx.fillRect(sx + 2 * s, sy + s, s * 12, s * 2);
      ctx.fillStyle = "#9a3a3a";
      for (let i = 0; i < 3; i++) ctx.fillRect(sx + (3 + i * 4) * s, sy + s, s * 2, s * 2);
      // warm light over the door
      const doorGlow = 0.25 + Math.sin(time * 0.002 + hash) * 0.08;
      ctx.fillStyle = `rgba(255, 220, 150, ${doorGlow})`;
      ctx.fillRect(sx + 3 * s, sy + 3 * s, s * 10, s * 3);
      // glass door
      ctx.fillStyle = "#4a4a52";
      ctx.fillRect(sx + 4 * s, sy + 5 * s, s * 8, s * 10);
      ctx.fillStyle = "#22303e";
      ctx.fillRect(sx + 5 * s, sy + 6 * s, s * 6, s * 9);
      ctx.fillStyle = "#3a5a6e";
      ctx.fillRect(sx + 6 * s, sy + 6 * s, s, s * 9);
      // threshold
      ctx.fillStyle = "#84848c";
      ctx.fillRect(sx + 3 * s, sy + 15 * s, s * 10, s);
      break;
    }

    case TileType.StreetLight: {
      // sidewalk base
      ctx.fillStyle = "#9c9ca4";
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = "#7e7e86";
      ctx.fillRect(sx + 7 * s, sy, s, SCALED_TILE);
      ctx.fillRect(sx, sy + 7 * s, SCALED_TILE, s);
      // glow
      const lampGlow = 0.16 + Math.sin(time * 0.002 + hash) * 0.05;
      ctx.fillStyle = `rgba(255, 240, 190, ${lampGlow})`;
      ctx.fillRect(sx - 2 * s, sy - 2 * s, s * 14, s * 10);
      // pole + arm
      ctx.fillStyle = "#26262c";
      ctx.fillRect(sx + 9 * s, sy + 3 * s, s * 2, s * 13);
      ctx.fillRect(sx + 4 * s, sy + 2 * s, s * 7, s);
      // lamp head
      ctx.fillStyle = "#eee8c8";
      ctx.fillRect(sx + 3 * s, sy + 2 * s, s * 3, s * 2);
      break;
    }

    default:
      ctx.fillStyle = "#333";
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
  }
}

// ─── Character Drawing ──────────────────────────────────────────────────────

type Direction = "down" | "up" | "left" | "right";

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  dir: Direction,
  frame: number,
  _time: number,
  hasGoldenBamboo = false,
  fishingState: FishingState = "idle"
) {
  const s = SCALE;
  const f = frame % 4;
  const bob = f === 1 || f === 3 ? -s : 0;

  // sandals
  const footOffset = f === 0 ? -s : f === 2 ? s : 0;
  ctx.fillStyle = "#8b6f4e";
  if (dir === "left" || dir === "right") {
    ctx.fillRect(sx + 5 * s, sy + 14 * s + footOffset, s * 3, s * 2);
    ctx.fillRect(sx + 8 * s, sy + 14 * s - footOffset, s * 3, s * 2);
  } else {
    ctx.fillRect(sx + 4 * s + footOffset, sy + 14 * s, s * 3, s * 2);
    ctx.fillRect(sx + 9 * s - footOffset, sy + 14 * s, s * 3, s * 2);
  }

  // legs
  ctx.fillStyle = "#1a1a3a";
  ctx.fillRect(sx + 5 * s, sy + 11 * s + bob, s * 6, s * 4);

  // kimono
  ctx.fillStyle = "#3a4a6a";
  ctx.fillRect(sx + 4 * s, sy + 5 * s + bob, s * 8, s * 7);
  ctx.fillStyle = "#4a5a7a";
  ctx.fillRect(sx + 6 * s, sy + 5 * s + bob, s * 4, s * 5);
  // obi
  ctx.fillStyle = "#8b3a3a";
  ctx.fillRect(sx + 4 * s, sy + 9 * s + bob, s * 8, s * 2);

  // arms
  ctx.fillStyle = "#3a4a6a";
  if (dir === "left") {
    ctx.fillRect(sx + 2 * s, sy + 6 * s + bob + (f % 2 === 0 ? 0 : s), s * 2, s * 4);
    ctx.fillRect(sx + 12 * s, sy + 6 * s + bob + (f % 2 === 0 ? s : 0), s * 2, s * 4);
  } else if (dir === "right") {
    ctx.fillRect(sx + 2 * s, sy + 6 * s + bob + (f % 2 === 0 ? s : 0), s * 2, s * 4);
    ctx.fillRect(sx + 12 * s, sy + 6 * s + bob + (f % 2 === 0 ? 0 : s), s * 2, s * 4);
  } else {
    ctx.fillRect(sx + 2 * s, sy + 6 * s + bob, s * 2, s * 4);
    ctx.fillRect(sx + 12 * s, sy + 6 * s + bob, s * 2, s * 4);
  }

  // head
  ctx.fillStyle = "#f0d0a0";
  ctx.fillRect(sx + 5 * s, sy + 0 * s + bob, s * 6, s * 6);

  // hair
  ctx.fillStyle = "#1a1a2a";
  if (dir === "up") {
    ctx.fillRect(sx + 4 * s, sy + bob, s * 8, s * 3);
    ctx.fillRect(sx + 5 * s, sy + 3 * s + bob, s * 6, s);
  } else {
    ctx.fillRect(sx + 4 * s, sy + bob, s * 8, s * 2);
    ctx.fillRect(sx + 4 * s, sy + bob, s * 2, s * 5);
    ctx.fillRect(sx + 10 * s, sy + bob, s * 2, s * 5);
  }

  // face
  if (dir !== "up") {
    ctx.fillStyle = "#1a1a2a";
    if (dir === "left") {
      ctx.fillRect(sx + 5 * s, sy + 3 * s + bob, s, s);
      ctx.fillRect(sx + 8 * s, sy + 3 * s + bob, s, s);
    } else if (dir === "right") {
      ctx.fillRect(sx + 7 * s, sy + 3 * s + bob, s, s);
      ctx.fillRect(sx + 10 * s, sy + 3 * s + bob, s, s);
    } else {
      ctx.fillRect(sx + 6 * s, sy + 3 * s + bob, s, s);
      ctx.fillRect(sx + 9 * s, sy + 3 * s + bob, s, s);
    }
  }

  // straw hat (kasa)
  ctx.fillStyle = "#d4b878";
  ctx.fillRect(sx + 2 * s, sy - 2 * s + bob, s * 12, s * 2);
  ctx.fillStyle = "#c4a868";
  ctx.fillRect(sx + 4 * s, sy - 3 * s + bob, s * 8, s);
  ctx.fillStyle = "#b49858";
  ctx.fillRect(sx + 6 * s, sy - 4 * s + bob, s * 4, s);
  ctx.fillStyle = "#8b3a3a";
  ctx.fillRect(sx + 2 * s, sy - s + bob, s * 12, s);

  // golden bamboo in hand
  if (hasGoldenBamboo) {
    const armSwing = f % 2 === 0 ? 0 : s;
    let bx: number, by: number;
    if (dir === "left") {
      bx = sx + 1 * s;
      by = sy + 2 * s + bob + armSwing;
    } else if (dir === "right") {
      bx = sx + 13 * s;
      by = sy + 2 * s + bob + (f % 2 === 0 ? s : 0);
    } else {
      bx = sx + 13 * s;
      by = sy + 2 * s + bob;
    }
    // bamboo stalk
    ctx.fillStyle = "#d4a017";
    ctx.fillRect(bx, by, s, s * 10);
    // highlight
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(bx, by, s, s * 2);
    ctx.fillRect(bx, by + s * 5, s, s);
    // nodes
    ctx.fillStyle = "#b8860b";
    ctx.fillRect(bx, by + s * 3, s, s);
    ctx.fillRect(bx, by + s * 7, s, s);
  }

  // fishing rod in hand
  if (fishingState !== "idle") {
    let handX: number, handY: number, tipX: number, tipY: number;
    if (dir === "right") {
      handX = sx + 13 * s; handY = sy + 7 * s + bob;
      tipX = handX + s * 10; tipY = handY - s * 10;
    } else if (dir === "left") {
      handX = sx + 3 * s; handY = sy + 7 * s + bob;
      tipX = handX - s * 10; tipY = handY - s * 10;
    } else if (dir === "up") {
      handX = sx + 13 * s; handY = sy + 7 * s + bob;
      tipX = handX + s * 4; tipY = handY - s * 12;
    } else {
      handX = sx + 13 * s; handY = sy + 7 * s + bob;
      tipX = handX + s * 4; tipY = handY - s * 12;
    }
    // rod shaft
    ctx.strokeStyle = "#5a8a4a";
    ctx.lineWidth = s * 1.2;
    ctx.beginPath();
    ctx.moveTo(handX + s / 2, handY);
    ctx.lineTo(tipX + s / 2, tipY);
    ctx.stroke();
    // rod tip
    ctx.fillStyle = "#3a6a2a";
    ctx.fillRect(tipX, tipY - s / 2, s, s);
  }
}

// ─── Fishing Helpers ─────────────────────────────────────────────────────────

function findNearestWater(
  px: number, py: number,
  getTile: (wx: number, wy: number) => TileType
): { wx: number; wy: number; dir: Direction } | null {
  const baseTx = Math.floor(px);
  const baseTy = Math.floor(py);
  let best: { wx: number; wy: number; dist: number; dir: Direction } | null = null;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = baseTx + dx;
      const ty = baseTy + dy;
      const dist = Math.abs(px - tx - 0.5) + Math.abs(py - ty - 0.5);
      if (dist < 2 && getTile(tx, ty) === TileType.Water) {
        if (!best || dist < best.dist) {
          let dir: Direction = "down";
          const ddx = tx + 0.5 - px;
          const ddy = ty + 0.5 - py;
          if (Math.abs(ddx) > Math.abs(ddy)) dir = ddx > 0 ? "right" : "left";
          else dir = ddy > 0 ? "down" : "up";
          best = { wx: tx, wy: ty, dist, dir };
        }
      }
    }
  }
  return best;
}

function findWaterTilesInRadius(
  px: number, py: number,
  radius: number,
  getTile: (wx: number, wy: number) => TileType
): { x: number; y: number }[] {
  const baseTx = Math.floor(px);
  const baseTy = Math.floor(py);
  const result: { x: number; y: number }[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const tx = baseTx + dx;
      const ty = baseTy + dy;
      if (getTile(tx, ty) === TileType.Water) {
        result.push({ x: tx, y: ty });
      }
    }
  }
  return result;
}

function drawPixelFish(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, color: string, time: number
) {
  const s = SCALE;
  const flop = Math.sin(time * 0.01) > 0 ? 0 : s;
  // body
  ctx.fillStyle = color;
  ctx.fillRect(cx - s * 3, cy - s, s * 6, s * 2);
  // head
  ctx.fillRect(cx + s * 3, cy - s, s, s * 2);
  // tail
  ctx.fillRect(cx - s * 4, cy - s * 2 + flop, s, s * 3);
  // eye
  ctx.fillStyle = "#111";
  ctx.fillRect(cx + s * 2, cy - s, s, s);
}

function drawKoi(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  color: string, accentColor: string,
  time: number, phase: number,
  size: number, facingLeft: boolean
) {
  const s = SCALE * size;
  const dir = facingLeft ? -1 : 1;
  const tailFlop = Math.sin(time * 0.012 + phase) * s;
  // body
  ctx.fillStyle = color;
  ctx.fillRect(cx - dir * s * 3, cy - s, s * 6, s * 2);
  // accent patches
  ctx.fillStyle = accentColor;
  ctx.fillRect(cx - dir * s, cy - s, s * 2, s * 2);
  // head
  ctx.fillStyle = color;
  ctx.fillRect(cx + dir * s * 3, cy - s, s, s * 2);
  // tail
  ctx.fillRect(cx - dir * s * 4, cy - s * 1.5 + tailFlop, s, s * 3);
  // eye
  ctx.fillStyle = "#111";
  ctx.fillRect(cx + dir * s * 2.5, cy - s * 0.5, s * 0.6, s * 0.6);
}

function drawKoiRipple(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  time: number, phase: number
) {
  const rippleR = SCALE * 4 + Math.sin(time * 0.005 + phase) * SCALE;
  const alpha = 0.12 + Math.sin(time * 0.004 + phase * 2) * 0.06;
  ctx.strokeStyle = `rgba(150, 200, 255, ${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rippleR, rippleR * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCritter(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  _time: number, frame: number,
  kind: CritterKind,
  facingLeft: boolean,
  hash = 0
) {
  const s = SCALE;
  ctx.save();
  if (facingLeft) {
    // mirror around the sprite's vertical center line
    ctx.translate(2 * sx + 16 * s, 0);
    ctx.scale(-1, 1);
  }
  const legOff = frame === 0 ? 0 : s;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(sx + 3 * s, sy + 14 * s, 11 * s, 2 * s);

  if (kind === "villager") {
    const kimono = VILLAGER_KIMONOS[Math.abs(hash) % VILLAGER_KIMONOS.length];
    // sandals + legs
    ctx.fillStyle = "#8b6f4e";
    ctx.fillRect(sx + 5 * s + legOff, sy + 14 * s, 3 * s, 2 * s);
    ctx.fillRect(sx + 9 * s - legOff, sy + 14 * s, 3 * s, 2 * s);
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(sx + 6 * s, sy + 11 * s, 5 * s, 4 * s);
    // kimono
    ctx.fillStyle = kimono;
    ctx.fillRect(sx + 5 * s, sy + 5 * s, 7 * s, 7 * s);
    // obi
    ctx.fillStyle = "#d4c4a0";
    ctx.fillRect(sx + 5 * s, sy + 9 * s, 7 * s, s);
    // arms
    ctx.fillStyle = kimono;
    ctx.fillRect(sx + 3 * s, sy + 6 * s + (frame === 0 ? 0 : s), 2 * s, 4 * s);
    ctx.fillRect(sx + 12 * s, sy + 6 * s + (frame === 0 ? s : 0), 2 * s, 4 * s);
    // head
    ctx.fillStyle = "#f0d0a0";
    ctx.fillRect(sx + 5 * s, sy + 0 * s, 6 * s, 5 * s);
    // hair (bun or bowl by hash)
    ctx.fillStyle = "#1a1a2a";
    ctx.fillRect(sx + 5 * s, sy, 6 * s, 2 * s);
    if ((hash & 1) === 0) ctx.fillRect(sx + 7 * s, sy - s, 2 * s, s); // topknot
    else { ctx.fillRect(sx + 4 * s, sy, s, 4 * s); ctx.fillRect(sx + 11 * s, sy, s, 4 * s); }
    // eye (side view)
    ctx.fillRect(sx + 9 * s, sy + 2 * s, s, s);
  } else if (kind === "cat") {
    // small gray city cat — tail up, alert ears
    // tail
    ctx.fillStyle = "#6a6a72";
    ctx.fillRect(sx + 2 * s, sy + 6 * s, s, 5 * s);
    ctx.fillRect(sx + 3 * s, sy + 5 * s, s, 2 * s);
    // legs
    ctx.fillStyle = "#55555d";
    ctx.fillRect(sx + 5 * s + legOff, sy + 12 * s, 2 * s, 3 * s);
    ctx.fillRect(sx + 10 * s - legOff, sy + 12 * s, 2 * s, 3 * s);
    // body
    ctx.fillStyle = "#8a8a92";
    ctx.fillRect(sx + 4 * s, sy + 8 * s, 8 * s, 5 * s);
    // stripes
    ctx.fillStyle = "#6a6a72";
    ctx.fillRect(sx + 6 * s, sy + 8 * s, s, 5 * s);
    ctx.fillRect(sx + 9 * s, sy + 8 * s, s, 5 * s);
    // head
    ctx.fillStyle = "#93939b";
    ctx.fillRect(sx + 10 * s, sy + 5 * s, 5 * s, 4 * s);
    // ears
    ctx.fillStyle = "#6a6a72";
    ctx.fillRect(sx + 10 * s, sy + 4 * s, s, s);
    ctx.fillRect(sx + 14 * s, sy + 4 * s, s, s);
    // eye (green) + nose
    ctx.fillStyle = "#7dd87d";
    ctx.fillRect(sx + 12 * s, sy + 6 * s, s, s);
    ctx.fillStyle = "#3a3a40";
    ctx.fillRect(sx + 15 * s, sy + 7 * s, s, s);
  } else if (kind === "panda") {
    // legs
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(sx + 3 * s + legOff, sy + 11 * s, 2 * s, 4 * s);
    ctx.fillRect(sx + 9 * s - legOff, sy + 11 * s, 2 * s, 4 * s);
    // body
    ctx.fillStyle = "#ece8e0";
    ctx.fillRect(sx + 2 * s, sy + 6 * s, 10 * s, 6 * s);
    // shoulder band
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(sx + 8 * s, sy + 6 * s, 3 * s, 6 * s);
    // head
    ctx.fillStyle = "#f2eee6";
    ctx.fillRect(sx + 9 * s, sy + 2 * s, 6 * s, 6 * s);
    // ears
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(sx + 9 * s, sy + 1 * s, 2 * s, 2 * s);
    ctx.fillRect(sx + 13 * s, sy + 1 * s, 2 * s, 2 * s);
    // eye patch + nose
    ctx.fillRect(sx + 12 * s, sy + 4 * s, s, 2 * s);
    ctx.fillRect(sx + 14 * s, sy + 5 * s, s, s);
  } else {
    // ringed tail (behind)
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#b85c25" : "#e8d8b0";
      ctx.fillRect(sx + i * s, sy + 5 * s - (i % 2) * s, s, 4 * s);
    }
    // legs
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(sx + 5 * s + legOff, sy + 11 * s, 2 * s, 4 * s);
    ctx.fillRect(sx + 10 * s - legOff, sy + 11 * s, 2 * s, 4 * s);
    // body
    ctx.fillStyle = "#c96a2a";
    ctx.fillRect(sx + 4 * s, sy + 6 * s, 8 * s, 6 * s);
    // dark belly
    ctx.fillStyle = "#4a2c18";
    ctx.fillRect(sx + 4 * s, sy + 10 * s, 8 * s, 2 * s);
    // head
    ctx.fillStyle = "#d47a35";
    ctx.fillRect(sx + 10 * s, sy + 3 * s, 6 * s, 5 * s);
    // white-tipped ears + muzzle
    ctx.fillStyle = "#e8e0d0";
    ctx.fillRect(sx + 10 * s, sy + 2 * s, 2 * s, 2 * s);
    ctx.fillRect(sx + 14 * s, sy + 2 * s, 2 * s, 2 * s);
    ctx.fillRect(sx + 13 * s, sy + 5 * s, 3 * s, 2 * s);
    // eye + nose
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(sx + 12 * s, sy + 4 * s, s, s);
    ctx.fillRect(sx + 15 * s, sy + 5 * s, s, s);
  }
  ctx.restore();
}

function drawFishingOverlay(
  ctx: CanvasRenderingContext2D,
  charSX: number, charSY: number,
  waterScreenX: number, waterScreenY: number,
  fishingState: FishingState, time: number,
  fishColor: string, catchStartTime: number,
  dir: Direction
) {
  const s = SCALE;
  const halfTile = SCALED_TILE / 2;

  if (fishingState === "idle") return;

  // Rod tip must match drawCharacter's fishing rod tip position
  // drawCharacter receives sx = charSX, so we use the same offsets
  const bob = 0; // character is stationary while fishing (frame=0)
  let rodTipX: number, rodTipY: number;
  if (dir === "right") {
    const handX = charSX + 13 * s;
    const handY = charSY + 7 * s + bob;
    rodTipX = handX + s * 10 + s / 2;
    rodTipY = handY - s * 10;
  } else if (dir === "left") {
    const handX = charSX + 3 * s;
    const handY = charSY + 7 * s + bob;
    rodTipX = handX - s * 10 + s / 2;
    rodTipY = handY - s * 10;
  } else {
    const handX = charSX + 13 * s;
    const handY = charSY + 7 * s + bob;
    rodTipX = handX + s * 4 + s / 2;
    rodTipY = handY - s * 12;
  }
  const bobberX = waterScreenX + halfTile;
  const bobberY = waterScreenY + halfTile;

  // Line with sag
  ctx.strokeStyle = "rgba(200,200,200,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rodTipX, rodTipY);
  const cpX = (rodTipX + bobberX) / 2;
  const cpY = Math.max(rodTipY, bobberY) + 15;
  ctx.quadraticCurveTo(cpX, cpY, bobberX, bobberY);
  ctx.stroke();

  // Bobber
  const bobberBob = fishingState === "bite"
    ? Math.sin(time * 0.02) * s * 2
    : Math.sin(time * 0.003) * s * 0.5;
  const by = bobberY + bobberBob;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bobberX - s, by - s * 2, s * 2, s * 2);
  ctx.fillStyle = "#cc3333";
  ctx.fillRect(bobberX - s, by - s * 4, s * 2, s * 2);

  // Splash rings during bite
  if (fishingState === "bite") {
    const ringAlpha = 0.3 + Math.sin(time * 0.015) * 0.2;
    ctx.strokeStyle = `rgba(150,200,255,${ringAlpha})`;
    ctx.lineWidth = 1.5;
    const ringR = s * 3 + Math.sin(time * 0.01) * s * 2;
    ctx.beginPath();
    ctx.ellipse(bobberX, by, ringR, ringR * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    const ringR2 = s * 5 + Math.sin(time * 0.008) * s * 2;
    ctx.beginPath();
    ctx.ellipse(bobberX, by, ringR2, ringR2 * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Fish sprite during caught state — rises and fades out
  if (fishingState === "caught") {
    const elapsed = performance.now() - catchStartTime;
    const duration = 3000;
    const t = Math.min(elapsed / duration, 1);
    const rise = t * s * 30;
    const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    const fishY = bobberY - s * 6 - rise;
    ctx.globalAlpha = Math.max(0, alpha);
    drawPixelFish(ctx, bobberX, fishY, fishColor, time);
    ctx.globalAlpha = 1;
  }
}

// ─── Title Screen Drawing ───────────────────────────────────────────────────

// Lowercase pixel letters for "zozi"
const LETTER_z = [
  "      ",
  "      ",
  "XXXXXX",
  "   XX ",
  "  XX  ",
  " XX   ",
  "XXXXXX",
];
const LETTER_o = [
  "      ",
  "      ",
  " XXXX ",
  "XX  XX",
  "XX  XX",
  "XX  XX",
  " XXXX ",
];
const LETTER_i = [
  "  XX  ",
  "      ",
  "  XX  ",
  "  XX  ",
  "  XX  ",
  "  XX  ",
  "  XX  ",
];

function drawTitleCharacter(ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number) {
  // Draw the Zozi character sprite as the logo, scaled up
  const s = 4; // pixel scale for title character
  const sx = cx - 8 * s;
  const sy = cy - 10 * s;

  // gentle idle bob
  const bob = Math.sin(time * 0.002) * 2;
  const by = Math.floor(bob);

  // sandals
  ctx.fillStyle = "#8b6f4e";
  ctx.fillRect(sx + 4 * s, sy + 14 * s, s * 3, s * 2);
  ctx.fillRect(sx + 9 * s, sy + 14 * s, s * 3, s * 2);

  // legs
  ctx.fillStyle = "#1a1a3a";
  ctx.fillRect(sx + 5 * s, sy + 11 * s + by, s * 6, s * 4);

  // kimono
  ctx.fillStyle = "#3a4a6a";
  ctx.fillRect(sx + 4 * s, sy + 5 * s + by, s * 8, s * 7);
  ctx.fillStyle = "#4a5a7a";
  ctx.fillRect(sx + 6 * s, sy + 5 * s + by, s * 4, s * 5);
  // obi
  ctx.fillStyle = "#8b3a3a";
  ctx.fillRect(sx + 4 * s, sy + 9 * s + by, s * 8, s * 2);

  // arms
  ctx.fillStyle = "#3a4a6a";
  ctx.fillRect(sx + 2 * s, sy + 6 * s + by, s * 2, s * 4);
  ctx.fillRect(sx + 12 * s, sy + 6 * s + by, s * 2, s * 4);

  // head
  ctx.fillStyle = "#f0d0a0";
  ctx.fillRect(sx + 5 * s, sy + 0 * s + by, s * 6, s * 6);

  // hair
  ctx.fillStyle = "#1a1a2a";
  ctx.fillRect(sx + 4 * s, sy + by, s * 8, s * 2);
  ctx.fillRect(sx + 4 * s, sy + by, s * 2, s * 5);
  ctx.fillRect(sx + 10 * s, sy + by, s * 2, s * 5);

  // eyes
  ctx.fillStyle = "#1a1a2a";
  ctx.fillRect(sx + 6 * s, sy + 3 * s + by, s, s);
  ctx.fillRect(sx + 9 * s, sy + 3 * s + by, s, s);

  // straw hat
  ctx.fillStyle = "#d4b878";
  ctx.fillRect(sx + 2 * s, sy - 2 * s + by, s * 12, s * 2);
  ctx.fillStyle = "#c4a868";
  ctx.fillRect(sx + 4 * s, sy - 3 * s + by, s * 8, s);
  ctx.fillStyle = "#b49858";
  ctx.fillRect(sx + 6 * s, sy - 4 * s + by, s * 4, s);
  ctx.fillStyle = "#8b3a3a";
  ctx.fillRect(sx + 2 * s, sy - s + by, s * 12, s);
}

function drawTitleText(ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number) {
  const letters = [LETTER_z, LETTER_o, LETTER_z, LETTER_i];
  const pixSize = 4;
  const letterW = 6 * pixSize;
  const gap = pixSize * 2;
  const totalW = letters.length * letterW + (letters.length - 1) * gap;
  let startX = cx - totalW / 2;
  const startY = cy;

  for (let li = 0; li < letters.length; li++) {
    const letter = letters[li];
    for (let row = 0; row < letter.length; row++) {
      for (let col = 0; col < letter[row].length; col++) {
        if (letter[row][col] === "X") {
          const px = startX + col * pixSize;
          const py = startY + row * pixSize;
          const shimmer = Math.sin(time * 0.002 + li * 1.5 + row * 0.3 + col * 0.5) * 0.08;
          const base = 0.82 + shimmer;
          const r = Math.floor(212 * base);
          const g = Math.floor(184 * base);
          const b = Math.floor(120 * base);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(px, py, pixSize, pixSize);
          ctx.fillStyle = `rgba(180, 152, 88, ${0.3 + shimmer})`;
          ctx.fillRect(px + pixSize - 1, py, 1, pixSize);
          ctx.fillRect(px, py + pixSize - 1, pixSize, 1);
        }
      }
    }
    startX += letterW + gap;
  }
}

// ─── Interior Drawing ───────────────────────────────────────────────────────

function drawInterior(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  px: number, py: number, dir: Direction, frame: number, time: number
) {
  const tileSize = SCALED_TILE;
  const offX = (w - ROOM_W * tileSize) / 2;
  const offY = (h - ROOM_H * tileSize) / 2;
  const s = SCALE;

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, w, h);

  for (let ry = 0; ry < ROOM_H; ry++) {
    for (let rx = 0; rx < ROOM_W; rx++) {
      const sx = offX + rx * tileSize;
      const sy = offY + ry * tileSize;
      const cell = ROOM_LAYOUT[ry][rx];

      if (cell === 0 || cell === 4 || cell === 5 || cell === 3 || cell === 2) {
        // tatami base
        ctx.fillStyle = "#c4a060";
        ctx.fillRect(sx, sy, tileSize, tileSize);
        ctx.fillStyle = "#b89850";
        for (let ty = 0; ty < 16; ty += 2) ctx.fillRect(sx, sy + ty * s, tileSize, s);
        ctx.fillStyle = "#a08840";
        ctx.fillRect(sx, sy, s, tileSize);
        ctx.fillRect(sx, sy, tileSize, s);
      }

      if (cell === 1) { // wall
        ctx.fillStyle = "#8b7355";
        ctx.fillRect(sx, sy, tileSize, tileSize);
        ctx.fillStyle = "#f5e6c8";
        ctx.fillRect(sx + 2 * s, sy + 2 * s, tileSize - 4 * s, tileSize - 4 * s);
        ctx.fillStyle = "#7a6345";
        ctx.fillRect(sx + s, sy + s, tileSize - 2 * s, s);
        ctx.fillRect(sx + s, sy + s, s, tileSize - 2 * s);
      } else if (cell === 2) { // exit door
        ctx.fillStyle = "#5a3a2a";
        ctx.fillRect(sx + 2 * s, sy + 2 * s, tileSize - 4 * s, tileSize - 4 * s);
        ctx.fillStyle = "#d4a017";
        ctx.fillRect(sx + 6 * s, sy + 6 * s, s * 3, s * 3);
      } else if (cell === 3) { // table
        ctx.fillStyle = "#6b4e38";
        ctx.fillRect(sx + s, sy + 2 * s, 14 * s, 12 * s);
        ctx.fillStyle = "#8b6f4e";
        ctx.fillRect(sx + 2 * s, sy + 3 * s, 12 * s, 10 * s);
      } else if (cell === 4) { // cushion
        ctx.fillStyle = "#8b3a3a";
        ctx.fillRect(sx + 3 * s, sy + 3 * s, 10 * s, 10 * s);
        ctx.fillStyle = "#a04848";
        ctx.fillRect(sx + 4 * s, sy + 4 * s, 8 * s, 8 * s);
      } else if (cell === 5) { // futon
        ctx.fillStyle = "#e8e0d0";
        ctx.fillRect(sx + s, sy + s, 14 * s, 14 * s);
        ctx.fillStyle = "#d4c4b0";
        ctx.fillRect(sx + 2 * s, sy + 2 * s, 12 * s, 4 * s);
        ctx.fillStyle = "#3a4a6a";
        ctx.fillRect(sx + 2 * s, sy + 7 * s, 12 * s, 8 * s);
      } else if (cell === 6) { // tokonoma
        ctx.fillStyle = "#6b5238";
        ctx.fillRect(sx, sy, tileSize, tileSize);
        ctx.fillStyle = "#f5e6c8";
        ctx.fillRect(sx + 4 * s, sy + s, 8 * s, 12 * s);
        ctx.fillStyle = "#1a1a2a";
        ctx.fillRect(sx + 6 * s, sy + 3 * s, 4 * s, s);
        ctx.fillRect(sx + 7 * s, sy + 5 * s, 2 * s, s);
        ctx.fillRect(sx + 5 * s, sy + 7 * s, 6 * s, s);
      } else if (cell === 7) { // shoji screen
        ctx.fillStyle = "#c4a868";
        ctx.fillRect(sx, sy, tileSize, tileSize);
        ctx.fillStyle = "#f5edd8";
        ctx.fillRect(sx + s, sy + s, 14 * s, 14 * s);
        ctx.fillStyle = "#c4a868";
        ctx.fillRect(sx + 7 * s, sy, s * 2, tileSize);
        ctx.fillRect(sx, sy + 7 * s, tileSize, s * 2);
        const sg = 0.08 + Math.sin(time * 0.001) * 0.04;
        ctx.fillStyle = `rgba(100,180,100,${sg})`;
        ctx.fillRect(sx + s, sy + s, 14 * s, 14 * s);
      }
    }
  }

  // Tea set on table
  const tsx = offX + 3 * tileSize + 4 * s, tsy = offY + 3 * tileSize + 5 * s;
  ctx.fillStyle = "#e8e0d0";
  ctx.fillRect(tsx, tsy, s * 4, s * 3);
  ctx.fillStyle = "#c4b4a0";
  ctx.fillRect(tsx + s, tsy + s, s * 2, s);
  ctx.fillStyle = "#e8e0d0";
  ctx.fillRect(tsx + 6 * s, tsy, s * 2, s * 2);
  ctx.fillRect(tsx + 9 * s, tsy + s, s * 2, s * 2);

  // Character
  const csx = offX + px * tileSize - 8 * s;
  const csy = offY + py * tileSize - 8 * s;
  drawCharacter(ctx, csx, csy, dir, frame, time);

  // Warm interior vignette
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.5);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Warm ambient glow
  ctx.fillStyle = "rgba(255,200,100,0.03)";
  ctx.fillRect(0, 0, w, h);
}

// ─── Falling Petals ─────────────────────────────────────────────────────────

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

// ─── Koi Gathering ──────────────────────────────────────────────────────────

interface Koi {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  color: string;
  accentColor: string;
  phase: number;
  size: number;
  scattering: boolean;
  scatterLife: number;
}

const KOI_COLORS = [
  { body: "#cc5533", accent: "#f0e0d0" },
  { body: "#e07030", accent: "#fff8f0" },
  { body: "#d4a017", accent: "#fff0d0" },
  { body: "#cc3322", accent: "#f8f0e8" },
  { body: "#e88040", accent: "#ffffff" },
];

const KOI_MAX_COUNT = 3;
const KOI_SPAWN_RADIUS = 7;
const KOI_IDLE_DELAY = 5000;
const KOI_SPAWN_INTERVAL = 1500;
const KOI_SWIM_SPEED = 0.008;
const KOI_SCATTER_SPEED = 0.04;
const KOI_SCATTER_LIFE = 120;

// ─── Audio Engine ───────────────────────────────────────────────────────────

type Surface = "grass" | "stone";

class ZenAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private isPlaying = false;
  private noteTimeout: ReturnType<typeof setTimeout> | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private mode: "village" | "city" = "village";
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private muted = false;

  setMode(mode: "village" | "city") {
    this.mode = mode;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.3, this.ctx.currentTime + 0.3);
    }
  }

  isMuted() {
    return this.muted;
  }

  setRain(on: boolean) {
    if (!this.ctx || !this.masterGain) return;
    if (on && !this.rainSource) {
      const rate = this.ctx.sampleRate;
      const len = rate * 2;
      const buf = this.ctx.createBuffer(1, len, rate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.045, this.ctx.currentTime + 2);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      src.start();
      this.rainSource = src;
      this.rainGain = g;
    } else if (!on && this.rainSource) {
      const src = this.rainSource, g = this.rainGain!;
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.5);
      setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } }, 1700);
      this.rainSource = null;
      this.rainGain = null;
    }
  }


  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.15;
    this.musicGain.connect(this.masterGain);
  }

  async start() {
    await this.init();
    if (this.isPlaying || !this.ctx || !this.musicGain) return;
    this.isPlaying = true;

    // Drone
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.08;
    droneGain.connect(this.musicGain);

    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = "sine";
    this.droneOsc.frequency.value = 110;
    this.droneOsc.connect(droneGain);
    this.droneOsc.start();

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = "sine";
    this.droneOsc2.frequency.value = 164.81;
    this.droneOsc2.connect(droneGain);
    this.droneOsc2.start();

    this.playNextNote();
  }

  private playNextNote() {
    if (!this.isPlaying || !this.ctx || !this.musicGain) return;

    // village: A-major pentatonic-ish calm; city: B♭ minor, tighter and moodier
    const notes = this.mode === "village"
      ? [220, 246.94, 293.66, 329.63, 392, 440, 493.88, 587.33]
      : [233.08, 277.18, 311.13, 369.99, 415.3, 466.16, 554.37];
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const duration = this.mode === "village" ? 1.5 + Math.random() * 3 : 1 + Math.random() * 2;

    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0, this.ctx.currentTime);
    noteGain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.3);
    noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(noteGain);
    noteGain.connect(this.musicGain!);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);

    if (Math.random() > 0.6) {
      const osc2 = this.ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.value = freq * 1.5;
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0, this.ctx.currentTime);
      g2.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.5);
      g2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration * 0.8);
      osc2.connect(g2);
      g2.connect(this.musicGain!);
      osc2.start(this.ctx.currentTime + 0.1);
      osc2.stop(this.ctx.currentTime + duration);
    }

    const nextDelay = this.mode === "village"
      ? (1 + Math.random() * 4) * 1000
      : (0.7 + Math.random() * 2.5) * 1000;
    this.noteTimeout = setTimeout(() => this.playNextNote(), nextDelay);
  }

  playFootstep(surface: Surface) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Both surfaces use gentle lowpass noise — stone is just slightly brighter
    const isStone = surface === "stone";
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    // stone: slightly higher cutoff for a subtle difference, grass: softer
    filter.frequency.value = isStone
      ? 650 + Math.random() * 150
      : 450 + Math.random() * 100;

    const stepGain = this.ctx.createGain();
    stepGain.gain.setValueAtTime(0.06 + Math.random() * 0.02, now);
    stepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    source.connect(filter);
    filter.connect(stepGain);
    stepGain.connect(this.masterGain);
    source.start(now);
  }

  playFishingSplash() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const rate = this.ctx.sampleRate;

    // Layer 1: initial plop — short, low-frequency thump
    const plopLen = Math.floor(rate * 0.06);
    const plopBuf = this.ctx.createBuffer(1, plopLen, rate);
    const plopData = plopBuf.getChannelData(0);
    for (let i = 0; i < plopLen; i++) {
      const t = i / rate;
      plopData[i] = Math.sin(t * 180 * Math.PI * 2) * Math.exp(-t * 60) * 0.6;
    }
    const plopSrc = this.ctx.createBufferSource();
    plopSrc.buffer = plopBuf;
    const plopFilter = this.ctx.createBiquadFilter();
    plopFilter.type = "lowpass";
    plopFilter.frequency.value = 300;
    const plopGain = this.ctx.createGain();
    plopGain.gain.setValueAtTime(0.1, now);
    plopGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    plopSrc.connect(plopFilter);
    plopFilter.connect(plopGain);
    plopGain.connect(this.masterGain);
    plopSrc.start(now);

    // Layer 2: water spray — longer filtered noise with soft attack
    const sprayLen = Math.floor(rate * 0.4);
    const sprayBuf = this.ctx.createBuffer(1, sprayLen, rate);
    const sprayData = sprayBuf.getChannelData(0);
    for (let i = 0; i < sprayLen; i++) {
      const t = i / sprayLen;
      const attack = Math.min(1, t * 20);
      const decay = Math.exp(-t * 6);
      sprayData[i] = (Math.random() * 2 - 1) * attack * decay;
    }
    const spraySrc = this.ctx.createBufferSource();
    spraySrc.buffer = sprayBuf;
    const sprayLow = this.ctx.createBiquadFilter();
    sprayLow.type = "lowpass";
    sprayLow.frequency.setValueAtTime(1200, now);
    sprayLow.frequency.exponentialRampToValueAtTime(400, now + 0.35);
    const sprayHigh = this.ctx.createBiquadFilter();
    sprayHigh.type = "highpass";
    sprayHigh.frequency.value = 150;
    const sprayGain = this.ctx.createGain();
    sprayGain.gain.setValueAtTime(0.06, now);
    sprayGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    spraySrc.connect(sprayLow);
    sprayLow.connect(sprayHigh);
    sprayHigh.connect(sprayGain);
    sprayGain.connect(this.masterGain);
    spraySrc.start(now + 0.01);

    // Layer 3: gentle ripple tail — very soft, slow noise fade
    const ripLen = Math.floor(rate * 0.5);
    const ripBuf = this.ctx.createBuffer(1, ripLen, rate);
    const ripData = ripBuf.getChannelData(0);
    for (let i = 0; i < ripLen; i++) {
      const t = i / ripLen;
      ripData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 4) * 0.3;
    }
    const ripSrc = this.ctx.createBufferSource();
    ripSrc.buffer = ripBuf;
    const ripFilter = this.ctx.createBiquadFilter();
    ripFilter.type = "lowpass";
    ripFilter.frequency.value = 500;
    ripFilter.Q.value = 0.5;
    const ripGain = this.ctx.createGain();
    ripGain.gain.setValueAtTime(0.04, now + 0.05);
    ripGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    ripSrc.connect(ripFilter);
    ripFilter.connect(ripGain);
    ripGain.connect(this.masterGain);
    ripSrc.start(now + 0.05);
  }

  playJump() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playChime() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [659.25, 880, 1318.5];
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = this.ctx!.createGain();
      const t = now + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  stop() {
    this.isPlaying = false;
    if (this.noteTimeout) clearTimeout(this.noteTimeout);
    if (this.droneOsc) { this.droneOsc.stop(); this.droneOsc = null; }
    if (this.droneOsc2) { this.droneOsc2.stop(); this.droneOsc2 = null; }
  }
}

// ─── 3D First-Person Rendering (raycaster) ──────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function wallColorFor(t: TileType, wx: number, wy: number): [number, number, number] {
  switch (t) {
    case TileType.HouseWall: return hexToRgb(getHousePalette(wx, wy).wallBase);
    case TileType.HouseDoor: return hexToRgb("#5a3a2a");
    case TileType.HouseRoof: return hexToRgb(getHousePalette(wx, wy).roofMid);
    case TileType.TreeTrunk: return hexToRgb("#6b4e38");
    case TileType.TreeCanopy: return hexToRgb("#8b4060");
    case TileType.Bamboo: return hexToRgb("#5a8a4a");
    case TileType.GoldenBamboo: return hexToRgb("#ffd700");
    case TileType.Bush: return hexToRgb("#3a5a2a");
    case TileType.Water: return hexToRgb("#3d6b8e");
    case TileType.StoneWall: return hexToRgb("#8a8a7a");
    case TileType.Fence: return hexToRgb("#9a7a5a");
    case TileType.Lantern: return hexToRgb("#cc3333");
    case TileType.Torii: return hexToRgb("#cc2222");
    case TileType.BuildingWall: return hexToRgb(getCityPalette(wx, wy).wall);
    case TileType.BuildingRoof: return hexToRgb("#3c3e46");
    case TileType.BuildingDoor: return hexToRgb("#4a4a52");
    case TileType.StreetLight: return hexToRgb("#26262c");
    default: return [120, 120, 120];
  }
}

const FOV_3D = Math.PI / 3;
const MAX_RAY_DIST = 24;

function render3D(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  px: number, py: number, angle: number,
  tod: ReturnType<typeof getTimeOfDay>,
  isSolid: (x: number, y: number) => boolean,
  getTileAt: (x: number, y: number) => TileType,
  critters: Critter[],
  cityUnder: boolean,
  time: number
) {
  const [bgR, bgG, bgB] = tod.bgRgb;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h / 2);
  sky.addColorStop(0, tod.bg);
  sky.addColorStop(1, `rgb(${Math.min(255, bgR + 40)},${Math.min(255, bgG + 40)},${Math.min(255, bgB + 50)})`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h / 2);

  // floor
  const floorCol: [number, number, number] = cityUnder ? [58, 58, 64] : [47, 74, 44];
  const floor = ctx.createLinearGradient(0, h / 2, 0, h);
  floor.addColorStop(0, `rgb(${Math.round((floorCol[0] + bgR) / 2)},${Math.round((floorCol[1] + bgG) / 2)},${Math.round((floorCol[2] + bgB) / 2)})`);
  floor.addColorStop(1, `rgb(${floorCol[0]},${floorCol[1]},${floorCol[2]})`);
  ctx.fillStyle = floor;
  ctx.fillRect(0, h / 2, w, h / 2);

  // walls via DDA raycasting
  const numRays = Math.min(480, w);
  const colW = w / numRays;
  const zbuf = new Float32Array(numRays).fill(Infinity);

  for (let i = 0; i < numRays; i++) {
    const rayAngle = angle - FOV_3D / 2 + (i / numRays) * FOV_3D;
    const dirX = Math.cos(rayAngle);
    const dirY = Math.sin(rayAngle);

    let mapX = Math.floor(px);
    let mapY = Math.floor(py);
    const deltaX = Math.abs(1 / (dirX || 1e-9));
    const deltaY = Math.abs(1 / (dirY || 1e-9));
    const stepX = dirX < 0 ? -1 : 1;
    const stepY = dirY < 0 ? -1 : 1;
    let sideX = dirX < 0 ? (px - mapX) * deltaX : (mapX + 1 - px) * deltaX;
    let sideY = dirY < 0 ? (py - mapY) * deltaY : (mapY + 1 - py) * deltaY;

    let side = 0;
    let dist = Infinity;
    for (let step = 0; step < MAX_RAY_DIST * 2; step++) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      if (isSolid(mapX, mapY)) {
        dist = side === 0 ? sideX - deltaX : sideY - deltaY;
        break;
      }
      if (Math.max(sideX, sideY) > MAX_RAY_DIST) break;
    }
    if (!isFinite(dist)) continue;

    const perpDist = Math.max(0.05, dist * Math.cos(rayAngle - angle));
    zbuf[i] = perpDist;
    const wallH = (h * 0.95) / perpDist;
    const tile = getTileAt(mapX, mapY);
    let [r, g, b] = wallColorFor(tile, mapX, mapY);
    // subtle per-tile brightness variation
    const vary = 0.9 + ((Math.abs(hashCoord(mapX, mapY)) & 3) / 3) * 0.18;
    let shade = (side === 1 ? 0.72 : 1) * vary;
    // lanterns glow
    if (tile === TileType.Lantern || tile === TileType.GoldenBamboo) {
      shade *= 1.15 + Math.sin(time * 0.004) * 0.15;
    }
    const fog = Math.min(1, perpDist / 18);
    r = Math.round((r * shade) * (1 - fog) + bgR * fog);
    g = Math.round((g * shade) * (1 - fog) + bgG * fog);
    b = Math.round((b * shade) * (1 - fog) + bgB * fog);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(Math.floor(i * colW), (h - wallH) / 2, Math.ceil(colW), wallH);
  }

  // critters as billboards, far to near
  const visible = critters
    .map((c) => ({ c, dx: c.x - px, dy: c.y - py }))
    .map((e) => ({ ...e, dist: Math.hypot(e.dx, e.dy) }))
    .filter((e) => e.dist > 0.4 && e.dist < 20)
    .sort((a, b) => b.dist - a.dist);

  for (const e of visible) {
    let rel = Math.atan2(e.dy, e.dx) - angle;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    if (Math.abs(rel) > FOV_3D / 2 + 0.35) continue;
    const corrDist = e.dist * Math.cos(rel);
    if (corrDist < 0.2) continue;
    const screenX = (0.5 + rel / FOV_3D) * w;
    const col = Math.max(0, Math.min(numRays - 1, Math.floor(screenX / colW)));
    if (zbuf[col] < corrDist) continue; // occluded by a wall

    const spriteH = (h * (e.c.kind === "villager" ? 0.55 : 0.34)) / corrDist;
    const spriteW = spriteH * 0.75;
    const bottom = h / 2 + (h * 0.95) / corrDist / 2;
    const fog = Math.min(0.85, corrDist / 18);

    const [bodyHex, darkHex] =
      e.c.kind === "panda" ? ["#ece8e0", "#1c1c1c"] :
      e.c.kind === "redpanda" ? ["#c96a2a", "#3a2418"] :
      e.c.kind === "cat" ? ["#8a8a92", "#3a3a40"] :
      [VILLAGER_KIMONOS[Math.abs(e.c.hash ?? 0) % VILLAGER_KIMONOS.length], "#1a1a2a"];
    const [br, bg2, bb] = hexToRgb(bodyHex);
    const [dr, dg, db] = hexToRgb(darkHex);
    const mix = (v: number, bgc: number) => Math.round(v * (1 - fog) + bgc * fog);

    // body
    ctx.fillStyle = `rgb(${mix(br, bgR)},${mix(bg2, bgG)},${mix(bb, bgB)})`;
    ctx.fillRect(screenX - spriteW / 2, bottom - spriteH * 0.62, spriteW, spriteH * 0.62);
    // head
    const headW = spriteW * 0.62;
    ctx.fillStyle = e.c.kind === "villager"
      ? `rgb(${mix(240, bgR)},${mix(208, bgG)},${mix(160, bgB)})`
      : `rgb(${mix(br, bgR)},${mix(bg2, bgG)},${mix(bb, bgB)})`;
    ctx.fillRect(screenX - headW / 2, bottom - spriteH, headW, spriteH * 0.42);
    // ears / hair
    ctx.fillStyle = `rgb(${mix(dr, bgR)},${mix(dg, bgG)},${mix(db, bgB)})`;
    if (e.c.kind === "villager") {
      ctx.fillRect(screenX - headW / 2, bottom - spriteH, headW, spriteH * 0.12);
    } else {
      ctx.fillRect(screenX - headW / 2, bottom - spriteH * 1.06, headW * 0.3, spriteH * 0.12);
      ctx.fillRect(screenX + headW / 2 - headW * 0.3, bottom - spriteH * 1.06, headW * 0.3, spriteH * 0.12);
    }
    // speech bubble
    if (e.c.say && e.c.sayUntil && time < e.c.sayUntil && corrDist < 8) {
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      const tw = ctx.measureText(e.c.say).width;
      ctx.fillStyle = "rgba(20,20,30,0.85)";
      ctx.fillRect(screenX - tw / 2 - 6, bottom - spriteH - 24, tw + 12, 18);
      ctx.fillStyle = "#e8e0d0";
      ctx.fillText(e.c.say, screenX, bottom - spriteH - 11);
    }
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdIndex, setCmdIndex] = useState(0);
  const [journalOpen, setJournalOpen] = useState(false);
  const audioRef = useRef<ZenAudio | null>(null);

  // Game state refs
  const playerRef = useRef({ x: 0.5, y: 0.5 });
  const dirRef = useRef<Direction>("down");
  const movingRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const chunksRef = useRef<Map<string, Chunk>>(new Map());
  const frameRef = useRef(0);
  const walkTimerRef = useRef(0);
  const petalsRef = useRef<Petal[]>([]);
  const lastStepRef = useRef(0);
  const overlayRef = useRef<Map<string, OverlayTile>>(buildInitialOverlay());
  const hasGoldenBambooRef = useRef(false);
  const zoziRevealedRef = useRef(false);
  const insideHouseRef = useRef(false);
  const savedPosRef = useRef({ x: 0, y: 0 });
  const pickupMsgRef = useRef(0);
  const pulsatingLanternsRef = useRef<Set<string>>(new Set());

  // Fishing state
  const fishingStateRef = useRef<FishingState>("idle");
  const fishingStartTimeRef = useRef(0);
  const fishingDirRef = useRef<Direction>("down");
  const fishingWaterTileRef = useRef({ x: 0, y: 0 });
  const fishingBiteTimeRef = useRef(0);
  const fishingCaughtFishRef = useRef<{ name: string; color: string; holdTime: number }>({ name: "", color: "", holdTime: 0 });
  const fishingHoldRef = useRef(0);

  // Koi gathering state
  const koiRef = useRef<Koi[]>([]);
  const koiIdleTimerRef = useRef(0);
  const koiLastSpawnRef = useRef(0);

  // Jump state
  const jumpRef = useRef({ active: false, start: 0, fromX: 0, fromY: 0, toX: 0, toY: 0 });

  // City state
  const walkMsRef = useRef(0);
  const cityModeRef = useRef(false);
  const lastFrameTimeRef = useRef(0);

  // Toasts / HUD
  const toastRef = useRef({ text: "", color: "#ffd700", time: 0 });
  const fishCountsRef = useRef<Record<string, number>>({});
  const hintStartRef = useRef(0);

  // World seed / save
  const seedRef = useRef(0);

  // 3D POV
  const view3dRef = useRef(false);
  const angle3dRef = useRef(0);

  // Weather & seasons
  const weatherModeRef = useRef<WeatherMode>("auto");
  const seasonModeRef = useRef<SeasonMode>("auto");
  const rainingRef = useRef(false);
  const weatherNextRef = useRef(0);
  const raindropsRef = useRef<Raindrop[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const waterTilesRef = useRef<{ x: number; y: number }[]>([]);
  const waterScanRef = useRef(0);
  const audioCityRef = useRef(false);

  // Critters (pandas, red panda, villagers, city cat)
  const crittersRef = useRef<Critter[]>([]);
  const critterBlocksRef = useRef<Set<string>>(new Set());
  const critterScanRef = useRef(0);
  const redPandaFoundRef = useRef(false);
  const catFoundRef = useRef(false);

  const getChunk = useCallback((cx: number, cy: number): Chunk => {
    const key = `${cx},${cy}`;
    let chunk = chunksRef.current.get(key);
    if (!chunk) {
      const isCity = cityModeRef.current &&
        !(Math.abs(cx) <= VILLAGE_CORE_CHUNKS && Math.abs(cy) <= VILLAGE_CORE_CHUNKS);
      chunk = generateChunk(cx, cy, isCity);
      chunksRef.current.set(key, chunk);
    }
    return chunk;
  }, []);

  const isSolid = useCallback(
    (worldX: number, worldY: number): boolean => {
      const tx = Math.floor(worldX);
      const ty = Math.floor(worldY);
      const ov = overlayRef.current.get(`${tx},${ty}`);
      if (ov !== undefined) return ov.solid;
      const cx = Math.floor(tx / CHUNK_SIZE);
      const cy = Math.floor(ty / CHUNK_SIZE);
      const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const chunk = getChunk(cx, cy);
      return chunk.solid[ly][lx];
    },
    [getChunk]
  );

  const getTileAt = useCallback(
    (worldX: number, worldY: number): TileType => {
      const tx = Math.floor(worldX);
      const ty = Math.floor(worldY);
      const ov = overlayRef.current.get(`${tx},${ty}`);
      if (ov !== undefined) return ov.type;
      const cx = Math.floor(tx / CHUNK_SIZE);
      const cy = Math.floor(ty / CHUNK_SIZE);
      const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const chunk = getChunk(cx, cy);
      return chunk.tiles[ly][lx];
    },
    [getChunk]
  );

  const totalFish = useCallback(() => {
    return Object.values(fishCountsRef.current).reduce((s, n) => s + n, 0);
  }, []);

  const saveGame = useCallback(() => {
    const rp = crittersRef.current.find((c) => c.kind === "redpanda");
    const cat = crittersRef.current.find((c) => c.kind === "cat");
    const data: SaveData = {
      v: 1,
      seed: seedRef.current,
      x: playerRef.current.x,
      y: playerRef.current.y,
      walkMs: walkMsRef.current,
      city: cityModeRef.current,
      bamboo: hasGoldenBambooRef.current,
      redPandaFound: redPandaFoundRef.current,
      redPandaFollowing: !!rp?.following,
      catFound: catFoundRef.current,
      catFollowing: !!cat?.following,
      fish: fishCountsRef.current,
      weatherMode: weatherModeRef.current,
      seasonMode: seasonModeRef.current,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage full/blocked */ }
  }, []);

  // Load the save (or mint a fresh world) once on mount
  useEffect(() => {
    const save = loadSave();
    const seed = typeof save?.seed === "number" ? save.seed : newWorldSeed();
    seedRef.current = seed;
    setWorldSeed(seed);

    if (save) {
      if (save.bamboo) {
        hasGoldenBambooRef.current = true;
        overlayRef.current.delete(`${GOLDEN_BAMBOO_POS.x},${GOLDEN_BAMBOO_POS.y}`);
        revealZoziPath(overlayRef.current);
        zoziRevealedRef.current = true;
      }
      if (save.city) cityModeRef.current = true;
      if (typeof save.walkMs === "number") walkMsRef.current = save.walkMs;
      if (save.fish) fishCountsRef.current = save.fish;
      redPandaFoundRef.current = !!save.redPandaFound;
      catFoundRef.current = !!save.catFound;
      if (save.weatherMode) weatherModeRef.current = save.weatherMode;
      if (save.seasonMode) seasonModeRef.current = save.seasonMode;
      if (typeof save.x === "number" && typeof save.y === "number") {
        playerRef.current.x = save.x;
        playerRef.current.y = save.y;
      }
    }

    // nudge a target onto the nearest walkable tile
    const findSpawn = (home: { x: number; y: number }) => {
      for (let r = 0; r < 8; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const tx = home.x + dx, ty = home.y + dy;
            if (!isSolid(tx, ty)) return { x: tx, y: ty };
          }
        }
      }
      return home;
    };

    // if the save left the player inside something solid, nudge them out too
    if (isSolid(playerRef.current.x, playerRef.current.y)) {
      const safe = findSpawn(playerRef.current);
      playerRef.current.x = safe.x;
      playerRef.current.y = safe.y;
    }

    const mkUnique = (kind: CritterKind, home: { x: number; y: number }, following: boolean): Critter => {
      const spot = following ? findSpawn({ x: playerRef.current.x + 1, y: playerRef.current.y + 1 }) : findSpawn(home);
      return {
        kind, x: spot.x, y: spot.y, homeX: spot.x, homeY: spot.y,
        vx: 0, vy: 0, moving: false, stateTimer: 800 + Math.random() * 800,
        walkAcc: 0, facingLeft: false, blockKey: "", following,
      };
    };
    crittersRef.current.push(mkUnique("redpanda", redPandaHomeFor(seed), !!save?.redPandaFollowing));
    crittersRef.current.push(mkUnique("cat", catHomeFor(seed), !!save?.catFollowing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave every 5s + on tab close
  useEffect(() => {
    if (!started) return;
    const id = setInterval(saveGame, 5000);
    window.addEventListener("beforeunload", saveGame);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", saveGame);
    };
  }, [started, saveGame]);

  const startGame = useCallback(async () => {
    if (started) return;
    setStarted(true);
    if (!audioRef.current) {
      audioRef.current = new ZenAudio();
    }
    await audioRef.current.start();
  }, [started]);

  const unlockCity = useCallback(() => {
    if (cityModeRef.current) return;
    cityModeRef.current = true;
    walkMsRef.current = CITY_UNLOCK_MS;
    toastRef.current = { text: "🌆 the landscape shifts — a city rises ahead...", color: "#9fd6ff", time: performance.now() };
    audioRef.current?.playChime();
    // drop cached far-away chunks so newly explored land regenerates as city
    const pcx = Math.floor(playerRef.current.x / CHUNK_SIZE);
    const pcy = Math.floor(playerRef.current.y / CHUNK_SIZE);
    for (const key of Array.from(chunksRef.current.keys())) {
      const [ccx, ccy] = key.split(",").map(Number);
      const inCore = Math.abs(ccx) <= VILLAGE_CORE_CHUNKS && Math.abs(ccy) <= VILLAGE_CORE_CHUNKS;
      const nearPlayer = Math.abs(ccx - pcx) <= 3 && Math.abs(ccy - pcy) <= 3;
      if (!inCore && !nearPlayer) chunksRef.current.delete(key);
    }
  }, []);

  const toggle3d = useCallback((on?: boolean) => {
    const next = on ?? !view3dRef.current;
    if (next === view3dRef.current) return;
    if (next) {
      // enter first person: derive view angle from facing direction
      const d = dirRef.current;
      angle3dRef.current = d === "right" ? 0 : d === "down" ? Math.PI / 2 : d === "left" ? Math.PI : -Math.PI / 2;
      fishingStateRef.current = "idle";
      if (jumpRef.current.active) {
        jumpRef.current.active = false;
        playerRef.current.x = jumpRef.current.toX;
        playerRef.current.y = jumpRef.current.toY;
      }
      toastRef.current = { text: "◉ first person — w/s walk, a/d turn, v to return", color: "#9fd6ff", time: performance.now() };
    } else {
      // back to top-down: derive facing from view angle
      const a = angle3dRef.current;
      const q = Math.round(a / (Math.PI / 2));
      dirRef.current = (["right", "down", "left", "up"] as Direction[])[((q % 4) + 4) % 4];
    }
    view3dRef.current = next;
  }, []);

  const newWorld = useCallback(() => {
    // keep the traveler's belongings, reroll the land
    const keep = {
      v: 1,
      seed: newWorldSeed(),
      walkMs: walkMsRef.current,
      city: cityModeRef.current,
      fish: fishCountsRef.current,
      weatherMode: weatherModeRef.current,
      seasonMode: seasonModeRef.current,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(keep)); } catch { /* ignore */ }
    window.location.reload();
  }, []);

  interface Command {
    name: string;
    aliases?: string[];
    hint?: string;
    hidden?: boolean;
    action: () => void;
  }

  const COMMANDS = useMemo<Command[]>(() => {
    const teleport = (x: number, y: number) => {
      playerRef.current.x = x;
      playerRef.current.y = y;
      insideHouseRef.current = false;
    };
    const toast = (text: string, color = "#e8e0d0") => {
      toastRef.current = { text, color, time: performance.now() };
    };
    return [
      { name: "3d view", aliases: ["3d", "pov", "first person"], hint: "see through zozi's eyes (V)", action: () => toggle3d(true) },
      { name: "2d view", aliases: ["2d", "top down"], hint: "back to the classic view (V)", action: () => toggle3d(false) },
      { name: "fish journal", aliases: ["journal", "fish"], hint: "your catch collection (J)", action: () => setJournalOpen(true) },
      { name: "weather: rain", aliases: ["rain"], hint: "let it pour", action: () => { weatherModeRef.current = "rain"; toast("🌧 the rain settles in..."); } },
      { name: "weather: clear", aliases: ["clear"], hint: "clear skies", action: () => { weatherModeRef.current = "clear"; toast("☀ the sky clears"); } },
      { name: "weather: auto", hint: "let the world decide", action: () => { weatherModeRef.current = "auto"; toast("the weather drifts on its own"); } },
      { name: "mute", hint: "silence the music", action: () => { audioRef.current?.setMuted(true); toast("♪ muted"); } },
      { name: "unmute", hint: "bring the music back", action: () => { audioRef.current?.setMuted(false); toast("♪ music returns"); } },
      { name: "save game", aliases: ["save"], hint: "progress autosaves too", action: () => { saveGame(); toast("💾 saved"); } },
      { name: "where am i", aliases: ["where"], hint: "current coordinates", action: () => toast(`x: ${playerRef.current.x.toFixed(1)}  y: ${playerRef.current.y.toFixed(1)}  ·  seed ${seedRef.current}`) },
      { name: "new world", aliases: ["reroll"], hint: "fresh seed — keeps your fish, resets the land", action: newWorld },
      // hidden cheats: not listed, but typing them exactly still works
      { name: "golden bamboo", hidden: true, action: () => teleport(GOLDEN_BAMBOO_POS.x + 0.5, GOLDEN_BAMBOO_POS.y + 1.5) },
      { name: "zozi house", hidden: true, action: () => teleport(87.5, 69.5) },
      {
        name: "red panda", hidden: true, action: () => {
          const rp = crittersRef.current.find((c) => c.kind === "redpanda");
          if (rp) teleport(rp.x + 1, rp.y + 1);
        },
      },
      {
        name: "stray cat", hidden: true, action: () => {
          const cat = crittersRef.current.find((c) => c.kind === "cat");
          if (cat) teleport(cat.x + 1, cat.y + 1);
        },
      },
      {
        name: "unlock city", hidden: true, action: () => {
          teleport(128.5, 8.5);
          unlockCity();
        },
      },
      {
        name: "season spring", hidden: true, action: () => { seasonModeRef.current = "spring"; toast("🌸 spring"); },
      },
      {
        name: "season summer", hidden: true, action: () => { seasonModeRef.current = "summer"; toast("🌿 summer"); },
      },
      {
        name: "season autumn", hidden: true, action: () => { seasonModeRef.current = "autumn"; toast("🍂 autumn"); },
      },
      {
        name: "season winter", hidden: true, action: () => { seasonModeRef.current = "winter"; toast("❄ winter"); },
      },
      {
        name: "season auto", hidden: true, action: () => { seasonModeRef.current = "auto"; toast("the seasons follow the calendar"); },
      },
    ];
  }, [unlockCity, toggle3d, newWorld, saveGame]);

  const visibleCommands = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    return COMMANDS.filter((c) => !c.hidden).filter(
      (c) => !q || c.name.includes(q) || c.aliases?.some((a) => a.includes(q)) || c.hint?.includes(q)
    );
  }, [COMMANDS, cmdQuery]);

  const runCommand = useCallback((cmd: Command) => {
    cmd.action();
    setCmdOpen(false);
    setCmdQuery("");
    setCmdIndex(0);
  }, []);

  const submitCommand = useCallback(() => {
    const q = cmdQuery.trim().toLowerCase();
    const hiddenHit = COMMANDS.find(
      (c) => c.hidden && (c.name === q || c.aliases?.includes(q))
    );
    if (hiddenHit) { runCommand(hiddenHit); return; }
    const list = visibleCommands;
    if (list.length > 0) runCommand(list[Math.min(cmdIndex, list.length - 1)]);
  }, [cmdQuery, cmdIndex, COMMANDS, visibleCommands, runCommand]);

  // Input handling + keyboard start
  useEffect(() => {
    const moveKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d"]);

    const startJump = () => {
      const p = playerRef.current;
      let vx = 0, vy = 0;
      const k = keysRef.current;
      if (k.has("ArrowLeft") || k.has("a")) vx -= 1;
      if (k.has("ArrowRight") || k.has("d")) vx += 1;
      if (k.has("ArrowUp") || k.has("w")) vy -= 1;
      if (k.has("ArrowDown") || k.has("s")) vy += 1;
      if (vx === 0 && vy === 0) {
        // standing jump goes in the facing direction
        if (dirRef.current === "left") vx = -1;
        else if (dirRef.current === "right") vx = 1;
        else if (dirRef.current === "up") vy = -1;
        else vy = 1;
      }
      const len = Math.hypot(vx, vy);
      vx /= len; vy /= len;
      const R = 0.3;
      const clear = (x: number, y: number) =>
        !isSolid(x - R, y - R) && !isSolid(x + R, y - R) &&
        !isSolid(x - R, y + R) && !isSolid(x + R, y + R);
      // try a full leap, then a short hop, else jump in place
      let toX = p.x, toY = p.y;
      for (const d of [JUMP_DIST, 1.0]) {
        const tx = p.x + vx * d, ty = p.y + vy * d;
        if (clear(tx, ty)) { toX = tx; toY = ty; break; }
      }
      jumpRef.current = { active: true, start: performance.now(), fromX: p.x, fromY: p.y, toX, toY };
      audioRef.current?.playJump();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K: toggle the command center
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((prev) => {
          if (!prev) { setCmdQuery(""); setCmdIndex(0); }
          return !prev;
        });
        return;
      }
      // Escape: close overlays / cancel fishing
      if (e.key === "Escape") {
        setCmdOpen(false);
        setJournalOpen(false);
        if (fishingStateRef.current !== "idle") fishingStateRef.current = "idle";
        return;
      }
      // While the command center is open, its input owns the keyboard
      if (cmdOpen) return;
      // normalize letters so a stuck Shift can't leave "W" behind when "w" is released
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysRef.current.add(key);
      // Movement cancels fishing
      if (moveKeys.has(key) && fishingStateRef.current !== "idle") {
        fishingStateRef.current = "idle";
      }
      // Start game on movement key press
      if (moveKeys.has(key) && !started) {
        startGame();
      }
      // J: fish journal
      if (key === "j" && !e.repeat && started) {
        setJournalOpen((v) => !v);
        return;
      }
      // V: toggle first-person view
      if (key === "v" && !e.repeat && started && !insideHouseRef.current) {
        toggle3d();
        return;
      }
      // Spacebar: pick up bamboo > feed companion > talk to villager > jump
      if (e.key === " " && !e.repeat && started && !insideHouseRef.current) {
        e.preventDefault();
        const px = playerRef.current.x, py = playerRef.current.y;
        const bambooDist = Math.abs(px - GOLDEN_BAMBOO_POS.x - 0.5) + Math.abs(py - GOLDEN_BAMBOO_POS.y - 0.5);
        const nearest = (kinds: CritterKind[], maxDist: number): Critter | null => {
          let best: Critter | null = null, bestD = maxDist;
          for (const c of crittersRef.current) {
            if (!kinds.includes(c.kind)) continue;
            const d = Math.abs(c.x - px) + Math.abs(c.y - py);
            if (d < bestD) { best = c; bestD = d; }
          }
          return best;
        };
        const companion = nearest(["redpanda", "cat"], 2.5);
        const villager = nearest(["villager"], 2.5);
        const now = performance.now();
        if (!hasGoldenBambooRef.current && bambooDist < 2) {
          hasGoldenBambooRef.current = true;
          pickupMsgRef.current = now;
          overlayRef.current.delete(`${GOLDEN_BAMBOO_POS.x},${GOLDEN_BAMBOO_POS.y}`);
          revealZoziPath(overlayRef.current);
          zoziRevealedRef.current = true;
          saveGame();
        } else if (companion) {
          const label = companion.kind === "redpanda" ? "red panda" : "stray cat";
          if (companion.following) {
            companion.say = "♥";
            companion.sayUntil = now + 1500;
          } else if (totalFish() > 0) {
            // feed it the most plentiful fish
            const counts = fishCountsRef.current;
            const species = Object.keys(counts).reduce((a, b) => (counts[a] >= counts[b] ? a : b));
            counts[species]--;
            if (counts[species] <= 0) delete counts[species];
            companion.following = true;
            companion.say = "♥";
            companion.sayUntil = now + 2500;
            toastRef.current = { text: `🐟 the ${label} is following you!`, color: "#ffb066", time: now };
            audioRef.current?.playChime();
            saveGame();
          } else {
            companion.say = "...";
            companion.sayUntil = now + 1500;
            toastRef.current = { text: `the ${label} eyes your fishing rod... (catch it a fish)`, color: "#e8e0d0", time: now };
          }
        } else if (villager) {
          const rp = crittersRef.current.find((c) => c.kind === "redpanda");
          const lineCtx = {
            redPandaDir: rp ? compassDir(rp.x - villager.x, rp.y - villager.y) : "north",
            catKnown: catFoundRef.current,
          };
          const idx = (Math.abs(villager.hash ?? 0) + Math.floor(now / 20000)) % VILLAGER_LINES.length;
          villager.say = VILLAGER_LINES[idx](lineCtx);
          villager.sayUntil = now + 4000;
          villager.facingLeft = px < villager.x;
        } else if (!jumpRef.current.active && !view3dRef.current) {
          if (fishingStateRef.current !== "idle") fishingStateRef.current = "idle";
          startJump();
        }
      }
      // L key: toggle pulsating on nearby lanterns
      if (key === "l" && started && !insideHouseRef.current) {
        const px = playerRef.current.x, py = playerRef.current.y;
        const baseTx = Math.floor(px), baseTy = Math.floor(py);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const tx = baseTx + dx, ty = baseTy + dy;
            const dist = Math.abs(px - tx - 0.5) + Math.abs(py - ty - 0.5);
            if (dist < 1.5 && getTileAt(tx, ty) === TileType.Lantern) {
              const key = `${tx},${ty}`;
              if (pulsatingLanternsRef.current.has(key)) {
                pulsatingLanternsRef.current.delete(key);
              } else {
                pulsatingLanternsRef.current.add(key);
              }
            }
          }
        }
      }
      // F key: fishing interaction (ignore key-repeat so holding F doesn't cancel the wait)
      if (key === "f" && !e.repeat && started && !insideHouseRef.current && !jumpRef.current.active && !view3dRef.current) {
        const fs = fishingStateRef.current;
        if (fs === "idle") {
          const water = findNearestWater(playerRef.current.x, playerRef.current.y, getTileAt);
          if (water) {
            fishingStateRef.current = "casting";
            fishingStartTimeRef.current = performance.now();
            fishingDirRef.current = water.dir;
            fishingWaterTileRef.current = { x: water.wx, y: water.wy };
            fishingBiteTimeRef.current = 3000 + Math.random() * 5000;
            dirRef.current = water.dir;
            audioRef.current?.playFishingSplash();
          }
        } else if (fs === "waiting") {
          // Pressed too early — cancel
          fishingStateRef.current = "idle";
        }
        // bite: handled by holding F in game loop; caught: auto-expires after 3s
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [started, startGame, getTileAt, isSolid, cmdOpen, toggle3d, totalFish, saveGame]);

  // Title screen canvas animation
  useEffect(() => {
    if (started) return;
    const canvas = titleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animFrame: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Title petals
    const titlePetals: Petal[] = [];

    const loop = (time: number) => {
      animFrame = requestAnimationFrame(loop);
      const w = canvas.width;
      const h = canvas.height;
      const tod = getTimeOfDay();

      ctx.fillStyle = tod.bg;
      ctx.fillRect(0, 0, w, h);

      // floating petals in background
      if (Math.random() < 0.04) {
        titlePetals.push({
          x: Math.random() * w,
          y: -10,
          vx: -0.3 + Math.random() * 0.6,
          vy: 0.3 + Math.random() * 0.5,
          life: 400 + Math.random() * 300,
          size: 2 + Math.random() * 3,
        });
      }
      for (const p of titlePetals) {
        p.x += p.vx + Math.sin(time * 0.001 + p.y * 0.01) * 0.3;
        p.y += p.vy;
        p.life--;
        const alpha = Math.min(1, p.life / 60) * 0.25;
        ctx.fillStyle = `rgba(255, 176, 192, ${alpha})`;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
      }
      // prune dead petals
      for (let i = titlePetals.length - 1; i >= 0; i--) {
        if (titlePetals[i].life <= 0) titlePetals.splice(i, 1);
      }

      // Draw Zozi character as logo
      drawTitleCharacter(ctx, w / 2, h / 2 - 50, time);

      // Draw "zozi" lowercase pixel text below character
      drawTitleText(ctx, w / 2, h / 2 + 30, time);

      // Subtle prompt text
      const pulse = 0.3 + Math.sin(time * 0.003) * 0.15;
      ctx.fillStyle = `rgba(106, 106, 90, ${pulse})`;
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("press any arrow key to begin", w / 2, h / 2 + 72);

      // time-of-day tint
      ctx.fillStyle = tod.tint;
      ctx.fillRect(0, 0, w, h);

      // vignette
      const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.65);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, `rgba(0,0,0,${tod.vignetteAlpha.toFixed(2)})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    };

    animFrame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
    };
  }, [started]);

  // Game loop
  useEffect(() => {
    if (!started) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animFrame: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const MOVE_SPEED = 0.04;

    const loop = (time: number) => {
      animFrame = requestAnimationFrame(loop);

      const w = canvas.width;
      const h = canvas.height;

      // ── Update ──
      const dt = lastFrameTimeRef.current > 0 ? Math.min(time - lastFrameTimeRef.current, 100) : 16.7;
      lastFrameTimeRef.current = time;
      const keys = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (keys.has("ArrowLeft") || keys.has("a")) { dx -= 1; dirRef.current = "left"; }
      if (keys.has("ArrowRight") || keys.has("d")) { dx += 1; dirRef.current = "right"; }
      if (keys.has("ArrowUp") || keys.has("w")) { dy -= 1; dirRef.current = "up"; }
      if (keys.has("ArrowDown") || keys.has("s")) { dy += 1; dirRef.current = "down"; }

      movingRef.current = dx !== 0 || dy !== 0;

      if (insideHouseRef.current) {
        // ── Interior mode ──
        if (movingRef.current) {
          if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
          const nx = playerRef.current.x + dx * MOVE_SPEED;
          const ny = playerRef.current.y + dy * MOVE_SPEED;
          const R = 0.3;
          const rpx = playerRef.current.x, rpy = playerRef.current.y;
          if (!isRoomSolid(rpx - R, ny - R) && !isRoomSolid(rpx + R, ny - R) &&
              !isRoomSolid(rpx - R, ny + R) && !isRoomSolid(rpx + R, ny + R))
            playerRef.current.y = ny;
          const rfy = playerRef.current.y;
          if (!isRoomSolid(nx - R, rfy - R) && !isRoomSolid(nx + R, rfy - R) &&
              !isRoomSolid(nx - R, rfy + R) && !isRoomSolid(nx + R, rfy + R))
            playerRef.current.x = nx;
          walkTimerRef.current += 1;
          if (walkTimerRef.current >= 8) { walkTimerRef.current = 0; frameRef.current += 1; }
          if (time - lastStepRef.current > 280) {
            lastStepRef.current = time;
            audioRef.current?.playFootstep("stone");
          }
        } else { walkTimerRef.current = 0; frameRef.current = 0; }
        // Exit check
        if (playerRef.current.y > 9.2) {
          insideHouseRef.current = false;
          playerRef.current.x = savedPosRef.current.x;
          playerRef.current.y = savedPosRef.current.y;
        }
        // Render interior
        ctx.imageSmoothingEnabled = false;
        drawInterior(ctx, w, h, playerRef.current.x, playerRef.current.y,
          dirRef.current, frameRef.current, time);
      } else {
        // ── Overworld mode ──
        const tod = getTimeOfDay();
        const seasonNow: Season = seasonModeRef.current === "auto" ? seasonFromDate() : seasonModeRef.current;
        const jmp = jumpRef.current;
        if (view3dRef.current) {
          // first-person movement: a/d or ←/→ turn, w/s or ↑/↓ walk
          const ROT = 0.0032, MV = 0.0038;
          if (keys.has("ArrowLeft") || keys.has("a")) angle3dRef.current -= ROT * dt;
          if (keys.has("ArrowRight") || keys.has("d")) angle3dRef.current += ROT * dt;
          let fwd = 0;
          if (keys.has("ArrowUp") || keys.has("w")) fwd += 1;
          if (keys.has("ArrowDown") || keys.has("s")) fwd -= 1;
          movingRef.current = fwd !== 0;
          if (fwd !== 0) {
            const nx = playerRef.current.x + Math.cos(angle3dRef.current) * fwd * MV * dt;
            const ny = playerRef.current.y + Math.sin(angle3dRef.current) * fwd * MV * dt;
            const R = 0.3;
            const cy0 = playerRef.current.y;
            if (!isSolid(nx - R, cy0 - R) && !isSolid(nx + R, cy0 - R) &&
                !isSolid(nx - R, cy0 + R) && !isSolid(nx + R, cy0 + R))
              playerRef.current.x = nx;
            const cx0 = playerRef.current.x;
            if (!isSolid(cx0 - R, ny - R) && !isSolid(cx0 + R, ny - R) &&
                !isSolid(cx0 - R, ny + R) && !isSolid(cx0 + R, ny + R))
              playerRef.current.y = ny;
            if (time - lastStepRef.current > 320) {
              lastStepRef.current = time;
              const underTile = getTileAt(Math.floor(playerRef.current.x), Math.floor(playerRef.current.y));
              audioRef.current?.playFootstep(isStoneSurface(underTile) ? "stone" : "grass");
            }
          }
        } else if (jmp.active) {
          // airborne — interpolate along the arc, ignore normal movement
          const jt = (time - jmp.start) / JUMP_MS;
          if (jt >= 1) {
            jmp.active = false;
            playerRef.current.x = jmp.toX;
            playerRef.current.y = jmp.toY;
            const landTile = getTileAt(Math.floor(jmp.toX), Math.floor(jmp.toY));
            audioRef.current?.playFootstep(isStoneSurface(landTile) ? "stone" : "grass");
          } else {
            playerRef.current.x = jmp.fromX + (jmp.toX - jmp.fromX) * jt;
            playerRef.current.y = jmp.fromY + (jmp.toY - jmp.fromY) * jt;
            movingRef.current = true;
          }
          walkTimerRef.current = 0;
        } else if (fishingStateRef.current === "idle") {
          // Normal movement — only when not fishing
          if (movingRef.current) {
            if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
            const nx = playerRef.current.x + dx * MOVE_SPEED;
            const ny = playerRef.current.y + dy * MOVE_SPEED;
            const R = 0.3;
            const px = playerRef.current.x, py = playerRef.current.y;
            if (!isSolid(Math.floor(px - R), Math.floor(ny - R)) &&
                !isSolid(Math.floor(px + R), Math.floor(ny - R)) &&
                !isSolid(Math.floor(px - R), Math.floor(ny + R)) &&
                !isSolid(Math.floor(px + R), Math.floor(ny + R)))
              playerRef.current.y = ny;
            const fy = playerRef.current.y;
            if (!isSolid(Math.floor(nx - R), Math.floor(fy - R)) &&
                !isSolid(Math.floor(nx + R), Math.floor(fy - R)) &&
                !isSolid(Math.floor(nx - R), Math.floor(fy + R)) &&
                !isSolid(Math.floor(nx + R), Math.floor(fy + R)))
              playerRef.current.x = nx;
            walkTimerRef.current += 1;
            if (walkTimerRef.current >= 8) { walkTimerRef.current = 0; frameRef.current += 1; }
            if (time - lastStepRef.current > 280) {
              lastStepRef.current = time;
              const tile = getTileAt(Math.floor(playerRef.current.x), Math.floor(playerRef.current.y));
              const surface: Surface = isStoneSurface(tile) ? "stone" : "grass";
              audioRef.current?.playFootstep(surface);
            }
          } else { walkTimerRef.current = 0; frameRef.current = 0; }
        } else {
          // Fishing — face water, freeze movement
          dirRef.current = fishingDirRef.current;
          walkTimerRef.current = 0;
          frameRef.current = 0;
        }

        // ── Walking clock — enough wandering reveals the city ──
        if (movingRef.current) {
          walkMsRef.current += dt;
          if (!cityModeRef.current && walkMsRef.current >= CITY_UNLOCK_MS) unlockCity();
        }

        // ── Weather ──
        {
          const mode = weatherModeRef.current;
          if (mode === "auto") {
            if (weatherNextRef.current === 0) {
              // start every session dry
              weatherNextRef.current = time + (90 + Math.random() * 180) * 1000;
            } else if (time > weatherNextRef.current) {
              if (rainingRef.current) {
                rainingRef.current = false;
                weatherNextRef.current = time + (180 + Math.random() * 240) * 1000;
              } else {
                rainingRef.current = Math.random() < 0.55;
                weatherNextRef.current = time + (rainingRef.current ? 60 + Math.random() * 90 : 120 + Math.random() * 180) * 1000;
              }
            }
          } else {
            rainingRef.current = mode === "rain";
          }
          audioRef.current?.setRain(rainingRef.current && seasonNow !== "winter");

          if (rainingRef.current) {
            const isSnow = seasonNow === "winter";
            while (raindropsRef.current.length < (isSnow ? 90 : 130)) {
              raindropsRef.current.push({
                x: Math.random() * (w + 100) - 50,
                y: -20 - Math.random() * h,
                speed: isSnow ? 0.05 + Math.random() * 0.04 : 0.55 + Math.random() * 0.35,
                len: isSnow ? 2 : 10 + Math.random() * 8,
              });
            }
            for (const d of raindropsRef.current) {
              d.y += d.speed * dt;
              d.x += d.speed * dt * (isSnow ? 0.15 : 0.3);
              if (d.y > h + 20) { d.y = -20; d.x = Math.random() * (w + 100) - 50; }
            }
          } else if (raindropsRef.current.length) {
            raindropsRef.current = [];
          }
        }

        // ── Fireflies at night, near water ──
        {
          if (time - waterScanRef.current > 1500) {
            waterScanRef.current = time;
            waterTilesRef.current = findWaterTilesInRadius(playerRef.current.x, playerRef.current.y, 10, getTileAt);
          }
          const night = tod.playerGlow > 0.04;
          if (night && waterTilesRef.current.length > 0 && firefliesRef.current.length < 22 && Math.random() < 0.12) {
            const t0 = waterTilesRef.current[Math.floor(Math.random() * waterTilesRef.current.length)];
            firefliesRef.current.push({
              x: t0.x + Math.random() * 3 - 1, y: t0.y + Math.random() * 3 - 1,
              vx: 0, vy: 0, phase: Math.random() * Math.PI * 2,
              life: 6000 + Math.random() * 6000,
            });
          }
          for (const f of firefliesRef.current) {
            f.vx += (Math.random() - 0.5) * 0.0004;
            f.vy += (Math.random() - 0.5) * 0.0004;
            f.vx *= 0.98; f.vy *= 0.98;
            f.x += f.vx * dt * 0.06;
            f.y += f.vy * dt * 0.06;
            f.life -= dt;
          }
          firefliesRef.current = night ? firefliesRef.current.filter((f) => f.life > 0) : [];
        }

        // ── Fishing state machine ──
        const fsNow = performance.now();
        const fsDelta = fsNow - fishingStartTimeRef.current;
        if (fishingStateRef.current === "casting" && fsDelta > 800) {
          fishingStateRef.current = "waiting";
          fishingStartTimeRef.current = fsNow;
        } else if (fishingStateRef.current === "waiting" && fsDelta > fishingBiteTimeRef.current) {
          fishingStateRef.current = "bite";
          fishingStartTimeRef.current = fsNow;
          fishingCaughtFishRef.current = rollFish();
          fishingHoldRef.current = 0;
        } else if (fishingStateRef.current === "bite") {
          // Hold F to reel in — rarer fish need longer hold
          if (keys.has("f")) {
            fishingHoldRef.current += dt;
            if (fishingHoldRef.current >= fishingCaughtFishRef.current.holdTime) {
              fishingStateRef.current = "caught";
              fishingStartTimeRef.current = fsNow;
              const fname = fishingCaughtFishRef.current.name;
              fishCountsRef.current[fname] = (fishCountsRef.current[fname] ?? 0) + 1;
              toastRef.current = { text: `you caught a ${fname}!`, color: "#ffe9a0", time: fsNow };
              audioRef.current?.playFishingSplash();
              audioRef.current?.playChime();
              saveGame();
            }
          } else if (fsDelta > 1500) {
            // Missed the bite
            fishingStateRef.current = "idle";
          }
        } else if (fishingStateRef.current === "caught" && fsDelta > 3000) {
          fishingStateRef.current = "idle";
        }

        // Check house entry (not while mid-jump — only a grounded step through the door counts)
        if (zoziRevealedRef.current && !jumpRef.current.active) {
          const pk = `${Math.floor(playerRef.current.x)},${Math.floor(playerRef.current.y)}`;
          if (ZOZI_DOOR_KEYS.has(pk)) {
            savedPosRef.current = { x: playerRef.current.x, y: playerRef.current.y };
            insideHouseRef.current = true;
            koiRef.current = [];
            koiIdleTimerRef.current = 0;
            playerRef.current.x = 5.5;
            playerRef.current.y = 8.5;
            dirRef.current = "up";
          }
        }

        // ── Koi Gathering ──
        {
          const px = playerRef.current.x;
          const py = playerRef.current.y;
          const isIdle = !movingRef.current && fishingStateRef.current === "idle";
          const nearWater = findNearestWater(px, py, getTileAt);

          if (isIdle && nearWater) {
            if (koiIdleTimerRef.current === 0) {
              koiIdleTimerRef.current = time;
            }
            const idleDuration = time - koiIdleTimerRef.current;

            // Spawn koi after delay, rate increases over time
            if (idleDuration > KOI_IDLE_DELAY &&
                koiRef.current.length < KOI_MAX_COUNT &&
                time - koiLastSpawnRef.current > KOI_SPAWN_INTERVAL / (1 + idleDuration * 0.0003)) {
              const waterTiles = findWaterTilesInRadius(px, py, KOI_SPAWN_RADIUS, getTileAt);
              const farTiles = waterTiles.filter(t => {
                const d = Math.abs(t.x + 0.5 - px) + Math.abs(t.y + 0.5 - py);
                return d > 3.5;
              });
              if (farTiles.length > 0) {
                const tile = farTiles[Math.floor(Math.random() * farTiles.length)];
                const palette = KOI_COLORS[Math.floor(Math.random() * KOI_COLORS.length)];
                koiRef.current.push({
                  x: tile.x + 0.3 + Math.random() * 0.4,
                  y: tile.y + 0.3 + Math.random() * 0.4,
                  vx: 0, vy: 0,
                  targetX: nearWater.wx + 0.5,
                  targetY: nearWater.wy + 0.5,
                  color: palette.body,
                  accentColor: palette.accent,
                  phase: Math.random() * Math.PI * 2,
                  size: 0.85 + Math.random() * 0.3,
                  scattering: false,
                  scatterLife: 0,
                });
                koiLastSpawnRef.current = time;
              }
            }

            // Swim toward player's nearest water tile
            for (const koi of koiRef.current) {
              if (koi.scattering) continue;
              koi.targetX = nearWater.wx + 0.5;
              koi.targetY = nearWater.wy + 0.5;
              const ddx = koi.targetX - koi.x;
              const ddy = koi.targetY - koi.y;
              const dist = Math.sqrt(ddx * ddx + ddy * ddy);
              if (dist > 0.3) {
                const speed = KOI_SWIM_SPEED * (0.7 + 0.3 * Math.sin(time * 0.003 + koi.phase));
                koi.vx = (ddx / dist) * speed + Math.sin(time * 0.005 + koi.phase) * 0.002;
                koi.vy = (ddy / dist) * speed + Math.cos(time * 0.004 + koi.phase * 1.3) * 0.002;
              } else {
                koi.vx = Math.sin(time * 0.003 + koi.phase) * 0.002;
                koi.vy = Math.cos(time * 0.004 + koi.phase * 1.5) * 0.001;
              }
              koi.x += koi.vx;
              koi.y += koi.vy;
              // Stay on water tiles
              if (getTileAt(Math.floor(koi.x), Math.floor(koi.y)) !== TileType.Water) {
                koi.x -= koi.vx;
                koi.y -= koi.vy;
                koi.vx *= -0.5;
                koi.vy *= -0.5;
              }
            }
          } else {
            // Scatter koi when player moves or leaves water — fade out in place
            if (koiRef.current.length > 0) {
              for (const koi of koiRef.current) {
                if (!koi.scattering) {
                  koi.scattering = true;
                  koi.scatterLife = KOI_SCATTER_LIFE;
                  koi.vx = Math.sin(koi.phase) * KOI_SCATTER_SPEED;
                  koi.vy = Math.cos(koi.phase) * KOI_SCATTER_SPEED;
                }
              }
            }
            koiIdleTimerRef.current = 0;
          }

          // Update scattering koi
          for (const koi of koiRef.current) {
            if (koi.scattering) {
              const nx = koi.x + koi.vx;
              const ny = koi.y + koi.vy;
              if (getTileAt(Math.floor(nx), Math.floor(ny)) === TileType.Water) {
                koi.x = nx;
                koi.y = ny;
              } else {
                koi.vx = 0;
                koi.vy = 0;
              }
              koi.scatterLife--;
            }
          }
          koiRef.current = koiRef.current.filter(k => !k.scattering || k.scatterLife > 0);
        }

        // ── Pandas & the red panda ──
        {
          const px = playerRef.current.x;
          const py = playerRef.current.y;

          // spawn scan (throttled): very few pandas + some villagers, deterministic per block
          if (time - critterScanRef.current > 500) {
            critterScanRef.current = time;
            crittersRef.current = crittersRef.current.filter((c) => {
              if (c.kind === "redpanda" || c.kind === "cat" || c.following) return true;
              if (Math.abs(c.x - px) + Math.abs(c.y - py) > 80) {
                critterBlocksRef.current.delete(c.blockKey);
                return false;
              }
              return true;
            });
            let pandaCount = crittersRef.current.filter((c) => c.kind === "panda").length;
            let villagerCount = crittersRef.current.filter((c) => c.kind === "villager").length;
            if (pandaCount < PANDA_MAX || villagerCount < VILLAGER_MAX) {
              const bx0 = Math.floor((px - 26) / 16), bx1 = Math.floor((px + 26) / 16);
              const by0 = Math.floor((py - 18) / 12), by1 = Math.floor((py + 18) / 12);
              outer:
              for (let by = by0; by <= by1; by++) {
                for (let bx = bx0; bx <= bx1; bx++) {
                  const bKey = `${bx},${by}`;
                  if (critterBlocksRef.current.has(bKey)) continue;
                  critterBlocksRef.current.add(bKey);
                  const bHash = Math.abs(hashCoord(bx * 31 + 7, by * 57 + 11));
                  const vHash = Math.abs(hashCoord(bx * 17 + 5, by * 23 + 3));
                  let kind: CritterKind | null = null;
                  if (bHash % 19 === 0 && pandaCount < PANDA_MAX) kind = "panda";
                  else if (vHash % 7 === 0 && villagerCount < VILLAGER_MAX) kind = "villager";
                  if (!kind) continue;
                  const sRng = seededRandom((kind === "panda" ? bHash : vHash) + 1);
                  for (let attempt = 0; attempt < 10; attempt++) {
                    const tx = bx * 16 + 3 + Math.floor(sRng() * 11);
                    const ty = by * 12 + 3 + Math.floor(sRng() * 7);
                    const ch = getChunk(Math.floor(tx / CHUNK_SIZE), Math.floor(ty / CHUNK_SIZE));
                    if (ch.city) break; // pandas & villagers stay out of the city
                    if (!isSolid(tx, ty)) {
                      crittersRef.current.push({
                        kind, x: tx + 0.5, y: ty + 0.5,
                        homeX: tx + 0.5, homeY: ty + 0.5,
                        vx: 0, vy: 0, moving: false,
                        stateTimer: 400 + sRng() * 1200,
                        walkAcc: 0, facingLeft: false, blockKey: bKey,
                        hash: vHash,
                      });
                      if (kind === "panda") pandaCount++; else villagerCount++;
                      break;
                    }
                  }
                  if (pandaCount >= PANDA_MAX && villagerCount >= VILLAGER_MAX) break outer;
                }
              }
            }

            // city ↔ village ambience follows the ground under your feet
            const hereChunk = getChunk(Math.floor(px / CHUNK_SIZE), Math.floor(py / CHUNK_SIZE));
            if (hereChunk.city !== audioCityRef.current) {
              audioCityRef.current = hereChunk.city;
              audioRef.current?.setMode(hereChunk.city ? "city" : "village");
            }

            // prune far-away chunks so the cache never grows unbounded
            if (chunksRef.current.size > 380) {
              const pcx = Math.floor(px / CHUNK_SIZE), pcy = Math.floor(py / CHUNK_SIZE);
              for (const key of Array.from(chunksRef.current.keys())) {
                const [ccx, ccy] = key.split(",").map(Number);
                if (Math.max(Math.abs(ccx - pcx), Math.abs(ccy - pcy)) > 6) chunksRef.current.delete(key);
              }
            }
          }

          // wander AI (+ companions that follow)
          for (const c of crittersRef.current) {
            const cd = Math.abs(c.x - px) + Math.abs(c.y - py);
            if (c.following) {
              const ddx = px - c.x, ddy = py - c.y;
              const d2 = Math.hypot(ddx, ddy);
              if (d2 > 25) {
                // left far behind (teleport, jump chains) — catch up
                for (const [ox, oy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
                  if (!isSolid(px + ox, py + oy)) { c.x = px + ox; c.y = py + oy; break; }
                }
              } else if (d2 > 1.6) {
                const sp = Math.min(FOLLOW_SPEED, (d2 - 1.2) * 0.002);
                const nx = c.x + (ddx / d2) * sp * dt;
                const ny = c.y + (ddy / d2) * sp * dt;
                const R = 0.25;
                const clearAt = (x: number, y: number) =>
                  !isSolid(x - R, y - R) && !isSolid(x + R, y - R) &&
                  !isSolid(x - R, y + R) && !isSolid(x + R, y + R);
                if (clearAt(nx, ny)) { c.x = nx; c.y = ny; }
                else if (clearAt(nx, c.y)) { c.x = nx; }
                else if (clearAt(c.x, ny)) { c.y = ny; }
                c.walkAcc += dt;
                c.moving = true;
                c.facingLeft = ddx < 0;
              } else {
                c.moving = false;
              }
              continue;
            }
            if (cd > 40) continue;
            c.stateTimer -= dt;
            if (c.stateTimer <= 0) {
              if (Math.random() < 0.45) {
                c.moving = false;
                c.stateTimer = 900 + Math.random() * 1800;
              } else {
                const distHome = Math.hypot(c.x - c.homeX, c.y - c.homeY);
                const ang = distHome > 4
                  ? Math.atan2(c.homeY - c.y, c.homeX - c.x) + (Math.random() - 0.5)
                  : Math.random() * Math.PI * 2;
                c.vx = Math.cos(ang) * CRITTER_SPEED;
                c.vy = Math.sin(ang) * CRITTER_SPEED;
                c.moving = true;
                c.facingLeft = c.vx < 0;
                c.stateTimer = 700 + Math.random() * 1300;
              }
            }
            if (c.moving) {
              const nx = c.x + c.vx * dt;
              const ny = c.y + c.vy * dt;
              const R = 0.25;
              if (!isSolid(nx - R, ny - R) && !isSolid(nx + R, ny - R) &&
                  !isSolid(nx - R, ny + R) && !isSolid(nx + R, ny + R)) {
                c.x = nx;
                c.y = ny;
                c.walkAcc += dt;
              } else {
                c.moving = false;
                c.stateTimer = 400 + Math.random() * 600;
              }
            }
            if (c.kind === "redpanda" && !redPandaFoundRef.current && cd < 3) {
              redPandaFoundRef.current = true;
              toastRef.current = { text: "✨ you found the red panda! ✨", color: "#ffb066", time };
              audioRef.current?.playChime();
              saveGame();
            }
            if (c.kind === "cat" && !catFoundRef.current && cd < 3) {
              catFoundRef.current = true;
              toastRef.current = { text: "🐈 you found the stray cat of the city!", color: "#c8d8ff", time };
              audioRef.current?.playChime();
              saveGame();
            }
          }
        }

        // ── Petals (seasonal: sakura, leaves, snow) ──
        const petalCfg = SEASON_PETAL[seasonNow];
        if (Math.random() < petalCfg.rate) {
          petalsRef.current.push({
            x: playerRef.current.x + (Math.random() - 0.5) * 20,
            y: playerRef.current.y - 8 + Math.random() * 2,
            vx: -0.005 + Math.random() * 0.01,
            vy: (0.005 + Math.random() * 0.008) * petalCfg.vyMul,
            life: 300 + Math.random() * 200,
            size: 1 + Math.random(),
          });
        }
        for (const p of petalsRef.current) {
          p.x += p.vx + Math.sin(time * 0.001 + p.x) * 0.003;
          p.y += p.vy;
          p.life--;
        }
        petalsRef.current = petalsRef.current.filter((p) => p.life > 0);

        // ── Render overworld ──
        ctx.imageSmoothingEnabled = false;
        const camX = playerRef.current.x * SCALED_TILE - w / 2;
        const camY = playerRef.current.y * SCALED_TILE - h / 2;
        ctx.fillStyle = tod.bg;
        ctx.fillRect(0, 0, w, h);

        if (view3dRef.current) {
          const pChunk = getChunk(
            Math.floor(playerRef.current.x / CHUNK_SIZE),
            Math.floor(playerRef.current.y / CHUNK_SIZE)
          );
          render3D(
            ctx, w, h,
            playerRef.current.x, playerRef.current.y, angle3dRef.current,
            tod, isSolid, getTileAt, crittersRef.current, pChunk.city, time
          );
        } else {

        const startTileX = Math.floor(camX / SCALED_TILE) - 1;
        const startTileY = Math.floor(camY / SCALED_TILE) - 1;
        const endTileX = Math.ceil((camX + w) / SCALED_TILE) + 1;
        const endTileY = Math.ceil((camY + h) / SCALED_TILE) + 1;

        for (let ty = startTileY; ty <= endTileY; ty++) {
          for (let tx = startTileX; tx <= endTileX; tx++) {
            const ovKey = `${tx},${ty}`;
            const ov = overlayRef.current.get(ovKey);
            let tileType: TileType;
            if (ov) {
              tileType = ov.type;
            } else {
              const chunkX = Math.floor(tx / CHUNK_SIZE);
              const chunkY = Math.floor(ty / CHUNK_SIZE);
              const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
              const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
              const chunk = getChunk(chunkX, chunkY);
              tileType = chunk.tiles[ly][lx];
            }
            const screenX = Math.floor(tx * SCALED_TILE - camX);
            const screenY = Math.floor(ty * SCALED_TILE - camY);
            const isPulsating = tileType === TileType.Lantern && pulsatingLanternsRef.current.has(`${tx},${ty}`);
            drawTile(ctx, tileType, screenX, screenY, tx, ty, time, isPulsating);
          }
        }

        // koi fish in water
        for (const koi of koiRef.current) {
          const koiSX = Math.floor(koi.x * SCALED_TILE - camX);
          const koiSY = Math.floor(koi.y * SCALED_TILE - camY);
          if (koiSX > -SCALED_TILE && koiSX < w + SCALED_TILE &&
              koiSY > -SCALED_TILE && koiSY < h + SCALED_TILE) {
            drawKoiRipple(ctx, koiSX, koiSY, time, koi.phase);
            const alpha = koi.scattering ? Math.max(0, koi.scatterLife / KOI_SCATTER_LIFE) : 1;
            ctx.globalAlpha = alpha;
            drawKoi(ctx, koiSX, koiSY, koi.color, koi.accentColor,
              time, koi.phase, koi.size, koi.vx < 0);
            ctx.globalAlpha = 1;
          }
        }

        // pandas
        for (const c of crittersRef.current) {
          const csx = Math.floor(c.x * SCALED_TILE - camX) - 8 * SCALE;
          const csy = Math.floor(c.y * SCALED_TILE - camY) - 10 * SCALE;
          if (csx < -SCALED_TILE * 2 || csx > w + SCALED_TILE ||
              csy < -SCALED_TILE * 2 || csy > h + SCALED_TILE) continue;
          const cFrame = c.moving ? Math.floor(c.walkAcc / 160) % 2 : 0;
          drawCritter(ctx, csx, csy, time, cFrame, c.kind, c.facingLeft, c.hash ?? 0);
        }

        // speech bubbles
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        for (const c of crittersRef.current) {
          if (!c.say || !c.sayUntil || time > c.sayUntil) continue;
          const bx = Math.floor(c.x * SCALED_TILE - camX);
          const by = Math.floor(c.y * SCALED_TILE - camY) - 14 * SCALE;
          const tw = ctx.measureText(c.say).width;
          ctx.fillStyle = "rgba(20,20,30,0.85)";
          ctx.fillRect(bx - tw / 2 - 6, by - 14, tw + 12, 18);
          ctx.fillStyle = "#e8e0d0";
          ctx.fillText(c.say, bx, by - 1);
        }

        // character (with jump arc + shadow)
        const charScreenX = Math.floor(playerRef.current.x * SCALED_TILE - camX - 8 * SCALE);
        const charScreenY = Math.floor(playerRef.current.y * SCALED_TILE - camY - 8 * SCALE);
        let jumpLift = 0;
        if (jumpRef.current.active) {
          const jt = Math.min((time - jumpRef.current.start) / JUMP_MS, 1);
          jumpLift = -Math.sin(Math.PI * jt) * 6 * SCALE;
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.beginPath();
          ctx.ellipse(charScreenX + 8 * SCALE, charScreenY + 15 * SCALE, 5 * SCALE, 2 * SCALE, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        drawCharacter(ctx, charScreenX, charScreenY + jumpLift, dirRef.current, frameRef.current, time, hasGoldenBambooRef.current, fishingStateRef.current);

        // fishing overlay
        if (fishingStateRef.current !== "idle") {
          const wt = fishingWaterTileRef.current;
          const waterSX = Math.floor(wt.x * SCALED_TILE - camX);
          const waterSY = Math.floor(wt.y * SCALED_TILE - camY);
          drawFishingOverlay(
            ctx, charScreenX, charScreenY,
            waterSX, waterSY,
            fishingStateRef.current, time,
            fishingCaughtFishRef.current.color,
            fishingStartTimeRef.current,
            dirRef.current
          );
        }

        // petals / leaves / snow
        ctx.fillStyle = petalCfg.color;
        for (const p of petalsRef.current) {
          const ppx = Math.floor(p.x * SCALED_TILE - camX);
          const ppy = Math.floor(p.y * SCALED_TILE - camY);
          const alpha = Math.min(1, p.life / 50);
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillRect(ppx, ppy, p.size * SCALE, p.size * SCALE * 0.6);
        }
        ctx.globalAlpha = 1;

        // fireflies
        for (const f of firefliesRef.current) {
          const fx = Math.floor(f.x * SCALED_TILE - camX);
          const fy = Math.floor(f.y * SCALED_TILE - camY);
          const pulse = 0.35 + Math.sin(time * 0.006 + f.phase) * 0.35;
          const fade = Math.min(1, f.life / 1500);
          ctx.fillStyle = `rgba(255,240,130,${(pulse * fade * 0.25).toFixed(3)})`;
          ctx.fillRect(fx - 4, fy - 4, 9, 9);
          ctx.fillStyle = `rgba(255,244,160,${(pulse * fade).toFixed(3)})`;
          ctx.fillRect(fx - 1, fy - 1, 3, 3);
        }

        // player aura glow at night
        if (tod.playerGlow > 0) {
          const glowCx = charScreenX + 8 * SCALE;
          const glowCy = charScreenY + 6 * SCALE;
          const glowR = SCALED_TILE * 3;
          const aura = ctx.createRadialGradient(glowCx, glowCy, 0, glowCx, glowCy, glowR);
          aura.addColorStop(0, `rgba(255,220,160,${(tod.playerGlow * 0.7).toFixed(3)})`);
          aura.addColorStop(0.3, `rgba(255,200,120,${(tod.playerGlow * 0.3).toFixed(3)})`);
          aura.addColorStop(1, "rgba(255,200,120,0)");
          ctx.fillStyle = aura;
          ctx.fillRect(glowCx - glowR, glowCy - glowR, glowR * 2, glowR * 2);
        }

        } // end 2D world rendering

        // rain / snow overlay (screen space — falls over both views)
        if (raindropsRef.current.length > 0) {
          if (seasonNow === "winter") {
            ctx.fillStyle = "rgba(240,246,255,0.8)";
            for (const d of raindropsRef.current) ctx.fillRect(d.x, d.y, 2.5, 2.5);
          } else {
            ctx.fillStyle = "rgba(20,30,60,0.10)";
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = "rgba(170,190,230,0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const d of raindropsRef.current) {
              ctx.moveTo(d.x, d.y);
              ctx.lineTo(d.x - d.len * 0.3, d.y - d.len);
            }
            ctx.stroke();
          }
        }

        // golden bamboo pickup message
        if (pickupMsgRef.current > 0 && time - pickupMsgRef.current < 3000) {
          const msgAlpha = Math.max(0, 1 - (time - pickupMsgRef.current) / 3000);
          ctx.globalAlpha = msgAlpha;
          ctx.fillStyle = "#ffd700";
          ctx.font = "bold 16px monospace";
          ctx.textAlign = "center";
          ctx.fillText("✨ golden bamboo found! follow the golden road... ✨", w / 2, 40);
          ctx.globalAlpha = 1;
        }

        // toast messages (fish caught, red panda, city)
        const toast = toastRef.current;
        if (toast.time > 0 && time - toast.time < 3500) {
          const toastAlpha = Math.max(0, 1 - (time - toast.time) / 3500);
          ctx.globalAlpha = toastAlpha;
          ctx.fillStyle = toast.color;
          ctx.font = "bold 15px monospace";
          ctx.textAlign = "center";
          ctx.fillText(toast.text, w / 2, 64);
          ctx.globalAlpha = 1;
        }

        // bamboo indicator when held
        if (hasGoldenBambooRef.current) {
          ctx.fillStyle = "#ffd700";
          ctx.fillRect(w - 30, 10, 6, 20);
          ctx.fillStyle = "#d4a017";
          ctx.fillRect(w - 29, 10, 4, 20);
        }

        // fish tally
        const fishTotal = totalFish();
        if (fishTotal > 0) {
          const fhY = hasGoldenBambooRef.current ? 52 : 20;
          drawPixelFish(ctx, w - 44, fhY, "#7a9bb5", time);
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.font = "12px monospace";
          ctx.textAlign = "left";
          ctx.fillText(`× ${fishTotal}`, w - 28, fhY + 4);
        }

        // controls hint for the first few seconds
        if (hintStartRef.current === 0) hintStartRef.current = time;
        const hintAge = time - hintStartRef.current;
        if (hintAge < 11000) {
          const hintAlpha = hintAge < 800 ? hintAge / 800 : hintAge > 9000 ? Math.max(0, 1 - (hintAge - 9000) / 2000) : 1;
          ctx.globalAlpha = hintAlpha * 0.55;
          ctx.fillStyle = "#e8e0d0";
          ctx.font = "12px monospace";
          ctx.textAlign = "center";
          ctx.fillText("arrows/wasd walk · space jump/talk · f fish · j journal · v 3d · ⌘k commands", w / 2, h - 20);
          ctx.globalAlpha = 1;
        }

        // time-of-day tint
        ctx.fillStyle = tod.tint;
        ctx.fillRect(0, 0, w, h);

        // vignette
        const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, `rgba(0,0,0,${tod.vignetteAlpha.toFixed(2)})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // dev coordinates + debug hook
        if (process.env.NODE_ENV === "development") {
          (window as unknown as Record<string, unknown>).__zozi = {
            player: playerRef.current,
            critters: crittersRef.current,
            seed: seedRef.current,
            raining: rainingRef.current,
            view3d: view3dRef.current,
          };
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.font = "11px monospace";
          ctx.textAlign = "right";
          ctx.fillText(
            `x: ${playerRef.current.x.toFixed(1)}  y: ${playerRef.current.y.toFixed(1)}`,
            w - 10, h - 10
          );
        }
      }
    };

    animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
    };
  }, [started, getChunk, isSolid, getTileAt, unlockCity, saveGame, totalFish]);

  // Cleanup
  useEffect(() => {
    return () => { audioRef.current?.stop(); };
  }, []);

  if (!started) {
    return (
      <canvas
        ref={titleCanvasRef}
        className="block w-screen h-screen cursor-pointer"
        onClick={startGame}
      />
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="block w-screen h-screen" />
      {cmdOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "18vh",
            zIndex: 100,
          }}
          onClick={() => setCmdOpen(false)}
        >
          <div
            style={{
              background: "#1a1a2e",
              border: "1px solid #333",
              borderRadius: 8,
              padding: 8,
              minWidth: 340,
              maxWidth: 440,
              fontFamily: "monospace",
              fontSize: 13,
              color: "#e0d8c8",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={cmdQuery}
              placeholder="type a command..."
              onChange={(e) => {
                setCmdQuery(e.target.value);
                setCmdIndex(0);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") { setCmdOpen(false); return; }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCmdIndex((i) => Math.min(i + 1, Math.max(0, visibleCommands.length - 1)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCmdIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  submitCommand();
                }
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#12121f",
                border: "1px solid #333",
                borderRadius: 4,
                padding: "8px 10px",
                marginBottom: 6,
                fontFamily: "monospace",
                fontSize: 13,
                color: "#e8e0d0",
                outline: "none",
              }}
            />
            {visibleCommands.length === 0 && (
              <div style={{ padding: "8px 10px", opacity: 0.45, fontSize: 12 }}>
                press enter if you know what you&apos;re doing...
              </div>
            )}
            {visibleCommands.map((cmd, i) => (
              <button
                key={cmd.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 10px",
                  background: i === cmdIndex ? "#2a2a4e" : "transparent",
                  border: "none",
                  color: i === cmdIndex ? "#ffd700" : "#e0d8c8",
                  fontFamily: "monospace",
                  fontSize: 13,
                  cursor: "pointer",
                  borderRadius: 4,
                }}
                onMouseEnter={() => setCmdIndex(i)}
                onClick={() => runCommand(cmd)}
              >
                <span>{cmd.name}</span>
                {cmd.hint && <span style={{ opacity: 0.45, fontSize: 11 }}>{cmd.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {journalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 90,
          }}
          onClick={() => setJournalOpen(false)}
        >
          <div
            style={{
              background: "#1a1a2e",
              border: "1px solid #3a3a52",
              borderRadius: 10,
              padding: "18px 22px",
              minWidth: 340,
              fontFamily: "monospace",
              color: "#e0d8c8",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, marginBottom: 12, color: "#ffd700" }}>
              🎣 fish journal
            </div>
            {FISH_TYPES.map((f) => {
              const count = fishCountsRef.current[f.name] ?? 0;
              const rarity = "★".repeat(Math.max(1, Math.round(6 - f.weight / 7)));
              return (
                <div
                  key={f.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "5px 0",
                    opacity: count > 0 ? 1 : 0.4,
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: count > 0 ? f.color : "#333",
                      display: "inline-block",
                    }}
                  />
                  <span style={{ width: 130 }}>{count > 0 ? f.name : "???"}</span>
                  <span style={{ opacity: 0.55, fontSize: 11, width: 60 }}>{rarity}</span>
                  <span style={{ marginLeft: "auto", color: count > 0 ? "#ffd700" : "#555" }}>
                    {count > 0 ? `× ${count}` : "—"}
                  </span>
                </div>
              );
            })}
            <div style={{ marginTop: 12, fontSize: 11, opacity: 0.45 }}>
              {Object.keys(fishCountsRef.current).length}/{FISH_TYPES.length} species · press J or click away to close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
