import { toAsciiDigits } from './digits';

export const isMobileNumber = (value) => /^0?9\d{9}$/.test(toAsciiDigits(value).trim());

/** Builds the PUT /sms/settings body: an empty API key field is omitted so the stored key is kept. */
export const buildSmsSettingsPayload = (form) => {
  const payload = {
    provider: form.provider,
    melipayamakUsername: form.username.trim(),
    melipayamakSender: toAsciiDigits(form.sender).trim(),
    melipayamakOtpBodyId: toAsciiDigits(form.otpBodyId).trim(),
  };
  if (form.password.trim()) payload.melipayamakPassword = form.password.trim();
  return payload;
};
