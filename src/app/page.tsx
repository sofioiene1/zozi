"use client";

import { useEffect, useRef, useCallback, useState } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const TILE = 16;
const SCALE = 3;
const SCALED_TILE = TILE * SCALE;
const CHUNK_SIZE = 16; // tiles per chunk
const RENDER_DISTANCE = 3; // chunks around player

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
  wallBase: "#d4c4a0",
  wallDark: "#b8a888",
  wallLight: "#e8dcc0",
  roofDark: "#6b2d2d",
  roofMid: "#8b3d3d",
  roofLight: "#a04848",
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

  // fill with grass
  for (let y = 0; y < CHUNK_SIZE; y++) {
    tiles[y] = [];
    solid[y] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      tiles[y][x] = TileType.Grass;
      solid[y][x] = false;
    }
  }

  // world-space coords for this chunk's top-left
  const wx = cx * CHUNK_SIZE;
  const wy = cy * CHUNK_SIZE;

  // roads: every 8 tiles in world space there's a path
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = wx + x;
      const worldY = wy + y;
      // horizontal roads every 12 tiles, 2 tiles wide
      if (((worldY % 12) + 12) % 12 < 2) {
        tiles[y][x] = TileType.Path;
      }
      // vertical roads every 16 tiles, 2 tiles wide
      if (((worldX % 16) + 16) % 16 < 2) {
        tiles[y][x] = TileType.Path;
      }
    }
  }

  // water canals: every 48 tiles there's a 3-wide canal
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
      // bridge over canal where vertical roads cross
      if (modY >= 22 && modY <= 24 && ((worldX % 16) + 16) % 16 < 2) {
        tiles[y][x] = TileType.Bridge;
        solid[y][x] = false;
      }
      // small ponds
      if (modX >= 38 && modX <= 40 && modY >= 8 && modY <= 10 && tiles[y][x] === TileType.Grass) {
        tiles[y][x] = TileType.Water;
        solid[y][x] = true;
      }
    }
  }

  // place houses in blocks between roads
  // blocks are 12 high (road gap) x 16 wide (road gap), houses go in the interior
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = wx + x;
      const worldY = wy + y;
      const blockX = ((worldX % 16) + 16) % 16;
      const blockY = ((worldY % 12) + 12) % 12;

      // skip if on road or water
      if (tiles[y][x] !== TileType.Grass) continue;

      // determine block hash for variety
      const bx = Math.floor(worldX / 16);
      const by = Math.floor(worldY / 12);
      const blockRng = seededRandom(hashCoord(bx * 7 + 3, by * 13 + 7));
      const blockType = blockRng(); // 0-1 determines what goes in this block

      if (blockType < 0.55) {
        // house block
        // house body: 4x3 area, positioned in center of block
        const houseStartX = 4;
        const houseEndX = 12;
        const houseStartY = 3;
        const houseEndY = 9;

        if (blockX >= houseStartX && blockX < houseEndX && blockY >= houseStartY && blockY < houseEndY) {
          const relX = blockX - houseStartX;
          const relY = blockY - houseStartY;
          const houseW = houseEndX - houseStartX;
          const houseH = houseEndY - houseStartY;

          // roof (top 2 rows)
          if (relY < 2) {
            tiles[y][x] = TileType.HouseRoof;
            solid[y][x] = true;
          }
          // wall
          else if (relY < houseH) {
            // door in center bottom
            if (relY === houseH - 1 && relX >= houseW / 2 - 1 && relX <= houseW / 2) {
              tiles[y][x] = TileType.HouseDoor;
              solid[y][x] = true;
            } else {
              tiles[y][x] = TileType.HouseWall;
              solid[y][x] = true;
            }
          }
        }

        // lanterns at corners of house
        if (blockX === 3 && blockY === 4) {
          tiles[y][x] = TileType.Lantern;
        }
        if (blockX === 12 && blockY === 4) {
          tiles[y][x] = TileType.Lantern;
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
        // cherry blossom trees
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
        // stone path through garden
        if (blockX >= 7 && blockX <= 8 && blockY >= 3 && blockY <= 9) {
          tiles[y][x] = TileType.Garden;
        }
        // bushes
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
        // stone path leading to torii
        if (blockX === 8 && blockY >= 3 && blockY <= 8) {
          tiles[y][x] = TileType.Garden;
        }
        // lanterns
        if (blockX === 6 && blockY === 6) {
          tiles[y][x] = TileType.Lantern;
        }
        if (blockX === 10 && blockY === 6) {
          tiles[y][x] = TileType.Lantern;
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
        // opening
        if (blockX >= 7 && blockX <= 9 && blockY === 9) {
          tiles[y][x] = TileType.Garden;
          solid[y][x] = false;
        }
      }
    }
  }

  // scatter some decorative elements
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

