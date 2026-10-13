/** Mirrors the server DTO limits so the user sees why "save" is refused before a round-trip. */
export const validateParkForm = (form) => {
  const errors = {};
  const name = form.name.trim();
  const address = form.address.trim();
  if (name.length < 2) errors.name = 'نام شهرک را وارد کنید (حداقل ۲ حرف).';
  else if (name.length > 160) errors.name = 'نام شهرک حداکثر ۱۶۰ کاراکتر است.';
  if (!form.province) errors.province = 'استان را انتخاب کنید.';
  if (!form.city) errors.city = 'شهر را انتخاب کنید.';
  if (address.length < 2) errors.address = 'آدرس شهرک را وارد کنید.';
  else if (address.length > 240) errors.address = 'آدرس حداکثر ۲۴۰ کاراکتر است.';
  if (form.phoneNumber.length < 6) errors.phoneNumber = 'شماره تماس شهرک را وارد کنید (حداقل ۶ رقم).';
  if (form.guardPhone && form.guardPhone.length < 6) errors.guardPhone = 'شماره نگهبانی حداقل ۶ رقم است.';
  return errors;
};
