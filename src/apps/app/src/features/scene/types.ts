import type { components } from '@/api/schema';

export type SceneAction = components['schemas']['SceneActionDto'];
export type SceneDetail = components['schemas']['SceneDetail'];
export type Participant = components['schemas']['SceneParticipantDto'];
export type Character = components['schemas']['CharacterDto'];
export type Presence = { userId: string; userName: string };

export const EMOJIS = [
  '😀', '😂', '🥲', '😊', '😍', '😘', '😎', '🤔', '😏', '😳', '😢', '😭', '😡', '🤬', '😱', '🥺',
  '😴', '🤯', '🥳', '😈', '👀', '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '❤️', '💔', '🔥', '✨',
  '⭐', '🌙', '☀️', '⚡', '❄️', '🌹', '🍷', '🍺', '⚔️', '🛡️', '🏹', '🗡️', '🔮', '📜', '👑', '💀',
];
