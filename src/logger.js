function ts() {
  return new Date().toISOString();
}

function log(level, ...args) {
  console.log(`[${ts()}] [${level}]`, ...args);
}

const debug = process.env.DEBUG === 'true';

module.exports = {
  info: (...args) => log('INFO', ...args),
  warn: (...args) => log('WARN', ...args),
  error: (...args) => log('ERROR', ...args),
  debug: (...args) => {
    if (debug) log('DEBUG', ...args);
  },
};
