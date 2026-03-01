const registeredPollers = [];
let intervalIds = [];

function registerPoller(fn, intervalMs, name) {
  registeredPollers.push({ fn, intervalMs, name });
}

function startAll() {
  intervalIds = registeredPollers.map(({ fn, intervalMs, name }) => {
    console.log(`Starting poller: ${name} (every ${intervalMs}ms)`);
    fn();
    return setInterval(fn, intervalMs);
  });
}

function stopAll() {
  intervalIds.forEach(clearInterval);
  intervalIds = [];
}

module.exports = { registerPoller, startAll, stopAll };
