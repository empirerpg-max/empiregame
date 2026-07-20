declare namespace YT {
  interface Player {
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    loadVideoById(id: string): void;
    cueVideoById(id: string): void;
    destroy(): void;
    getPlayerState(): number;
    [key: string]: unknown;
  }
}
