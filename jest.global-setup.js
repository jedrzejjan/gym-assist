// Runs once before Jest starts its workers, so they inherit this time zone.
// CI runs in UTC; local-date tests need a zone that is not UTC.
module.exports = async () => {
  process.env.TZ = 'Europe/Warsaw';
};
