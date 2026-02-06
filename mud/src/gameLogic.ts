import type { Room, Item, Monster } from './types';
import type { NPC } from './types';
import type { World } from './world';

/** Result of parsing a player command */
export type ParsedCommand =
  | { command: 'look' }
  | { command: 'go'; direction: string }
  | { command: 'say'; message: string }
  | { command: 'help' }
  | { command: 'attack'; target: string }
  | { command: 'flee' }
  | { command: 'get'; itemName: string }
  | { command: 'drop'; itemName: string }
  | { command: 'inventory' }
  | { command: 'equip'; itemName: string }
  | { command: 'unequip'; slotOrItem: string }
  | { command: 'talk'; npcName: string }
  | { command: 'list' }
  | { command: 'buy'; itemName: string }
  | { command: 'sell'; itemName: string }
  | { command: 'lever' }
  | { command: 'use'; skillName: string }
  | { command: 'cast'; skillName: string }
  | { command: 'save' }
  | { command: 'unknown'; input: string };

/** Direction aliases (e.g. "n" -> "north") */
const DIR_ALIASES: Record<string, string> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  ne: 'northeast',
  nw: 'northwest',
  se: 'southeast',
  sw: 'southwest',
  u: 'up',
  d: 'down',
};

function normalizeDirection(input: string): string {
  const key = input.toLowerCase().trim();
  return DIR_ALIASES[key] ?? (key.length > 1 ? key : key);
}

/**
 * Parse raw input into a structured command.
 * Understands: look, go [direction], say [message], help.
 */
export function parseCommand(line: string): ParsedCommand {
  const trimmed = (line ?? '').trim();
  if (!trimmed) {
    return { command: 'unknown', input: trimmed };
  }

  const lower = trimmed.toLowerCase();
  const parts = trimmed.split(/\s+/);

  // look (or l)
  if (lower === 'look' || lower === 'l') {
    return { command: 'look' };
  }

  // help
  if (lower === 'help' || lower === 'h' || lower === '?') {
    return { command: 'help' };
  }

  // attack [monster name] / fight [monster name]
  if (parts[0]?.toLowerCase() === 'attack' || parts[0]?.toLowerCase() === 'fight' || lower === 'a' || lower === 'f') {
    const target = (parts[0]?.toLowerCase() === 'attack' || parts[0]?.toLowerCase() === 'fight')
      ? parts.slice(1).join(' ').trim()
      : (parts.slice(1).join(' ').trim() || '');
    return { command: 'attack', target };
  }

  // flee
  if (lower === 'flee' || lower === 'run') {
    return { command: 'flee' };
  }

  // get / take [item]
  if (parts[0]?.toLowerCase() === 'get' || parts[0]?.toLowerCase() === 'take') {
    const itemName = parts.slice(1).join(' ').trim();
    if (!itemName) return { command: 'unknown', input: trimmed };
    return { command: 'get', itemName };
  }

  // drop [item]
  if (parts[0]?.toLowerCase() === 'drop') {
    const itemName = parts.slice(1).join(' ').trim();
    if (!itemName) return { command: 'unknown', input: trimmed };
    return { command: 'drop', itemName };
  }

  // inventory / inv
  if (lower === 'inventory' || lower === 'inv' || lower === 'i') {
    return { command: 'inventory' };
  }

  // equip [item]
  if (parts[0]?.toLowerCase() === 'equip') {
    const itemName = parts.slice(1).join(' ').trim();
    if (!itemName) return { command: 'unknown', input: trimmed };
    return { command: 'equip', itemName };
  }

  // unequip [item or slot]
  if (parts[0]?.toLowerCase() === 'unequip') {
    const slotOrItem = parts.slice(1).join(' ').trim();
    if (!slotOrItem) return { command: 'unknown', input: trimmed };
    return { command: 'unequip', slotOrItem };
  }

  // talk [npc]
  if (parts[0]?.toLowerCase() === 'talk') {
    const npcName = parts.slice(1).join(' ').trim();
    if (!npcName) return { command: 'unknown', input: trimmed };
    return { command: 'talk', npcName };
  }

  // list (shop)
  if (lower === 'list') {
    return { command: 'list' };
  }

  // buy [item]
  if (parts[0]?.toLowerCase() === 'buy') {
    const itemName = parts.slice(1).join(' ').trim();
    if (!itemName) return { command: 'unknown', input: trimmed };
    return { command: 'buy', itemName };
  }

  // sell [item]
  if (parts[0]?.toLowerCase() === 'sell') {
    const itemName = parts.slice(1).join(' ').trim();
    if (!itemName) return { command: 'unknown', input: trimmed };
    return { command: 'sell', itemName };
  }

  // pull lever / lever (Arena)
  if (lower === 'lever' || lower === 'pull lever' || (parts[0]?.toLowerCase() === 'pull' && parts[1]?.toLowerCase() === 'lever')) {
    return { command: 'lever' };
  }

  // use [skill] / cast [skill]
  if (parts[0]?.toLowerCase() === 'use' || parts[0]?.toLowerCase() === 'cast') {
    const skillName = parts.slice(1).join(' ').trim();
    if (!skillName) return { command: 'unknown', input: trimmed };
    return { command: 'use', skillName };
  }

  // save
  if (lower === 'save') {
    return { command: 'save' };
  }

  // go [direction]
  if (parts[0]?.toLowerCase() === 'go') {
    const dir = parts.slice(1).join(' ');
    if (!dir) {
      return { command: 'unknown', input: trimmed };
    }
    return { command: 'go', direction: normalizeDirection(dir) };
  }

  // say [message]
  if (parts[0]?.toLowerCase() === 'say') {
    const message = parts.slice(1).join(' ');
    return { command: 'say', message };
  }

  // Bare direction (e.g. "north") treated as "go north"
  const asDir = normalizeDirection(trimmed);
  if (asDir && trimmed.length <= 12) {
    return { command: 'go', direction: asDir };
  }

  return { command: 'unknown', input: trimmed };
}

