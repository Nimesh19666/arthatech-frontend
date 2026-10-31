// Always react to error.code, never to the message text.

const MESSAGES = {
  invalid_credentials: "Wrong email or password.",
  locked: "This account is locked. Try again in 15 minutes, or ask an admin.",
  password_change_required: "You must change your password first.",
  stage_invalid: "Your login step expired. Please sign in again.",
  token_invalid: "Your session ended. Please sign in again.",
  profile_unavailable: "That role cannot be used right now.",
  no_access: "You have no active role. Please contact your admin.",
  bad_otp: "That code is wrong. Check your email and try again.",
  otp_wait: "Please wait a minute before asking for a new code.",
  otp_send_failed: "We could not send the email. Please try again shortly.",
  bad_password: "Your current password is wrong.",
  not_authenticated: "Please sign in.",
  permission_denied: "You are not allowed to do this.",
  not_found: "Not found.",
  conflict: "This already exists.",
  too_many_requests: "Too many requests. Please slow down.",
  server_error: "Something went wrong on our side. Please try again.",
  network_error: "Cannot reach the server. Check your connection.",
};

const hasFields = (e) => e && e.fields && Object.keys(e.fields).length > 0;

export function errorText(e) {
  if (!e) return "";
  if (e.code === "validation_error") {
    // Field errors are shown under each input. Without fields, show the server text.
    return hasFields(e) ? "Please fix the highlighted fields." : e.message || "Invalid data.";
  }
  // Unknown codes (for example "delete blocked" 400s) show the server's plain text.
  return MESSAGES[e.code] || e.message || MESSAGES.server_error;
}

/** First error message for one input, from error.fields */
export function fieldError(e, name) {
  const v = e?.fields?.[name];
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : String(v);
}
