export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

type SessionData = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  storage: "local" | "session";
};

const ACCESS_TOKEN_KEY = "cmdmvp_access_token";
const REFRESH_TOKEN_KEY = "cmdmvp_refresh_token";
const USER_KEY = "cmdmvp_user";

function readFromStorage(storage: Storage, kind: "local" | "session"): SessionData | null {
  const accessToken = storage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
  const userRaw = storage.getItem(USER_KEY);

  if (!accessToken || !refreshToken || !userRaw) {
    return null;
  }

  try {
    const user = JSON.parse(userRaw) as SessionUser;
    if (!user?.id || !user?.email) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      user,
      storage: kind,
    };
  } catch {
    return null;
  }
}

export function getSession(): SessionData | null {
  if (typeof window === "undefined") {
    return null;
  }

  return readFromStorage(localStorage, "local") ?? readFromStorage(sessionStorage, "session");
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
