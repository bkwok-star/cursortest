import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { World } from '../src/world';
import {
  parseCommand,
  tryGo,
  formatRoomOutput,
  getHelpText,
  formatInventory,
  formatShopList,
} from '../src/gameLogic';
import { initiateCombat } from '../src/combat';
import { calculatePlayerStats, regenerateStats, xpToNextLevel } from '../src/stats';
import { getNPCsInRoom, getNPCByName } from '../src/npcs';
import { handleAdminCommand, createMonsterFromTemplate, getRandomMonsterTemplate } from '../src/admin';
import {
  EquipmentSlot,
  ItemType,
  ClassType,
  type Item,
} from '../src/types';
import {
  getClassStats,
  getSkillByName,
  getSkillById,
  getSkillLearnedAtLevel,
  getStartingSkillId,
} from '../src/skills';
import { ensureDataDir, savePlayer, loadPlayer, type SavedPlayerData } from '../src/persistence';

const app = express();
const httpServer = createServer(app);

// Serve static files from public folder (project root/public)
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// World engine (shared)
const world = new World();

const START_ROOM_ID = 'town-square';

/** Default regen (class stats override HP/Stamina/Energy/Attack) */
const DEFAULT_REGEN_RATE = 5;
const REGEN_TICK_MS = 5000;

/** Per-socket player state (mutable) */
const playerState = new Map<
  string,
  {
    hp: number;
    maxHp: number;
    attack: number;
    isAlive: boolean;
    stamina: number;
    maxStamina: number;
    energy: number;
    maxEnergy: number;
    regenRate: number;
    level: number;
    xp: number;
    godMode: boolean;
    class: ClassType;
    skills: string[];
  }
>();

/** Per-socket combat stop function (clear interval when combat ends or on disconnect) */
const combatStop = new Map<string, () => void>();

/** Per-socket equipment: slot -> item id (item stays in inventory, this marks it as equipped) */
const equipment = new Map<string, Partial<Record<EquipmentSlot, string>>>();

/** Per-socket gold */
const gold = new Map<string, number>();

/** Per-socket completed quest IDs (no repeat rewards) */
const completedQuests = new Map<string, string[]>();

/** Per-socket kill count: monster id -> number killed */
const killCount = new Map<string, Map<string, number>>();

/** Per-socket per-NPC dialogue index (for cycling) */
const talkIndex = new Map<string, Map<string, number>>();

/** Socket IDs that have admin (first player + /admin grants) */
const adminSet = new Set<string>();

/** Current combat monster id per socket (for use/cast skill target) */
const currentCombatMonsterId = new Map<string, string>();

/** Skill cooldown end timestamp per socket per skill id */
const skillCooldowns = new Map<string, Map<string, number>>();

/** Connection state: LOGIN (awaiting name) or PLAYING */
const connectionState = new Map<string, 'LOGIN' | 'PLAYING'>();

/** Character name per socket (set when entering PLAYING) */
const playerName = new Map<string, string>();

const AUTOSAVE_INTERVAL_MS = 60_000;

function send(socket: import('socket.io').Socket, text: string): void {
  socket.emit('message', text);
}

/** Build save snapshot for a connected playing character; null if not playing or no name */
function buildSnapshot(socketId: string): SavedPlayerData | null {
  const name = playerName.get(socketId);
  if (connectionState.get(socketId) !== 'PLAYING' || !name) return null;
  const state = playerState.get(socketId);
  const roomId = currentRoom.get(socketId);
  if (!state || !roomId) return null;
  const inv = world.getItemsHeldBy(socketId);
  const equip = equipment.get(socketId) ?? {};
  const kc = killCount.get(socketId);
  const killCountObj: Record<string, number> = {};
  if (kc) for (const [k, v] of kc) killCountObj[k] = v;
  return {
    name,
    currentRoomId: roomId,
    inventoryItemIds: inv.map((i) => i.id),
    equipment: { ...equip },
    gold: gold.get(socketId) ?? 0,
    completedQuests: [...(completedQuests.get(socketId) ?? [])],
    killCount: killCountObj,
    hp: state.hp,
    maxHp: state.maxHp,
    stamina: state.stamina,
    maxStamina: state.maxStamina,
    energy: state.energy,
    maxEnergy: state.maxEnergy,
    regenRate: state.regenRate,
    level: state.level,
    xp: state.xp,
    godMode: state.godMode,
    class: state.class,
    skills: [...state.skills],
    attack: state.attack,
    isAlive: state.isAlive,
    isAdmin: true,
  };
}

