const formatLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const localToday = () => formatLocalDate(new Date());

export const localDateAfter = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
};
