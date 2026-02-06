import type { Monster } from './types';
import { ClassType } from './types';
import { getSkillLearnedAtLevel } from './skills';

/** Monster templates for /spawn and arena lever (id will be generated) */
export const MONSTER_TEMPLATES: Record<string, Omit<Monster, 'id'>> = {
  goblin: {
    name: 'Grumpy Goblin',
    description: 'A small, green-skinned creature clutching a rusty dagger.',
    hp: 20,
    maxHp: 20,
    attack: 3,
    isAlive: true,
    lootTable: ['goblin-dagger'],
    xpReward: 15,
  },
  skeleton: {
    name: 'Drowned Skeleton',
    description: 'A skeletal figure with bones clacking.',
    hp: 15,
    maxHp: 15,
    attack: 2,
    isAlive: true,
    lootTable: ['rotten-bone'],
    xpReward: 10,
  },
  spider: {
    name: 'Cave Spider',
    description: 'A large spider with glossy black legs.',
    hp: 12,
    maxHp: 12,
    attack: 4,
    isAlive: true,
    lootTable: ['spider-fang'],
    xpReward: 12,
  },
  dragon: {
    name: 'Dragon',
    description: 'A fearsome dragon with scales and fiery breath.',
    hp: 80,
    maxHp: 80,
    attack: 15,
    isAlive: true,
    lootTable: ['goblin-dagger', 'spider-fang'],
    xpReward: 100,
  },
};

export function getRandomMonsterTemplate(): { key: string; monster: Omit<Monster, 'id'> } {
  const keys = Object.keys(MONSTER_TEMPLATES);
  const key = keys[Math.floor(Math.random() * keys.length)]!;
  return { key, monster: MONSTER_TEMPLATES[key]! };
}

export function createMonsterFromTemplate(templateKey: string, uniqueId?: string): Monster | null {
  const t = MONSTER_TEMPLATES[templateKey];
  if (!t) return null;
  const id = uniqueId ?? `spawn-${templateKey}-${Date.now()}`;
  return {
    id,
    name: t.name,
    description: t.description,
    hp: t.hp,
    maxHp: t.maxHp,
    attack: t.attack,
    isAlive: true,
    lootTable: t.lootTable ? [...t.lootTable] : undefined,
    xpReward: t.xpReward,
  };
}

export interface AdminContext {
  world: { getRoom: (id: string) => { id: string; name: string; monsters?: Monster[] } | undefined; addMonsterToRoom: (roomId: string, m: Monster) => void };
  currentRoom: Map<string, string>;
  playerState: Map<string, { hp: number; maxHp: number; stamina: number; maxStamina: number; energy: number; maxEnergy: number; level: number; xp: number; godMode: boolean; class: ClassType; skills: string[] }>;
  gold: Map<string, number>;
  adminSet: Set<string>;
  send: (socket: import('socket.io').Socket, text: string) => void;
  socket: import('socket.io').Socket;
  recalcStats: (socketId: string) => void;
  emitUpdateStats: (socket: import('socket.io').Socket) => void;
  /** Called after /tp so server can send room description */
  onTeleport?: (socketId: string, roomId: string) => void;
  /** Called when player levels up (so server can grant skills) */
  onLevelUp?: (socketId: string, newLevel: number) => void;
}

function xpToNextLevel(level: number): number {
  return level * 100;
}

function processLevelUps(socketId: string, ctx: AdminContext): void {
  const state = ctx.playerState.get(socketId);
  if (!state) return;
  while (state.xp >= xpToNextLevel(state.level)) {
    state.xp -= xpToNextLevel(state.level);
    state.level++;
    ctx.recalcStats(socketId);
    ctx.onLevelUp?.(socketId, state.level);
  }
}

