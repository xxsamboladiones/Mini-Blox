export type AvatarColors = {
  head: string;
  body: string;
  arms: string;
  legs: string;
};

export type LocalProfile = {
  displayName: string;
  bio: string;
  avatarColors: AvatarColors;
  createdAt: string;
  updatedAt: string;
};

export type LocalProfilePatch = Partial<{
  displayName: string;
  bio: string;
  avatarColors: Partial<AvatarColors>;
}>;

const PROFILE_KEY = "mini-blox-profile";
const DEFAULT_DISPLAY_NAME = "Criador";
const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_BIO_LENGTH = 180;

export const DEFAULT_AVATAR_COLORS: AvatarColors = {
  head: "#f2c49b",
  body: "#3b82f6",
  arms: "#f2c49b",
  legs: "#1f2937"
};

export const LocalProfileStorage = {
  getProfile(): LocalProfile {
    const storedProfile = readProfile();

    if (storedProfile) {
      return storedProfile;
    }

    const profile = createDefaultProfile();
    writeProfile(profile);
    return profile;
  },

  saveProfile(patch: LocalProfilePatch): LocalProfile {
    const current = this.getProfile();
    const next: LocalProfile = {
      ...current,
      displayName: normalizeDisplayName(patch.displayName ?? current.displayName),
      bio: normalizeBio(patch.bio ?? current.bio),
      avatarColors: normalizeAvatarColors(patch.avatarColors, current.avatarColors),
      updatedAt: new Date().toISOString()
    };

    writeProfile(next);
    return next;
  },

  getDisplayName(): string {
    return this.getProfile().displayName;
  },

  isCreatorNameFromProfile(creatorName: string | undefined, profile?: LocalProfile): boolean {
    const activeProfile = profile ?? LocalProfileStorage.getProfile();
    return normalizeCreatorName(creatorName) === normalizeCreatorName(activeProfile.displayName);
  }
};

export function normalizeCreatorName(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function createDefaultProfile(): LocalProfile {
  const now = new Date().toISOString();

  return {
    displayName: DEFAULT_DISPLAY_NAME,
    bio: "",
    avatarColors: { ...DEFAULT_AVATAR_COLORS },
    createdAt: now,
    updatedAt: now
  };
}

function readProfile(): LocalProfile | null {
  const raw = readProfileRaw();

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizeProfile(parsed);
  } catch {
    return null;
  }
}

function normalizeProfile(value: unknown): LocalProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    displayName: normalizeDisplayName(value.displayName),
    bio: normalizeBio(value.bio),
    avatarColors: normalizeAvatarColors(
      isRecord(value.avatarColors) ? value.avatarColors : undefined,
      DEFAULT_AVATAR_COLORS
    ),
    createdAt: typeof value.createdAt === "string" && value.createdAt.trim()
      ? value.createdAt
      : now,
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt.trim()
      ? value.updatedAt
      : now
  };
}

function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_DISPLAY_NAME;
  }

  const normalized = value.trim().replace(/\s+/g, " ").slice(0, MAX_DISPLAY_NAME_LENGTH);
  return normalized || DEFAULT_DISPLAY_NAME;
}

function normalizeBio(value: unknown): string {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_BIO_LENGTH)
    : "";
}

function normalizeAvatarColors(
  patch: unknown,
  fallback: AvatarColors
): AvatarColors {
  const colors = isRecord(patch) ? patch : {};

  return {
    head: normalizeColor(colors.head, fallback.head),
    body: normalizeColor(colors.body, fallback.body),
    arms: normalizeColor(colors.arms, fallback.arms),
    legs: normalizeColor(colors.legs, fallback.legs)
  };
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}

function readProfileRaw(): string | null {
  try {
    return globalThis.localStorage?.getItem(PROFILE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeProfile(profile: LocalProfile): void {
  try {
    globalThis.localStorage?.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage pode estar indisponivel em alguns ambientes embutidos.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
