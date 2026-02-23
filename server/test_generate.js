const scheduler = require('./src/services/schedulerService');
scheduler.autoGenerate({ clearExisting: true, activeDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] })
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(console.error)
  .finally(() => process.exit(0));
