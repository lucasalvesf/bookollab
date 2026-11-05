import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import { useEffect, useRef, useState } from 'react';

import { API_URL, validAccessToken } from '@/api/client';
import type { components } from '@/api/schema';

type SceneAction = components['schemas']['SceneActionDto'];
type Participant = components['schemas']['SceneParticipantDto'];
// Hub-only payloads (not part of the REST OpenAPI document); mirror PresenceDto/TypingDto in SceneContracts.cs.
type Presence = { userId: string; userName: string };
type Typing = { sceneId: string; userId: string; characterName: string };

export type SceneRealtimeHandlers = {
  onActionCreated: (action: SceneAction) => void;
  onActionUpdated: (action: SceneAction) => void;
  onActionDeleted: (actionId: string) => void;
  onParticipantJoined: (participant: Participant) => void;
  onSceneClosed: () => void;
};

const TYPING_VISIBLE_MS = 4000;
const TYPING_THROTTLE_MS = 2000;

/**
 * Subscribes to a scene over SignalR: live actions, presence (who is online) and "typing".
 * Reconnects automatically and re-subscribes after reconnecting.
 */
export function useSceneRealtime(sceneId: string | undefined, handlers: SceneRealtimeHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const connectionRef = useRef<HubConnection | null>(null);
  const lastTypingSent = useRef(0);
  const [online, setOnline] = useState<Presence[]>([]);
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sceneId) return;
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/scenes`, { accessTokenFactory: async () => (await validAccessToken()) ?? '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connectionRef.current = connection;

    connection.on('ActionCreated', (a: SceneAction) => {
      handlersRef.current.onActionCreated(a);
      setTyping((t) => {
        const { [a.authorUserId]: _, ...rest } = t;
        return rest;
      });
    });
    connection.on('ActionUpdated', (a: SceneAction) => handlersRef.current.onActionUpdated(a));
    connection.on('ActionDeleted', (id: string) => handlersRef.current.onActionDeleted(id));
    connection.on('ParticipantJoined', (p: Participant) => handlersRef.current.onParticipantJoined(p));
    connection.on('SceneClosed', () => handlersRef.current.onSceneClosed());
    connection.on('Presence', (_scene: string, list: Presence[]) => setOnline(list));
    connection.on('Typing', (t: Typing) =>
      setTyping((current) => ({ ...current, [t.userId]: { name: t.characterName, until: Date.now() + TYPING_VISIBLE_MS } })),
    );

    const subscribe = () => connection.invoke('JoinScene', sceneId);
    connection.onreconnected(() => {
      setConnected(true);
      void subscribe();
    });
    connection.onreconnecting(() => setConnected(false));
    connection.onclose(() => setConnected(false));

    let cancelled = false;
    connection
      .start()
      .then(() => (cancelled ? undefined : subscribe()))
      .then(() => !cancelled && setConnected(true))
      .catch(() => !cancelled && setConnected(false));

    return () => {
      cancelled = true;
      connectionRef.current = null;
      void connection.stop();
    };
  }, [sceneId]);

  // Expire "typing" indicators.
  useEffect(() => {
    const timer = setInterval(() => {
      setTyping((current) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(current).filter(([, v]) => v.until > now));
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /** Tells the others "typing…" (throttled). */
  function notifyTyping(characterId: string) {
    const connection = connectionRef.current;
    if (!sceneId || !connection || connection.state !== HubConnectionState.Connected) return;
    if (Date.now() - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = Date.now();
    void connection.invoke('Typing', sceneId, characterId).catch(() => undefined);
  }

  return { online, typingNames: Object.values(typing).map((t) => t.name), connected, notifyTyping };
}