/** Apply loaded snapshot to server state and world for this socket */
function applySnapshot(socketId: string, data: SavedPlayerData): void {
  playerName.set(socketId, data.name);
  connectionState.set(socketId, 'PLAYING');
  currentRoom.set(socketId, data.currentRoomId);
  playerState.set(socketId, {
    hp: data.hp,
    maxHp: data.maxHp,
    stamina: data.stamina,
    maxStamina: data.maxStamina,
    energy: data.energy,
    maxEnergy: data.maxEnergy,
    regenRate: data.regenRate,
    level: data.level,
    xp: data.xp,
    godMode: data.godMode,
    class: data.class,
    skills: [...data.skills],
    attack: data.attack,
    isAlive: data.isAlive,
  });
  gold.set(socketId, data.gold);
  completedQuests.set(socketId, [...data.completedQuests]);
  const kc = new Map<string, number>();
  for (const [k, v] of Object.entries(data.killCount)) kc.set(k, v);
  killCount.set(socketId, kc);
  equipment.set(socketId, { ...data.equipment } as Partial<Record<EquipmentSlot, string>>);
  talkIndex.set(socketId, new Map());
  for (const itemId of data.inventoryItemIds) {
    world.moveItemToHolder(itemId, socketId);
  }
}

function getEquippedItems(socketId: string): Item[] {
  const map = equipment.get(socketId);
  if (!map) return [];
  const out: Item[] = [];
  for (const id of Object.values(map)) {
    if (id) {
      const item = world.getItem(id);
      if (item) out.push(item);
    }
  }
  return out;
}

/** Base stats from class + level scaling (level 1 = class base, each level +5% hp/stam/energy, +2 attack) */
function baseStatsForClassAndLevel(classType: ClassType, level: number): { maxHp: number; maxStamina: number; maxEnergy: number; attack: number } {
  const base = getClassStats(classType);
  const scale = 1 + (level - 1) * 0.05;
  return {
    maxHp: Math.floor(base.maxHp * scale) + (level - 1) * 5,
    maxStamina: Math.floor(base.maxStamina * scale) + (level - 1) * 3,
    maxEnergy: Math.floor(base.maxEnergy * scale) + (level - 1) * 3,
    attack: base.attack + (level - 1) * 2,
  };
}

function recalcStats(socketId: string): void {
  const state = playerState.get(socketId);
  if (!state) return;
  const equipped = getEquippedItems(socketId);
  const base = baseStatsForClassAndLevel(state.class, state.level);
  const resolved = calculatePlayerStats(base.maxHp, base.attack, equipped);
  state.maxHp = resolved.maxHp;
  state.maxStamina = base.maxStamina;
  state.maxEnergy = base.maxEnergy;
  state.attack = resolved.attack;
  state.hp = Math.min(state.hp, state.maxHp);
  state.stamina = Math.min(state.stamina, state.maxStamina);
  state.energy = Math.min(state.energy, state.maxEnergy);
}

/** Grant the skill for this level if the class learns one; returns the skill name if granted */
function grantSkillForLevel(socketId: string, level: number): string | null {
  const state = playerState.get(socketId);
  if (!state) return null;
  const skillId = getSkillLearnedAtLevel(level, state.class);
  if (!skillId || state.skills.includes(skillId)) return null;
  state.skills.push(skillId);
  const skill = getSkillById(skillId);
  return skill?.name ?? null;
}

/** Shared victory logic when a monster is killed (combat tick or skill) */
function handleMonsterKilled(
  socket: import('socket.io').Socket,
  roomId: string,
  monster: import('../src/types').Monster,
  state: NonNullable<ReturnType<typeof playerState.get>>
): void {
  const stop = combatStop.get(socket.id);
  if (stop) stop();
  combatStop.delete(socket.id);
  currentCombatMonsterId.delete(socket.id);
  const kc = killCount.get(socket.id);
  if (kc) kc.set(monster.id, (kc.get(monster.id) ?? 0) + 1);
  world.tryDropLoot(roomId, monster);
  world.removeMonsterFromRoom(roomId, monster.id);
  send(socket, `Victory! ${monster.name} is defeated.`);

  const xpAmount = monster.xpReward ?? monster.maxHp + monster.attack * 2;
  if (xpAmount > 0) {
    state.xp += xpAmount;
    send(socket, `You gain ${xpAmount} XP!`);
    while (state.xp >= state.level * 100) {
      state.xp -= state.level * 100;
      state.level++;
      recalcStats(socket.id);
      send(socket, `You level up! You are now level ${state.level}.`);
      const learned = grantSkillForLevel(socket.id, state.level);
      if (learned) send(socket, `You learn: ${learned}!`);
    }
    emitUpdateStats(socket);
  }
}

