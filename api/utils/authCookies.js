/**
 * Cookie options for `accessToken`.
 * Login setCookie and logout clearCookie must use the same flags
 * or browsers will not clear the cookie.
 *
 * Production / COOKIE_SECURE=true: SameSite=None + Secure (cross-origin HTTPS clients).
 * Local HTTP: SameSite=Lax + Secure=false. Prefer Authorization: Bearer for
 * cross-origin localhost (e.g. Vite :5173 → API :8000) when cookies are blocked.
 */
export const getAccessTokenCookieOptions = () => {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  };
};