export function handleAdminCommand(socketId: string, line: string, ctx: AdminContext): string | null {
  if (!line.startsWith('/')) return null;
  if (!ctx.adminSet.has(socketId)) return 'Access denied.';

  const parts = line.slice(1).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const arg = parts.slice(1).join(' ').trim();

  const roomId = ctx.currentRoom.get(socketId);
  const state = ctx.playerState.get(socketId);

  switch (cmd) {
    case 'spawn': {
      if (!arg) return 'Usage: /spawn <monsterName> (e.g. goblin, dragon, spider, skeleton).';
      if (!roomId) return 'You are nowhere.';
      const templateKey = Object.keys(MONSTER_TEMPLATES).find((k) => k.toLowerCase().includes(arg.toLowerCase()) || arg.toLowerCase().includes(k));
      if (!templateKey) return `Unknown monster. Try: ${Object.keys(MONSTER_TEMPLATES).join(', ')}`;
      const monster = createMonsterFromTemplate(templateKey);
      if (!monster) return 'Failed to spawn.';
      ctx.world.addMonsterToRoom(roomId, monster);
      return `${monster.name} has been spawned here.`;
    }
    case 'xp': {
      const amount = parseInt(arg, 10);
      if (!state || isNaN(amount) || amount < 0) return 'Usage: /xp <amount> (e.g. /xp 1000).';
      state.xp += amount;
      processLevelUps(socketId, ctx);
      ctx.emitUpdateStats(ctx.socket);
      return `Granted ${amount} XP. Level ${state.level}, ${state.xp}/${xpToNextLevel(state.level)} to next.`;
    }
    case 'gold': {
      const amount = parseInt(arg, 10);
      if (isNaN(amount) || amount < 0) return 'Usage: /gold <amount> (e.g. /gold 1000).';
      const g = ctx.gold.get(socketId) ?? 0;
      ctx.gold.set(socketId, g + amount);
      ctx.emitUpdateStats(ctx.socket);
      return `Granted ${amount} gold. You now have ${g + amount} gold.`;
    }
    case 'god': {
      if (!state) return 'No state.';
      state.godMode = !state.godMode;
      return state.godMode ? 'God mode ON. HP will not drop below 1.' : 'God mode OFF.';
    }
    case 'fullheal': {
      if (!state) return 'No state.';
      state.hp = state.maxHp;
      state.stamina = state.maxStamina;
      state.energy = state.maxEnergy;
      ctx.socket.emit('hp', { current: state.hp, max: state.maxHp });
      ctx.socket.emit('stamina', { current: state.stamina, max: state.maxStamina });
      ctx.socket.emit('energy', { current: state.energy, max: state.maxEnergy });
      ctx.emitUpdateStats(ctx.socket);
      return 'HP, Stamina, and Energy restored to max.';
    }
    case 'tp': {
      if (!arg) return 'Usage: /tp <roomID> (e.g. /tp arena, /tp town-square).';
      const room = ctx.world.getRoom(arg);
      if (!room) return `Room not found: ${arg}.`;
      ctx.currentRoom.set(socketId, room.id);
      ctx.onTeleport?.(socketId, room.id);
      return `Teleported to ${room.name} (${room.id}).`;
    }
    case 'class': {
      if (!state) return 'No state.';
      const classArg = arg.toLowerCase();
      const classMap: Record<string, ClassType> = {
        warrior: ClassType.WARRIOR,
        mage: ClassType.MAGE,
        rogue: ClassType.ROGUE,
      };
      const newClass = classMap[classArg];
      if (!newClass) return 'Usage: /class <warrior|mage|rogue>.';
      state.class = newClass;
      state.skills.length = 0;
      ctx.recalcStats(socketId);
      for (const lvl of [1, 3, 5]) {
        if (lvl <= state.level) {
          const skillId = getSkillLearnedAtLevel(lvl, state.class);
          if (skillId) state.skills.push(skillId);
        }
      }
      state.hp = state.maxHp;
      state.stamina = state.maxStamina;
      state.energy = state.maxEnergy;
      ctx.socket.emit('hp', { current: state.hp, max: state.maxHp });
      ctx.socket.emit('stamina', { current: state.stamina, max: state.maxStamina });
      ctx.socket.emit('energy', { current: state.energy, max: state.maxEnergy });
      ctx.emitUpdateStats(ctx.socket);
      return `Class changed to ${state.class}. Stats and skills reset.`;
    }
    case 'help': {
      return [
        'Admin commands:',
        '  /spawn <name> - Spawn monster (goblin, skeleton, spider, dragon)',
        '  /xp <amount>  - Grant XP (level up at level*100)',
        '  /gold <amount> - Grant gold',
        '  /god          - Toggle god mode (HP never below 1)',
        '  /fullheal     - Restore HP/Stamina/Energy to max',
        '  /tp <roomID>  - Teleport (e.g. arena, town-square)',
        '  /class <name> - Change class (warrior, mage, rogue). Resets stats & skills.',
      ].join('\n');
    }
    default:
      return 'Unknown admin command. Type /help for list.';
  }
}