/**
 * Try to move from current room in the given direction.
 * Returns the new room if the exit exists, otherwise an error.
 */
export function tryGo(
  world: World,
  currentRoomId: string,
  direction: string
): { success: true; room: Room } | { success: false; error: string } {
  const room = world.getRoom(currentRoomId);
  if (!room) {
    return { success: false, error: "You are nowhere. (Room data missing.)" };
  }

  const normalizedDir = normalizeDirection(direction);
  const nextRoomId = room.exits[normalizedDir];
  if (!nextRoomId) {
    return { success: false, error: "You can't go that way." };
  }

  const nextRoom = world.getRoom(nextRoomId);
  if (!nextRoom) {
    return { success: false, error: "You can't go that way." };
  }

  return { success: true, room: nextRoom };
}

/**
 * Format current room for display: name, description, NPCs, items, monsters, and exits.
 */
export function formatRoomOutput(
  room: Room,
  items: Item[] = [],
  monsters: Monster[] = [],
  npcs: NPC[] = []
): string {
  const lines: string[] = ['', room.name, room.description, ''];
  if (npcs.length > 0) {
    lines.push('NPCs here: ' + npcs.map((n) => n.name).join(', ') + '.');
    lines.push('');
  }
  const aliveMonsters = monsters.filter((m) => m.isAlive);
  if (aliveMonsters.length > 0) {
    lines.push('Monsters here: ' + aliveMonsters.map((m) => m.name).join(', ') + '.');
    lines.push('');
  }
  if (items.length > 0) {
    lines.push('You see: ' + items.map((i) => i.name).join(', ') + '.');
    lines.push('');
  }
  const exitList = Object.keys(room.exits).join(', ');
  if (exitList) {
    lines.push(`Exits: ${exitList}`);
  }
  return lines.join('\n');
}

/**
 * Format shop inventory for display (list command).
 */
export function formatShopList(entries: { itemName: string; price: number }[]): string {
  if (entries.length === 0) return '\nThe shop has nothing for sale.\n';
  const lines = ['', 'For sale:', ...entries.map((e) => `  ${e.itemName} - ${e.price} gold`), ''];
  return lines.join('\n');
}

/**
 * Format inventory list for display.
 */
export function formatInventory(items: Item[]): string {
  if (items.length === 0) {
    return '\nYou are not carrying anything.\n';
  }
  return '\nYou are carrying: ' + items.map((i) => i.name).join(', ') + '.\n';
}

/**
 * Help text shown for the 'help' command.
 */
export function getHelpText(): string {
  return [
    '',
    'Commands:',
    '  look, l       - Show room description, NPCs, monsters, items, and exits.',
    '  go <dir>, n/s/e/w  - Move in a direction (e.g. go north, n).',
    '  get/take <item> - Pick up an item from the room.',
    '  drop <item>   - Drop an item in the current room.',
    '  inv, i        - List items you are carrying.',
    '  equip <item>  - Equip a weapon or piece of gear.',
    '  unequip <item/slot> - Remove equipped item.',
    '  talk <npc>    - Talk to an NPC (quests, dialogue).',
    '  list          - List items for sale (when near a merchant).',
    '  buy <item>    - Buy an item from a merchant.',
    '  sell <item>   - Sell an item to a merchant.',
    '  say <msg>     - Say something to everyone in the same room.',
    '  attack <name> - Attack a monster by name (e.g. attack goblin).',
    '  flee, run     - Try to escape combat (50% chance, random adjacent room).',
    '  lever         - (Arena only) Pull the lever to spawn a random monster.',
    '  use/cast <skill> - Use a skill in combat (e.g. use heavy strike).',
    '  save           - Save your game.',
    '  help, h, ?    - Show this help.',
    '',
  ].join('\n');
}
