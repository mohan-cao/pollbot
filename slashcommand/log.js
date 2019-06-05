module.exports = function(dev, console) {
  if (dev === 'development') return console;
  return {
    log: () => {},
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
  }
}