"use client";

import { useEffect, useRef, useCallback, useState } from "react";

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

function hashCoord(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return h ^ (h >> 16);
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
}

// Helper: is walkable surface "stone-like"?
function isStoneSurface(t: TileType): boolean {
  return t === TileType.Path || t === TileType.Bridge || t === TileType.Garden || t === TileType.YellowBrick;
}

// ─── World Generation ───────────────────────────────────────────────────────

interface Chunk {
  cx: number;
  cy: number;
  tiles: TileType[][];
  solid: boolean[][];
}

function generateChunk(cx: number, cy: number): Chunk {
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

  return { cx, cy, tiles, solid };
}

// ─── House palette lookup ───────────────────────────────────────────────────

function getHousePalette(worldX: number, worldY: number) {
  const bx = Math.floor(worldX / 16);
  const by = Math.floor(worldY / 12);
  if (bx === ZOZI_BLOCK.bx && by === ZOZI_BLOCK.by) return ZOZI_PALETTE;
  const idx = Math.abs(hashCoord(bx * 11 + 5, by * 17 + 3)) % HOUSE_PALETTES.length;
  return HOUSE_PALETTES[idx];
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

    const notes = [220, 246.94, 293.66, 329.63, 392, 440, 493.88, 587.33];
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const duration = 1.5 + Math.random() * 3;

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

    const nextDelay = (1 + Math.random() * 4) * 1000;
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

  stop() {
    this.isPlaying = false;
    if (this.noteTimeout) clearTimeout(this.noteTimeout);
    if (this.droneOsc) { this.droneOsc.stop(); this.droneOsc = null; }
    if (this.droneOsc2) { this.droneOsc2.stop(); this.droneOsc2 = null; }
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [cheatPaletteOpen, setCheatPaletteOpen] = useState(false);
  const [cheatIndex, setCheatIndex] = useState(0);
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

  const getChunk = useCallback((cx: number, cy: number): Chunk => {
    const key = `${cx},${cy}`;
    let chunk = chunksRef.current.get(key);
    if (!chunk) {
      chunk = generateChunk(cx, cy);
      chunksRef.current.set(key, chunk);
    }
    return chunk;
  }, []);

  const isSolid = useCallback(
    (worldX: number, worldY: number): boolean => {
      const key = `${Math.floor(worldX)},${Math.floor(worldY)}`;
      const ov = overlayRef.current.get(key);
      if (ov !== undefined) return ov.solid;
      const cx = Math.floor(worldX / CHUNK_SIZE);
      const cy = Math.floor(worldY / CHUNK_SIZE);
      const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = ((worldY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const chunk = getChunk(cx, cy);
      return chunk.solid[ly][lx];
    },
    [getChunk]
  );

  const getTileAt = useCallback(
    (worldX: number, worldY: number): TileType => {
      const key = `${Math.floor(worldX)},${Math.floor(worldY)}`;
      const ov = overlayRef.current.get(key);
      if (ov !== undefined) return ov.type;
      const cx = Math.floor(worldX / CHUNK_SIZE);
      const cy = Math.floor(worldY / CHUNK_SIZE);
      const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = ((worldY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const chunk = getChunk(cx, cy);
      return chunk.tiles[ly][lx];
    },
    [getChunk]
  );

  const startGame = useCallback(async () => {
    if (started) return;
    setStarted(true);
    if (!audioRef.current) {
      audioRef.current = new ZenAudio();
    }
    await audioRef.current.start();
  }, [started]);

  const CHEATS = [
    {
      label: "teleport to golden bamboo",
      action: () => {
        playerRef.current.x = GOLDEN_BAMBOO_POS.x + 0.5;
        playerRef.current.y = GOLDEN_BAMBOO_POS.y + 1.5;
        insideHouseRef.current = false;
      },
    },
    {
      label: "teleport to zozi's house",
      action: () => {
        playerRef.current.x = 87.5;
        playerRef.current.y = 69.5;
        insideHouseRef.current = false;
      },
    },
  ];

  // Input handling + keyboard start
  useEffect(() => {
    const moveKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d"]);
    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K: toggle cheat palette
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCheatPaletteOpen((prev) => {
          if (!prev) setCheatIndex(0);
          return !prev;
        });
        return;
      }
      // Escape: close cheat palette
      if (e.key === "Escape") {
        setCheatPaletteOpen(false);
        return;
      }
      if (cheatPaletteOpen) {
        // Arrow keys: navigate cheats
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setCheatIndex((i) => (i - 1 + CHEATS.length) % CHEATS.length);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setCheatIndex((i) => (i + 1) % CHEATS.length);
          return;
        }
        // Enter: execute selected cheat
        if (e.key === "Enter") {
          e.preventDefault();
          CHEATS[cheatIndex].action();
          setCheatPaletteOpen(false);
          return;
        }
        return;
      }
      keysRef.current.add(e.key);
      // Movement or Escape cancels fishing
      if ((moveKeys.has(e.key) || e.key === "Escape") && fishingStateRef.current !== "idle") {
        fishingStateRef.current = "idle";
      }
      // Start game on movement key press
      if (moveKeys.has(e.key) && !started) {
        startGame();
      }
      // Spacebar: pick up golden bamboo if nearby
      if (e.key === " " && started && !hasGoldenBambooRef.current && !insideHouseRef.current) {
        const px = playerRef.current.x, py = playerRef.current.y;
        const dist = Math.abs(px - GOLDEN_BAMBOO_POS.x - 0.5) + Math.abs(py - GOLDEN_BAMBOO_POS.y - 0.5);
        if (dist < 2) {
          hasGoldenBambooRef.current = true;
          pickupMsgRef.current = performance.now();
          overlayRef.current.delete(`${GOLDEN_BAMBOO_POS.x},${GOLDEN_BAMBOO_POS.y}`);
          revealZoziPath(overlayRef.current);
          zoziRevealedRef.current = true;
        }
      }
      // L key: toggle pulsating on nearby lanterns
      if ((e.key === "l" || e.key === "L") && started && !insideHouseRef.current) {
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
      // F key: fishing interaction
      if ((e.key === "f" || e.key === "F") && started && !insideHouseRef.current) {
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
      keysRef.current.delete(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [started, startGame, getTileAt, cheatPaletteOpen, cheatIndex, CHEATS]);

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
        if (fishingStateRef.current === "idle") {
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
          if (keys.has("f") || keys.has("F")) {
            fishingHoldRef.current += 16.67; // ~1 frame at 60fps
            if (fishingHoldRef.current >= fishingCaughtFishRef.current.holdTime) {
              fishingStateRef.current = "caught";
              fishingStartTimeRef.current = fsNow;
              audioRef.current?.playFishingSplash();
            }
          } else if (fsDelta > 1500) {
            // Missed the bite
            fishingStateRef.current = "idle";
          }
        } else if (fishingStateRef.current === "caught" && fsDelta > 3000) {
          fishingStateRef.current = "idle";
        }

        // Check house entry
        if (zoziRevealedRef.current) {
          const pk = `${Math.floor(playerRef.current.x)},${Math.floor(playerRef.current.y)}`;
          if (ZOZI_DOOR_KEYS.has(pk)) {
            savedPosRef.current = { x: playerRef.current.x, y: playerRef.current.y };
            insideHouseRef.current = true;
            playerRef.current.x = 5.5;
            playerRef.current.y = 8.5;
            dirRef.current = "up";
          }
        }

        // ── Petals ──
        if (Math.random() < 0.03) {
          petalsRef.current.push({
            x: playerRef.current.x + (Math.random() - 0.5) * 20,
            y: playerRef.current.y - 8 + Math.random() * 2,
            vx: -0.005 + Math.random() * 0.01,
            vy: 0.005 + Math.random() * 0.008,
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
        const tod = getTimeOfDay();
        ctx.fillStyle = tod.bg;
        ctx.fillRect(0, 0, w, h);

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

        // character
        const charScreenX = Math.floor(playerRef.current.x * SCALED_TILE - camX - 8 * SCALE);
        const charScreenY = Math.floor(playerRef.current.y * SCALED_TILE - camY - 8 * SCALE);
        drawCharacter(ctx, charScreenX, charScreenY, dirRef.current, frameRef.current, time, hasGoldenBambooRef.current, fishingStateRef.current);

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

        // bamboo indicator when held
        if (hasGoldenBambooRef.current) {
          ctx.fillStyle = "#ffd700";
          ctx.fillRect(w - 30, 10, 6, 20);
          ctx.fillStyle = "#d4a017";
          ctx.fillRect(w - 29, 10, 4, 20);
        }

        // petals
        ctx.fillStyle = COLORS.petal;
        for (const p of petalsRef.current) {
          const ppx = Math.floor(p.x * SCALED_TILE - camX);
          const ppy = Math.floor(p.y * SCALED_TILE - camY);
          const alpha = Math.min(1, p.life / 50);
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillRect(ppx, ppy, p.size * SCALE, p.size * SCALE * 0.6);
        }
        ctx.globalAlpha = 1;

        // time-of-day tint
        ctx.fillStyle = tod.tint;
        ctx.fillRect(0, 0, w, h);

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

        // vignette
        const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, `rgba(0,0,0,${tod.vignetteAlpha.toFixed(2)})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // dev coordinates
        if (process.env.NODE_ENV === "development") {
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
  }, [started, getChunk, isSolid, getTileAt]);

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
      {cheatPaletteOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "20vh",
            zIndex: 100,
          }}
          onClick={() => setCheatPaletteOpen(false)}
        >
          <div
            style={{
              background: "#1a1a2e",
              border: "1px solid #333",
              borderRadius: 8,
              padding: 8,
              minWidth: 260,
              fontFamily: "monospace",
              fontSize: 13,
              color: "#e0d8c8",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "4px 8px", opacity: 0.5, fontSize: 11 }}>cheats</div>
            {CHEATS.map((cheat, i) => (
              <button
                key={i}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  background: i === cheatIndex ? "#2a2a4e" : "transparent",
                  border: "none",
                  color: i === cheatIndex ? "#ffd700" : "#e0d8c8",
                  fontFamily: "monospace",
                  fontSize: 13,
                  cursor: "pointer",
                  borderRadius: 4,
                }}
                onMouseEnter={() => setCheatIndex(i)}
                onClick={() => {
                  cheat.action();
                  setCheatPaletteOpen(false);
                }}
              >
                {cheat.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
