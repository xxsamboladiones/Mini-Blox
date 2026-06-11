import type { GameMap, OnlineMapSummary } from "../types/OnlineMapSchema.js";

export type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
};

export type AuthSessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

export type OnlineMapRecord = {
  id: string;
  ownerUserId: string | null;
  legacyOwnerClientId: string | null;
  map: GameMap;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  playCount: number;
  likeCount: number;
};

export type OnlineMapSummaryWithOwnership = OnlineMapSummary & {
  ownerUserId: string | null;
  isOwner?: boolean;
  likedByCurrentUser?: boolean;
};

export type CreateMapInput = {
  id: string;
  ownerUserId: string;
  legacyOwnerClientId?: string | null;
  map: GameMap;
  creatorName: string;
  now: string;
};

export type LegacyMapImportInput = {
  id: string;
  ownerClientId: string;
  map: GameMap;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  playCount: number;
  likeCount: number;
};
