/** Platform-independent ports. Native SDKs implement these contracts. */
export interface PlatformAdapter {
  readonly id: string;
  readonly contractVersion: 1;
  readonly capabilities: { cloudSave: boolean; crossPlay: boolean; commerce: boolean };
  clock: { now(): number; monotonic(): number };
  storage: { read(key: string): Promise<string | null>; write(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };
  network: { request(request: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; body: string }> };
  identity: { current(): Promise<{ playerId: string; provider: string } | null> };
  lifecycle: { subscribe(listener: (state: 'active' | 'suspended') => void): () => void };
  input: { subscribe(listener: (action: { action: string; pressed: boolean }) => void): () => void };
  locale: { language: string; timeZone: string };
}
/** A backend uses a game-independent account ID, not a storefront account ID. */
export interface CloudSavePort {
  read(gameId: string, slotId: string): Promise<unknown>;
  write(gameId: string, slotId: string, expectedRevision: number, document: unknown): Promise<{ revision: number }>;
}
export interface MatchmakingPort {
  join(request: { gameId: string; protocolVersion: number; contentVersion: string; region: string; inputPool?: string }): Promise<{ sessionId: string }>;
}