// ─── Tile Rendering ─────────────────────────────────────────────────────────

function drawTile(
  ctx: CanvasRenderingContext2D,
  type: TileType,
  sx: number,
  sy: number,
  worldX: number,
  worldY: number,
  time: number
) {
  const s = SCALE;
  const hash = hashCoord(worldX, worldY);
  const variant = Math.abs(hash) % 4;

  switch (type) {
    case TileType.Grass: {
      ctx.fillStyle = variant === 0 ? COLORS.grass1 : variant === 1 ? COLORS.grass2 : COLORS.grass3;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // little grass blades
      const grassRng = seededRandom(hash);
      ctx.fillStyle = COLORS.grass2;
      for (let i = 0; i < 3; i++) {
        const gx = Math.floor(grassRng() * 14) * s;
        const gy = Math.floor(grassRng() * 14) * s;
        ctx.fillRect(sx + gx, sy + gy, s, s * 2);
      }
      // occasional flower
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
      // path texture
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
      // animated waves
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
      ctx.fillStyle = COLORS.wallBase;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // wooden beam detail
      ctx.fillStyle = COLORS.woodDark;
      ctx.fillRect(sx, sy, s, SCALED_TILE); // left edge
      ctx.fillRect(sx + 15 * s, sy, s, SCALED_TILE); // right edge
      // window
      if (variant < 2) {
        ctx.fillStyle = COLORS.woodDark;
        ctx.fillRect(sx + 4 * s, sy + 4 * s, s * 8, s * 6);
        ctx.fillStyle = "#2a3a4a";
        ctx.fillRect(sx + 5 * s, sy + 5 * s, s * 6, s * 4);
        // warm light in window
        const glow = 0.5 + Math.sin(time * 0.001 + hash) * 0.2;
        ctx.fillStyle = `rgba(255, 200, 100, ${glow * 0.4})`;
        ctx.fillRect(sx + 5 * s, sy + 5 * s, s * 6, s * 4);
        // cross bar
        ctx.fillStyle = COLORS.wood;
        ctx.fillRect(sx + 7 * s, sy + 5 * s, s * 2, s * 4);
        ctx.fillRect(sx + 5 * s, sy + 6 * s, s * 6, s);
      }
      break;
    }

    case TileType.HouseRoof: {
      ctx.fillStyle = COLORS.roofDark;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // roof tiles pattern
      for (let ry = 0; ry < 16; ry += 3) {
        for (let rx = (ry % 6 === 0 ? 0 : 3); rx < 16; rx += 6) {
          ctx.fillStyle = COLORS.roofMid;
          ctx.fillRect(sx + rx * s, sy + ry * s, s * 5, s * 2);
          ctx.fillStyle = COLORS.roofLight;
          ctx.fillRect(sx + rx * s, sy + ry * s, s * 5, s);
        }
      }
      break;
    }

    case TileType.HouseDoor: {
      ctx.fillStyle = COLORS.wallBase;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // door
      ctx.fillStyle = COLORS.door;
      ctx.fillRect(sx + 3 * s, sy + 2 * s, s * 10, s * 14);
      // noren curtain
      ctx.fillStyle = "#2a4a7a";
      ctx.fillRect(sx + 3 * s, sy + 2 * s, s * 10, s * 6);
      ctx.fillStyle = "#e8dcc0";
      // curtain pattern
      ctx.fillRect(sx + 5 * s, sy + 3 * s, s * 2, s);
      ctx.fillRect(sx + 9 * s, sy + 3 * s, s * 2, s);
      // split in curtain
      ctx.fillStyle = COLORS.door;
      ctx.fillRect(sx + 7 * s, sy + 4 * s, s * 2, s * 4);
      break;
    }

    case TileType.TreeTrunk: {
      // draw grass underneath
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // trunk
      ctx.fillStyle = COLORS.trunkDark;
      ctx.fillRect(sx + 6 * s, sy, s * 4, SCALED_TILE);
      ctx.fillStyle = COLORS.trunk;
      ctx.fillRect(sx + 7 * s, sy, s * 2, SCALED_TILE);
      break;
    }

    case TileType.TreeCanopy: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // cherry blossom canopy
      ctx.fillStyle = COLORS.leaves1;
      ctx.fillRect(sx + s, sy + s, s * 14, s * 14);
      ctx.fillStyle = COLORS.leaves2;
      ctx.fillRect(sx + 2 * s, sy + 2 * s, s * 12, s * 10);
      ctx.fillStyle = COLORS.leaves3;
      ctx.fillRect(sx + 3 * s, sy + 3 * s, s * 8, s * 6);
      // petals
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
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // pole
      ctx.fillStyle = COLORS.lanternPole;
      ctx.fillRect(sx + 7 * s, sy + 6 * s, s * 2, s * 10);
      // lantern body
      ctx.fillStyle = COLORS.lanternBody;
      ctx.fillRect(sx + 5 * s, sy + 2 * s, s * 6, s * 5);
      // glow
      const glowI = 0.3 + Math.sin(time * 0.003 + hash * 0.1) * 0.15;
      ctx.fillStyle = `rgba(255, 100, 50, ${glowI})`;
      ctx.fillRect(sx + 3 * s, sy, s * 10, s * 9);
      // top
      ctx.fillStyle = COLORS.lanternPole;
      ctx.fillRect(sx + 4 * s, sy + s, s * 8, s);
      ctx.fillRect(sx + 4 * s, sy + 7 * s, s * 8, s);
      break;
    }

    case TileType.Bridge: {
      ctx.fillStyle = COLORS.wood;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // planks
      ctx.fillStyle = COLORS.woodDark;
      for (let py = 0; py < 16; py += 4) {
        ctx.fillRect(sx, sy + py * s, SCALED_TILE, s);
      }
      // railings
      ctx.fillStyle = COLORS.bridgeRail;
      ctx.fillRect(sx, sy, s * 2, SCALED_TILE);
      ctx.fillRect(sx + 14 * s, sy, s * 2, SCALED_TILE);
      break;
    }

    case TileType.Torii: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // pillars
      ctx.fillStyle = COLORS.toriRed;
      ctx.fillRect(sx + 5 * s, sy, s * 3, SCALED_TILE);
      // crossbar (top)
      ctx.fillStyle = COLORS.toriRedDark;
      ctx.fillRect(sx, sy, SCALED_TILE, s * 3);
      ctx.fillStyle = COLORS.toriRed;
      ctx.fillRect(sx, sy + s, SCALED_TILE, s * 2);
      // second crossbar
      ctx.fillRect(sx + 2 * s, sy + 5 * s, s * 12, s * 2);
      break;
    }

    case TileType.StoneWall: {
      ctx.fillStyle = COLORS.stone;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.stoneDark;
      // stone pattern
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
      // horizontal beams
      ctx.fillStyle = COLORS.fenceWood;
      ctx.fillRect(sx, sy + 4 * s, SCALED_TILE, s * 2);
      ctx.fillRect(sx, sy + 10 * s, SCALED_TILE, s * 2);
      // vertical post
      ctx.fillStyle = COLORS.woodDark;
      ctx.fillRect(sx + 6 * s, sy + 2 * s, s * 3, s * 12);
      break;
    }

    case TileType.Bamboo: {
      ctx.fillStyle = COLORS.grass1;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      // bamboo stalk
      ctx.fillStyle = COLORS.bamboo;
      ctx.fillRect(sx + 6 * s, sy, s * 3, SCALED_TILE);
      ctx.fillStyle = COLORS.bambooDark;
      ctx.fillRect(sx + 6 * s, sy + 5 * s, s * 3, s);
      ctx.fillRect(sx + 6 * s, sy + 11 * s, s * 3, s);
      // leaves
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
      // flowers on some bushes
      if ((hash & 3) === 0) {
        ctx.fillStyle = COLORS.flowerWhite;
        ctx.fillRect(sx + 5 * s, sy + 6 * s, s * 2, s * 2);
        ctx.fillRect(sx + 10 * s, sy + 7 * s, s * 2, s * 2);
      }
      break;
    }

    case TileType.Garden: {
      // stepping stones on grass
      ctx.fillStyle = COLORS.grass2;
      ctx.fillRect(sx, sy, SCALED_TILE, SCALED_TILE);
      ctx.fillStyle = COLORS.stone;
      ctx.fillRect(sx + 3 * s, sy + 3 * s, s * 4, s * 4);
      ctx.fillRect(sx + 9 * s, sy + 9 * s, s * 4, s * 4);
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
  _time: number
) {
  const s = SCALE;
  const f = frame % 4; // 4 frame walk cycle

  // offset for body bob
  const bob = f === 1 || f === 3 ? -s : 0;

  // ── BODY (simple kimono/yukata style) ──
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

  // kimono body
  ctx.fillStyle = "#3a4a6a";
  ctx.fillRect(sx + 4 * s, sy + 5 * s + bob, s * 8, s * 7);
  // kimono lighter inner
  ctx.fillStyle = "#4a5a7a";
  ctx.fillRect(sx + 6 * s, sy + 5 * s + bob, s * 4, s * 5);
  // obi (belt)
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
    // eyes
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
  // hat band
  ctx.fillStyle = "#8b3a3a";
  ctx.fillRect(sx + 2 * s, sy - s + bob, s * 12, s);
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

    // Drone - deep sustained pad
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.08;
    droneGain.connect(this.musicGain);

    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = "sine";
    this.droneOsc.frequency.value = 110; // A2
    this.droneOsc.connect(droneGain);
    this.droneOsc.start();

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = "sine";
    this.droneOsc2.frequency.value = 164.81; // E3
    this.droneOsc2.connect(droneGain);
    this.droneOsc2.start();

    // Start playing pentatonic melody
    this.playNextNote();
  }

  private playNextNote() {
    if (!this.isPlaying || !this.ctx || !this.musicGain) return;

    // Japanese pentatonic (in scale) - Miyako-bushi-ish
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

    // Sometimes add a harmonic
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

  playFootstep() {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    // Soft footstep sound
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Low pass filter for soft sound
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600 + Math.random() * 200;

    const stepGain = this.ctx.createGain();
    stepGain.gain.setValueAtTime(0.06 + Math.random() * 0.02, now);
    stepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    source.connect(filter);
    filter.connect(stepGain);
    stepGain.connect(this.masterGain);
    source.start(now);
  }

  stop() {
    this.isPlaying = false;
    if (this.noteTimeout) clearTimeout(this.noteTimeout);
    if (this.droneOsc) {
      this.droneOsc.stop();
      this.droneOsc = null;
    }
    if (this.droneOsc2) {
      this.droneOsc2.stop();
      this.droneOsc2 = null;
    }
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const audioRef = useRef<ZenAudio | null>(null);

  // Game state refs
  const playerRef = useRef({ x: 0.5, y: 0.5 }); // spawn on road intersection
  const dirRef = useRef<Direction>("down");
  const movingRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const chunksRef = useRef<Map<string, Chunk>>(new Map());
  const frameRef = useRef(0);
  const walkTimerRef = useRef(0);
  const petalsRef = useRef<Petal[]>([]);
  const lastStepRef = useRef(0);

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
      const cx = Math.floor(worldX / CHUNK_SIZE);
      const cy = Math.floor(worldY / CHUNK_SIZE);
      const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = ((worldY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const chunk = getChunk(cx, cy);
      return chunk.solid[ly][lx];
    },
    [getChunk]
  );

  const startGame = useCallback(async () => {
    setStarted(true);
    if (!audioRef.current) {
      audioRef.current = new ZenAudio();
    }
    await audioRef.current.start();
  }, []);

  // Input handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
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
  }, []);

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

      if (movingRef.current) {
        // normalize diagonal
        if (dx !== 0 && dy !== 0) {
          dx *= 0.707;
          dy *= 0.707;
        }
        const nx = playerRef.current.x + dx * MOVE_SPEED;
        const ny = playerRef.current.y + dy * MOVE_SPEED;

        // AABB collision - player hitbox is ~0.3 tile radius from center
        const R = 0.3;
        const px = playerRef.current.x;
        const py = playerRef.current.y;

        // Try Y movement (keep current X)
        const canMoveY = !isSolid(Math.floor(px - R), Math.floor(ny - R)) &&
          !isSolid(Math.floor(px + R), Math.floor(ny - R)) &&
          !isSolid(Math.floor(px - R), Math.floor(ny + R)) &&
          !isSolid(Math.floor(px + R), Math.floor(ny + R));
        if (canMoveY) playerRef.current.y = ny;

        // Try X movement (use updated Y)
        const fy = playerRef.current.y;
        const canMoveX = !isSolid(Math.floor(nx - R), Math.floor(fy - R)) &&
          !isSolid(Math.floor(nx + R), Math.floor(fy - R)) &&
          !isSolid(Math.floor(nx - R), Math.floor(fy + R)) &&
          !isSolid(Math.floor(nx + R), Math.floor(fy + R));
        if (canMoveX) playerRef.current.x = nx;

        // walk animation
        walkTimerRef.current += 1;
        if (walkTimerRef.current >= 8) {
          walkTimerRef.current = 0;
          frameRef.current += 1;
        }

        // footsteps
        if (time - lastStepRef.current > 280) {
          lastStepRef.current = time;
          audioRef.current?.playFootstep();
        }
      } else {
        walkTimerRef.current = 0;
        frameRef.current = 0;
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

      // ── Render ──
      ctx.imageSmoothingEnabled = false;

      // camera centered on player
      const camX = playerRef.current.x * SCALED_TILE - w / 2;
      const camY = playerRef.current.y * SCALED_TILE - h / 2;

      // clear
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, w, h);

      // determine visible tile range
      const startTileX = Math.floor(camX / SCALED_TILE) - 1;
      const startTileY = Math.floor(camY / SCALED_TILE) - 1;
      const endTileX = Math.ceil((camX + w) / SCALED_TILE) + 1;
      const endTileY = Math.ceil((camY + h) / SCALED_TILE) + 1;

      // render tiles
      for (let ty = startTileY; ty <= endTileY; ty++) {
        for (let tx = startTileX; tx <= endTileX; tx++) {
          const cx = Math.floor(tx / CHUNK_SIZE);
          const cy = Math.floor(ty / CHUNK_SIZE);
          const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const chunk = getChunk(cx, cy);
          const screenX = Math.floor(tx * SCALED_TILE - camX);
          const screenY = Math.floor(ty * SCALED_TILE - camY);
          drawTile(ctx, chunk.tiles[ly][lx], screenX, screenY, tx, ty, time);
        }
      }

      // render character
      const charScreenX = Math.floor(playerRef.current.x * SCALED_TILE - camX - 8 * SCALE);
      const charScreenY = Math.floor(playerRef.current.y * SCALED_TILE - camY - 8 * SCALE);
      drawCharacter(ctx, charScreenX, charScreenY, dirRef.current, frameRef.current, time);

      // render petals
      ctx.fillStyle = COLORS.petal;
      for (const p of petalsRef.current) {
        const px = Math.floor(p.x * SCALED_TILE - camX);
        const py = Math.floor(p.y * SCALED_TILE - camY);
        const alpha = Math.min(1, p.life / 50);
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillRect(px, py, p.size * SCALE, p.size * SCALE * 0.6);
      }
      ctx.globalAlpha = 1;

      // vignette overlay
      const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    };

    animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
    };
  }, [started, getChunk, isSolid]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.stop();
    };
  }, []);

  if (!started) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen bg-[#1a1a2e] cursor-pointer"
        onClick={startGame}
      >
        <div className="text-center">
          <h1
            className="text-6xl mb-4 tracking-widest"
            style={{
              color: "#d4b878",
              fontFamily: "serif",
              textShadow: "0 0 40px rgba(212,184,120,0.3)",
            }}
          >
            ZOZI
          </h1>
          <p className="text-[#8a8a7a] text-sm tracking-[0.3em] mb-2">
            A PEACEFUL WALK
          </p>
          <div className="mt-12 text-[#6a6a5a] text-xs tracking-wider animate-pulse">
            click anywhere to begin
          </div>
          <div className="mt-6 text-[#4a4a4a] text-xs tracking-wider">
            arrow keys or WASD to walk
          </div>
        </div>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="block w-screen h-screen" />;
}