const ALL_SLOTS: EquipmentSlot[] = [
  EquipmentSlot.HEAD,
  EquipmentSlot.BODY,
  EquipmentSlot.WEAPON,
  EquipmentSlot.SHIELD,
];

function emitUpdateStats(socket: import('socket.io').Socket): void {
  const state = playerState.get(socket.id);
  const inv = world.getItemsHeldBy(socket.id);
  const equipMap = equipment.get(socket.id) ?? {};
  const equipmentList: Record<string, { name: string } | null> = {};
  for (const slot of ALL_SLOTS) {
    const id = equipMap[slot];
    const item = id ? world.getItem(id) : undefined;
    equipmentList[slot] = item ? { name: item.name } : null;
  }
  socket.emit('updateStats', {
    hp: state?.hp ?? 0,
    maxHp: state?.maxHp ?? 0,
    stamina: state?.stamina ?? 0,
    maxStamina: state?.maxStamina ?? 0,
    energy: state?.energy ?? 0,
    maxEnergy: state?.maxEnergy ?? 0,
    attack: state?.attack ?? 0,
    gold: gold.get(socket.id) ?? 0,
    level: state?.level ?? 1,
    xp: state?.xp ?? 0,
    xpToNextLevel: state ? xpToNextLevel(state.level) : 100,
    class: state?.class ?? ClassType.WARRIOR,
    skills: (state?.skills ?? []).map((id) => getSkillById(id)?.name ?? id),
    inventory: inv.map((i) => ({ id: i.id, name: i.name })),
    equipment: equipmentList,
  });
}

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

// Per-socket state: current room ID
const currentRoom = new Map<string, string>();

/** Get all socket IDs that are in the given room */
function getSocketIdsInRoom(roomId: string): string[] {
  const ids: string[] = [];
  for (const [socketId, rId] of currentRoom) {
    if (rId === roomId) ids.push(socketId);
  }
  return ids;
}

