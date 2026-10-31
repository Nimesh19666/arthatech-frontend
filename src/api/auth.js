import { api } from "./client";

const post = (path, body, auth = true) => api(path, { method: "POST", body, auth });

// ---- Before login (no Bearer token) ----
export const login = (email, password) => post("/auth/login", { email, password }, false);

export const changePasswordFirst = (stage_token, new_password) =>
  post("/auth/change-password-first", { stage_token, new_password }, false);

/** otp must be a STRING like "012345" */
export const selectProfile = (stage_token, profile_id, otp) =>
  post("/auth/select-profile", { stage_token, profile_id, ...(otp ? { otp } : {}) }, false);

/** "Resend code". Wait 60 seconds between sends. */
export const resendOtp = (stage_token) => post("/auth/2fa/setup", { stage_token }, false);

// ---- After login ----
export const me = () => api("/auth/me");

export const switchProfile = (refresh, profile_id, otp) =>
  post("/auth/switch-profile", { refresh, profile_id, ...(otp ? { otp } : {}) });

export const changePassword = (old_password, new_password) =>
  post("/auth/change-password", { old_password, new_password });

export const logout = (refresh) => post("/auth/logout", { refresh });
