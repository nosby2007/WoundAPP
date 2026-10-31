module.exports = config => require('../karma.conf.js')({
  set: options => config.set({ ...options, port: 9877 }),
});