/** Broadcast a message to every player in the given room (including sender) */
function broadcastToRoom(roomId: string, text: string): void {
  const socketIds = getSocketIdsInRoom(roomId);
  for (const id of socketIds) {
    const s = io.sockets.sockets.get(id);
    if (s) s.emit('message', text);
  }
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  connectionState.set(socket.id, 'LOGIN');
  send(socket, 'Welcome to the MUD. Please enter your character name:');

  socket.on('command', async (line: string) => {
    const raw = (line ?? '').trim();

    if (connectionState.get(socket.id) === 'LOGIN') {
      const name = raw || 'Hero';
      const result = await loadPlayer(name);
      if (result) {
        applySnapshot(socket.id, result.data);
        adminSet.add(socket.id);
        send(socket, `Welcome back, ${result.data.name}. Profile loaded.`);
      } else {
        send(socket, `Welcome, ${name}. A new legend begins.`);
        playerName.set(socket.id, name);
        adminSet.add(socket.id);
        connectionState.set(socket.id, 'PLAYING');
        currentRoom.set(socket.id, START_ROOM_ID);
        const startClassStats = getClassStats(ClassType.WARRIOR);
        const startSkillId = getStartingSkillId(ClassType.WARRIOR);
        playerState.set(socket.id, {
          hp: startClassStats.maxHp,
          maxHp: startClassStats.maxHp,
          attack: startClassStats.attack,
          isAlive: true,
          stamina: startClassStats.maxStamina,
          maxStamina: startClassStats.maxStamina,
          energy: startClassStats.maxEnergy,
          maxEnergy: startClassStats.maxEnergy,
          regenRate: DEFAULT_REGEN_RATE,
          level: 1,
          xp: 0,
          godMode: false,
          class: ClassType.WARRIOR,
          skills: startSkillId ? [startSkillId] : [],
        });
        gold.set(socket.id, 0);
        completedQuests.set(socket.id, []);
        killCount.set(socket.id, new Map());
        talkIndex.set(socket.id, new Map());
        equipment.set(socket.id, {});
        const snapshot = buildSnapshot(socket.id);
        if (snapshot) await savePlayer(snapshot);
        send(socket, `Character "${name}" created. Have fun!`);
      }
      const roomId = currentRoom.get(socket.id)!;
      const room = world.getRoom(roomId);
      if (room) {
        const monsters = room.monsters?.filter((m) => m.isAlive) ?? [];
        const npcs = getNPCsInRoom(room.id);
        send(socket, formatRoomOutput(room, world.getItemsInRoom(room.id), monsters, npcs));
      }
      const state = playerState.get(socket.id);
      if (state) {
        socket.emit('hp', { current: state.hp, max: state.maxHp });
        socket.emit('stamina', { current: state.stamina, max: state.maxStamina });
        socket.emit('energy', { current: state.energy, max: state.maxEnergy });
      }
      emitUpdateStats(socket);
      return;
    }

    if (connectionState.get(socket.id) !== 'PLAYING') return;

    if (raw.startsWith('/')) {
      const msg = handleAdminCommand(socket.id, raw, {
        world,
        currentRoom,
        playerState,
        gold,
        adminSet,
        send,
        socket,
        recalcStats,
        emitUpdateStats,
        onTeleport: (sid, roomId) => {
          const room = world.getRoom(roomId);
          if (!room) return;
          const s = io.sockets.sockets.get(sid);
          if (s) {
            const monsters = room.monsters?.filter((m) => m.isAlive) ?? [];
            const npcs = getNPCsInRoom(room.id);
            send(s, formatRoomOutput(room, world.getItemsInRoom(room.id), monsters, npcs));
          }
        },
        onLevelUp: (sid, level) => {
          const name = grantSkillForLevel(sid, level);
          if (name) {
            const s = io.sockets.sockets.get(sid);
            if (s) send(s, `You learn: ${name}!`);
          }
          const s = io.sockets.sockets.get(sid);
          if (s) emitUpdateStats(s);
        },
      });
      if (msg !== null) send(socket, msg);
      else send(socket, 'Unknown admin command or access denied. Try /help');
      return;
    }

    const parsed = parseCommand(line ?? '');

    const roomId = currentRoom.get(socket.id) ?? START_ROOM_ID;

    switch (parsed.command) {
      case 'look': {
        const room = world.getRoom(roomId);
        if (!room) {
          send(socket, "You are nowhere. (Room data missing.)");
          return;
        }
        const monsters = room.monsters?.filter((m) => m.isAlive) ?? [];
        const npcs = getNPCsInRoom(room.id);
        send(socket, formatRoomOutput(room, world.getItemsInRoom(room.id), monsters, npcs));
        return;
      }

      case 'go': {
        const result = tryGo(world, roomId, parsed.direction);
        if (result.success) {
          currentRoom.set(socket.id, result.room.id);
          const monsters = result.room.monsters?.filter((m) => m.isAlive) ?? [];
          const npcs = getNPCsInRoom(result.room.id);
          send(socket, formatRoomOutput(result.room, world.getItemsInRoom(result.room.id), monsters, npcs));
        } else {
          send(socket, result.error);
        }
        return;
      }

      case 'say': {
        const room = world.getRoom(roomId);
        const roomName = room?.name ?? 'Nowhere';
        const msg = `[${roomName}] Someone says: ${parsed.message}`;
        broadcastToRoom(roomId, msg);
        return;
      }

      case 'help':
        send(socket, getHelpText());
        return;

      case 'get': {
        const room = world.getRoom(roomId);
        if (!room) {
          send(socket, "You are nowhere.");
          return;
        }
        const roomItems = world.getItemsInRoom(roomId);
        const name = parsed.itemName.toLowerCase();
        const item = roomItems.find((i) => i.name.toLowerCase().includes(name) || name.includes(i.name.toLowerCase()));
        if (!item) {
          send(socket, "You don't see that here.");
          return;
        }
        world.moveItemToHolder(item.id, socket.id);
        send(socket, `You take the ${item.name}.`);
        recalcStats(socket.id);
        emitUpdateStats(socket);
        return;
      }

      case 'drop': {
        const inv = world.getItemsHeldBy(socket.id);
        const name = parsed.itemName.toLowerCase();
        const item = inv.find((i) => i.name.toLowerCase().includes(name) || name.includes(i.name.toLowerCase()));
        if (!item) {
          send(socket, "You don't have that.");
          return;
        }
        const equipMap = equipment.get(socket.id);
        const inSlot = equipMap && Object.entries(equipMap).find(([, id]) => id === item.id);
        if (inSlot) {
          (equipMap as Record<string, string | undefined>)[inSlot[0]] = undefined;
        }
        world.moveItemToRoom(item.id, roomId);
        send(socket, `You drop the ${item.name}.`);
        recalcStats(socket.id);
        emitUpdateStats(socket);
        return;
      }

      case 'inventory':
        send(socket, formatInventory(world.getItemsHeldBy(socket.id)));
        return;

      case 'save': {
        const snapshot = buildSnapshot(socket.id);
        if (!snapshot) {
          send(socket, "You are not in a game.");
          return;
        }
        try {
          await savePlayer(snapshot);
          send(socket, 'Game saved successfully.');
        } catch (err) {
          console.error('Save failed:', err);
          send(socket, 'Save failed. Try again.');
        }
        return;
      }

      case 'equip': {
        const inv = world.getItemsHeldBy(socket.id);
        const name = parsed.itemName.toLowerCase();
        const item = inv.find((i) => i.name.toLowerCase().includes(name) || name.includes(i.name.toLowerCase()));
        if (!item) {
          send(socket, "You don't have that.");
          return;
        }
        if (item.type !== ItemType.EQUIPMENT || !item.slot) {
          send(socket, `You can't equip the ${item.name}.`);
          return;
        }
        let equipMap = equipment.get(socket.id);
        if (!equipMap) {
          equipMap = {};
          equipment.set(socket.id, equipMap);
        }
        equipMap[item.slot] = item.id;
        send(socket, `You equip the ${item.name}.`);
        recalcStats(socket.id);
        emitUpdateStats(socket);
        return;
      }

      case 'unequip': {
        const raw = parsed.slotOrItem.toLowerCase();
        const equipMap = equipment.get(socket.id);
        if (!equipMap) {
          send(socket, "You have nothing equipped.");
          return;
        }
        const slotMatch = ALL_SLOTS.find((s) => s.toLowerCase() === raw);
        if (slotMatch && equipMap[slotMatch]) {
          equipMap[slotMatch] = undefined;
          recalcStats(socket.id);
          emitUpdateStats(socket);
          send(socket, `You unequip your ${slotMatch.toLowerCase()} slot.`);
          return;
        }
        const inv = world.getItemsHeldBy(socket.id);
        const item = inv.find((i) => i.name.toLowerCase().includes(raw) || raw.includes(i.name.toLowerCase()));
        if (!item) {
          send(socket, "You don't have that, or it's not equipped.");
          return;
        }
        if (!item.slot || equipMap[item.slot] !== item.id) {
          send(socket, "That isn't equipped.");
          return;
        }
        equipMap[item.slot] = undefined;
        send(socket, `You unequip the ${item.name}.`);
        recalcStats(socket.id);
        emitUpdateStats(socket);
        return;
      }

      case 'lever': {
        if (roomId !== 'arena') {
          send(socket, "There's no lever here.");
          return;
        }
        const { key, monster: template } = getRandomMonsterTemplate();
        const monster = createMonsterFromTemplate(key);
        if (!monster) {
          send(socket, "The lever jams. Nothing happens.");
          return;
        }
        world.addMonsterToRoom('arena', monster);
        send(socket, `You pull the lever. A ${monster.name} appears!`);
        return;
      }

      case 'use': {
        const skillName = parsed.skillName;
        const stateForSkill = playerState.get(socket.id);
        if (!stateForSkill || !stateForSkill.isAlive) {
          send(socket, "You're in no condition to fight.");
          return;
        }
        if (!combatStop.has(socket.id) || !currentCombatMonsterId.has(socket.id)) {
          send(socket, "You're not in combat.");
          return;
        }
        const monsterId = currentCombatMonsterId.get(socket.id);
        const roomForSkill = world.getRoom(roomId);
        const monster = roomForSkill?.monsters?.find((m) => m.id === monsterId && m.isAlive);
        if (!monster) {
          send(socket, "Your target is gone.");
          return;
        }
        const skill = getSkillByName(skillName);
        if (!skill) {
          send(socket, `Unknown skill. Type "use" or "cast" and the skill name (e.g. use heavy strike).`);
          return;
        }
        if (!stateForSkill.skills.includes(skill.id)) {
          send(socket, `You haven't learned ${skill.name}.`);
          return;
        }
        const cdMap = skillCooldowns.get(socket.id) ?? new Map();
        if (!skillCooldowns.has(socket.id)) skillCooldowns.set(socket.id, cdMap);
        const cdEnd = cdMap.get(skill.id) ?? 0;
        if (Date.now() < cdEnd) {
          send(socket, `${skill.name} is on cooldown.`);
          return;
        }
        const cost = skill.cost;
        if (skill.costType === 'stamina' && stateForSkill.stamina < cost) {
          send(socket, `Not enough Stamina (need ${cost}).`);
          return;
        }
        if (skill.costType === 'energy' && stateForSkill.energy < cost) {
          send(socket, `Not enough Energy (need ${cost}).`);
          return;
        }
        if (skill.costType === 'stamina') stateForSkill.stamina -= cost;
        else stateForSkill.energy -= cost;

        if (skill.healAmount != null) {
          stateForSkill.hp = Math.min(stateForSkill.maxHp, stateForSkill.hp + skill.healAmount);
          socket.emit('hp', { current: stateForSkill.hp, max: stateForSkill.maxHp });
          socket.emit('combat-deal', `You heal yourself for ${skill.healAmount} HP!`);
        } else {
          const dmg = Math.max(1, Math.floor(stateForSkill.attack * (skill.damageMultiplier ?? 1)) + (skill.flatDamage ?? 0));
          monster.hp = Math.max(0, monster.hp - dmg);
          socket.emit('combat-deal', `You use ${skill.name}! ${monster.name} takes ${dmg} damage!`);
          if (monster.hp <= 0) {
            monster.isAlive = false;
            handleMonsterKilled(socket, roomId, monster, stateForSkill);
          }
        }
        cdMap.set(skill.id, Date.now() + skill.cooldownMs);
        socket.emit('stamina', { current: stateForSkill.stamina, max: stateForSkill.maxStamina });
        socket.emit('energy', { current: stateForSkill.energy, max: stateForSkill.maxEnergy });
        emitUpdateStats(socket);
        return;
      }

      case 'attack': {
        if (combatStop.has(socket.id)) {
          send(socket, "You're already in combat!");
          return;
        }
        recalcStats(socket.id);
        const state = playerState.get(socket.id);
        if (!state || !state.isAlive) {
          send(socket, "You're in no condition to fight.");
          return;
        }
        const room = world.getRoom(roomId);
        if (!room) {
          send(socket, "You are nowhere.");
          return;
        }
        const target = parsed.target.trim().toLowerCase();
        const monster = target
          ? room.monsters?.find(
              (m) => m.isAlive && m.name.toLowerCase().includes(target)
            )
          : room.monsters?.find((m) => m.isAlive);
        if (!monster) {
          send(
            socket,
            target
              ? "You don't see any such creature here."
              : "There's nothing to fight here."
          );
          return;
        }
        send(socket, `Combat with ${monster.name}!`);
        currentCombatMonsterId.set(socket.id, monster.id);
        const stop = initiateCombat({
          playerState: state,
          monster,
          emit: (msg) => send(socket, msg),
          emitDeal: (msg) => socket.emit('combat-deal', msg),
          emitTake: (msg) => socket.emit('combat-take', msg),
          onHpChange: (hp, max) => socket.emit('hp', { current: hp, max }),
          godMode: state.godMode,
          onMonsterKilled: () => handleMonsterKilled(socket, roomId, monster, state),
          onPlayerDeath: () => {
            combatStop.delete(socket.id);
            currentCombatMonsterId.delete(socket.id);
            state.hp = state.maxHp;
            state.isAlive = true;
            currentRoom.set(socket.id, START_ROOM_ID);
            socket.emit('hp', { current: state.hp, max: state.maxHp });
            emitUpdateStats(socket);
            send(socket, "You have died. You respawn at the Town Square.");
            const startRoom = world.getRoom(START_ROOM_ID);
            if (startRoom) {
              const monsters = startRoom.monsters?.filter((m) => m.isAlive) ?? [];
              const npcs = getNPCsInRoom(startRoom.id);
              send(socket, formatRoomOutput(startRoom, world.getItemsInRoom(startRoom.id), monsters, npcs));
            }
          },
        });
        combatStop.set(socket.id, stop);
        return;
      }

      case 'talk': {
        const npc = getNPCByName(roomId, parsed.npcName);
        if (!npc) {
          send(socket, "You don't see anyone like that here.");
          return;
        }
        const idxMap = talkIndex.get(socket.id);
        const idx = (idxMap?.get(npc.id) ?? 0) % npc.dialogue.length;
        send(socket, `${npc.name} says: "${npc.dialogue[idx]}"`);
        if (!idxMap) talkIndex.set(socket.id, new Map());
        talkIndex.get(socket.id)!.set(npc.id, idx + 1);

        if (npc.quest) {
          const done = completedQuests.get(socket.id) ?? [];
          if (done.includes(npc.quest.id)) {
            send(socket, `You already completed ${npc.quest.title}.`);
            return;
          }
          const goal = npc.quest.goalStructured;
          let completed = false;
          if (goal.type === 'kill') {
            const kc = killCount.get(socket.id)?.get(goal.target) ?? 0;
            if (kc >= goal.count) completed = true;
          } else {
            const inv = world.getItemsHeldBy(socket.id);
            const count = inv.filter((i) => i.name.toLowerCase().includes(goal.target.toLowerCase()) || goal.target.toLowerCase().includes(i.name.toLowerCase())).length;
            if (count >= goal.count) completed = true;
          }
          if (completed) {
            if (goal.type === 'collect') {
              const inv = world.getItemsHeldBy(socket.id);
              const toRemove = goal.count;
              let removed = 0;
              const equipMap = equipment.get(socket.id);
              for (const item of inv) {
                if (removed >= toRemove) break;
                if (item.name.toLowerCase().includes(goal.target.toLowerCase()) || goal.target.toLowerCase().includes(item.name.toLowerCase())) {
                  if (equipMap && item.slot && equipMap[item.slot] === item.id) equipMap[item.slot] = undefined;
                  world.removeItem(item.id);
                  removed++;
                }
              }
              if (removed > 0) recalcStats(socket.id);
            }
            const g = gold.get(socket.id) ?? 0;
            gold.set(socket.id, g + npc.quest.rewardGold);
            const cq = completedQuests.get(socket.id) ?? [];
            cq.push(npc.quest.id);
            completedQuests.set(socket.id, cq);
            send(socket, `Quest complete: ${npc.quest.title}! You receive ${npc.quest.rewardGold} gold.`);
            if (npc.quest.rewardItem) {
              const reward = world.getItemsInRoom('reward-pool').find((i) => i.id === npc.quest!.rewardItem) ?? world.getItem(npc.quest.rewardItem);
              if (reward) {
                world.moveItemToHolder(reward.id, socket.id);
                send(socket, `You receive: ${reward.name}.`);
              }
            }
            recalcStats(socket.id);
            emitUpdateStats(socket);
          } else {
            send(socket, `I have a task: "${npc.quest.title}". ${npc.quest.description} Goal: ${npc.quest.goal}. Reward: ${npc.quest.rewardGold} gold.`);
          }
        }
        return;
      }

      case 'list': {
        const npcs = getNPCsInRoom(roomId);
        const merchant = npcs.find((n) => n.shopInventory && n.shopInventory.length > 0);
        if (!merchant || !merchant.shopInventory) {
          send(socket, "No one here is selling anything.");
          return;
        }
        send(socket, formatShopList(merchant.shopInventory));
        return;
      }

      case 'buy': {
        const npcs = getNPCsInRoom(roomId);
        const merchant = npcs.find((n) => n.shopInventory && n.shopInventory.length > 0);
        if (!merchant || !merchant.shopInventory) {
          send(socket, "No merchant here.");
          return;
        }
        const entry = merchant.shopInventory.find((e) => e.itemName.toLowerCase().includes(parsed.itemName.toLowerCase()) || parsed.itemName.toLowerCase().includes(e.itemName.toLowerCase()));
        if (!entry) {
          send(socket, "They don't sell that.");
          return;
        }
        const item = world.getOneItemInShopPoolByName(entry.itemName);
        if (!item) {
          send(socket, `Sold out: ${entry.itemName}.`);
          return;
        }
        const g = gold.get(socket.id) ?? 0;
        if (g < entry.price) {
          send(socket, `You need ${entry.price} gold. You have ${g}.`);
          return;
        }
        gold.set(socket.id, g - entry.price);
        world.moveItemToHolder(item.id, socket.id);
        send(socket, `You buy ${item.name} for ${entry.price} gold.`);
        emitUpdateStats(socket);
        return;
      }

      case 'sell': {
        const npcs = getNPCsInRoom(roomId);
        const merchant = npcs.find((n) => n.shopInventory && n.shopInventory.length > 0);
        if (!merchant || !merchant.shopInventory) {
          send(socket, "No merchant here to sell to.");
          return;
        }
        const inv = world.getItemsHeldBy(socket.id);
        const name = parsed.itemName.toLowerCase();
        const item = inv.find((i) => i.name.toLowerCase().includes(name) || name.includes(i.name.toLowerCase()));
        if (!item) {
          send(socket, "You don't have that.");
          return;
        }
        const sellPrice = item.price != null ? Math.max(1, Math.floor(item.price / 2)) : 1;
        const equipMap = equipment.get(socket.id);
        const inSlot = equipMap && Object.entries(equipMap).find(([, id]) => id === item.id);
        if (inSlot) (equipMap as Record<string, string | undefined>)[inSlot[0]] = undefined;
        world.moveItemToRoom(item.id, 'shop-pool');
        const g = gold.get(socket.id) ?? 0;
        gold.set(socket.id, g + sellPrice);
        send(socket, `You sell ${item.name} for ${sellPrice} gold.`);
        recalcStats(socket.id);
        emitUpdateStats(socket);
        return;
      }

      case 'flee': {
        if (!combatStop.has(socket.id)) {
          send(socket, "You're not in combat.");
          return;
        }
        const room = world.getRoom(roomId);
        if (!room) {
          send(socket, "You are nowhere.");
          return;
        }
        const exitDirections = Object.keys(room.exits);
        if (exitDirections.length === 0) {
          send(socket, "There's nowhere to flee!");
          return;
        }
        if (Math.random() < 0.5) {
          const stop = combatStop.get(socket.id);
          if (stop) stop();
          combatStop.delete(socket.id);
          currentCombatMonsterId.delete(socket.id);
          const randomDir = exitDirections[Math.floor(Math.random() * exitDirections.length)]!;
          const result = tryGo(world, roomId, randomDir);
          if (result.success) {
            currentRoom.set(socket.id, result.room.id);
            send(socket, "You flee to safety!");
            const monsters = result.room.monsters?.filter((m) => m.isAlive) ?? [];
            const npcs = getNPCsInRoom(result.room.id);
            send(socket, formatRoomOutput(result.room, world.getItemsInRoom(result.room.id), monsters, npcs));
          } else {
            send(socket, "You failed to flee!");
          }
        } else {
          send(socket, "You failed to flee!");
        }
        return;
      }

      case 'unknown':
        send(
          socket,
          `Unknown command: "${parsed.input}". Type "help" for commands.`
        );
        break;
    }
  });

  socket.on('disconnect', async () => {
    const snapshot = buildSnapshot(socket.id);
    const stop = combatStop.get(socket.id);
    if (stop) stop();
    combatStop.delete(socket.id);
    currentCombatMonsterId.delete(socket.id);
    skillCooldowns.delete(socket.id);
    connectionState.delete(socket.id);
    playerName.delete(socket.id);
    currentRoom.delete(socket.id);
    playerState.delete(socket.id);
    equipment.delete(socket.id);
    gold.delete(socket.id);
    completedQuests.delete(socket.id);
    killCount.delete(socket.id);
    talkIndex.delete(socket.id);
    adminSet.delete(socket.id);
    if (snapshot) {
      try {
        await savePlayer(snapshot);
      } catch (err) {
        console.error('Save on disconnect failed:', err);
      }
    }
    console.log(`Client disconnected: ${socket.id}`);
  });
});

/** Regen tick: restore HP, Stamina, Energy for all online players */
setInterval(() => {
  for (const [socketId, state] of playerState) {
    regenerateStats(state);
    const s = io.sockets.sockets.get(socketId);
    if (s) {
      s.emit('hp', { current: state.hp, max: state.maxHp });
      s.emit('stamina', { current: state.stamina, max: state.maxStamina });
      s.emit('energy', { current: state.energy, max: state.maxEnergy });
      emitUpdateStats(s);
    }
  }
}, REGEN_TICK_MS);

/** Autosave: save every connected playing character every 60 seconds */
setInterval(async () => {
  for (const [socketId] of connectionState) {
    if (connectionState.get(socketId) !== 'PLAYING') continue;
    const snapshot = buildSnapshot(socketId);
    if (snapshot) {
      try {
        await savePlayer(snapshot);
      } catch (err) {
        console.error('Autosave failed for', socketId, err);
      }
    }
  }
}, AUTOSAVE_INTERVAL_MS);

// Start server
const PORT = process.env.PORT ?? 3000;
ensureDataDir()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`MUD server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to create data directory:', err);
    process.exit(1);
  });

export { io };
